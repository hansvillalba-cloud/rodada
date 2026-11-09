'use strict';
const $=s=>document.querySelector(s),set=(i,v)=>{const e=$('#'+i);if(e)e.textContent=v};
const fmtT=s=>{s=Math.floor(s);return Math.floor(s/3600)+':'+String(Math.floor(s/60)%60).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const km=m=>(m/1000).toFixed(1);
const rad=Math.PI/180,hav=(a,b,c,d)=>{const p=(c-a)*rad,q=(d-b)*rad,x=Math.sin(p/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(q/2)**2;return 12742000*Math.asin(Math.sqrt(x))};
const gc=g=>g<3?'#2f9e5b':g<6?'#e6c229':g<9?'#f08a24':g<12?'#d9363e':'#8a1130'; // colores ClimbPro
const S={rec:0,pause:0,pts:[],dist:0,odo:0,gain:0,mov:0,el:0,max:0,hr:0,cad:0,pow:0,sspd:null,sat:0,cat:0,spd:0,grade:0,alt:null,buf:[],last:null,lat:0,lon:0,ridx:-1,route:null,climbs:[],cues:[],dest:null,hdg:0,left:null};
let wheel=(+localStorage.wheel||2105)/1000,map,mk,line,trk,follow=true,voice=true,said={},offT=0,pages,pg=0,ep=0;
$('#wh').value=wheel*1000;$('#wh').onchange=e=>{wheel=e.target.value/1000;localStorage.wheel=e.target.value};
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',4000)};
const btn=(t,f)=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;return b};

/* ---------- Almacenamiento (IndexedDB) ---------- */
const db=new Promise((ok,ko)=>{const r=indexedDB.open('rodada',1);r.onupgradeneeded=()=>r.result.createObjectStore('act',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=ko});
const tx=async(m,f)=>{const d=await db;return new Promise((ok,ko)=>{const t=d.transaction('act',m);const r=f(t.objectStore('act'));t.oncomplete=()=>ok(r.result);t.onerror=ko})};

/* ---------- Sensores Bluetooth ---------- */
function cscH(){const q={};return v=>{const f=v.getUint8(0),n=Date.now();let o=1;
 if(f&1){const r=v.getUint32(o,true),t=v.getUint16(o+4,true);o+=6;
  if(q.wt!=null&&t!==q.wt){S.sspd=(r-q.wr)*wheel/(((t-q.wt+65536)%65536)/1024)*3.6;S.sat=n}q.wr=r;q.wt=t}
 if(f&2){const r=v.getUint16(o,true),t=v.getUint16(o+2,true);
  if(q.ct!=null&&t!==q.ct){S.cad=((r-q.cr+65536)%65536)/(((t-q.ct+65536)%65536)/1024)*60;S.cat=n}q.cr=r;q.ct=t}}}
const BT={hr:['heart_rate','heart_rate_measurement',v=>{S.hr=v.getUint8(0)&1?v.getUint16(1,true):v.getUint8(1)}],
 csc:['cycling_speed_and_cadence','csc_measurement'],
 pow:['cycling_power','cycling_power_measurement',v=>{S.pow=v.getInt16(2,true)}]};
const Cap=window.Capacitor,NAT=Cap&&Cap.isNativePlatform&&Cap.isNativePlatform()&&window.Native;
const U=s=>`0000${s}-0000-1000-8000-00805f9b34fb`;
const BTU={hr:[U('180d'),U('2a37')],csc:[U('1816'),U('2a5b')],pow:[U('1818'),U('2a63')]};
async function linkNative(k,btn){
 try{const B=NAT.BleClient,[sv,ch]=BTU[k],h=k=='csc'?cscH():BT[k][2],label=btn.textContent;
  await B.initialize();const d=await B.requestDevice({services:[sv]});
  const go=async()=>{await B.connect(d.deviceId,()=>{btn.classList.remove('on');re()});await B.startNotifications(d.deviceId,sv,ch,h);btn.classList.add('on')};
  const re=()=>go().catch(()=>setTimeout(re,3000));
  await go();btn.textContent=d.name||label}catch(e){toast('Sensor: '+(e.message||e))}}
async function link(k,btn){
 if(NAT)return linkNative(k,btn);
 if(!navigator.bluetooth)return toast('Este navegador no soporta Bluetooth web. Usa Chrome en Android o el APK.');
 try{const [sv,ch]=BT[k],h=k=='csc'?cscH():BT[k][2],label=btn.textContent;
  const d=await navigator.bluetooth.requestDevice({filters:[{services:[sv]}]});
  const go=async()=>{const g=await d.gatt.connect(),c=await(await g.getPrimaryService(sv)).getCharacteristic(ch);
   c.oncharacteristicvaluechanged=e=>h(e.target.value);await c.startNotifications();btn.classList.add('on')};
  const re=()=>go().catch(()=>setTimeout(re,3000));
  d.ongattserverdisconnected=()=>{btn.classList.remove('on');re()};
  await go();btn.textContent=d.name||label}catch(e){if(e.name!=='NotFoundError')toast('Sensor: '+e.message)}}
document.querySelectorAll('[data-bt]').forEach(b=>b.onclick=()=>link(b.dataset.bt,b));

/* ---------- GPS en tiempo real ---------- */
const onFix=c=>{if(c.accuracy>30)return;
 S.lat=c.latitude;S.lon=c.longitude;
 if(c.altitude!=null)S.alt=S.alt==null?c.altitude:S.alt+.25*(c.altitude-S.alt);
 const gs=c.speed!=null?c.speed*3.6:null,pr=S.last,dd=pr?hav(pr.lat,pr.lon,c.latitude,c.longitude):0;
 if(!pr||dd>=2){
  if(pr){S.odo+=dd;if(S.rec&&!S.pause){S.dist+=dd;if(S.alt!=null&&pr.alt!=null&&S.alt>pr.alt)S.gain+=S.alt-pr.alt}}
  S.last={lat:c.latitude,lon:c.longitude,alt:S.alt};
  S.buf.push({d:S.odo,a:S.alt});while(S.buf.length>2&&S.buf[1].d<=S.odo-50)S.buf.shift();
  const f=S.buf[0],l=S.buf.at(-1),sp=l.d-f.d;
  if(sp>=30&&f.a!=null&&l.a!=null)S.grade+=.3*(Math.max(-25,Math.min(25,(l.a-f.a)/sp*100))-S.grade)}
 S.spd=S.sspd!=null?S.sspd:(gs||0);
 if(S.rec&&!S.pause){if(S.spd<90)S.max=Math.max(S.max,S.spd);S.pts.push([Date.now(),+c.latitude.toFixed(6),+c.longitude.toFixed(6),S.alt==null?null:+S.alt.toFixed(1),S.hr||null,Math.round(S.cad)||null,S.pow||null,+S.spd.toFixed(1)])}
 mapUpd(c);climbpro();ui()};
if(NAT)NAT.BackgroundGeolocation.addWatcher({backgroundTitle:'Rodada',backgroundMessage:'Registrando tu rodada',requestPermissions:true,stale:false,distanceFilter:0},(l,e)=>{if(e)return toast('GPS: '+(e.message||e.code));l&&onFix(l)});
else navigator.geolocation.watchPosition(p=>onFix(p.coords),e=>toast('GPS: '+e.message),{enableHighAccuracy:true,maximumAge:0});
setInterval(()=>{const n=Date.now(),dt=(n-(S.tk||n))/1000;S.tk=n;
 if(n-S.cat>3000)S.cad=0;if(n-S.sat>3000)S.sspd=null;
 if(S.rec&&!S.pause){S.el+=dt;if(S.spd>1.5)S.mov+=dt}ui()},1000);

let wl;$('#go').onclick=async()=>{if(!S.rec){S.rec=1;S.pause=0;S.t0=Date.now();try{wl=await navigator.wakeLock.request('screen')}catch{}}else S.pause=!S.pause;ui()};
$('#end').onclick=async()=>{if(!S.rec||!confirm('¿Terminar y guardar la actividad?'))return;
 if(S.pts.length>10){const a={id:Date.now(),t0:S.t0,dist:S.dist,el:S.el,mov:S.mov,gain:S.gain,pts:S.pts};await tx('readwrite',s=>s.put(a));toast('Actividad guardada')}
 Object.assign(S,{rec:0,pause:0,pts:[],dist:0,gain:0,mov:0,el:0,max:0});if(trk)trk.setLatLngs([]);try{wl&&wl.release()}catch{}ui();list()};

/* ---------- Campos de datos y pantallas personalizables ---------- */
const CAT={spd:['Velocidad','km/h',()=>S.spd.toFixed(1)],avg:['Vel. promedio','km/h',()=>S.mov?(S.dist/S.mov*3.6).toFixed(1):'0.0'],max:['Vel. máxima','km/h',()=>S.max.toFixed(1)],
 time:['Tiempo','',()=>fmtT(S.el)],dist:['Distancia','km',()=>(S.dist/1000).toFixed(2)],grade:['Pendiente','%',()=>S.grade.toFixed(1)],
 alt:['Altitud','m',()=>S.alt==null?'–':Math.round(S.alt)],gain:['Desnivel +','m',()=>Math.round(S.gain)],
 hr:['Pulso','lpm',()=>S.hr||'–'],cad:['Cadencia','rpm',()=>Math.round(S.cad)||'–'],pow:['Potencia','W',()=>S.pow||'–'],
 clock:['Hora','',()=>new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})],
 left:['Ruta restante','km',()=>S.left==null?'–':km(S.left)],eta:['Llegada en','min',()=>S.left==null?'–':Math.round(S.left/1000/Math.max(S.spd,10)*60)],
 map:['Mapa'],climb:['ClimbPro']};
const DEF=[[['map'],['spd','time','dist']],[['spd','hr'],['cad','pow'],['grade','alt'],['time','dist']],[['climb'],['grade','gain','alt']]];
try{pages=JSON.parse(localStorage.pages);if(!Array.isArray(pages)||!pages.length)throw 0}catch{pages=JSON.parse(JSON.stringify(DEF))}
pg=Math.min(+localStorage.pg||0,pages.length-1);
function ui(){document.querySelectorAll('[data-f]').forEach(e=>{e.textContent=CAT[e.dataset.f][2]();if(e.dataset.f=='grade')e.style.color=S.grade<0?'#5aa9ff':gc(S.grade)});
 $('#go').textContent=!S.rec?'Iniciar':S.pause?'Reanudar':'Pausar'}
function render(){pg=Math.min(pg,pages.length-1);$('#holder').append($('#mapbox'),$('#climbbox'));
 $('#screen').replaceChildren(...pages[pg].map(r=>r.filter(id=>CAT[id])).filter(r=>r.length).map(row=>{
  const r=document.createElement('div');r.className='prow';r.style.flex=row.includes('map')?'4':row.includes('climb')?'2':'1';
  row.forEach(id=>{const c=document.createElement('div'),big=id=='map'||id=='climb';c.className='cell'+(big?' big':'');
   if(id=='map')c.append($('#mapbox'));else if(id=='climb')c.append($('#climbbox'));
   else{const b=document.createElement('b'),l=document.createElement('span');b.dataset.f=id;b.textContent='–';b.style.setProperty('--n',id=='time'?7:id=='clock'?5:4);l.textContent=CAT[id][0]+(CAT[id][1]?' · '+CAT[id][1]:'');c.append(b,l)}
   r.append(c)});return r}));
 $('#dots').textContent=pages.map((_,i)=>i==pg?'●':'○').join(' ');
 if($('#screen').querySelector('#mapbox')){sizeMap();initMap();map&&map.invalidateSize();applyFollow()}
 if(S.route)profs(S.route);ui()}
const goPage=d=>{pg=(pg+d+pages.length)%pages.length;localStorage.pg=pg;render()};
$('#pv').onclick=()=>goPage(-1);$('#nx').onclick=()=>goPage(1);
let sx=null;$('#screen').addEventListener('touchstart',e=>{sx=e.target.closest('#mapbox')?null:e.touches[0].clientX},{passive:true});
$('#screen').addEventListener('touchend',e=>{if(sx==null)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>70)goPage(dx<0?1:-1)},{passive:true});

/* ---------- Mapa con rumbo hacia arriba ---------- */
function sizeMap(){const b=$('#mapbox'),w=b.clientWidth,h=b.clientHeight,sz=Math.ceil(2*Math.hypot(w/2,h*.62))+40,wr=$('#mapwrap');if(!w)return;
 wr.style.width=wr.style.height=sz+'px';wr.style.left=(w/2-sz/2)+'px';wr.style.top=(h*.62-sz/2)+'px';$('#arrow').style.top=(h*.62)+'px';map&&map.invalidateSize()}
addEventListener('resize',sizeMap);
function initMap(){if(map||!window.L)return;
 map=L.map('map',{zoomControl:false,attributionControl:false}).setView([S.lat||4.65,S.lon||-74.08],17);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
 line=L.polyline([],{color:'#ffd23f',weight:6,opacity:.9}).addTo(map);trk=L.polyline([],{color:'#5aa9ff',weight:4}).addTo(map);
 mk=L.circleMarker([S.lat||0,S.lon||0],{radius:9,color:'#fff',weight:3,fillColor:'#d9363e',fillOpacity:1}).addTo(map);
 map.on('dragstart',()=>{follow=false;$('#fl').classList.remove('on');applyFollow()});
 map.on('contextmenu',e=>{if(confirm('¿Ir a este punto?'))navTo({lat:e.latlng.lat,lon:e.latlng.lng,name:'Punto en el mapa'})});
 if(S.route)drawRoute(S.route)}
function drawRoute(r){if(map)line.setLatLngs(r?r.map(p=>[p.lat,p.lon]):[])}
function rot(){$('#mapwrap').style.transform=follow?`rotate(${-S.hdg}deg)`:'none'}
function applyFollow(){const on=follow&&!!map;$('#arrow').style.display=on?'block':'none';if(mk)mk.setStyle({opacity:on?0:1,fillOpacity:on?0:1});rot()}
function mapUpd(c){if(!map)return;const ll=[c.latitude,c.longitude],hd=c.heading!=null&&!isNaN(c.heading)?c.heading:c.bearing;
 if((c.speed||0)>1&&hd!=null&&!isNaN(hd))S.hdg=(S.hdg+(((hd-S.hdg+540)%360)-180)*.4+360)%360;
 mk.setLatLng(ll);if(S.rec&&!S.pause)trk.addLatLng(ll);
 if(follow){map.setView(ll,map.getZoom(),{animate:false});rot()}}
$('#zi').onclick=()=>map&&map.zoomIn();$('#zo').onclick=()=>map&&map.zoomOut();
$('#fl').onclick=()=>{follow=!follow;$('#fl').classList.toggle('on',follow);applyFollow();if(follow&&map&&S.lat)map.setView([S.lat,S.lon],map.getZoom())};

/* ---------- Rutas, ClimbPro y navegación ---------- */
function smooth(o){return o.map((p,i)=>{const w=o.slice(Math.max(0,i-2),i+3);return{...p,a:w.reduce((s,x)=>s+x.a,0)/w.length}})}
function resample(P){P=P.filter(p=>p.a!=null);if(P.length<2)return[];let cum=0,nx=50;const out=[{d:0,a:P[0].a,lat:P[0].lat,lon:P[0].lon}];
 for(let i=1;i<P.length;i++){const q=P[i-1],dd=hav(q.lat,q.lon,P[i].lat,P[i].lon);
  while(dd>0&&cum+dd>=nx){const f=(nx-cum)/dd;out.push({d:nx,a:q.a+(P[i].a-q.a)*f,lat:q.lat+(P[i].lat-q.lat)*f,lon:q.lon+(P[i].lon-q.lon)*f});nx+=50}cum+=dd}
 return smooth(out)}
function findClimbs(r){const g=[];for(let i=0;i<r.length-1;i++)g.push((r[i+1].a-r[i].a)/(r[i+1].d-r[i].d)*100);
 const out=[];let i=0;
 while(i<g.length){if(g[i]>=3){let e=i,dip=0;for(let j=i;j<g.length;j++){if(g[j]>=2){e=j;dip=0}else{dip+=50;if(dip>150)break}}
  const len=r[e+1].d-r[i].d,gain=r[e+1].a-r[i].a;
  if(len>=500&&gain>=25)out.push({si:i,ei:e+1,s:r[i].d,e:r[e+1].d,len,gain,avg:gain/len*100});i=e+1}else i++}
 return out}
function prof(cv,r,mk){const w=cv.width=cv.clientWidth*2,h=cv.height=cv.clientHeight*2,g=cv.getContext('2d');g.clearRect(0,0,w,h);if(r.length<2||!w)return;
 const d0=r[0].d,d1=r.at(-1).d,as=r.map(p=>p.a),lo=Math.min(...as),hi=Math.max(...as,lo+20),X=d=>(d-d0)/(d1-d0)*w,Y=a=>h-8-(a-lo)/(hi-lo)*(h-24);
 for(let i=0;i<r.length-1;i++){g.fillStyle=gc((r[i+1].a-r[i].a)/50*100);g.beginPath();g.moveTo(X(r[i].d),h);g.lineTo(X(r[i].d),Y(r[i].a));g.lineTo(X(r[i+1].d)+1,Y(r[i+1].a));g.lineTo(X(r[i+1].d)+1,h);g.fill()}
 if(mk!=null){g.fillStyle='#fff';g.fillRect(X(mk)-2,0,4,h)}}
const profs=(r,m)=>{const c=$('#cpc');c.isConnected&&prof(c,r,m)};
const setCp=t=>set('cpt',t);
const brg=(a,b)=>{const dl=(b.lon-a.lon)*rad;return Math.atan2(Math.sin(dl)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(dl))/rad};
function cuesFromGeo(r){const o=[];let last=-999;
 for(let i=2;i<r.length-2;i++){const d=(brg(r[i],r[i+2])-brg(r[i-2],r[i])+540)%360-180;
  if(Math.abs(d)>=45&&r[i].d-last>150){last=r[i].d;const rt=d>0,sh=Math.abs(d)>110;o.push({d:r[i].d,lat:r[i].lat,lon:r[i].lon,ic:sh?'↩':rt?'↱':'↰',text:`Gira ${sh?'cerrado ':''}a la ${rt?'derecha':'izquierda'}`})}}
 const e=r.at(-1);o.push({d:e.d,lat:e.lat,lon:e.lon,ic:'⚑',text:'Llegaste al final de la ruta'});return o}
function setRoute(r,cues){S.cues=cues||cuesFromGeo(r);said={};
 try{localStorage.route=JSON.stringify(r.map(p=>[p.d,+p.a.toFixed(1),+p.lat.toFixed(6),+p.lon.toFixed(6)]));localStorage.cues=JSON.stringify(S.cues);localStorage.dest=JSON.stringify(S.dest)}catch{}
 drawRoute(r);S.route=r;S.climbs=findClimbs(r);S.ridx=-1;
 $('#clist').innerHTML=S.climbs.length?S.climbs.map((c,i)=>`<span style="color:${gc(c.avg)}">${i+1}. km ${km(c.s)} · ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join(''):'';
 setCp(`${km(r.at(-1).d)} km · ${S.climbs.length} subidas`);profs(r)}
const say=t=>{if(!voice||!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='es-CO';speechSynthesis.speak(u)};
const MOD={left:'a la izquierda','slight left':'ligeramente a la izquierda','sharp left':'cerrado a la izquierda',right:'a la derecha','slight right':'ligeramente a la derecha','sharp right':'cerrado a la derecha',straight:'recto',uturn:'en U'};
const ICO={left:'↰','slight left':'↖','sharp left':'↰',right:'↱','slight right':'↗','sharp right':'↱',straight:'↑',uturn:'↩'};
function instr(s){const m=s.maneuver,t=m.type,md=MOD[m.modifier]||'',n=s.name?` por ${s.name}`:'';
 if(t=='arrive')return 'Llegaste a tu destino';
 if(t=='roundabout'||t=='rotary')return `En la glorieta toma la salida ${m.exit||''}`.trim();
 if(['turn','end of road','fork','on ramp','off ramp'].includes(t))return `Gira ${md}${n}`;
 return `Continúa ${md||'recto'}${n}`}
const near=(r,la,lo)=>{let b=1e9,bi=0;r.forEach((p,i)=>{const d=hav(la,lo,p.lat,p.lon);if(d<b){b=d;bi=i}});return bi};
async function addElev(r){if(r.length>2400)return toast('Ruta muy larga: sin ClimbPro');
 try{const ch=[];for(let i=0;i<r.length;i+=100)ch.push(r.slice(i,i+100));
  await Promise.all(ch.map(async s=>{const j=await(await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${s.map(p=>p.lat.toFixed(5))}&longitude=${s.map(p=>p.lon.toFixed(5))}`)).json();j.elevation.forEach((e,k)=>s[k].a=e)}))}
 catch{toast('Sin datos de elevación: ClimbPro no disponible en esta ruta')}}
async function navTo(d){
 if(!S.lat)return toast('Aún no hay señal GPS');
 $('#nav').classList.remove('hide');set('nv-i','…');set('nv-t','Calculando ruta…');set('nv-d','');set('nv-r','');
 try{const j=await(await fetch(`https://routing.openstreetmap.de/routed-bike/route/v1/driving/${S.lon},${S.lat};${d.lon},${d.lat}?overview=full&geometries=geojson&steps=true`)).json();
  if(!j.routes||!j.routes.length)throw new Error('no hay ruta disponible');
  const rt=j.routes[0];let r=resample(rt.geometry.coordinates.map(c=>({lon:c[0],lat:c[1],a:0})));
  if(r.length<2)throw new Error('destino demasiado cerca');
  await addElev(r);r=smooth(r);
  const cues=rt.legs.flatMap(l=>l.steps).filter(s=>s.maneuver.type!=='depart').map(s=>{const[lo,la]=s.maneuver.location;return{d:r[near(r,la,lo)].d,lat:la,lon:lo,text:instr(s),ic:s.maneuver.type=='arrive'?'⚑':ICO[s.maneuver.modifier]||'↑'}}).sort((a,b)=>a.d-b.d);
  S.dest=d;setRoute(r,cues);follow=true;$('#fl').classList.add('on');applyFollow();say('Ruta calculada')}
 catch(e){toast('Navegación: '+e.message);if(!S.route)$('#nav').classList.add('hide')}}
function guide(cur){const tot=S.route.at(-1).d,left=tot-cur,n=S.cues.find(c=>c.d>cur-15);offT=0;S.left=left;
 $('#nav').classList.remove('hide');
 if(n){const dist=n.d-cur;set('nv-i',n.ic);set('nv-t',n.text);set('nv-d',dist>=1000?km(dist)+' km':Math.max(0,Math.round(dist/10)*10)+' m');
  for(const th of[200,50]){const k=n.d+'|'+th;if(dist<=th&&!said[k]&&(th==200||dist>20)){said[k]=1;say(th==200?`En ${th} metros, ${n.text}`:n.text)}}}
 else{set('nv-i','↑');set('nv-t','Sigue la ruta');set('nv-d','')}
 set('nv-r',`${km(left)} km restantes · ${Math.round(left/1000/Math.max(S.spd,10)*60)} min`)}
function offRoute(){S.left=null;set('nv-i','⚠');set('nv-t','Fuera de ruta');set('nv-d','');$('#nav').classList.remove('hide');
 if(!S.dest)return;const n=Date.now();if(!offT)offT=n;
 if(n-offT>15000&&n-(S.lastRe||0)>30000){S.lastRe=n;offT=0;say('Recalculando ruta');navTo(S.dest)}}
function climbpro(){const R=S.route;if(!R||!S.lat)return;
 const lo=S.ridx<0?0:Math.max(0,S.ridx-10),hi=S.ridx<0?R.length:Math.min(R.length,S.ridx+200);let b=1e9,bi=-1;
 for(let i=lo;i<hi;i++){const d=hav(S.lat,S.lon,R[i].lat,R[i].lon);if(d<b){b=d;bi=i}}
 if(b>60){S.ridx=-1;offRoute();return setCp('Fuera de la ruta')}
 S.ridx=bi;const cur=R[bi].d;guide(cur);const c=S.climbs.find(c=>cur>=c.s&&cur<c.e);
 if(c){const rem=c.e-cur,asc=R[c.ei].a-R[bi].a,i=S.climbs.indexOf(c)+1;
  setCp(`Subida ${i}/${S.climbs.length} · quedan ${km(rem)} km · +${Math.round(asc)} m · ${(asc/rem*100).toFixed(1)}% prom.`);profs(R.slice(c.si,c.ei+1),cur)}
 else{const n=S.climbs.find(c=>c.s>cur);
  setCp(n?`Próxima subida en ${km(n.s-cur)} km: ${km(n.len)} km · ${n.avg.toFixed(1)}% · +${Math.round(n.gain)} m`:'No quedan subidas');profs(R,cur)}}
function clearRoute(){S.route=null;S.cues=[];S.climbs=[];S.dest=null;S.ridx=-1;S.left=null;['route','cues','dest'].forEach(k=>localStorage.removeItem(k));
 $('#nav').classList.add('hide');$('#clist').textContent='';setCp('Carga o calcula una ruta para ver ClimbPro');drawRoute(null);const c=$('#cpc');c.getContext('2d').clearRect(0,0,c.width,c.height)}
$('#gpxf').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 const x=new DOMParser().parseFromString(await f.text(),'text/xml');
 const P=[...x.querySelectorAll('trkpt,rtept')].map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),a:p.querySelector('ele')?+p.querySelector('ele').textContent:null}));
 const r=resample(P);if(r.length<2)return toast('El GPX necesita elevación (<ele>).');
 S.dest=null;setRoute(r);$('#menu').classList.add('hide');toast('Ruta cargada: '+S.climbs.length+' subidas')};
$('#xn').onclick=clearRoute;$('#vz').onclick=e=>{voice=!voice;e.target.textContent='Voz: '+(voice?'sí':'no')};
$('#qb').onclick=async()=>{const q=$('#q').value.trim();if(!q)return;
 try{const j=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q))).json(),box=$('#qr');box.textContent=j.length?'':'Sin resultados';
  j.forEach(x=>{const b=btn(x.display_name.split(',').slice(0,3).join(','),()=>{box.textContent='';$('#menu').classList.add('hide');navTo({lat:+x.lat,lon:+x.lon,name:x.display_name})});box.append(b)})}
 catch(e){toast('Búsqueda: '+e.message)}};

/* ---------- Menú y editor de pantallas ---------- */
$('#mn').onclick=()=>$('#menu').classList.remove('hide');$('#mx').onclick=()=>$('#menu').classList.add('hide');
$('#edb').onclick=()=>{$('#menu').classList.add('hide');ep=pg;editor();$('#ed').classList.remove('hide')};
$('#edok').onclick=()=>{localStorage.pages=JSON.stringify(pages);$('#ed').classList.add('hide');pg=Math.min(ep,pages.length-1);localStorage.pg=pg;render()};
function editor(){const root=$('#edc'),P=pages[ep];root.replaceChildren();
 const tabs=document.createElement('div');tabs.className='bar';
 pages.forEach((_,i)=>{const b=btn('Pantalla '+(i+1),()=>{ep=i;editor()});if(i==ep)b.className='on';tabs.append(b)});
 tabs.append(btn('+',()=>{pages.push([['spd','time'],['dist','grade']]);ep=pages.length-1;editor()}));root.append(tabs);
 P.forEach((row,ri)=>{const d=document.createElement('div');d.className='erow';
  row.forEach((id,ci)=>{const s=document.createElement('select');s.setAttribute('aria-label','Campo '+(ci+1)+' de la fila '+(ri+1));
   Object.keys(CAT).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=CAT[k][0];o.selected=k==id;s.append(o)});
   s.onchange=()=>{const v=s.value;if((v=='map'||v=='climb')&&P.some((r,j)=>r.some((x,k)=>x==v&&!(j==ri&&k==ci)))){toast('Ya hay un campo "'+CAT[v][0]+'" en esta pantalla');s.value=row[ci];return}row[ci]=v};d.append(s)});
  d.append(btn('+',()=>{if(row.length<4){row.push('hr');editor()}}),btn('−',()=>{if(row.length>1){row.pop();editor()}}),
   btn('↑',()=>{if(ri){[P[ri-1],P[ri]]=[P[ri],P[ri-1]];editor()}}),btn('✕',()=>{P.splice(ri,1);editor()}));
  root.append(d)});
 const c=document.createElement('div');c.className='bar';
 c.append(btn('+ Fila',()=>{P.push(['spd','time']);editor()}),btn('Borrar pantalla',()=>{if(pages.length>1&&confirm('¿Borrar esta pantalla?')){pages.splice(ep,1);ep=0;editor()}}),
  btn('Restablecer',()=>{if(confirm('¿Restablecer las pantallas originales?')){pages=JSON.parse(JSON.stringify(DEF));ep=0;editor()}}));root.append(c)}

/* ---------- Actividades ---------- */
async function list(){const a=(await tx('readonly',s=>s.getAll())).sort((x,y)=>y.id-x.id);
 $('#acts').innerHTML=a.length?a.map(x=>`<div class="card" data-id="${x.id}" style="cursor:pointer"><b>${new Date(x.t0).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'short'})}</b><div class="row"><span>${km(x.dist)} km</span><span>${fmtT(x.mov)}</span><span>+${Math.round(x.gain)} m</span><span>${x.mov?(x.dist/x.mov*3.6).toFixed(1):0} km/h</span></div></div>`).join(''):'<p class="mut">Aún no hay actividades. Termina una rodada y aparecerá aquí.</p>';
 document.querySelectorAll('#acts .card').forEach(c=>c.onclick=()=>detail(a.find(x=>x.id==c.dataset.id)))}
function toGpx(a){return `<?xml version="1.0"?><gpx version="1.1" creator="Rodada" xmlns="http://www.topografix.com/GPX/1/1" xmlns:g="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Rodada ${new Date(a.t0).toISOString()}</name><trkseg>${a.pts.map(p=>`<trkpt lat="${p[1]}" lon="${p[2]}"><ele>${p[3]??0}</ele><time>${new Date(p[0]).toISOString()}</time><extensions><g:TrackPointExtension>${p[4]?`<g:hr>${p[4]}</g:hr>`:''}${p[5]?`<g:cad>${p[5]}</g:cad>`:''}</g:TrackPointExtension></extensions></trkpt>`).join('')}</trkseg></trk></gpx>`}
function detail(a){const avg=i=>{const v=a.pts.map(p=>p[i]).filter(Boolean);return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):'–'};
 const r=resample(a.pts.map(p=>({lat:p[1],lon:p[2],a:p[3]}))),cl=findClimbs(r),mx=Math.max(...a.pts.map(p=>p[7]||0));
 $('#det').innerHTML=`<div class="card"><b>Detalle</b><div class="row"><span>Prom. ${a.mov?(a.dist/a.mov*3.6).toFixed(1):0} km/h</span><span>Máx. ${mx.toFixed(1)} km/h</span><span>Pulso prom. ${avg(4)}</span><span>Cad. prom. ${avg(5)}</span><span>Potencia prom. ${avg(6)} W</span></div>
 <canvas id="dc" style="width:100%;height:90px"></canvas><div class="row">${cl.map((c,i)=>`<span style="color:${gc(c.avg)}">Subida ${i+1}: ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join('')||'Sin subidas categorizadas'}</div>
 <div class="bar"><button id="gx">Exportar GPX</button><button id="dl">Borrar</button></div></div>`;
 prof($('#dc'),r);
 $('#gx').onclick=()=>{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([toGpx(a)],{type:'application/gpx+xml'}));l.download=`rodada-${a.id}.gpx`;l.click()};
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta actividad?')){await tx('readwrite',s=>s.delete(a.id));$('#det').innerHTML='';list()}}}

/* ---------- Inicio ---------- */
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('on',x===b));
 ['ride','acts-v'].forEach(id=>$('#'+id).classList.toggle('hide',id!==b.dataset.t));if(b.dataset.t=='ride')render()});
if(localStorage.route){try{S.dest=JSON.parse(localStorage.dest||'null')}catch{}
 setRoute(JSON.parse(localStorage.route).map(p=>({d:p[0],a:p[1],lat:p[2],lon:p[3]})),localStorage.cues?JSON.parse(localStorage.cues):null)}
render();list();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
