/** Editorial cleanup with original payload backups, stable fragments and literal metadata evidence. */
import {createHash} from "node:crypto";
import {readFile,writeFile,mkdir,copyFile,rename,access} from "node:fs/promises";
import {dirname,join,relative,resolve,isAbsolute,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {gzipSync,gunzipSync} from "node:zlib";
import assert from "node:assert/strict";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const sha=value=>createHash("sha256").update(value).digest("hex");
const pathOf=path=>{const full=resolve(root,path),local=relative(root,full);if(isAbsolute(local)||local===".."||local.startsWith(`..${sep}`))throw new Error(`Unsafe path: ${path}`);return full;};
const json=async path=>JSON.parse(await readFile(pathOf(path),"utf8"));
const cp1252={128:"€",130:"‚",131:"ƒ",132:"„",133:"…",134:"†",135:"‡",136:"ˆ",137:"‰",138:"Š",139:"‹",140:"Œ",142:"Ž",145:"‘",146:"’",147:"“",148:"”",149:"•",150:"–",151:"—",152:"˜",153:"™",154:"š",155:"›",156:"œ",158:"ž",159:"Ÿ"};
const legacy=new Map(Object.entries(cp1252).map(([byte,char])=>[char,Number(byte)]));
const ligatures={"ﬀ":"ff","ﬁ":"fi","ﬂ":"fl","ﬃ":"ffi","ﬄ":"ffl","ﬅ":"st","ﬆ":"st"};
const decoder=new TextDecoder("utf-8",{fatal:true});
function chars(text,counts={},depth=0){
  let result="";
  for(let i=0;i<text.length;i++){
    const char=text[i],lead=legacy.get(char)??char.charCodeAt(0),size=lead>=194&&lead<=223?2:lead>=224&&lead<=239?3:lead>=240&&lead<=244?4:0;
    if(size){const bytes=[lead];for(let j=1;j<size;j++){const next=text[i+j],byte=next===undefined?-1:(legacy.get(next)??next.charCodeAt(0));if(byte<128||byte>191)break;bytes.push(byte);}if(bytes.length===size)try{const decoded=decoder.decode(Uint8Array.from(bytes));if(!/[\u0000-\u001f\u007f-\u009f]/.test(decoded)){result+=decoded;i+=size-1;counts.reversibleMojibake=(counts.reversibleMojibake||0)+1;continue;}}catch{}}
    if(cp1252[char.charCodeAt(0)]){result+=cp1252[char.charCodeAt(0)];counts.c1Typography=(counts.c1Typography||0)+1;}
    else if(ligatures[char]){result+=ligatures[char];counts.ocrLigatures=(counts.ocrLigatures||0)+1;}
    else if(char==="\u00a0"){result+=" ";counts.nonBreakingSpace=(counts.nonBreakingSpace||0)+1;}
    else if(char==="\u00ad"){counts.softHyphen=(counts.softHyphen||0)+1;}
    else result+=char;
  }
  return result!==text&&depth<4?chars(result,counts,depth+1):result;
}
const scalar=value=>{let s=value.trim();if(/^"[\s\S]*"$|^\[[\s\S]*\]$/.test(s))try{return JSON.parse(s);}catch{}if(/^'[\s\S]*'$/.test(s))return s.slice(1,-1).replace(/''/g,"'");if(/^(?:null|none|unknown|n\/a|--|~)$/i.test(s))return null;return s;};
const knownKeys=new Set("title author authors saint book_title book_id book_group original_title original_numbers original_number catalog_number source source_url source_index language original_format document_type institution publication_year publication_date year extracted_at document_role updated_at notebooklm_grouped_source integrity_note description translator translation rights license complete".split(" "));
function yamlFields(raw){const fields={};for(const line of raw.split("\n")){const match=line.match(/^([A-Za-z_][\w.-]*):\s*(.*)$/);if(match)fields[match[1]]=scalar(match[2]);}return fields;}
function yamlBlock(lines,start){
  if(!/^---[ \t]*$/.test(lines[start]))return null;
  let end=start+1;while(end<Math.min(lines.length,start+120)&&!/^---[ \t]*$/.test(lines[end]))end++;
  if(end>=lines.length||end>=start+120)return null;
  const body=lines.slice(start+1,end),fields=yamlFields(body.join("\n")),keys=Object.keys(fields);
  if(keys.length<2||!keys.some(k=>knownKeys.has(k))||body.some(l=>l.trim()&&!/^(?:[A-Za-z_][\w.-]*:|[ \t]+|#)/.test(l)))return null;
  return {end,fields,raw:lines.slice(start,end+1).join("\n")};
}
const fenceStart=line=>line.match(/^\s{0,3}(`{3,}|~{3,})/);
const labels=/^(#{1,6})\s+(Title|Author|Year|Language):\s+(.+?)\s*#*\s*$/i;
function proseLine(line,counts){
  // Inline code, destinations and bare URLs are not rewritten as prose.
  return line.split(/(`+[^`]*`+|\]\([^\n)]*\)|https?:\/\/[^\s<>]+)/g).map((part,i)=>{
    if(i%2)return part;
    let value=/[\u0080-\u009f\u00a0\u00ad\u00c2-\u00f4\ufb00-\ufb06]/.test(part)?chars(part,counts):part;
    value=value.replace(/&(?:nbsp|#160|#x[aA]0);/g,()=>{counts.htmlSpaces=(counts.htmlSpaces||0)+1;return " ";});
    value=value.replace(/&(quot|apos|#34|#39);/g,(raw,key)=>{counts.htmlPunctuation=(counts.htmlPunctuation||0)+1;return key==="quot"||key==="#34"?'"':"'";});
    value=value.replace(/<br\s*\/?\s*>/gi,()=>{counts.htmlBreaks=(counts.htmlBreaks||0)+1;return "  \n";});
    value=value.replace(/<\/?(?:strong|b)>/gi,()=>{counts.htmlEmphasis=(counts.htmlEmphasis||0)+1;return "**";}).replace(/<\/?(?:em|i)>/gi,()=>{counts.htmlEmphasis=(counts.htmlEmphasis||0)+1;return "*";});
    value=value.replace(/(\^\d+\^)([.,;:!?]?)\^{2,}/g,(_,mark,punctuation)=>{counts.redundantFootnoteCarets=(counts.redundantFootnoteCarets||0)+1;return mark+punctuation;});
    value=value.replace(/(?<=[\p{L}\p{N}]) {2}(?=[\p{L}\p{N}])/gu,()=>{counts.doubleWordSpaces=(counts.doubleWordSpaces||0)+1;return " ";});
    return value;
  }).join("");
}
function formatChunk(input){
  const candidate=/\r|\uFEFF|[\u0080-\u009f\u00a0\u00ad\ufb00-\ufb06]|[\u00c2-\u00f4][\u0080-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]|^---[ \t]*$|^#{1,6}\s+(?:Title|Author|Year|Language):|[\p{L}\p{N}] {2}[\p{L}\p{N}]|[ \t]+$|\n\n\n\n|<(?:br|\/?strong|\/?em|\/?b|\/?i)\b|&(?:nbsp|quot|apos|#160|#34|#39|#x[aA]0);|\^\d+\^[.,;:!?]?\^{2,}|^\|.*\||^\s{0,3}(?:`{3,}|~{3,})/mu;
  if(!candidate.test(input))return {text:input,counts:{},blocks:[],headingChanges:[],unclosedFence:false};
  const counts={},blocks=[],headingChanges=[],lines=input.replace(/\r\n?/g,"\n").replace(/^\uFEFF/,"").split("\n"),output=[];
  if(input.includes("\r"))counts.lineEndings=1;if(input.startsWith("\uFEFF"))counts.bom=1;
  let fence=null,blank=0;
  for(let index=0;index<lines.length;index++){
    const line=lines[index],opening=fenceStart(line);
    if(fence){output.push(line);if(new RegExp(`^\\s{0,3}${fence.char}{${fence.length},}\\s*$`).test(line))fence=null;continue;}
    if(opening){fence={char:opening[1][0],length:opening[1].length};output.push(line);blank=0;continue;}
    const yaml=yamlBlock(lines,index);
    if(yaml){blocks.push({kind:"yaml",line:index,raw:yaml.raw,fields:yaml.fields,rawSha256:sha(yaml.raw)});counts.extractedYaml=(counts.extractedYaml||0)+1;index=yaml.end;continue;}
    if(/^\t|^ {4}/.test(line)){output.push(line);blank=0;continue;}
    let value=proseLine(line,counts),label=value.match(labels);
    if(label){const oldTitle=line.replace(/^#{1,6}\s+/,"").replace(/\s*#+\s*$/,"").trim(),newTitle=label[3].trim();blocks.push({kind:"bibliographic-heading",line:index,raw:line,fields:{[label[2].toLowerCase()]:newTitle},rawSha256:sha(line)});headingChanges.push({oldTitle,newTitle});value=`${label[1]} ${newTitle}`;counts.bibliographicLabels=(counts.bibliographicLabels||0)+1;}
    const tail=value.match(/[ \t]+$/);if(tail){const hardBreak=/ {2,}$/.test(value)&&value.trim();const normalized=value.replace(/[ \t]+$/,hardBreak?"  ":"");if(normalized!==value)counts.trailingWhitespace=(counts.trailingWhitespace||0)+1;value=normalized;}
    if(/^\|.*\|\s*$/.test(value)){const cells=value.trim().slice(1,-1).split("|");if(cells.length>1&&cells.every(c=>/^\s*:?-{1,}:?\s*$/.test(c))){const fixed=`|${cells.map(c=>c.replace(/-+/g,run=>run.length<3?"---":run)).join("|")}|`;if(fixed!==value){value=fixed;counts.tableDivider=(counts.tableDivider||0)+1;}}}
    if(!value.trim()){blank++;if(blank>2){counts.excessBlankLines=(counts.excessBlankLines||0)+1;continue;}}else blank=0;
    output.push(value);
  }
  return {text:output.join("\n"),counts,blocks,headingChanges,unclosedFence:Boolean(fence)};
}
function headings(text){return text.split(/\r?\n/).filter(l=>/^#{1,6}\s+\S/.test(l)).map(l=>l.match(/^(#{1,6})/)[1].length);}
function contentFingerprint(text){
  // Canonicalizes only the explicitly permitted presentation equivalents.
  const formatted=formatChunk(text).text;
  return sha(formatted.replace(/\s+/gu," ").trim());
}
const clean=value=>typeof value==="string"?chars(value).replace(/^(?:title|author|year):\s*/i,"").replace(/\s+/g," ").trim():value;
const valid=value=>typeof value==="string"&&value.trim()&&!/^(?:null|none|unknown|anonymous|desconocido|n\/a|--|~|no consignado)$/i.test(value.trim())&&!/^[|>][+-]?$/.test(value.trim());
const lang=value=>({spanish:"es",espanol:"es",español:"es",spa:"es",es:"es",english:"en",eng:"en",en:"en",french:"fr",fra:"fr",fre:"fr",fr:"fr",latin:"la",lat:"la",la:"la",italian:"it",ita:"it",it:"it",german:"de",deu:"de",ger:"de",de:"de",portuguese:"pt",por:"pt",pt:"pt",greek:"el",ell:"el",el:"el"}[String(value||"").toLowerCase().trim()]||null);
function editorialMetadata(document,library,blocks){
  const evidence=[],works=[],authors=new Set(),firstYaml=blocks.find(b=>b.chunkIndex===0&&b.kind==="yaml"&&b.line<=2),fields=firstYaml?.fields||{};
  let current;
  for(const value of [fields.author,fields.authors].flatMap(value=>Array.isArray(value)?value:[]))if(valid(value))authors.add(clean(value));
  for(const block of blocks.filter(b=>b.kind==="bibliographic-heading")){
    const f=block.fields;if(f.title){current={title:clean(f.title),chunkIndex:block.chunkIndex,source:"bibliographic-heading"};works.push(current);}
    if(f.author&&valid(f.author)){authors.add(clean(f.author));if(current)current.author=clean(f.author);}
    if(f.year&&current)current.year=clean(f.year);
    if(f.language&&current)current.language=lang(f.language)||clean(f.language);
  }
  let title=document.title,author=document.author,year=document.year,language=document.language;
  const filenameAuthor=library.id==="clasicos"?document.file.match(/^(.+?) - Obras completas(?: - Parte \d+)?\.md$/i)?.[1]:null;
  if(firstYaml){const field=valid(fields.saint)?"saint":valid(fields.title)?"title":valid(fields.book_title)?"book_title":null;if(field){title=clean(fields[field]);evidence.push({field:"title",source:"yaml",key:field,chunkIndex:0,literal:fields[field]});}}
  if(works.length){
    if(works.length===1)title=works[0].title;
    else if(filenameAuthor){const part=document.file.match(/ - Parte (\d+)\.md$/i)?.[1];title=`Obras reunidas de ${clean(filenameAuthor)}${part?` · Parte ${Number(part)}`:""}`;}
    else title=clean(document.title);
    evidence.push({field:"title",source:works.length>1?"collection-filename-and-contained-titles":"bibliographic-heading",chunkIndex:works[0].chunkIndex,literal:works.length>1?document.file:works[0].title});
  }
  if(valid(fields.author)){
    if(!valid(author)){author=clean(fields.author);evidence.push({field:"author",source:"yaml",key:"author",chunkIndex:0,literal:fields.author});}
  }else if(!valid(author)&&authors.size===1){author=[...authors][0];evidence.push({field:"author",source:"bibliographic-heading",literal:author});}
  else if(!valid(author)&&authors.size===0&&filenameAuthor){author=clean(filenameAuthor);evidence.push({field:"author",source:"explicit-collection-filename",literal:document.file});}
  if(!valid(author))author=null;else author=clean(author);
  title=clean(title);
  const rawYear=fields.publication_year??fields.year??(works.length===1?works[0].year:null);
  if(year==null&&/^\d{3,4}$/.test(String(rawYear||""))){year=Number(rawYear);evidence.push({field:"year",source:fields.publication_year||fields.year?"yaml":"bibliographic-heading",literal:rawYear});}
  const fileLanguage=document.file.match(/_(ES|EN|FR|IT|LA|PT|DE)(?:\.md$|_)/i)?.[1],rawLanguage=fields.language||(works.length===1?works[0].language:null),normalizedLanguage=lang(rawLanguage)||lang(language)||lang(fileLanguage);
  if(fileLanguage&&new RegExp(`(?:_|\\s)${fileLanguage}$`,"i").test(title)){title=title.replace(new RegExp(`(?:_|\\s)${fileLanguage}$`,"i"),"").trim();evidence.push({field:"title",source:"remove-explicit-filename-language-suffix",literal:document.file});}
  if(normalizedLanguage){if(normalizedLanguage!==language)evidence.push({field:"language",source:rawLanguage?"explicit-source-metadata":language?"catalog-language-normalization":"explicit-filename-language-suffix",literal:rawLanguage||language||document.file});language=normalizedLanguage;}
  const changes={};for(const [key,value]of Object.entries({title,author,year,language}))if(JSON.stringify(document[key]??null)!==JSON.stringify(value??null))changes[key]={before:document[key]??null,after:value??null};
  for(const [field,change]of Object.entries(changes))if(!evidence.some(e=>e.field===field))evidence.push({field,source:"literal-catalog-value-cleanup",literal:change.before});
  return {values:{title,author,year,language},changes,evidence,works,authors:[...authors],needsReview:{missingAuthor:!author&&!authors.size,missingLanguage:!language,authorConflict:valid(author)&&valid(fields.author)&&clean(fields.author)!==author,multipleDeclaredAuthors:authors.size>1}};
}
async function writeAtomic(path,bytes){const target=pathOf(path),temp=`${target}.editorial-tmp`;await mkdir(dirname(target),{recursive:true});await writeFile(temp,bytes);await rename(temp,target);if(sha(await readFile(target))!==sha(bytes))throw new Error(`Write verification failed: ${path}`);}

async function run(apply){
  const catalogBytes=await readFile(pathOf("data/catalog.json")),catalog=JSON.parse(catalogBytes),catalogHash=sha(catalogBytes),backup=`reports/editorial-backup-${catalogHash.slice(0,16)}`,staging=`reports/editorial-staging-${catalogHash.slice(0,16)}`;
  const report={schemaVersion:1,tool:"editorial-corpus-v1",mode:apply?"apply":"dry-run",catalogBeforeSha256:catalogHash,backup,summary:{documents:0,chunks:0,changedBodies:0,changedPayloads:0,changedCatalogEntries:0,extractedYamlBlocks:0,bibliographicHeadings:0,containedWorks:0,missingAuthors:0,missingLanguages:0,authorConflicts:0,ambiguousFormats:0,remainingHtmlTags:0,remainingMalformedHeadingCandidates:0,remainingCaretRuns:0},rules:{noRechunk:true,preserveChunkIndexes:true,preserveTocAnchorLevelAndChunk:true,keepEveryRemovedMetadataBlockRaw:true,noUnverifiedTranslation:true,noAuthorInferenceFromGeneralKnowledge:true},documents:[],rulesApplied:{}};
  const files=[],cache=new Map(),payloadRows=[],markdownExports=new Map();let totalBytes=0;
  for(const library of catalog.libraries){for(const document of library.documents){
    const beforeBytes=await readFile(pathOf(document.contentFile)),payload=JSON.parse(gunzipSync(beforeBytes));
    if(payload.id!==document.id||payload.libraryId!==library.id)throw new Error(`Payload identity mismatch: ${document.id}`);
    const originalToc=(payload.toc||[]).map(t=>({anchor:t.anchor,level:t.level,chunkIndex:t.chunkIndex})),originalIndexes=payload.chunks.map(c=>c.index),blocks=[],chunkProof=[],allHeadingChanges=[];let bodyChanged=false;
    const originalCatalog={title:document.title,author:document.author,year:document.year,language:document.language};
    for(const chunk of payload.chunks){
      const text=chunk.markdown??chunk.text,beforeSha256=sha(text);let formatted=cache.get(beforeSha256);
      if(!formatted){formatted=formatChunk(text);if(formatChunk(formatted.text).text!==formatted.text)throw new Error(`Non-idempotent rules: ${document.id}/${chunk.index}`);if(contentFingerprint(text)!==contentFingerprint(formatted.text))throw new Error(`Content proof failed: ${document.id}/${chunk.index}`);if(JSON.stringify(headings(text))!==JSON.stringify(headings(formatted.text)))throw new Error(`Heading levels/order changed: ${document.id}/${chunk.index}`);cache.set(beforeSha256,formatted);}
      const changed=formatted.text!==text;if(changed){chunk.markdown=formatted.text;delete chunk.text;bodyChanged=true;}
      for(const block of formatted.blocks)blocks.push({...block,chunkIndex:chunk.index});
      for(const change of formatted.headingChanges)allHeadingChanges.push({...change,chunkIndex:chunk.index});
      for(const [key,value]of Object.entries(formatted.counts))report.rulesApplied[key]=(report.rulesApplied[key]||0)+value;
      const remaining={htmlTags:(formatted.text.match(/<\/?(?:html|head|script|style|div|p|span|ul|li|h[1-6]|a|img)\b/gi)||[]).length,malformedHeadingCandidates:(formatted.text.match(/^#{1,6}[^#\s][^\n]*$/gm)||[]).length,caretRuns:(formatted.text.match(/\^{3,}/g)||[]).length};
      chunkProof.push({index:chunk.index,beforeSha256,afterSha256:sha(formatted.text),contentFingerprint:contentFingerprint(text),changed,rules:formatted.counts,unclosedFence:formatted.unclosedFence,remaining});
    }
    const metadata=editorialMetadata(document,library,[...(payload.editorial?.metadataBlocks||[]),...blocks]);
    for(const [key,value]of Object.entries(metadata.values))document[key]=value??null;
    if(metadata.authors.length>1)document.authors=metadata.authors;
    if(metadata.works.length>1)document.workTitles=metadata.works.map(w=>w.title);
    for(const toc of payload.toc||[]){const change=allHeadingChanges.find(c=>c.chunkIndex===toc.chunkIndex&&c.oldTitle===toc.title);toc.title=clean(change?change.newTitle:toc.title);}
    assert.deepEqual(payload.chunks.map(c=>c.index),originalIndexes);assert.deepEqual((payload.toc||[]).map(t=>({anchor:t.anchor,level:t.level,chunkIndex:t.chunkIndex})),originalToc);
    const metadataChanged=Object.keys(metadata.changes).length>0;
    const substantive=bodyChanged||metadataChanged;
    if(substantive){
      const previous=payload.editorial;
      payload.title=document.title;
      payload.editorial={version:1,sourceLanguage:document.language||null,originalPayloadSha256:previous?.originalPayloadSha256||sha(beforeBytes),originalCatalog:previous?.originalCatalog||originalCatalog,metadataBlocks:[...(previous?.metadataBlocks||[]),...blocks],workMetadata:metadata.works.length?metadata.works:previous?.workMetadata||[],metadataProvenance:metadata.evidence,chunkProvenance:chunkProof.map(({rules,unclosedFence,...proof})=>proof),...(previous?{previousRevisionSha256:sha(beforeBytes)}:{})};
      document.editorial={version:1,originalPayloadSha256:payload.editorial.originalPayloadSha256,metadataProvenance:metadata.evidence};
    }
    const afterBytes=substantive?gzipSync(Buffer.from(JSON.stringify(payload)),{level:9,mtime:0}):beforeBytes;
    let markdownExport=null;
    if(bodyChanged){const body=payload.chunks.map(c=>c.markdown??c.text).join("\n\n"),frontmatter=Object.entries({title:document.title,author:document.author,...(document.authors?.length?{authors:document.authors}:{}),year:document.year,language:document.language}).map(([key,value])=>`${key}: ${JSON.stringify(value??null)}`).join("\n"),markdown=`---\n${frontmatter}\n---\n\n${body}`,digest=sha(markdown),path=`reports/editorial-markdown/${digest}.md`;markdownExport={path,sha256:digest,bodySha256:sha(body),bytes:Buffer.byteLength(markdown),fragmentJoiner:"\\n\\n"};if(!markdownExports.has(digest)){markdownExports.set(digest,markdownExport);if(apply){await mkdir(pathOf("reports/editorial-markdown"),{recursive:true});await writeFile(pathOf(path),markdown);if(sha(await readFile(pathOf(path)))!==digest)throw new Error(`Markdown export failed: ${document.id}`);}}}
    const record={id:document.id,libraryId:library.id,contentFile:document.contentFile,beforeSha256:sha(beforeBytes),afterSha256:sha(afterBytes),bodyChanged,markdownExport,metadataChanges:metadata.changes,metadataEvidence:metadata.evidence,metadataBlocks:blocks.length,workCount:metadata.works.length,needsReview:metadata.needsReview,chunks:chunkProof};
    report.documents.push(record);report.summary.documents++;report.summary.chunks+=payload.chunks.length;if(bodyChanged)report.summary.changedBodies++;if(substantive){report.summary.changedPayloads++;files.push({path:document.contentFile,beforeSha256:record.beforeSha256,afterSha256:record.afterSha256});if(apply){await mkdir(dirname(pathOf(join(staging,document.contentFile))),{recursive:true});await writeFile(pathOf(join(staging,document.contentFile)),afterBytes);}}
    if(metadataChanged)report.summary.changedCatalogEntries++;report.summary.extractedYamlBlocks+=blocks.filter(b=>b.kind==="yaml").length;report.summary.bibliographicHeadings+=blocks.filter(b=>b.kind==="bibliographic-heading").length;report.summary.containedWorks+=metadata.works.length;report.summary.missingAuthors+=Number(metadata.needsReview.missingAuthor);report.summary.missingLanguages+=Number(metadata.needsReview.missingLanguage);report.summary.authorConflicts+=Number(metadata.needsReview.authorConflict);report.summary.ambiguousFormats+=chunkProof.filter(c=>c.unclosedFence).length;report.summary.remainingHtmlTags+=chunkProof.reduce((n,c)=>n+c.remaining.htmlTags,0);report.summary.remainingMalformedHeadingCandidates+=chunkProof.reduce((n,c)=>n+c.remaining.malformedHeadingCandidates,0);report.summary.remainingCaretRuns+=chunkProof.reduce((n,c)=>n+c.remaining.caretRuns,0);
    totalBytes+=afterBytes.length;payloadRows.push(`${document.contentFile}\t${sha(afterBytes)}`);
    if(report.summary.documents%100===0)console.log(`Analizados ${report.summary.documents}/1385`);
  }
  library.authors=[...new Set(library.documents.flatMap(d=>d.authors?.length?d.authors:d.author?[d.author]:[]))].sort((a,b)=>a<b?-1:a>b?1:0).map(name=>({name,count:library.documents.filter(d=>(d.authors||[d.author]).includes(name)).length}));
  library.stats={...library.stats,authors:library.authors.length};
  }
  catalog.meta.contentRevision=sha(payloadRows.sort().join("\n"));catalog.meta.editorialVersion=1;
  const afterCatalog=Buffer.from(`${JSON.stringify(catalog,null,2)}\n`),manifest=Buffer.from(`${JSON.stringify({version:catalog.meta.dataVersion,documents:report.summary.documents,bytes:totalBytes,contentDigest:catalog.meta.contentRevision},null,2)}\n`);
  report.catalogAfterSha256=sha(afterCatalog);report.contentRevision=catalog.meta.contentRevision;report.uniqueChunksAnalyzed=cache.size;report.markdownExports=[...markdownExports.values()];report.summary.uniqueMarkdownExports=markdownExports.size;report.summary.markdownExportBytes=report.markdownExports.reduce((n,e)=>n+e.bytes,0);report.summary.changedChunks=report.documents.reduce((n,d)=>n+d.chunks.filter(c=>c.changed).length,0);
  if(apply){
    if(sha(await readFile(pathOf("data/catalog.json")))!==catalogHash)throw new Error("Catalog changed during analysis; no public files written.");
    for(const record of report.documents)if(sha(await readFile(pathOf(record.contentFile)))!==record.beforeSha256)throw new Error(`Corpus changed during analysis: ${record.id}; no public files written.`);
    files.push({path:"data/catalog.json",beforeSha256:catalogHash,afterSha256:sha(afterCatalog)},{path:"data/documents/manifest.json",beforeSha256:sha(await readFile(pathOf("data/documents/manifest.json"))),afterSha256:sha(manifest)});
    for(const file of files){const original=await readFile(pathOf(file.path));if(sha(original)!==file.beforeSha256)throw new Error(`Input changed: ${file.path}`);const destination=pathOf(join(backup,file.path));await mkdir(dirname(destination),{recursive:true});try{await access(destination);if(sha(await readFile(destination))!==file.beforeSha256)throw new Error(`Existing backup differs: ${file.path}`);}catch(error){if(error.code!=="ENOENT")throw error;await copyFile(pathOf(file.path),destination);}if(sha(await readFile(destination))!==file.beforeSha256)throw new Error(`Backup invalid: ${file.path}`);}
    // All original bytes and metadata have been copied and verified before writing.
    for(const file of files){const bytes=file.path==="data/catalog.json"?afterCatalog:file.path==="data/documents/manifest.json"?manifest:await readFile(pathOf(join(staging,file.path)));if(sha(bytes)!==file.afterSha256)throw new Error(`Staged bytes invalid: ${file.path}`);await writeAtomic(file.path,bytes);}
    report.files=files;
  }
  await mkdir(pathOf("reports"),{recursive:true});await writeFile(pathOf(`reports/editorial-corpus-${apply?"apply":"dry-run"}.json`),`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify(report.summary,null,2));console.log(`Content revision: ${report.contentRevision}`);
}

function tests(){
  const sample='---\ntitle: "Obra"\nauthor: "Autora"\n---\n\n# Title: Obra\n\n## Author: Autora\n\nTexto con  palabras y ﬁnal.\n\n```\n# Title: literal\nA  B\n```\n';
  const formatted=formatChunk(sample);assert(!formatted.text.includes('title: "Obra"'));assert(formatted.text.includes("# Obra"));assert(formatted.text.includes("## Autora"));assert(formatted.text.includes("A  B"));assert.equal(formatted.blocks[0].raw,'---\ntitle: "Obra"\nauthor: "Autora"\n---');assert.equal(formatChunk(formatted.text).text,formatted.text);assert.deepEqual(headings(sample),headings(formatted.text));assert.equal(contentFingerprint(sample),contentFingerprint(formatted.text));
  assert.equal(chars("EspaÃ±a y â€œtextoâ€"),'España y “texto”');assert.equal(proseLine('`Ã±` https://example.org/Ã± y Ã±',{}),'`Ã±` https://example.org/Ã± y ñ');
  assert.equal(chars("Â\u00a0")," ");
  const tagged=editorialMetadata({title:"Lumen gentium",author:null,year:null,language:null,file:"0074_Lumen_gentium_ES.md"},{id:"doctrine"},[{chunkIndex:0,line:0,kind:"yaml",fields:{title:"Lumen gentium ES",source_url:"https://example.org"}}]);assert.equal(tagged.values.title,"Lumen gentium");assert.equal(tagged.values.language,"es");assert.equal(tagged.values.author,null);
  assert.equal(formatChunk("|a|b|\n|--:|---|\n").text,"|a|b|\n|---:|---|\n");
  console.log("Editorial invariants passed: metadata retained raw, code/URLs protected, heading order, idempotence and reversible character repair.");
}
async function verify(){
  const report=await json("reports/editorial-corpus-apply.json"),catalog=await json("data/catalog.json"),current=new Map(catalog.libraries.flatMap(l=>l.documents.map(d=>[d.id,d]))),old=await json(join(report.backup,"data/catalog.json")),oldIds=old.libraries.flatMap(l=>l.documents.map(d=>d.id));
  assert.deepEqual(catalog.libraries.flatMap(l=>l.documents.map(d=>d.id)),oldIds);
  let modified=0,fragments=0;
  for(const file of report.files)assert.equal(sha(await readFile(pathOf(join(report.backup,file.path)))),file.beforeSha256,`Backup ${file.path}`);
  for(const record of report.documents){const now=JSON.parse(gunzipSync(await readFile(pathOf(record.contentFile))));assert.equal(sha(await readFile(pathOf(record.contentFile))),record.afterSha256,record.id);if(record.beforeSha256===record.afterSha256)continue;
    const before=JSON.parse(gunzipSync(await readFile(pathOf(join(report.backup,record.contentFile)))));assert.equal(now.id,before.id);assert.deepEqual(now.chunks.map(c=>c.index),before.chunks.map(c=>c.index));assert.deepEqual((now.toc||[]).map(({anchor,level,chunkIndex})=>({anchor,level,chunkIndex})),(before.toc||[]).map(({anchor,level,chunkIndex})=>({anchor,level,chunkIndex})));
    for(let i=0;i<before.chunks.length;i++){const source=before.chunks[i].markdown??before.chunks[i].text,body=now.chunks[i].markdown??now.chunks[i].text;assert.equal(body,formatChunk(source).text,`${record.id}/${i}`);assert.equal(contentFingerprint(source),contentFingerprint(body));fragments++;}
    for(const block of now.editorial?.metadataBlocks||[])assert.equal(sha(block.raw),block.rawSha256);
    assert.equal(now.title,current.get(record.id).title);modified++;
  }
  for(const item of report.markdownExports)assert.equal(sha(await readFile(pathOf(item.path))),item.sha256,item.path);
  console.log(JSON.stringify({documents:report.documents.length,modifiedPayloads:modified,fragmentsVerified:fragments,exportsVerified:report.markdownExports.length,backupsVerified:report.files.length,stableIds:true,stableTocAnchors:true},null,2));
}
async function release(version){
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error("Invalid release version");
  const report=await json("reports/editorial-corpus-apply.json"),catalogBytes=await readFile(pathOf("data/catalog.json")),catalog=JSON.parse(catalogBytes),manifest=await json("data/documents/manifest.json");
  if(sha(catalogBytes)!==report.catalogAfterSha256)throw new Error("Catalog changed outside the editorial report; release not applied.");
  const previous=catalog.meta.dataVersion;catalog.meta.dataVersion=version;manifest.version=version;
  const updated=Buffer.from(`${JSON.stringify(catalog,null,2)}\n`),updatedManifest=Buffer.from(`${JSON.stringify(manifest,null,2)}\n`);
  await writeAtomic("data/catalog.json",updated);await writeAtomic("data/documents/manifest.json",updatedManifest);
  report.release={from:previous,to:version,previousCatalogSha256:sha(catalogBytes)};report.catalogAfterSha256=sha(updated);
  report.files.find(f=>f.path==="data/catalog.json").afterSha256=sha(updated);report.files.find(f=>f.path==="data/documents/manifest.json").afterSha256=sha(updatedManifest);
  await writeAtomic("reports/editorial-corpus-apply.json",Buffer.from(`${JSON.stringify(report,null,2)}\n`));
  console.log(`Editorial release ${previous} -> ${version}; payload text unchanged.`);
}
const args=process.argv.slice(2);if(args.includes("--test"))tests();else if(args.includes("--verify"))await verify();else if(args.length===1&&args[0].startsWith("--release="))await release(args[0].slice(10));else if(args.some(a=>a!=="--apply"))throw new Error("Usage: node tools/editorial-corpus.mjs [--apply|--test|--verify|--release=x.y.z]");else await run(args.includes("--apply"));
