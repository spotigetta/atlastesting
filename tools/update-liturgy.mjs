/** Authorized, bounded iBreviary import. Dates are set by POST + a private cookie jar. */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const base = "https://www.ibreviary.com/m2/";
const hash = value => createHash("sha256").update(value).digest("hex");
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const entity = {nbsp:" ",aacute:"á",eacute:"é",iacute:"í",oacute:"ó",uacute:"ú",Aacute:"Á",Eacute:"É",Iacute:"Í",Oacute:"Ó",Uacute:"Ú",ntilde:"ñ",Ntilde:"Ñ",uuml:"ü",Uuml:"Ü",quot:'"',apos:"'",amp:"&",lt:"<",gt:">",laquo:"«",raquo:"»",ldquo:"“",rdquo:"”",lsquo:"‘",rsquo:"’",ndash:"–",mdash:"—",dagger:"†",Dagger:"‡",hellip:"…",acute:"´",copy:"©",ordf:"ª",ordm:"º"};
export const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(all,key) => {
  if(key[0]!=="#")return entity[key]??all;
  const n=key[1].toLowerCase()==="x"?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):"";
});
const esc = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const allowed = new Set("p div span br h1 h2 h3 h4 h5 h6 em strong b i u small blockquote ol ul li sup sub table tr td th tbody thead hr a".split(" "));
const safeClasses = new Set("rubrica sezione titolo citazione paragrafo_piccolo capolettera_grande capolettera_piccolo body_2".split(" "));
/** A small strict allow-list, not regex removal of event handlers. No supplied attribute is copied wholesale. */
export function sanitize(html) {
  html=html.replace(/<!--[\s\S]*?-->/g,"").replace(/<(script|style|iframe|object|svg|math|form|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"");
  return html.replace(/<[^>]*>/g,tag=>{
    const m=tag.match(/^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/i);if(!m)return "";
    const name=m[2].toLowerCase();if(!allowed.has(name))return "";if(m[1])return ["br","hr"].includes(name)?"":`</${name}>`;
    const attrs={};for(const a of m[3].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[a[1].toLowerCase()]=decode(a[2]??a[3]??a[4]??"");
    let result="";const classes=(attrs.class||"").split(/\s+/).filter(c=>safeClasses.has(c));if(classes.length)result+=` class="${classes.join(" ")}"`;
    const id=attrs.id||attrs.name;if(id&&/^[a-zA-Z][\w:.-]{0,100}$/.test(id))result+=` id="${esc(id)}"`;
    if(name==="a"&&attrs.href){try{const u=new URL(attrs.href,base);if(u.protocol==="https:"||u.protocol==="http:"){result+=` href="${esc(u.href)}" target="_blank" rel="noopener noreferrer"`;}if(attrs.href.startsWith("#")&&/^#[a-zA-Z][\w:.-]{0,100}$/.test(attrs.href))result=` href="${esc(attrs.href)}"`;}catch{}}
    return `<${name}${result}>`;
  });
}
export function inner(html) {
  const open=/<div\b[^>]*class=["']inner["'][^>]*>/i.exec(html);if(!open)throw Error("No aparece el contenedor de texto del proveedor");
  const start=open.index+open[0].length;let depth=1;const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;let m;
  while((m=tags.exec(html))){depth+=/^<\//.test(m[0])?-1:1;if(!depth)return html.slice(start,m.index);}
  throw Error("Contenedor de texto incompleto");
}
export const plain = html => decode(html.replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim();
const months=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
function confirmedDate(html) {
  const match=plain(html).match(/(?:Dia:\s*)?(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo),\s*(\d{1,2})\s+(\p{L}+)\s+(\d{4})/iu);
  if(!match)return null;const month=months.indexOf(match[2].toLowerCase())+1;return month?`${match[3]}-${String(month).padStart(2,"0")}-${match[1].padStart(2,"0")}`:null;
}
async function atomic(path,value){await mkdir(dirname(path),{recursive:true});const tmp=`${path}.liturgy-tmp`;await writeFile(tmp,typeof value==="string"?value:JSON.stringify(value,null,2)+"\n");await rename(tmp,path);}
function validateDate(value){if(!/^\d{4}-\d\d-\d\d$/.test(value)||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value)throw Error(`Fecha no válida: ${value}`);return value;}
const dateAdd=(date,n)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+n*86400000).toISOString().slice(0,10);
class Session {
  cookies=new Map();
  async request(path,body){
    const url=new URL(path,base);if(url.origin!==new URL(base).origin)throw Error("Origen no permitido");
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,{method:body?"POST":"GET",headers:{"User-Agent":"Atlas-Liturgia/1.0 (authorized liturgical reader)",...(this.cookies.size?{Cookie:[...this.cookies].map(([k,v])=>`${k}=${v}`).join("; ")} : {}),...(body?{"Content-Type":"application/x-www-form-urlencoded"}:{})},body:body?new URLSearchParams(body):undefined,signal:AbortSignal.timeout(25000),redirect:"follow"});
        for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],at=pair.indexOf("=");this.cookies.set(pair.slice(0,at),pair.slice(at+1));}
        if(!response.ok)throw Error(`HTTP ${response.status}`);const html=await response.text();if(html.length>3_000_000)throw Error("Respuesta demasiado grande");await wait(120);return html;
      }catch(error){if(attempt===2)throw error;await wait(500*(attempt+1));}
    }
  }
  async date(date){const [anno,mese,giorno]=date.split("-");const html=await this.request("opzioni.php",{lang:"es",anno,mese:String(+mese),giorno:String(+giorno),ok:"ok"});if(confirmedDate(inner(html))!==date)throw Error(`El proveedor no confirma ${date}`);const menu=inner(await this.request("breviario.php"));if(confirmedDate(menu)!==date)throw Error(`La sesión no conservó ${date}`);const p=[...menu.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>plain(m[1]));return p[1]||"Celebración no identificada";}
}
const hours=[['oficio','Oficio de lectura','ufficio_delle_letture'],['laudes','Laudes','lodi'],['intermedia','Hora intermedia','ora_media'],['visperas','Vísperas','vespri'],['completas','Completas','compieta']];
const mass=[['entrada','Antífona de entrada y colecta','antifona_e_colletta'],['lecturas','Lecturas de la misa','letture'],['ofrendas','Oración sobre las ofrendas','sulle_offerte'],['prefacio-dia','Prefacio del día','prefazio'],['comunion','Comunión y oración final','antifona_ed_orazione_dopo_comunione']];
async function section(session,path,id,title,category,dateScope){
  const raw=inner(await session.request(path));
  const content=sanitize(raw.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/i,"").replace(/<p\b[^>]*>\s*<a\b[^>]*href=["']#menu["'][^>]*>[\s\S]*?<\/a>\s*<\/p>/gi,""));
  const text=plain(content);const minimum=category==="horas"?1000:category==="misal"?650:90;
  if(text.length<minimum)throw Error("El proveedor no ofrece texto completo para esta sección (vacía o menú)");
  // A long list of hyperlinks is still a menu, never a prayer.
  const linked=[...content.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].reduce((n,m)=>n+plain(m[1]).length,0);
  if(linked>text.length*.65)throw Error("El proveedor devolvió un menú, no un texto litúrgico");
  const sha256=hash(content),object=`data/liturgy/objects/${sha256}.json`;
  await atomic(join(root,object),{schemaVersion:1,sha256,html:content,textLength:text.length,words:(text.match(/[\p{L}\p{N}]+/gu)||[]).length});
  return {id,title,category,dateScope,object,sha256,sourceUrl:new URL(path,base).href,words:(text.match(/[\p{L}\p{N}]+/gu)||[]).length};
}
const calendarReference={region:"España",providerCalendarVerified:false,referenceUrl:"https://www.conferenciaepiscopal.es/cee-calendario-liturgico-pastoral-2025-2026/",calendarPdf:"https://www.conferenciaepiscopal.es/wp-content/uploads/2026/01/Calendario-Liturgico-CEE-2026.pdf",notice:"Fecha comprobada en iBreviary. El proveedor no identifica la edición ni permite seleccionar el calendario propio de España. Puede omitir celebraciones españolas o diocesanas. No se han calculado rangos ni primeras vísperas.",checks:{"2026-11-05":"La CEE permite la feria o la memoria libre de santa Ángela de la Cruz; hay propios diocesanos, entre ellos Toledo (calendario CEE, p. PDF 343).","2026-11-06":"La CEE prescribe en España la memoria de santos Pedro Poveda, Inocencio de la Inmaculada y compañeros, mártires (p. PDF 344). Si el proveedor muestra la feria, estos textos no verifican ese propio español.","2026-11-08":"Domingo XXXII del tiempo ordinario en el calendario CEE. Las variantes locales deben comprobarse."}};
async function main(){
  const args=process.argv.slice(2);if(args.some(a=>!/^--(date=\d{4}-\d\d-\d\d|days=\d+|skip-common)$/.test(a)))throw Error("Uso: node tools/update-liturgy.mjs [--date=YYYY-MM-DD] [--days=4] [--skip-common]");
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const start=validateDate(args.find(a=>a.startsWith("--date="))?.slice(7)||today),days=Number(args.find(a=>a.startsWith("--days="))?.slice(7)||4);if(days<1||days>14)throw Error("El lote debe contener entre 1 y 14 días");
  let manifest;try{manifest=JSON.parse(await readFile(join(root,"data/liturgy/manifest.json"),"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;manifest={schemaVersion:1,dates:[],common:[]};}
  manifest={...manifest,provider:"iBreviary",language:"es",attribution:"Textos litúrgicos castellanos: © Conferencia Episcopal Española, según créditos de iBreviary. Reproducción autorizada para Atlas por confirmación expresa del usuario.",permission:{basis:"Permisos CEE, iBreviary y fuentes seleccionadas confirmados expresamente por el usuario para este proyecto empresarial",recordedAt:"2026-11-05"},creditsUrl:"https://www.ibreviary.com/credits_en.html",calendar:calendarReference};
  const report={schemaVersion:1,startedAt:new Date().toISOString(),start,days,dates:[],commonErrors:[],requestsPolicy:"Sequential requests, 120 ms minimum between successful requests, 3 attempts, maximum 14 dates"};
  const session=new Session();let failure=false;
  for(let n=0;n<days;n++){
    const date=dateAdd(start,n),entry={date,updatedAt:new Date().toISOString(),sections:[],errors:[]};
    try{
      entry.sourceCelebration=await session.date(date);entry.confirmedProviderDate=date;entry.calendarNotice=calendarReference.checks[date]||calendarReference.notice;
      entry.calendarStatus=date==="2026-11-06"&&/XXXI semana/i.test(entry.sourceCelebration)?"mismatch":date==="2026-11-08"&&/XXXII Domingo/i.test(entry.sourceCelebration)?"matched":"unverified";
      entry.calendarReason=entry.calendarNotice;
      for(const [id,title,key]of hours)try{entry.sections.push(await section(session,`breviario.php?s=${key}`,id,title,"horas",date));}catch(e){entry.errors.push({id,title,error:e.message});}
      for(const [id,title,key]of mass)try{entry.sections.push(await section(session,`letture.php?s=${key}`,id,title,"misa",date));}catch(e){entry.errors.push({id,title,error:e.message});}
      entry.hoursComplete=hours.every(([id])=>entry.sections.some(s=>s.id===id));entry.complete=entry.hoursComplete&&mass.every(([id])=>entry.sections.some(s=>s.id===id));
      if(!entry.hoursComplete||!entry.sections.some(s=>s.id==="lecturas"))failure=true;
      const file=`data/liturgy/days/${date}.json`,previous=manifest.dates.find(d=>d.date===date);
      if(previous?.hoursComplete&&!entry.hoursComplete){entry.keptPrevious=true;}
      else {await atomic(join(root,file),entry);manifest.dates=manifest.dates.filter(d=>d.date!==date);manifest.dates.push({date,file,sourceCelebration:entry.sourceCelebration,calendarStatus:entry.calendarStatus,calendarReason:entry.calendarReason,hoursComplete:entry.hoursComplete,complete:entry.complete,sections:entry.sections.length,updatedAt:entry.updatedAt});}
      console.log(`${date}: ${entry.sections.length} textos; ${entry.errors.length} secciones no disponibles`);
    }catch(error){failure=true;entry.errors.push({error:error.message});console.error(`${date}: ${error.message}`);}
    report.dates.push({date,sections:entry.sections.length,hoursComplete:entry.hoursComplete||false,keptPrevious:entry.keptPrevious||false,errors:entry.errors});
  }
  if(!args.includes("--skip-common")){
    const common=[];
    for(const [category,title]of [["ordinario","Ordinario de la misa"],["prefazio","Prefacios"],["preghiera_eucaristica","Plegarias eucarísticas"]]){
      try{
        const menu=inner(await session.request(`messale.php?s=${category}`)),links=new Map();
        for(const m of menu.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){const path=decode(m[1]),u=new URL(path,base);if(u.origin===new URL(base).origin&&u.pathname==="/m2/messale.php"&&u.searchParams.get("s")===category&&/^\d+$/.test(u.searchParams.get("id")||""))links.set(u.href,plain(m[2]));}
        if(!links.size||links.size>100)throw Error("Catálogo del misal vacío o fuera del límite");
        for(const [url,label]of links){const u=new URL(url),id=`${category}-${u.searchParams.get("id")}`;try{common.push(await section(session,url,id,label||title,"misal","common"));}catch(error){report.commonErrors.push({id,error:error.message});}}
      }catch(error){report.commonErrors.push({id:category,error:error.message});}
    }
    if(common.some(s=>s.id==="ordinario-4")&&!report.commonErrors.length){manifest.common=common;manifest.commonUpdatedAt=new Date().toISOString();}
    else {failure=true;report.keptPreviousCommon=Boolean(manifest.common.length);}
  }
  manifest.dates.sort((a,b)=>a.date.localeCompare(b.date));manifest.updatedAt=new Date().toISOString();manifest.availableFrom=manifest.dates[0]?.date;manifest.availableTo=manifest.dates.at(-1)?.date;
  await atomic(join(root,"data/liturgy/manifest.json"),manifest);report.finishedAt=manifest.updatedAt;report.commonSections=manifest.common.length;report.failure=failure;
  await atomic(join(root,"reports/liturgy-import.json"),report);if(failure)process.exitCode=1;
}
export async function selfTest(){
  const attack='<script>alert(1)</script><p onclick="evil()">Texto <a href="javascript:evil()">malo</a><img src=x onerror=evil()><span class="rubrica" style="position:fixed">R.</span><iframe src="x">oculto</iframe></p>';
  const cleaned=sanitize(attack);assert(!/<(?:script|iframe|img)\b|\bonclick=|\bonerror=|\bstyle=|javascript:/i.test(cleaned));assert(cleaned.includes('class="rubrica"'));assert(cleaned.includes('Texto'));
  assert.equal(inner('<div class="inner"><p>A</p><div>B</div></div><script>x</script>'),'<p>A</p><div>B</div>');
  assert.equal(confirmedDate('<p>Dia: Jueves, 5 Noviembre 2026</p>'),'2026-11-05');assert.equal(decode('&aacute;&#241;&#x2020;'),'áñ†');assert.throws(()=>validateDate('2026-02-30'));
  const manifest=JSON.parse(await readFile(join(root,"data/liturgy/manifest.json"),"utf8")),objects=new Set();let hoursCount=0,sectionsCount=0;const dates=[];
  async function check(s){const p=JSON.parse(await readFile(join(root,s.object),"utf8")),text=plain(p.html);assert.equal(p.sha256,s.sha256);assert.equal(hash(p.html),s.sha256);assert.equal(sanitize(p.html),p.html);assert(!/<(?:script|iframe|img|form)\b|\bon\w+=|javascript:/i.test(p.html));assert.equal(p.textLength,text.length);assert.equal(p.words,(text.match(/[\p{L}\p{N}]+/gu)||[]).length);assert(p.textLength>=(s.category==='misal'?650:90));assert(p.words>10);if(s.id==='ordinario-4')assert(/Credo/i.test(text)&&/Gloria/i.test(text)&&/Liturgia Eucar[ií]stica/i.test(text));if(s.id==='preghiera_eucaristica-31')assert(/Padremisericordioso/i.test(text.replace(/\s/g,'')));if(s.id==='preghiera_eucaristica-32')assert(/Santoeresenverdad/i.test(text.replace(/\s/g,'')));objects.add(s.object);sectionsCount++;}
  for(const d of manifest.dates){const day=JSON.parse(await readFile(join(root,d.file),"utf8"));assert.equal(day.date,d.date);assert.equal(day.confirmedProviderDate,d.date);assert(['matched','mismatch','unverified'].includes(day.calendarStatus));assert.equal(new Set(day.sections.map(s=>s.id)).size,day.sections.length);for(const s of day.sections){await check(s);if(s.category==='horas'){hoursCount++;assert(plain(JSON.parse(await readFile(join(root,s.object),'utf8')).html).length>1000);}}assert(hours.every(([id])=>day.sections.some(s=>s.id===id)));assert(day.sections.some(s=>s.id==='lecturas'));dates.push({date:day.date,hours:5,sections:day.sections.length,calendarStatus:day.calendarStatus});}
  for(const s of manifest.common)await check(s);assert(manifest.common.some(s=>s.id==='ordinario-4'));assert(manifest.common.some(s=>s.id==='preghiera_eucaristica-31'));assert(manifest.common.some(s=>s.id==='preghiera_eucaristica-32'));
  const result={schemaVersion:1,passed:true,dates,hours:hoursCount,commonSections:manifest.common.length,sectionReferences:sectionsCount,uniqueObjects:objects.size,tests:['Strict sanitizer rejects executable tags, event attributes and javascript links','Nested content extraction excludes surrounding scripts','Date parser and impossible-date rejection','All stored objects hash-verified and sanitizer-idempotent','Five real Hours and Mass readings per imported date','Common texts are real Ordinary, Prefaces and Eucharistic Prayers'],testedAt:new Date().toISOString()};
  await atomic(join(root,'reports/liturgy-tests.json'),result);console.log(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){if(process.argv.slice(2).length===1&&process.argv[2]==='--test')await selfTest();else await main();}
