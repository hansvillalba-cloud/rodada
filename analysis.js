/* Usuarios, lista de actividades y análisis por usuario */
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
let users;try{users=JSON.parse(localStorage.users);if(!Array.isArray(users)||!users.length)throw 0}catch{users=[{id:'u1',name:'Yo',maxHr:190,ftp:0,kg:70,age:30,sex:'M'}]}
S.uid=localStorage.uid&&users.some(u=>u.id==localStorage.uid)?localStorage.uid:users[0].id;
const curU=()=>users.find(u=>u.id==S.uid)||users[0];
const saveUsers=()=>{localStorage.users=JSON.stringify(users);localStorage.uid=S.uid};
function usersUI(){$('#usr').replaceChildren(...users.map(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;o.selected=u.id==S.uid;return o}));
 const u=curU();$('#u-hr').value=u.maxHr;$('#u-ftp').value=u.ftp||'';$('#u-kg').value=u.kg;$('#u-age').value=u.age||30;$('#u-sex').value=u.sex||'M'}
[['u-hr','maxHr'],['u-ftp','ftp'],['u-kg','kg'],['u-age','age']].forEach(([i,k])=>$('#'+i).onchange=e=>{curU()[k]=+e.target.value||0;saveUsers()});
$('#u-sex').onchange=e=>{curU().sex=e.target.value;saveUsers()};
$('#usr').onchange=e=>{if(S.rec){usersUI();return toast('Termina la actividad primero')}S.uid=e.target.value;saveUsers();usersUI();list();loadA();alertsUI()};
$('#usn').onclick=()=>{if(S.rec)return toast('Termina la actividad primero');const n=(prompt('Nombre del nuevo usuario')||'').trim().slice(0,30);if(!n)return;
 users.push({id:'u'+Date.now(),name:n,maxHr:190,ftp:0,kg:70,age:30,sex:'M'});S.uid=users.at(-1).id;saveUsers();usersUI();list();loadA();alertsUI()};

const SPORT={ride:'Ciclismo',run:'Correr'},BK={road:'Ruta',mtb:'MTB',gravel:'Gravel',urban:'Urbana',ebike:'Eléctrica'};
const spdTxt=(v,run)=>run?pace(v)+' /km':v.toFixed(1)+' km/h';

/* Limpia saltos de GPS y recalcula distancia, tiempo en movimiento y desnivel (también repara actividades antiguas) */
function fixAct(a){if(a.v2)return false;const mv=a.sport=='run'?9:28,out=[];
 let an=null,lft=null,rej=0,seg=0,dist=0,mov=0,gain=0,prevT=null;
 for(const p of a.pts){let pr=an,brk=false;
  if(pr){const dt=Math.max((p[0]-(lft||pr.t))/1000,.5),d0=hav(pr.lat,pr.lon,p[1],p[2]);if(d0/dt>mv){if(++rej<5)continue;rej=0;pr=null;brk=true}else rej=0}
  if(lft&&p[0]-lft>30000)brk=true;lft=p[0];if(brk)seg++;
  const dd=pr?hav(pr.lat,pr.lon,p[1],p[2]):0;
  if(!pr||dd>=2){if(pr){dist+=dd;if(p[3]!=null&&pr.alt!=null&&p[3]>pr.alt)gain+=p[3]-pr.alt}an={lat:p[1],lon:p[2],alt:p[3],t:p[0]}}
  if(prevT!=null&&p[7]>1.5)mov+=Math.min((p[0]-prevT)/1000,10);prevT=p[0];
  const q=p.slice();q[8]=seg;out.push(q)}
 a.pts=out;a.dist=dist;a.mov=mov;a.gain=gain;a.v2=1;return true}

async function list(){
 const A=(await tx('readonly',s=>s.getAll())).filter(x=>x.id!=='draft'&&(x.uid||'u1')==S.uid).sort((x,y)=>y.t0-x.t0);
 for(const a of A)if(fixAct(a))await tx('readwrite',s=>s.put(a));
 const sum=d=>{const f=A.filter(a=>a.t0>=Date.now()-d*864e5);return `${f.length} actividades · ${km(f.reduce((s,a)=>s+a.dist,0))} km · ${fmtT(f.reduce((s,a)=>s+a.mov,0))} · +${Math.round(f.reduce((s,a)=>s+a.gain,0))} m`};
 $('#sum').innerHTML=`<b>${esc(curU().name)}</b><div class="mut">7 días: ${sum(7)}</div><div class="mut">30 días: ${sum(30)}</div>`;
 const d=t=>new Date(t).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'short'});
 $('#acts').innerHTML=A.length?A.map(a=>`<div class="card" data-id="${a.id}" style="cursor:pointer"><b>${d(a.t0)} · ${SPORT[a.sport||'ride']}${a.bike&&(a.sport||'ride')=='ride'?' · '+BK[a.bike]:''}</b><div class="row"><span>${km(a.dist)} km</span><span>${fmtT(a.mov)}</span><span>+${Math.round(a.gain)} m</span><span>${spdTxt(a.mov?a.dist/a.mov*3.6:0,a.sport=='run')}</span></div></div>`).join(''):'<p class="mut">Aún no hay actividades para este usuario.</p>';
 document.querySelectorAll('#acts .card').forEach(c=>c.onclick=()=>{detail(A.find(x=>x.id==c.dataset.id));$('#det').scrollIntoView({behavior:'smooth'})})}

function analyze(a){const P=a.pts,u=curU(),mx=u.maxHr||190,ftp=u.ftp||0,kg=u.kg||70,age=u.age||30,fem=u.sex=='F';
 const hrZ=[0,0,0,0,0],pwZ=[0,0,0,0,0,0,0];let hrS=0,hrN=0,hrMax=0,pS=0,pN=0,pMax=0,cS=0,cN=0,sMax=0,loss=0;
 for(let i=0;i<P.length;i++){const p=P[i],dt=i?Math.min((p[0]-P[i-1][0])/1000,10):0;
  if(p[4]){hrS+=p[4]*dt;hrN+=dt;hrMax=Math.max(hrMax,p[4]);const f=p[4]/mx;hrZ[f<.6?0:f<.7?1:f<.8?2:f<.9?3:4]+=dt}
  if(p[6]){pS+=p[6]*dt;pN+=dt;pMax=Math.max(pMax,p[6]);if(ftp){const f=p[6]/ftp;pwZ[f<.55?0:f<.75?1:f<.9?2:f<1.05?3:f<1.2?4:f<1.5?5:6]+=dt}}
  if(p[5]){cS+=p[5]*dt;cN+=dt}
  if(p[7]&&p[7]<90)sMax=Math.max(sMax,p[7]);
  if(i&&p[3]!=null&&P[i-1][3]!=null&&p[3]<P[i-1][3])loss+=P[i-1][3]-p[3]}
 let np=0;if(pN>0){const w=P.map(p=>p[6]||0),k=30;let acc=0,n=0,run=0;for(let i=0;i<w.length;i++){run+=w[i];if(i>=k)run-=w[i-k];if(i>=k-1){acc+=Math.pow(run/k,4);n++}}np=n?Math.pow(acc/n,.25):0}
 const sp=[];let cd=0,t0=P[0]&&P[0][0],nx=1000,hA=0,hC=0,gn=0;
 for(let i=1;i<P.length;i++){const same=(P[i][8]||0)===(P[i-1][8]||0);cd+=same?hav(P[i-1][1],P[i-1][2],P[i][1],P[i][2]):0;if(P[i][4]){hA+=P[i][4];hC++}
  if(P[i][3]!=null&&P[i-1][3]!=null&&P[i][3]>P[i-1][3])gn+=P[i][3]-P[i-1][3];
  if(cd>=nx){sp.push({k:Math.floor(cd/1000),t:(P[i][0]-t0)/1000,hr:hC?Math.round(hA/hC):0,gain:gn});t0=P[i][0];hA=hC=0;gn=0;nx=(Math.floor(cd/1000)+1)*1000}}
 const h=a.mov/3600,kmT=a.dist/1000,v=h?kmT/h:0,run=a.sport=='run';
 /* Energía: potencia > pulso (fórmula de Keytel) > estimación por velocidad (METs) */
 let kcal,src;
 if(pN>a.mov*.5){kcal=pS/1000;src='potencia'}
 else if(hrN>a.mov*.6){const hr=hrS/hrN,pm=fem?(-20.4022+.4472*hr-.1263*kg+.074*age):(-55.0969+.6309*hr+.1988*kg+.2017*age);kcal=Math.max(0,pm/4.184*a.mov/60);src='pulso'}
 else if(run){kcal=1.036*kg*kmT;src='distancia'}
 else{const met=v<10?3.5:v<16?4:v<19?6.8:v<22.5?8:v<25.7?10:v<30.6?12:15.8;kcal=met*kg*h;src='velocidad'}
 return{hrZ,pwZ,hr:hrN?hrS/hrN:0,hrMax,pw:pN?pS/pN:0,pMax,np,cad:cN?cS/cN:0,sMax,loss,sp,kcal,src,v,mx,ftp}}
function zbars(z,lab,col){const t=z.reduce((s,x)=>s+x,0)||1;return z.map((x,i)=>`<div class="zr"><span>${lab[i]}</span><i style="width:${Math.max(2,x/t*100)}%;background:${col[i]}"></i><span>${fmtT(x)}</span></div>`).join('')}
function lineChart(cv,ser){const w=cv.width=cv.clientWidth*2,h=cv.height=220,g=cv.getContext('2d');g.clearRect(0,0,w,h);
 ser.forEach(s=>{const v=s.v,n=v.length;if(n<2)return;const lo=Math.min(...v),hi=Math.max(...v),rg=(hi-lo)||1;g.beginPath();g.strokeStyle=s.c;g.lineWidth=3;
  v.forEach((y,i)=>{const X=i/(n-1)*w,Y=h-10-(y-lo)/rg*(h-20);i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke()})}
function detail(a){const A=analyze(a),run=a.sport=='run',P=a.pts,tl=(v,l)=>`<div class="tile"><b>${v}</b><span>${l}</span></div>`;
 const r=resample(P.map((p,i)=>({lat:p[1],lon:p[2],a:p[3],brk:i>0&&(p[8]||0)!==(P[i-1][8]||0)}))),cl=findClimbs(r);
 const HZ=['Z1 Recuperación','Z2 Aeróbica','Z3 Tempo','Z4 Umbral','Z5 Máximo'],PZ=['Z1','Z2','Z3','Z4','Z5','Z6','Z7'];
 $('#det').innerHTML=`<div class="card"><b>Análisis · ${SPORT[a.sport||'ride']}${a.bike&&!run?' · '+BK[a.bike]:''}</b>
 <div class="tiles">${tl(km(a.dist)+' km','Distancia')}${tl(fmtT(a.mov),'En movimiento')}${tl(fmtT(a.el),'Tiempo total')}
 ${tl(spdTxt(A.v,run),run?'Ritmo prom.':'Vel. prom.')}${tl(run?pace(A.sMax):A.sMax.toFixed(1)+' km/h',run?'Mejor ritmo':'Vel. máx.')}${tl(Math.round(A.kcal)+' kcal','Energía est. ('+A.src+')')}
 ${tl('+'+Math.round(a.gain)+' m','Desnivel +')}${tl('−'+Math.round(A.loss)+' m','Desnivel −')}${tl(A.hr?Math.round(A.hr)+' / '+A.hrMax:'–','Pulso prom./máx.')}
 ${A.pw?tl(Math.round(A.pw)+' W','Potencia prom.')+tl(Math.round(A.np)+' W','Pot. normalizada')+tl(A.pMax+' W','Pot. máx.'):''}${A.cad?tl(Math.round(A.cad)+' rpm','Cadencia prom.'):''}</div>
 <p class="mut">La energía es una estimación (±15–25 %). Es más precisa con potencia, luego con pulso; para eso completa edad, sexo y peso en ☰ → Usuario.</p>
 <canvas id="c1" style="width:100%;height:110px"></canvas><div class="row" id="l1"></div>
 ${A.hr?`<canvas id="c2" style="width:100%;height:110px"></canvas><div class="row" id="l2"></div>`:''}
 ${A.hr?`<b>Zonas de pulso (FC máx ${A.mx})</b>${zbars(A.hrZ,HZ,['#5aa9ff','#2f9e5b','#e6c229','#f08a24','#d9363e'])}`:''}
 ${A.pw&&A.ftp?`<b>Zonas de potencia (FTP ${A.ftp} W)</b>${zbars(A.pwZ,PZ,['#8ea3bb','#5aa9ff','#2f9e5b','#e6c229','#f08a24','#d9363e','#8a1130'])}`:''}
 ${A.sp.length?`<b>Parciales por km</b><table><tr><th>Km</th><th>${run?'Ritmo':'Vel.'}</th><th>Tiempo</th><th>Pulso</th><th>+m</th></tr>${A.sp.map(s=>`<tr><td>${s.k}</td><td>${spdTxt(3600/Math.max(s.t,1),run)}</td><td>${fmtT(s.t)}</td><td>${s.hr||'–'}</td><td>${Math.round(s.gain)}</td></tr>`).join('')}</table>`:''}
 <b>Subidas</b><div class="row">${cl.map((c,i)=>`<span style="color:${gc(c.avg)}">${i+1}. ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join('')||'Sin subidas categorizadas'}</div>
 <div class="bar"><button id="gx">Exportar GPX</button><button id="dl">Borrar</button></div></div>`;
 const I=[],st=Math.max(1,Math.floor(P.length/300));for(let i=0;i<P.length;i+=st)I.push(i);const S_=k=>I.map(i=>P[i][k]??0);
 const L=(id,arr)=>{$('#'+id).innerHTML=arr.map(s=>`<span style="color:${s.c}">● ${s.n}</span>`).join('')};
 const s1=[{v:S_(3),c:'#8ea3bb',n:'Elevación'},{v:S_(7),c:'#ffd23f',n:'Velocidad'}];lineChart($('#c1'),s1);L('l1',s1);
 if(A.hr){const s2=[{v:S_(4),c:'#d9363e',n:'Pulso'}];if(A.pw)s2.push({v:S_(6),c:'#5aa9ff',n:'Potencia'});if(A.cad)s2.push({v:S_(5),c:'#2f9e5b',n:'Cadencia'});lineChart($('#c2'),s2);L('l2',s2)}
 $('#gx').onclick=()=>{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([toGpx(a)],{type:'application/gpx+xml'}));l.download=`rodada-${a.id}.gpx`;l.click()};
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta actividad?')){await tx('readwrite',s=>s.delete(a.id));$('#det').innerHTML='';list()}}}
function toGpx(a){let seg=null,b='';
 a.pts.forEach(p=>{const q=p[8]||0;if(q!==seg){b+=(seg!==null?'</trkseg>':'')+'<trkseg>';seg=q}
  b+=`<trkpt lat="${p[1]}" lon="${p[2]}"><ele>${p[3]??0}</ele><time>${new Date(p[0]).toISOString()}</time><extensions><g:TrackPointExtension>${p[4]?`<g:hr>${p[4]}</g:hr>`:''}${p[5]?`<g:cad>${p[5]}</g:cad>`:''}</g:TrackPointExtension></extensions></trkpt>`});
 return `<?xml version="1.0"?><gpx version="1.1" creator="Rodada" xmlns="http://www.topografix.com/GPX/1/1" xmlns:g="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Rodada ${new Date(a.t0).toISOString()}</name>${b}</trkseg></trk></gpx>`}
