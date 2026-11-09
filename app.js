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
 mapUpd(c);climbpro();ui()};
if(NAT)NAT.BackgroundGeolocation.addWatcher({backgroundTitle:'Rodada',backgroundMessage:'Registrando tu rodada',requestPermissions:true,stale:false,distanceFilter:0},(l,e)=>{if(e)return toast('GPS: '+(e.message||e.code));l&&onFix(l)});
else navigator.geolocation.watchPosition(p=>onFix(p.coords),e=>toast('GPS: '+e.message),{enableHighAccuracy:true,maximumAge:0});

setInterval(()=>{const n=Date.now(),dt=(n-(S.tk||n))/1000;S.tk=n;
 if(n-S.cat>3000)S.cad=0;if(n-S.sat>3000){S.sspd=null}
 if(S.rec&&!S.pause){S.el+=dt;if(S.spd>1.5)S.mov+=dt}ui()},1000);

function ui(){set('spd',S.spd.toFixed(1));set('time',fmtT(S.el));set('dist',(S.dist/1000).toFixed(2));
 set('gr',S.grade.toFixed(1)+'%');$('#gr').style.color=S.grade<0?'#5aa9ff':gc(S.grade);
 set('alt',S.alt==null?'–':Math.round(S.alt));set('gain',Math.round(S.gain));set('hr',S.hr||'–');set('cad',Math.round(S.cad)||'–');set('pow',S.pow||'–');
 $('#go').textContent=!S.rec?'Iniciar':S.pause?'Reanudar':'Pausar';ui2()}

let wl;$('#go').onclick=async()=>{if(!S.rec){S.rec=1;S.pause=0;S.t0=Date.now();try{wl=await navigator.wakeLock.request('screen')}catch{}}else S.pause=!S.pause;ui()};
$('#end').onclick=async()=>{if(!S.rec)return;
 if(S.pts.length>10){const a={id:Date.now(),t0:S.t0,dist:S.dist,el:S.el,mov:S.mov,gain:S.gain,pts:S.pts};await tx('readwrite',s=>s.put(a));toast('Actividad guardada')}
 Object.assign(S,{rec:0,pause:0,pts:[],dist:0,gain:0,mov:0,el:0});try{wl&&wl.release()}catch{}ui();list()};

/* ---------- Navegación en tiempo real ---------- */
S.cues=[];S.dest=null;S.hdg=0;
function profs(r,m){prof($('#cpc'),r,m);prof($('#cpc2'),r,m)}
function setCp(t){set('cpt',t);set('cpm',t)}
function ui2(){if($('#map-v').classList.contains('hide'))return;
 set('h-spd',S.spd.toFixed(1));set('h-time',fmtT(S.el));set('h-dist',(S.dist/1000).toFixed(2));set('h-gr',S.grade.toFixed(1)+'%');$('#h-gr').style.color=S.grade<0?'#5aa9ff':gc(S.grade);set('h-hr',S.hr||'–');$('#go2').textContent=$('#go').textContent}
function sizeMap(){const b=$('#mapbox'),w=b.clientWidth,h=b.clientHeight,sz=Math.ceil(2*Math.hypot(w/2,h*.62))+40,wr=$('#mapwrap');
 wr.style.width=wr.style.height=sz+'px';wr.style.left=(w/2-sz/2)+'px';wr.style.top=(h*.62-sz/2)+'px';$('#arrow').style.top=(h*.62)+'px';map&&map.invalidateSize()}
function rot(){$('#mapwrap').style.transform=follow?`rotate(${-S.hdg}deg)`:'none'}
function applyFollow(){const on=follow&&!!map;$('#arrow').style.display=on?'block':'none';if(mk)mk.setStyle({opacity:on?0:1,fillOpacity:on?0:1});rot()}
addEventListener('resize',sizeMap);
$('#go2').onclick=()=>$('#go').click();$('#sb').onclick=()=>$('#sp').classList.toggle('hide');
let map,mk,line,trk,follow=true,voice=true,said={},offT=0;
function initMap(){if(map||!window.L)return;
 map=L.map('map',{zoomControl:false}).setView([S.lat||4.65,S.lon||-74.08],17);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
 line=L.polyline([],{color:'#ffd23f',weight:6,opacity:.9}).addTo(map);trk=L.polyline([],{color:'#5aa9ff',weight:4}).addTo(map);
 mk=L.circleMarker([S.lat||0,S.lon||0],{radius:9,color:'#fff',weight:3,fillColor:'#d9363e',fillOpacity:1}).addTo(map);
 map.on('dragstart',()=>{follow=false;$('#fl').classList.remove('on');applyFollow()});
 map.on('contextmenu',e=>{if(confirm('¿Ir a este punto?'))navTo({lat:e.latlng.lat,lon:e.latlng.lng,name:'Punto en el mapa'})});
 if(S.route)drawRoute(S.route)}
function drawRoute(r){if(map)line.setLatLngs(r?r.map(p=>[p.lat,p.lon]):[])}
function mapUpd(c){if(!map)return;const ll=[c.latitude,c.longitude],hd=c.heading!=null&&!isNaN(c.heading)?c.heading:c.bearing;
 if((c.speed||0)>1&&hd!=null&&!isNaN(hd))S.hdg=(S.hdg+(((hd-S.hdg+540)%360)-180)*.4+360)%360; // rumbo suavizado
 mk.setLatLng(ll);if(S.rec&&!S.pause)trk.addLatLng(ll);
 if(follow){map.setView(ll,Math.max(map.getZoom(),16),{animate:false});rot()}}
const say=t=>{if(!voice||!window.speechSynthesis)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='es-CO';speechSynthesis.speak(u)};
function smooth(o){return o.map((p,i)=>{const w=o.slice(Math.max(0,i-2),i+3);return{...p,a:w.reduce((s,x)=>s+x.a,0)/w.length}})}
const brg=(a,b)=>{const dl=(b.lon-a.lon)*rad;return Math.atan2(Math.sin(dl)*Math.cos(b.lat*rad),Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(dl))/rad};
function cuesFromGeo(r){const o=[];let last=-999; // giros estimados a partir de la geometría del GPX
 for(let i=2;i<r.length-2;i++){const d=(brg(r[i],r[i+2])-brg(r[i-2],r[i])+540)%360-180;
  if(Math.abs(d)>=45&&r[i].d-last>150){last=r[i].d;const rt=d>0,sh=Math.abs(d)>110;o.push({d:r[i].d,lat:r[i].lat,lon:r[i].lon,ic:sh?'↩':rt?'↱':'↰',text:`Gira ${sh?'cerrado ':''}a la ${rt?'derecha':'izquierda'}`})}}
 const e=r.at(-1);o.push({d:e.d,lat:e.lat,lon:e.lon,ic:'⚑',text:'Llegaste al final de la ruta'});return o}
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
 catch(e){toast('Navegación: '+e.message);$('#nav').classList.add('hide')}}
function guide(cur){const tot=S.route.at(-1).d,left=tot-cur,n=S.cues.find(c=>c.d>cur-15);offT=0;
 $('#nav').classList.remove('hide');
 if(n){const dist=n.d-cur;set('nv-i',n.ic);set('nv-t',n.text);set('nv-d',dist>=1000?km(dist)+' km':Math.max(0,Math.round(dist/10)*10)+' m');
  for(const th of[200,50]){const k=n.d+'|'+th;if(dist<=th&&!said[k]&&(th==200||dist>20)){said[k]=1;say(th==200?`En ${th} metros, ${n.text}`:n.text)}}}
 else{set('nv-i','↑');set('nv-t','Sigue la ruta');set('nv-d','')}
 set('nv-r',`${km(left)} km restantes · ${Math.round(left/1000/Math.max(S.spd,10)*60)} min`)}
function offRoute(){set('nv-i','⚠');set('nv-t','Fuera de ruta');set('nv-d','');$('#nav').classList.remove('hide');
 if(!S.dest)return;const n=Date.now();if(!offT)offT=n;
 if(n-offT>15000&&n-(S.lastRe||0)>30000){S.lastRe=n;offT=0;say('Recalculando ruta');navTo(S.dest)}}
function clearRoute(){S.route=null;S.cues=[];S.climbs=[];S.dest=null;S.ridx=-1;['route','cues','dest'].forEach(k=>localStorage.removeItem(k));
 $('#nav').classList.add('hide');$('#cp').classList.add('hide');$('#cpw').classList.add('hide');drawRoute(null)}
$('#fl').onclick=()=>{follow=!follow;$('#fl').classList.toggle('on',follow);applyFollow();if(follow&&map&&S.lat)map.setView([S.lat,S.lon],Math.max(map.getZoom(),16))};
$('#fit').onclick=()=>{if(line&&line.getLatLngs().length){follow=false;$('#fl').classList.remove('on');applyFollow();map.fitBounds(line.getBounds(),{padding:[20,20]})}};
$('#vz').onclick=e=>{voice=!voice;e.target.textContent=voice?'🔊':'🔇'};
$('#xn').onclick=clearRoute;
$('#qb').onclick=async()=>{const q=$('#q').value.trim();if(!q)return;
 try{const j=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q))).json(),box=$('#qr');box.textContent=j.length?'':'Sin resultados';
  j.forEach(x=>{const b=document.createElement('button');b.textContent=x.display_name.split(',').slice(0,3).join(',');b.onclick=()=>{box.textContent='';$('#sp').classList.add('hide');navTo({lat:+x.lat,lon:+x.lon,name:x.display_name})};box.append(b)})}
 catch(e){toast('Búsqueda: '+e.message)}};

/* ---------- Perfil de elevación y ClimbPro ---------- */
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
function prof(cv,r,mk){const w=cv.width=cv.clientWidth*2,h=cv.height=cv.clientHeight*2,g=cv.getContext('2d');g.clearRect(0,0,w,h);if(r.length<2)return;
 const d0=r[0].d,d1=r.at(-1).d,as=r.map(p=>p.a),lo=Math.min(...as),hi=Math.max(...as,lo+20),X=d=>(d-d0)/(d1-d0)*w,Y=a=>h-8-(a-lo)/(hi-lo)*(h-24);
 for(let i=0;i<r.length-1;i++){g.fillStyle=gc((r[i+1].a-r[i].a)/50*100);g.beginPath();g.moveTo(X(r[i].d),h);g.lineTo(X(r[i].d),Y(r[i].a));g.lineTo(X(r[i+1].d)+1,Y(r[i+1].a));g.lineTo(X(r[i+1].d)+1,h);g.fill()}
 if(mk!=null){g.fillStyle='#fff';g.fillRect(X(mk)-2,0,4,h)}}
const km=m=>(m/1000).toFixed(1);
function setRoute(r,cues){S.cues=cues||cuesFromGeo(r);said={};try{localStorage.route=JSON.stringify(r.map(p=>[p.d,+p.a.toFixed(1),+p.lat.toFixed(6),+p.lon.toFixed(6)]));localStorage.cues=JSON.stringify(S.cues);localStorage.dest=JSON.stringify(S.dest)}catch{}drawRoute(r);S.route=r;S.climbs=findClimbs(r);S.ridx=-1;$('#cp').classList.remove('hide');$('#cpw').classList.remove('hide');
 $('#clist').innerHTML=S.climbs.length?S.climbs.map((c,i)=>`<span style="color:${gc(c.avg)}">${i+1}. km ${km(c.s)} · ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join(''):'Esta ruta no tiene subidas de ClimbPro.';
 setCp(`${km(r.at(-1).d)} km · ${S.climbs.length} subidas`);profs(r)}
$('#gpxf').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 const x=new DOMParser().parseFromString(await f.text(),'text/xml');
 const P=[...x.querySelectorAll('trkpt,rtept')].map(p=>({lat:+p.getAttribute('lat'),lon:+p.getAttribute('lon'),a:p.querySelector('ele')?+p.querySelector('ele').textContent:null}));
 const r=resample(P);if(r.length<2)return toast('El GPX necesita elevación (<ele>).');
 localStorage.route=JSON.stringify(r.map(p=>[p.d,+p.a.toFixed(1),+p.lat.toFixed(6),+p.lon.toFixed(6)]));S.dest=null;setRoute(r)};
if(localStorage.route){try{S.dest=JSON.parse(localStorage.dest||'null')}catch{}setRoute(JSON.parse(localStorage.route).map(p=>({d:p[0],a:p[1],lat:p[2],lon:p[3]})),localStorage.cues?JSON.parse(localStorage.cues):null)}
function climbpro(){const R=S.route;if(!R||!S.lat)return;
 const lo=S.ridx<0?0:Math.max(0,S.ridx-10),hi=S.ridx<0?R.length:Math.min(R.length,S.ridx+200);let b=1e9,bi=-1;
 for(let i=lo;i<hi;i++){const d=hav(S.lat,S.lon,R[i].lat,R[i].lon);if(d<b){b=d;bi=i}}
 if(b>60){S.ridx=-1;offRoute();return setCp('Fuera de la ruta')}
 S.ridx=bi;const cur=R[bi].d;guide(cur);const c=S.climbs.find(c=>cur>=c.s&&cur<c.e);
 if(c){const rem=c.e-cur,asc=R[c.ei].a-R[bi].a,i=S.climbs.indexOf(c)+1;
  setCp(`Subida ${i}/${S.climbs.length} · quedan ${km(rem)} km · +${Math.round(asc)} m · ${(asc/rem*100).toFixed(1)}% prom.`);profs(R.slice(c.si,c.ei+1),cur)}
 else{const n=S.climbs.find(c=>c.s>cur);
  setCp(n?`Próxima subida en ${km(n.s-cur)} km: ${km(n.len)} km · ${n.avg.toFixed(1)}% · +${Math.round(n.gain)} m`:'No quedan subidas');profs(R,cur)}}

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
 ['ride','map-v','acts-v'].forEach(id=>$('#'+id).classList.toggle('hide',id!==b.dataset.t));if(S.route&&b.dataset.t=='ride')setRoute(S.route,S.cues);document.body.classList.toggle('bc',b.dataset.t=='map-v');if(b.dataset.t=='map-v'){sizeMap();initMap();applyFollow();map&&map.invalidateSize();if(S.route)profs(S.route)}});
list();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
