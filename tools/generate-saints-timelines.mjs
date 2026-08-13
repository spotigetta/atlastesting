import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const atlasRoot=dirname(dirname(fileURLToPath(import.meta.url))), workspaceRoot=dirname(atlasRoot);
const catalog=JSON.parse(await readFile(join(atlasRoot,"data/catalog.json"),"utf8"));
const library=catalog.libraries.find(item=>item.id==="vida-santos");
const excluded=/^000\d_|(?:INDICE|CONTROL|FUENTES|PENDIENTES|INFORME|Audiolibro)/i;
const clean=value=>String(value||"").replace(/\r/g,"").replace(/-\n(?=[a-záéíóúñ])/gi,"").replace(/\n+/g," ").replace(/\s{2,}/g," ").replace(/^[-–—*#\s]+/,"").trim();
const yearRegex=/(?<!\d)(1[0-9]{3}|20[0-2][0-9]|[3-9][0-9]{2})(?!\d)/g;
const timelines=[];

for(const doc of library.documents.filter(item=>!excluded.test(item.file||""))){
  let markdown; try{markdown=await readFile(join(workspaceRoot,"Vida de los Santos",doc.file),"utf8")}catch{continue}
  const body=markdown.replace(/^---[\s\S]*?---\s*/,"");
  const sentences=body.replace(/\n{2,}/g,"\n").split(/(?<=[.!?])\s+|\n+/).map(clean).filter(text=>text.length>=70&&text.length<=700&&!/Project Gutenberg|Internet Archive|biblioteca digital|edici[oó]n utilizada|URL del archivo/i.test(text));
  const candidates=[];
  for(const text of sentences){
    const years=[...text.matchAll(yearRegex)].map(match=>Number(match[1])).filter(year=>year>=250&&year<=2026);
    for(const year of years){
      const score=(/(naci[oó]|bautiz|ordenad|fund[oó]|lleg[oó]|viaj[oó]|entr[oó]|profes[oó]|muri[oó]|falleci[oó]|canoniz|beatific|convirti[oó]|comenz[oó]|regres[oó]|nombrad|consagrad|encarcelad|desterrad)/i.test(text)?8:0)+(text.length>140?2:0)-years.length;
      candidates.push({year,text,score});
    }
  }
  const byYear=new Map();
  candidates.sort((a,b)=>b.score-a.score||a.text.length-b.text.length).forEach(item=>{if(!byYear.has(item.year))byYear.set(item.year,item)});
  let events=[...byYear.values()].sort((a,b)=>a.year-b.year);
  if(events.length>10){const first=events[0],last=events.at(-1),middle=events.slice(1,-1).sort((a,b)=>b.score-a.score).slice(0,8);events=[first,...middle,last].sort((a,b)=>a.year-b.year)}
  if(events.length<2) continue;
  timelines.push({documentId:doc.id,saint:doc.title,startYear:events[0].year,endYear:events.at(-1).year,events:events.map((event,index)=>({id:`${doc.id}-${index+1}`,year:event.year,title:clean(event.text).slice(0,92),summary:clean(event.text),query:clean(event.text).slice(0,160)}))});
}
timelines.sort((a,b)=>a.startYear-b.startYear||a.saint.localeCompare(b.saint,"es"));
await writeFile(join(atlasRoot,"data/saints-timelines.json"),`${JSON.stringify({schemaVersion:1,generatedAt:new Date().toISOString(),libraryId:"vida-santos",count:timelines.length,minYear:Math.min(...timelines.map(x=>x.startYear)),maxYear:Math.max(...timelines.map(x=>x.endYear)),timelines},null,2)}\n`,`utf8`);
console.log(`Cronologías generadas: ${timelines.length}; hechos: ${timelines.reduce((sum,item)=>sum+item.events.length,0)}.`);
