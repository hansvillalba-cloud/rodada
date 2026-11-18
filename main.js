/* Arranque: deporte y bicicleta, recuperación de actividad, pestañas */
const BIKES={road:['Ruta',2105],mtb:['MTB 29"',2290],gravel:['Gravel',2150],urban:['Urbana',2170],ebike:['Eléctrica',2170]};
$('#bike').replaceChildren(...Object.entries(BIKES).map(([k,v])=>{const o=document.createElement('option');o.value=k;o.textContent=v[0];return o}));
S.sport=DEFS[localStorage.sport]?localStorage.sport:'ride';S.bike=BIKES[localStorage.bike]?localStorage.bike:'road';
function applySport(){$('#sport').value=S.sport;$('#bike').value=S.bike;$('#bike').hidden=S.sport!=='ride';loadPages();render()}
$('#sport').onchange=e=>{if(S.rec){e.target.value=S.sport;return toast('Termina la actividad primero')}S.sport=e.target.value;localStorage.sport=S.sport;applySport()};
$('#bike').onchange=e=>{if(S.rec){e.target.value=S.bike;return toast('Termina la actividad primero')}S.bike=e.target.value;localStorage.bike=S.bike;
 wheel=BIKES[S.bike][1]/1000;$('#wh').value=wheel*1000;localStorage.wheel=wheel*1000};

/* Guardado automático: la actividad sobrevive a cierres, llamadas o pantalla apagada */
async function saveDraft(){if(!S.rec)return;try{await tx('readwrite',s=>s.put({id:'draft',t0:S.t0,uid:S.uid,sport:S.sport,bike:S.bike,pms:S.pms,pst:S.pst,pause:S.pause,dist:S.dist,gain:S.gain,mov:S.mov,max:S.max,pts:S.pts,climbs:S.ac.list,seg:S.seg,saved:Date.now()}))}catch{}}
async function recoverDraft(){try{const d=(await tx('readonly',s=>s.getAll())).find(x=>x.id==='draft');if(!d)return;
 if(!confirm(`Hay una actividad sin terminar (${km(d.dist)} km). ¿Recuperarla?`)){await tx('readwrite',s=>s.delete('draft'));return}
 S.uid=d.uid||S.uid;S.sport=d.sport||'ride';S.bike=d.bike||'road';
 Object.assign(S,{rec:1,pause:1,t0:d.t0,pms:d.pms,pst:d.pause?d.pst:d.saved,dist:d.dist,gain:d.gain,mov:d.mov,max:d.max,pts:d.pts,seg:(d.seg||0)+1,lft:0,rej:0});S.ac.list=d.climbs||[];
 usersUI();applySport();toast('Actividad recuperada: pulsa Reanudar')}catch{}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveDraft();else if(S.rec&&!S.pause)wake()});
addEventListener('pagehide',saveDraft);

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
 ['ride','acts-v'].forEach(id=>$('#'+id).classList.toggle('hide',id!==b.dataset.t));
 if(b.dataset.t=='ride')render();if(b.dataset.t=='acts-v')list()});

if(localStorage.route){try{S.dest=JSON.parse(localStorage.dest||'null')}catch{}
 setRoute(JSON.parse(localStorage.route).map(p=>({d:p[0],a:p[1],lat:p[2],lon:p[3]})),localStorage.cues?JSON.parse(localStorage.cues):null)}
usersUI();loadA();alertsUI();applySport();list();recoverDraft();
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
