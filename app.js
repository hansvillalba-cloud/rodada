'use strict';
const $=s=>document.querySelector(s),set=(i,v)=>$('#'+i).textContent=v;
const fmtT=s=>{s=Math.floor(s);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const rad=Math.PI/180,hav=(a,b,c,d)=>{const p=(c-a)*rad,q=(d-b)*rad,x=Math.sin(p/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(q/2)**2;return 12742000*Math.asin(Math.sqrt(x))};
const gc=g=>g<3?'#2f9e5b':g<6?'#e6c229':g<9?'#f08a24':g<12?'#d9363e':'#8a1130'; // colores ClimbPro
const S={rec:0,pause:0,pts:[],dist:0,odo:0,gain:0,mov:0,el:0,hr:0,cad:0,pow:0,sspd:null,sat:0,cat:0,spd:0,grade:0,alt:null,buf:[],last:null,lat:0,lon:0,ridx:-1,route:null,climbs:[]};
let wheel=(+localStorage.wheel||2105)/1000;$('#wh').value=wheel*1000;
$('#wh').onchange=e=>{wheel=e.target.value/1000;localStorage.wheel=e.target.value};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',4000)};

/* ---------- Almacenamiento (IndexedDB) ---------- */
const db=new Promise((ok,ko)=>{const r=indexedDB.open('rodada',1);r.onupgradeneeded=()=>r.result.createObjectStore('act',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=ko});
const tx=async(m,f)=>{const d=await db;return new Promise((ok,ko)=>{const t=d.transaction('act',m);const r=f(t.objectStore('act'));t.oncomplete=()=>ok(r.result);t.onerror=ko})};

/* ---------- Sensores Bluetooth (Web Bluetooth) ---------- */
function cscH(){const q={};return v=>{const f=v.getUint8(0),n=Date.now();let o=1;
 if(f&1){const r=v.getUint32(o,true),t=v.getUint16(o+4,true);o+=6;
  if(q.wt!=null&&t!==q.wt){S.sspd=(r-q.wr)*wheel/(((t-q.wt+65536)%65536)/1024)*3.6;S.sat=n}q.wr=r;q.wt=t}
 if(f&2){const r=v.getUint16(o,true),t=v.getUint16(o+2,true);
  if(q.ct!=null&&t!==q.ct){S.cad=((r-q.cr+65536)%65536)/(((t-q.ct+65536)%65536)/1024)*60;S.cat=n}q.cr=r;q.ct=t}}}
const BT={hr:['heart_rate','heart_rate_measurement',v=>{S.hr=v.getUint8(0)&1?v.getUint16(1,true):v.getUint8(1)}],
 csc:['cycling_speed_and_cadence','csc_measurement'],
 pow:['cycling_power','cycling_power_measurement',v=>{S.pow=v.getInt16(2,true)}]};
async function link(k,btn){
 if(NAT)return linkNative(k,btn);
 if(!navigator.bluetooth)return toast('Este navegador no soporta Bluetooth web. Usa Chrome en Android.');
 try{const [sv,ch]=BT[k],h=k=='csc'?cscH():BT[k][2],label=btn.textContent;
  const d=await navigator.bluetooth.requestDevice({filters:[{services:[sv]}]});
  const go=async()=>{const g=await d.gatt.connect(),c=await(await g.getPrimaryService(sv)).getCharacteristic(ch);
   c.oncharacteristicvaluechanged=e=>h(e.target.value);await c.startNotifications();btn.classList.add('on')};
  const re=()=>go().catch(()=>setTimeout(re,3000));
  d.ongattserverdisconnected=()=>{btn.classList.remove('on');re()};
  await go();btn.textContent=d.name||label}catch(e){if(e.name!=='NotFoundError')toast('Sensor: '+e.message)}}
document.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>link(b.dataset.bt,b));

/* ---------- Modo nativo (Capacitor): BLE y GPS en segundo plano ---------- */
const Cap=window.Capacitor,NAT=Cap&&Cap.isNativePlatform&&Cap.isNativePlatform()&&window.Native;
const U=s=>`0000${s}-0000-1000-8000-00805f9b34fb`;
const BTU={hr:[U('180d'),U('2a37')],csc:[U('1816'),U('2a5b')],pow:[U('1818'),U('2a63')]};
async function linkNative(k,btn){
 try{const B=NAT.BleClient,[sv,ch]=BTU[k],h=k=='csc'?cscH():BT[k][2],label=btn.textContent;
  await B.initialize();const d=await B.requestDevice({services:[sv]});
  const go=async()=>{await B.connect(d.deviceId,()=>{btn.classList.remove('on');re()});await B.startNotifications(d.deviceId,sv,ch,h);btn.classList.add('on')};
  const re=()=>go().catch(()=>setTimeout(re,3000));
  await go();btn.textContent=d.name||label}catch(e){toast('Sensor: '+(e.message||e))}}

/* ---------- GPS en tiempo real ---------- */
const onFix=c=>{if(c.accuracy>30)return;
 S.lat=c.latitude;S.lon=c.longitude;
 if(c.altitude!=null)S.alt=S.alt==null?c.altitude:S.alt+.25*(c.altitude-S.alt); // filtro de altitud
 const gs=c.speed!=null?c.speed*3.6:null,pr=S.last,dd=pr?hav(pr.lat,pr.lon,c.latitude,c.longitude):0;
 if(!pr||dd>=2){ // ignora ruido GPS cuando estás detenido
  if(pr){S.odo+=dd;if(S.rec&&!S.pause){S.dist+=dd;if(S.alt!=null&&pr.alt!=null&&S.alt>pr.alt)S.gain+=S.alt-pr.alt}}
  S.last={lat:c.latitude,lon:c.longitude,alt:S.alt};
  S.buf.push({d:S.odo,a:S.alt});while(S.buf.length>2&&S.buf[1].d<=S.odo-50)S.buf.shift();
  const f=S.buf[0],l=S.buf.at(-1),sp=l.d-f.d; // pendiente sobre ~50 m
  if(sp>=30&&f.a!=null&&l.a!=null)S.grade+=.3*(Math.max(-25,Math.min(25,(l.a-f.a)/sp*100))-S.grade)}
 S.spd=S.sspd!=null?S.sspd:(gs||0);
 if(S.rec&&!S.pause)S.pts.push([Date.now(),+c.latitude.toFixed(6),+c.longitude.toFixed(6),S.alt==null?null:+S.alt.toFixed(1),S.hr||null,Math.round(S.cad)||null,S.pow||null,+S.spd.toFixed(1)]);
 climbpro();ui()};
if(NAT)NAT.BackgroundGeolocation.addWatcher({backgroundTitle:'Rodada',backgroundMessage:'Registrando tu rodada',requestPermissions:true,stale:false,distanceFilter:0},(l,e)=>{if(e)return toast('GPS: '+(e.message||e.code));l&&onFix(l)});
else navigator.geolocation.watchPosition(p=>onFix(p.coords),e=>toast('GPS: '+e.message),{enableHighAccuracy:true,maximumAge:0});

setInterval(()=>{const n=Date.now(),dt=(n-(S.tk||n))/1000;S.tk=n;
 if(n-S.cat>3000)S.cad=0;if(n-S.sat>3000){S.sspd=null}
 if(S.rec&&!S.pause){S.el+=dt;if(S.spd>1.5)S.mov+=dt}ui()},1000);

function ui(){set('spd',S.spd.toFixed(1));set('time',fmtT(S.el));set('dist',(S.dist/1000).toFixed(2));
 set('gr',S.grade.toFixed(1)+'%');$('#gr').style.color=S.grade<0?'#5aa9ff':gc(S.grade);
 set('alt',S.alt==null?'–':Math.round(S.alt));set('gain',Math.round(S.gain));set('hr',S.hr||'–');set('cad',Math.round(S.cad)||'–');set('pow',S.pow||'–');
 $('#go').textContent=!S.rec?'Iniciar':S.pause?'Reanudar':'Pausar'}

let wl;$('#go').onclick=async()=>{if(!S.rec){S.rec=1;S.pause=0;S.t0=Date.now();try{wl=await navigator.wakeLock.request('screen')}catch{}}else S.pause=!S.pause;ui()};
$('#end').onclick=async()=>{if(!S.rec)return;
 if(S.pts.length>10){const a={id:Date.now(),t0:S.t0,dist:S.dist,el:S.el,mov:S.mov,gain:S.gain,pts:S.pts};await tx('readwrite',s=>s.put(a));toast('Actividad guardada')}
 Object.assign(S,{rec:0,pause:0,pts:[],dist:0,gain:0,mov:0,el:0});try{wl&&wl.release()}catch{}ui();list()};

/* ---------- Perfil de elevación y ClimbPro ---------- */
function resample(P){P=P.filter(p=>p.a!=null);if(P.length<2)return[];let cum=0,nx=50;const out=[{d:0,a:P[0].a,lat:P[0].lat,lon:P[0].lon}];
 for(let i=1;i<P.length;i++){const q=P[i-1],dd=hav(q.lat,q.lon,P[i].lat,P[i].lon);
  while(dd>0&&cum+dd>=nx){const f=(nx-cum)/dd;out.push({d:nx,a:q.a+(P[i].a-q.a)*f,lat:q.lat+(P[i].lat-q.lat)*f,lon:q.lon+(P[i].lon-q.lon)*f});nx+=50}cum+=dd}
 return out.map((p,i,o)=>{const w=o.slice(Math.max(0,i-2),i+3);return{...p,a:w.reduce((s,x)=>s+x.a,0)/w.length}})}
function findClimbs(r){const g=[];for(let i=0;i<r.length-1;i++)g.push((r[i+1].a-r[i].a)/(r[i+1].d-r[i].d)*100);
 const out=[];let i=0;
 while(i<g.length){if(g[i]>=3){let e=i,dip=0;for(let j=i;j<g.length;j++){if(g[j]>=2){e=j;dip=0}else{dip+=50;if(dip>150)break}}
  const len=r[e+1].d-r[i].d,gain=r[e+1].a-r[i].a;
  if(len>=500&&gain>=25)out.push({si:i,ei:e+1,s:r[i].d,e:r[e+1].d,len,gain,avg:gain/len*100});i=e+1}else i++}
 return out}
function prof(cv,r,mk){const w=cv.width=cv.clientWidth*2,h=cv.height=cv.clientHeight*2,g=cv.getContext('2d');g.clearRect(0,0,w,h);if(r.length<2)return;
 const d0=r[0].d,d1=r.at(-1).d,as=r.map(p=>p.a),lo=Math.min(...as),hi=Math.max(...as,lo+20),X=d=>(d-d0)/(d1-d0)*w,Y=a=>h-8-(a-lo)/(hi-lo)*(h-24);
 for(let i=0;i<r.length-1;i++){g.fillStyle=gc((r[i+1].a-r[i].a)/50*100);g.beginPath();g.moveTo(X(r[i].d),h);g.lineTo(X(r[i].d),Y(r[i].a));g.lineTo(X(r[i+1].d)+1,Y(r[i+1].a));g.lineTo(X(r[i+1].d)+1,h);g.fill()}
 if(mk!=null){g.fillStyle='#fff';g.fillRect(X(mk)-2,0,4,h)}}
const km=m=>(m/1000).toFixed(1);
function setRoute(r){S.route=r;S.climbs=findClimbs(r);S.ridx=-1;$('#cp').classList.remove('hide');
 $('#clist').innerHTML=S.climbs.length?S.climbs.map((c,i)=>`<span style="color:${gc(c.avg)}">${i+1}. km ${km(c.s)} · ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join(''):'Esta ruta no tiene subidas de ClimbPro.';
 set('cpt',`${km(r.at(-1).d)} km · ${S.climbs.length} subidas`);prof($('#cpc'),r)}
$('#gpxf').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 const x=new DOMParser().parseFromString(await f.text(),'text/xml');
 const P=[...x.querySelectorAll('trkpt,rtept')].map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),a:p.querySelector('ele')?+p.querySelector('ele').textContent:null}));
 const r=resample(P);if(r.length<2)return toast('El GPX necesita elevación (<ele>).');
 localStorage.route=JSON.stringify(r.map(p=>[p.d,+p.a.toFixed(1),+p.lat.toFixed(6),+p.lon.toFixed(6)]));setRoute(r)};
if(localStorage.route)setRoute(JSON.parse(localStorage.route).map(p=>({d:p[0],a:p[1],lat:p[2],lon:p[3]})));
function climbpro(){const R=S.route;if(!R||!S.lat)return;
 const lo=S.ridx<0?0:Math.max(0,S.ridx-10),hi=S.ridx<0?R.length:Math.min(R.length,S.ridx+200);let b=1e9,bi=-1;
 for(let i=lo;i<hi;i++){const d=hav(S.lat,S.lon,R[i].lat,R[i].lon);if(d<b){b=d;bi=i}}
 if(b>60){S.ridx=-1;return set('cpt','Fuera de la ruta')}
 S.ridx=bi;const cur=R[bi].d,c=S.climbs.find(c=>cur>=c.s&&cur<c.e);
 if(c){const rem=c.e-cur,asc=R[c.ei].a-R[bi].a,i=S.climbs.indexOf(c)+1;
  set('cpt',`Subida ${i}/${S.climbs.length} · quedan ${km(rem)} km · +${Math.round(asc)} m · ${(asc/rem*100).toFixed(1)}% prom.`);prof($('#cpc'),R.slice(c.si,c.ei+1),cur)}
 else{const n=S.climbs.find(c=>c.s>cur);
  set('cpt',n?`Próxima subida en ${km(n.s-cur)} km: ${km(n.len)} km · ${n.avg.toFixed(1)}% · +${Math.round(n.gain)} m`:'No quedan subidas');prof($('#cpc'),R,cur)}}

/* ---------- Actividades ---------- */
async function list(){const a=(await tx('readonly',s=>s.getAll())).sort((x,y)=>y.id-x.id);
 $('#acts').innerHTML=a.length?a.map(x=>`<div class="card" data-id="${x.id}" style="margin:8px 0;cursor:pointer"><b>${new Date(x.t0).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'short'})}</b><div class="row"><span>${km(x.dist)} km</span><span>${fmtT(x.mov)}</span><span>+${Math.round(x.gain)} m</span><span>${x.mov?(x.dist/x.mov*3.6).toFixed(1):0} km/h</span></div></div>`).join(''):'<p class="mut">Aún no hay actividades. Termina una rodada y aparecerá aquí.</p>';
 document.querySelectorAll('#acts .card').forEach(c=>c.onclick=()=>detail(a.find(x=>x.id==c.dataset.id)))}
function toGpx(a){return `<?xml version="1.0"?><gpx version="1.1" creator="Rodada" xmlns="http://www.topografix.com/GPX/1/1" xmlns:g="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Rodada ${new Date(a.t0).toISOString()}</name><trkseg>${a.pts.map(p=>`<trkpt lat="${p[1]}" lon="${p[2]}"><ele>${p[3]??0}</ele><time>${new Date(p[0]).toISOString()}</time><extensions><g:TrackPointExtension>${p[4]?`<g:hr>${p[4]}</g:hr>`:''}${p[5]?`<g:cad>${p[5]}</g:cad>`:''}</g:TrackPointExtension></extensions></trkpt>`).join('')}</trkseg></trk></gpx>`}
function detail(a){const avg=i=>{const v=a.pts.map(p=>p[i]).filter(Boolean);return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):'–'};
 const r=resample(a.pts.map(p=>({lat:p[1],lon:p[2],a:p[3]}))),cl=findClimbs(r),mx=Math.max(...a.pts.map(p=>p[7]||0));
 $('#det').innerHTML=`<div class="card"><b>Detalle</b><div class="row"><span>Prom. ${a.mov?(a.dist/a.mov*3.6).toFixed(1):0} km/h</span><span>Máx. ${mx.toFixed(1)} km/h</span><span>Pulso prom. ${avg(4)}</span><span>Cad. prom. ${avg(5)}</span><span>Potencia prom. ${avg(6)} W</span></div>
 <canvas id="dc"></canvas><div class="row">${cl.map((c,i)=>`<span style="color:${gc(c.avg)}">Subida ${i+1}: ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join('')||'Sin subidas categorizadas'}</div>
 <div class="bar"><button id="gx">Exportar GPX</button><button id="dl">Borrar</button></div></div>`;
 prof($('#dc'),r);
 $('#gx').onclick=()=>{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([toGpx(a)],{type:'application/gpx+xml'}));l.download=`rodada-${a.id}.gpx`;l.click()};
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta actividad?')){await tx('readwrite',s=>s.delete(a.id));$('#det').innerHTML='';list()}}}

document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
 ['ride','acts-v'].forEach(id=>$('#'+id).classList.toggle('hide',id!==b.dataset.t));if(S.route&&b.dataset.t=='ride')setRoute(S.route)});
list();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
