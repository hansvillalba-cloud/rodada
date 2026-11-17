/* Bike fitting con cámara: ángulos de rodilla, torso, codo y hombro mientras pedaleas */
const FITR={road:[30,45],gravel:[40,55],mtb:[45,60],urban:[55,75],ebike:[55,75]};
const SIDES=[[11,13,15,23,25,27],[12,14,16,24,26,28]];
function pickSide(lm){let b=null,bs=0;SIDES.forEach(s=>{const sc=Math.min(...s.map(i=>lm[i].visibility==null?1:lm[i].visibility));if(sc>.4&&sc>bs){bs=sc;b=s}});return b}
async function fitOpen(){if(FT)return;FT={phase:'idle',s:[],cueCls:'',tm:0,res:null,live:null};$('#fit-host').append($('#vid'));cue('Cargando detección de pose…','');wake();
 FT.timer=setInterval(fitTick,1000);fitUI();
 try{await camStart();await poseInit();if(!FT)return camStop();cue('Colócate de lado, cuerpo y bici completos','warn');loop()}catch(e){cue('Cámara no disponible','bad');toast('Cámara o IA no disponible: '+(e.message||e))}}
function fitClose(){if(!FT)return;clearInterval(FT.timer);FT=null;camStop();try{wl&&wl.release()}catch{}$('#str-run').prepend($('#vid'))}
function fitStep(lm){if(!FT)return;const sd=pickSide(lm);if(!sd){cue('Colócate de lado, con cuerpo completo a la vista','warn');return}
 const [sh,el,wr,hp,kn,an]=sd,W=VW(),H=VH(),
  k=ang(lm[hp],lm[kn],lm[an]),e=ang(lm[sh],lm[el],lm[wr]),a=ang(lm[hp],lm[sh],lm[el]),
  t=Math.atan2(Math.abs(lm[sh].y-lm[hp].y)*H,Math.abs(lm[sh].x-lm[hp].x)*W)*180/Math.PI;
 FT.live={k,e,a,t};if(FT.phase=='collect')FT.s.push({k,e,a,t});
 if(FT.phase=='idle'||FT.phase=='done')cue('Listo para medir','ok')}
function fitResult(){const s=FT.s;if(s.length<40)return{err:'Pocas muestras: mejora la iluminación y que se vea la pierna completa.'};
 const q=(key,p)=>{const v=s.map(x=>x[key]).sort((a,b)=>a-b);return v[Math.min(v.length-1,Math.floor(p*v.length))]};
 const kmax=q('k',.95),kmin=q('k',.05);if(kmax-kmin<25)return{err:'No detecté pedaleo: pedalea suave y que se vea la pierna completa.'};
 return{kmax,kmin,torso:q('t',.5),elbow:q('e',.5),arm:q('a',.5)}}
function fitItems(r){const R=FITR[S.bike]||FITR.road,it=[];
 const add=(n,v,lo,hi,mL,mH)=>it.push({n,v:Math.round(v),r:`${lo}–${hi}°`,state:v<lo?'low':v>hi?'high':'ok',msg:v<lo?mL:v>hi?mH:''});
 add('Rodilla extendida (abajo)',r.kmax,140,155,'Rodilla muy flexionada abajo: sillín bajo. Súbelo 3–5 mm y vuelve a medir.','Pierna muy estirada abajo: sillín alto. Bájalo 3–5 mm y evita que la cadera oscile.');
 add('Inclinación del torso',r.torso,R[0],R[1],'Postura más baja de lo habitual para esta bici: sube el manubrio o usa una potencia más corta.','Postura más erguida de lo habitual: puedes bajar el manubrio si buscas más eficiencia.');
 add('Codo',r.elbow,150,170,'Codos muy flexionados: alcance corto o manubrio muy bajo.','Codos casi bloqueados: acorta el alcance o relaja los brazos.');
 add('Brazo–torso (hombro)',r.arm,75,95,'Hombro muy cerrado: alcance corto; prueba una potencia más larga.','Hombro muy abierto: alcance largo; prueba una potencia más corta.');
 return it}
function fitTick(){if(!FT)return;
 if(FT.phase=='count'){if(--FT.tm<=0){FT.phase='collect';FT.tm=15;FT.s=[];beep(1200);say('Pedalea')}else beep(660)}
 else if(FT.phase=='collect'){if(--FT.tm<=0){FT.phase='done';beep(1000);FT.res=fitResult();say('Medición lista');cue('Medición lista','ok')}else cue('Pedalea suave… '+FT.tm+' s','ok')}
 fitUI()}
function fitUI(){if(!FT)return;const box=$('#fit-gauges'),p=document.createElement('p');box.replaceChildren(p);p.className='mut';
 p.textContent=FT.phase=='count'?'Empieza en '+FT.tm+'…':FT.phase=='collect'?'Midiendo… '+FT.tm+' s':FT.res&&FT.res.err?FT.res.err:FT.live?`En vivo: rodilla ${Math.round(FT.live.k)}° · torso ${Math.round(FT.live.t)}° · codo ${Math.round(FT.live.e)}°`:'Pulsa Medir y pedalea 15 s.';
 if(FT.res&&!FT.res.err)fitItems(FT.res).forEach(i=>{const d=document.createElement('div'),h=document.createElement('b');d.className='card';
  h.textContent=`${i.n}: ${i.v}° (ideal ${i.r}) ${i.state=='ok'?'✓':i.state=='low'?'↓':'↑'}`;h.style.color=i.state=='ok'?'#7ee2a0':'#e6c229';d.append(h);
  if(i.msg){const m=document.createElement('span');m.textContent=i.msg;d.append(m)}box.append(d)})}
$('#fit-go').onclick=()=>{if(!FT)return;FT.phase='count';FT.tm=3;FT.res=null;cue('Prepárate…','warn');fitUI()};
$('#fit-save').onclick=async()=>{if(!FT||!FT.res||FT.res.err)return toast('Primero haz una medición válida');
 await tx('readwrite',x=>x.put({id:Date.now(),t0:Date.now(),uid:S.uid,kind:'fit',routine:'Bike fitting · '+(BK[S.bike]||''),bike:S.bike,dur:0,log:[],items:fitItems(FT.res),res:FT.res}),'sess');toast('Medición guardada en Actividades');list()};
function fitDetail(s){$('#det').innerHTML=`<div class="card"><b>Bike fitting · ${esc(BK[s.bike]||'')}</b><table><tr><th>Parámetro</th><th>Valor</th><th>Ideal</th><th></th></tr>${s.items.map(i=>`<tr><td>${esc(i.n)}</td><td>${i.v}°</td><td>${esc(i.r)}</td><td>${i.state=='ok'?'✓':i.state=='low'?'↓':'↑'}</td></tr>`).join('')}</table>
 ${s.items.filter(i=>i.msg).map(i=>`<p class="mut">${esc(i.msg)}</p>`).join('')}<p class="mut">Referencias generales con medición 2D: error de ±5°. No sustituye a un fitter profesional.</p><button id="dl">Borrar</button></div>`;
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta medición?')){await tx('readwrite',x=>x.delete(s.id),'sess');$('#det').innerHTML='';list()}}}
