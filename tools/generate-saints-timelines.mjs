import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const atlasRoot=dirname(dirname(fileURLToPath(import.meta.url))), workspaceRoot=dirname(atlasRoot);
const catalog=JSON.parse(await readFile(join(atlasRoot,"data/catalog.json"),"utf8"));
const library=catalog.libraries.find(item=>item.id==="vida-santos");
const excluded=/^000\d_|(?:INDICE|CONTROL|FUENTES|PENDIENTES|INFORME|Audiolibro)/i;
const clean=value=>String(value||"").replace(/\r/g,"").replace(/-\n(?=[a-záéíóúñ])/gi,"").replace(/\n+/g," ").replace(/\s{2,}/g," ").replace(/^[-–—*#\s]+/,"").trim();
const yearRegex=/(?<!\d)(1[0-9]{3}|20[0-2][0-9]|[3-9][0-9]{2})(?!\d)/g;
const birthRegex=/(?:naci(?:o|\u00f3)|nacimiento|vino al mundo|natural de|\bborn\b)/i;
const deathRegex=/(?:muri(?:o|\u00f3)|falleci(?:o|\u00f3)|martirizad|entreg(?:o|\u00f3) su alma|tr(?:a|\u00e1)nsito|\bdied\b)/i;
const MAX_LIFESPAN=110;
const MAX_UNANCHORED_WINDOW=85;
const timelines=[];

function coherentEvents(candidates){
  const years=[...new Set(candidates.map(item=>item.year))].sort((a,b)=>a-b);
  if(years.length<2)return [];
  const births=candidates.filter(item=>birthRegex.test(item.text));
  const deaths=candidates.filter(item=>deathRegex.test(item.text));
  let range=null;
  for(const birth of births)for(const death of deaths){
    const span=death.year-birth.year;
    if(span>=10&&span<=MAX_LIFESPAN){
      // Una referencia editorial tardia no debe imponerse a una muerte cercana y explicita.
      // Premiamos los hechos interiores, pero penalizamos suavemente intervalos excesivos.
      const score=birth.score+death.score+candidates.filter(item=>item.year>=birth.year&&item.year<=death.year).length-(span*1.2);
      if(!range||score>range.score)range={start:birth.year,end:death.year,score};
    }
  }
  if(!range){
    for(let left=0;left<years.length;left++){
      const inside=years.filter(year=>year>=years[left]&&year-years[left]<=MAX_UNANCHORED_WINDOW);
      const start=inside[0],end=inside.at(-1);
      const score=candidates.filter(item=>item.year>=start&&item.year<=end).reduce((sum,item)=>sum+item.score+2,0);
      if(inside.length>=2&&(!range||score>range.score))range={start,end,score};
    }
  }
  return range?candidates.filter(item=>item.year>=range.start&&item.year<=range.end):[];
}

function validateTimeline(item){
  const errors=[];
  if(!Number.isInteger(item.startYear)||!Number.isInteger(item.endYear))errors.push("fechas no enteras");
  if(item.endYear<item.startYear)errors.push("intervalo invertido");
  if(item.endYear-item.startYear>MAX_LIFESPAN)errors.push(`duracion superior a ${MAX_LIFESPAN} anos`);
  if(item.events.some((event,index,array)=>event.year<item.startYear||event.year>item.endYear||(index&&event.year<array[index-1].year)))errors.push("hechos fuera de rango o desordenados");
  return errors;
}

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
  coherentEvents(candidates).sort((a,b)=>b.score-a.score||a.text.length-b.text.length).forEach(item=>{if(!byYear.has(item.year))byYear.set(item.year,item)});
  let events=[...byYear.values()].sort((a,b)=>a.year-b.year);
  if(events.length>10){const first=events[0],last=events.at(-1),middle=events.slice(1,-1).sort((a,b)=>b.score-a.score).slice(0,8);events=[first,...middle,last].sort((a,b)=>a.year-b.year)}
  if(events.length<2) continue;
  const timeline={documentId:doc.id,saint:doc.title,startYear:events[0].year,endYear:events.at(-1).year,events:events.map((event,index)=>({id:`${doc.id}-${index+1}`,year:event.year,title:clean(event.text).slice(0,92),summary:clean(event.text),query:clean(event.text).slice(0,160)}))};
  const errors=validateTimeline(timeline);
  if(errors.length){console.warn(`Cronologia descartada (${doc.title}): ${errors.join(", ")}`);continue}
  timelines.push(timeline);
}
timelines.sort((a,b)=>a.startYear-b.startYear||a.saint.localeCompare(b.saint,"es"));
const validationErrors=timelines.flatMap(item=>validateTimeline(item).map(error=>`${item.saint}: ${error}`));
if(validationErrors.length)throw new Error(`Cronologias incoherentes:\n${validationErrors.join("\n")}`);
await writeFile(join(atlasRoot,"data/saints-timelines.json"),`${JSON.stringify({schemaVersion:2,generatedAt:new Date().toISOString(),libraryId:"vida-santos",validation:{maxLifespanYears:MAX_LIFESPAN,status:"ok"},count:timelines.length,minYear:Math.min(...timelines.map(x=>x.startYear)),maxYear:Math.max(...timelines.map(x=>x.endYear)),timelines},null,2)}\n`,`utf8`);
console.log(`Cronologías generadas: ${timelines.length}; hechos: ${timelines.reduce((sum,item)=>sum+item.events.length,0)}.`);
