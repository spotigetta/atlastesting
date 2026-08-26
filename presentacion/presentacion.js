const deck=[...document.querySelectorAll('.scene')], number=document.querySelector('#scene-number'), progress=document.querySelector('#scene-progress');
const metrics=[['131 M+','palabras para descubrir'],['1.385','documentos y obras'],['12','bibliotecas especializadas'],['1.254','contenidos para volver cada día']]; let metric=0;
function changeMetric(){const value=document.querySelector('#metric-value'),label=document.querySelector('#metric-label');value.animate([{opacity:.2,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});value.textContent=metrics[metric][0];label.textContent=metrics[metric][1];metric=(metric+1)%metrics.length}
setInterval(changeMetric,2400);
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)return;const index=deck.indexOf(entry.target);number.textContent=String(index+1).padStart(2,'0');progress.style.height=`${Math.max(14,(index+1)/deck.length*74)}px`;entry.target.classList.add('is-active')}),{threshold:.6});
deck.forEach(scene=>observer.observe(scene));
document.querySelector('[data-next]').addEventListener('click',()=>deck[1].scrollIntoView({behavior:'smooth'}));
document.querySelector('[data-play-tour]').addEventListener('click',event=>{const frame=document.querySelector('.phone-tour iframe');frame.src='../#/explore';event.currentTarget.textContent='Explorando Atlas…';setTimeout(()=>{frame.src='../#/discover';event.currentTarget.textContent='▶ Ver recorrido'},3500)});
document.querySelector('#whatsapp-presentation').addEventListener('click',()=>window.open(`https://wa.me/?text=${encodeURIComponent(`Conoce Atlas: una biblioteca viva para encontrar, preguntar y rezar.\n${location.href}`)}`,'_blank','noopener'));
