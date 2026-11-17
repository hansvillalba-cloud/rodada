/* Usuarios, lista de actividades y análisis por usuario */
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
let users;try{users=JSON.parse(localStorage.users);if(!Array.isArray(users)||!users.length)throw 0}catch{users=[{id:'u1',name:'Yo',maxHr:190,ftp:0,kg:70}]}
S.uid=localStorage.uid&&users.some(u=>u.id==localStorage.uid)?localStorage.uid:users[0].id;
const curU=()=>users.find(u=>u.id==S.uid)||users[0];
const saveUsers=()=>{localStorage.users=JSON.stringify(users);localStorage.uid=S.uid};
function usersUI(){$('#usr').replaceChildren(...users.map(u=>{const o=document.createElement('option');o.value=u.id;o.textContent=u.name;o.selected=u.id==S.uid;return o}));
 const u=curU();$('#u-hr').value=u.maxHr;$('#u-ftp').value=u.ftp||'';$('#u-kg').value=u.kg}
[['u-hr','maxHr'],['u-ftp','ftp'],['u-kg','kg']].forEach(([i,k])=>$('#'+i).onchange=e=>{curU()[k]=+e.target.value||0;saveUsers()});
$('#usr').onchange=e=>{if(S.rec){usersUI();return toast('Termina la actividad primero')}S.uid=e.target.value;saveUsers();usersUI();list();strInit();loadA();alertsUI()};
$('#usn').onclick=()=>{if(S.rec)return toast('Termina la actividad primero');const n=(prompt('Nombre del nuevo usuario')||'').trim().slice(0,30);if(!n)return;
 users.push({id:'u'+Date.now(),name:n,maxHr:190,ftp:0,kg:70});S.uid=users.at(-1).id;saveUsers();usersUI();list();strInit();loadA();alertsUI()};

const SPORT={ride:'Ciclismo',run:'Correr'},BK={road:'Ruta',mtb:'MTB',gravel:'Gravel',urban:'Urbana',ebike:'Eléctrica'};
const spdTxt=(v,run)=>run?pace(v)+' /km':v.toFixed(1)+' km/h';
async function list(){
 const A=(await tx('readonly',s=>s.getAll())).filter(x=>x.id!=='draft'&&(x.uid||'u1')==S.uid);
 const Q=(await tx('readonly',s=>s.getAll(),'sess')).filter(x=>(x.uid||'u1')==S.uid);
 const items=[...A.map(a=>({k:'a',t:a.t0,a})),...Q.map(a=>({k:'s',t:a.t0,a}))].sort((x,y)=>y.t-x.t);
 const sum=d=>{const f=items.filter(x=>x.t>=Date.now()-d*864e5),R=f.filter(x=>x.k=='a').map(x=>x.a);
  return `${f.length} actividades · ${km(R.reduce((s,a)=>s+a.dist,0))} km · ${fmtT(R.reduce((s,a)=>s+a.mov,0))} · +${Math.round(R.reduce((s,a)=>s+a.gain,0))} m`};
 $('#sum').innerHTML=`<b>${esc(curU().name)}</b><div class="mut">7 días: ${sum(7)}</div><div class="mut">30 días: ${sum(30)}</div>`;
 const d=t=>new Date(t).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'short'});
 $('#acts').innerHTML=items.length?items.map(x=>x.k=='a'?`<div class="card" data-k="a" data-id="${x.a.id}" style="cursor:pointer"><b>${d(x.t)} · ${SPORT[x.a.sport||'ride']}${x.a.bike&&(x.a.sport||'ride')=='ride'?' · '+BK[x.a.bike]:''}</b><div class="row"><span>${km(x.a.dist)} km</span><span>${fmtT(x.a.mov)}</span><span>+${Math.round(x.a.gain)} m</span><span>${spdTxt(x.a.mov?x.a.dist/x.a.mov*3.6:0,x.a.sport=='run')}</span></div></div>`
  :`<div class="card" data-k="s" data-id="${x.a.id}" style="cursor:pointer"><b>${d(x.t)} · ${x.a.kind=='fit'?'Postura':'Fuerza'} · ${esc(x.a.routine)}</b><div class="row"><span>${x.a.kind=='fit'?`${x.a.items.filter(i=>i.state=='ok').length}/${x.a.items.length} parámetros en rango`:`${fmtT(x.a.dur)}</span><span>${x.a.log.reduce((s,l)=>s+l.good,0)} reps buenas`}</span></div></div>`).join(''):'<p class="mut">Aún no hay actividades para este usuario.</p>';
 document.querySelectorAll('#acts .card').forEach(c=>c.onclick=()=>{const it=items.find(x=>x.k==c.dataset.k&&x.a.id==c.dataset.id);it.k=='a'?detail(it.a):sessDetail(it.a);$('#det').scrollIntoView({behavior:'smooth'})})}

function analyze(a){const P=a.pts,u=curU(),mx=u.maxHr||190,ftp=u.ftp||0,kg=u.kg||70;
 const hrZ=[0,0,0,0,0],pwZ=[0,0,0,0,0,0,0];let hrS=0,hrN=0,hrMax=0,pS=0,pN=0,pMax=0,cS=0,cN=0,sMax=0,loss=0;
 for(let i=0;i<P.length;i++){const p=P[i],dt=i?Math.min((p[0]-P[i-1][0])/1000,10):0;
  if(p[4]){hrS+=p[4]*dt;hrN+=dt;hrMax=Math.max(hrMax,p[4]);const f=p[4]/mx;hrZ[f<.6?0:f<.7?1:f<.8?2:f<.9?3:4]+=dt}
  if(p[6]){pS+=p[6]*dt;pN+=dt;pMax=Math.max(pMax,p[6]);if(ftp){const f=p[6]/ftp;pwZ[f<.55?0:f<.75?1:f<.9?2:f<1.05?3:f<1.2?4:f<1.5?5:6]+=dt}}
  if(p[5]){cS+=p[5]*dt;cN+=dt}
  if(p[7]&&p[7]<90)sMax=Math.max(sMax,p[7]);
  if(i&&p[3]!=null&&P[i-1][3]!=null&&p[3]<P[i-1][3])loss+=P[i-1][3]-p[3]}
 let np=0;if(pN>0){const w=P.map(p=>p[6]||0),k=30;let acc=0,n=0,run=0;for(let i=0;i<w.length;i++){run+=w[i];if(i>=k)run-=w[i-k];if(i>=k-1){acc+=Math.pow(run/k,4);n++}}np=n?Math.pow(acc/n,.25):0}
 const sp=[];let cd=0,t0=P[0]&&P[0][0],nx=1000,hA=0,hC=0,gn=0;
 for(let i=1;i<P.length;i++){cd+=hav(P[i-1][1],P[i-1][2],P[i][1],P[i][2]);if(P[i][4]){hA+=P[i][4];hC++}
  if(P[i][3]!=null&&P[i-1][3]!=null&&P[i][3]>P[i-1][3])gn+=P[i][3]-P[i-1][3];
  if(cd>=nx){sp.push({k:nx/1000,t:(P[i][0]-t0)/1000,hr:hC?Math.round(hA/hC):0,gain:gn});t0=P[i][0];hA=hC=0;gn=0;nx+=1000}}
 const h=a.mov/3600,kmT=a.dist/1000,v=h?kmT/h:0,run=a.sport=='run';
 const kcal=pN>0?pS/1000:run?kg*kmT:(v<16?4:v<20?6:v<25?8:v<30?10:12)*kg*h;
 return{hrZ,pwZ,hr:hrN?hrS/hrN:0,hrMax,pw:pN?pS/pN:0,pMax,np,cad:cN?cS/cN:0,sMax,loss,sp,kcal,v,mx,ftp}}
function zbars(z,lab,col){const t=z.reduce((s,x)=>s+x,0)||1;return z.map((x,i)=>`<div class="zr"><span>${lab[i]}</span><i style="width:${Math.max(2,x/t*100)}%;background:${col[i]}"></i><span>${fmtT(x)}</span></div>`).join('')}
function lineChart(cv,ser){const w=cv.width=cv.clientWidth*2,h=cv.height=220,g=cv.getContext('2d');g.clearRect(0,0,w,h);
 ser.forEach(s=>{const v=s.v,n=v.length;if(n<2)return;const lo=Math.min(...v),hi=Math.max(...v),rg=(hi-lo)||1;g.beginPath();g.strokeStyle=s.c;g.lineWidth=3;
  v.forEach((y,i)=>{const X=i/(n-1)*w,Y=h-10-(y-lo)/rg*(h-20);i?g.lineTo(X,Y):g.moveTo(X,Y)});g.stroke()})}
function detail(a){const A=analyze(a),run=a.sport=='run',P=a.pts,tl=(v,l)=>`<div class="tile"><b>${v}</b><span>${l}</span></div>`;
 const r=resample(P.map(p=>({lat:p[1],lon:p[2],a:p[3]}))),cl=findClimbs(r);
 const HZ=['Z1 Recuperación','Z2 Aeróbica','Z3 Tempo','Z4 Umbral','Z5 Máximo'],PZ=['Z1','Z2','Z3','Z4','Z5','Z6','Z7'];
 $('#det').innerHTML=`<div class="card"><b>Análisis · ${SPORT[a.sport||'ride']}${a.bike&&!run?' · '+BK[a.bike]:''}</b>
 <div class="tiles">${tl(km(a.dist)+' km','Distancia')}${tl(fmtT(a.mov),'En movimiento')}${tl(fmtT(a.el),'Tiempo total')}
 ${tl(spdTxt(A.v,run),run?'Ritmo prom.':'Vel. prom.')}${tl(run?pace(A.sMax):A.sMax.toFixed(1)+' km/h',run?'Mejor ritmo':'Vel. máx.')}${tl(Math.round(A.kcal)+' kcal','Energía est.')}
 ${tl('+'+Math.round(a.gain)+' m','Desnivel +')}${tl('−'+Math.round(A.loss)+' m','Desnivel −')}${tl(A.hr?Math.round(A.hr)+' / '+A.hrMax:'–','Pulso prom./máx.')}
 ${A.pw?tl(Math.round(A.pw)+' W','Potencia prom.')+tl(Math.round(A.np)+' W','Pot. normalizada')+tl(A.pMax+' W','Pot. máx.'):''}${A.cad?tl(Math.round(A.cad)+' rpm','Cadencia prom.'):''}</div>
 <canvas id="c1" style="width:100%;height:110px"></canvas><div class="row" id="l1"></div>
 ${A.hr?`<canvas id="c2" style="width:100%;height:110px"></canvas><div class="row" id="l2"></div>`:''}
 ${A.hr?`<b>Zonas de pulso (FC máx ${A.mx})</b>${zbars(A.hrZ,HZ,['#5aa9ff','#2f9e5b','#e6c229','#f08a24','#d9363e'])}`:''}
 ${A.pw&&A.ftp?`<b>Zonas de potencia (FTP ${A.ftp} W)</b>${zbars(A.pwZ,PZ,['#8ea3bb','#5aa9ff','#2f9e5b','#e6c229','#f08a24','#d9363e','#8a1130'])}`:''}
 ${A.sp.length?`<b>Parciales por km</b><table><tr><th>Km</th><th>${run?'Ritmo':'Vel.'}</th><th>Tiempo</th><th>Pulso</th><th>+m</th></tr>${A.sp.map(s=>`<tr><td>${s.k}</td><td>${spdTxt(3600/s.t,run)}</td><td>${fmtT(s.t)}</td><td>${s.hr||'–'}</td><td>${Math.round(s.gain)}</td></tr>`).join('')}</table>`:''}
 <b>Subidas</b><div class="row">${cl.map((c,i)=>`<span style="color:${gc(c.avg)}">${i+1}. ${km(c.len)} km · ${c.avg.toFixed(1)}% · +${Math.round(c.gain)} m</span>`).join('')||'Sin subidas categorizadas'}</div>
 <div class="bar"><button id="gx">Exportar GPX</button><button id="dl">Borrar</button></div></div>`;
 const I=[],st=Math.max(1,Math.floor(P.length/300));for(let i=0;i<P.length;i+=st)I.push(i);const S_=k=>I.map(i=>P[i][k]??0);
 const L=(id,arr)=>{$('#'+id).innerHTML=arr.map(s=>`<span style="color:${s.c}">● ${s.n}</span>`).join('')};
 const s1=[{v:S_(3),c:'#8ea3bb',n:'Elevación'},{v:S_(7),c:'#ffd23f',n:run?'Velocidad':'Velocidad'}];lineChart($('#c1'),s1);L('l1',s1);
 if(A.hr){const s2=[{v:S_(4),c:'#d9363e',n:'Pulso'}];if(A.pw)s2.push({v:S_(6),c:'#5aa9ff',n:'Potencia'});if(A.cad)s2.push({v:S_(5),c:'#2f9e5b',n:'Cadencia'});lineChart($('#c2'),s2);L('l2',s2)}
 $('#gx').onclick=()=>{const l=document.createElement('a');l.href=URL.createObjectURL(new Blob([toGpx(a)],{type:'application/gpx+xml'}));l.download=`rodada-${a.id}.gpx`;l.click()};
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta actividad?')){await tx('readwrite',s=>s.delete(a.id));$('#det').innerHTML='';list()}}}
function toGpx(a){return `<?xml version="1.0"?><gpx version="1.1" creator="Rodada" xmlns="http://www.topografix.com/GPX/1/1" xmlns:g="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Rodada ${new Date(a.t0).toISOString()}</name><trkseg>${a.pts.map(p=>`<trkpt lat="${p[1]}" lon="${p[2]}"><ele>${p[3]??0}</ele><time>${new Date(p[0]).toISOString()}</time><extensions><g:TrackPointExtension>${p[4]?`<g:hr>${p[4]}</g:hr>`:''}${p[5]?`<g:cad>${p[5]}</g:cad>`:''}</g:TrackPointExtension></extensions></trkpt>`).join('')}</trkseg></trk></gpx>`}
function sessDetail(s){if(s.kind=='fit')return fitDetail(s);const G=s.log.reduce((t,l)=>t+l.good,0),B=s.log.reduce((t,l)=>t+l.bad,0),by={};
 s.log.forEach(l=>{const o=by[l.ex]=by[l.ex]||{sets:0,good:0,bad:0,man:0,target:0};o.sets++;o.good+=l.good;o.bad+=l.bad;o.man+=l.man||0;o.target+=l.target});
 $('#det').innerHTML=`<div class="card"><b>Sesión de fuerza · ${esc(s.routine)}</b><div class="tiles"><div class="tile"><b>${fmtT(s.dur)}</b><span>Duración</span></div><div class="tile"><b>${G}</b><span>Reps buenas</span></div><div class="tile"><b>${G+B?Math.round(G/(G+B)*100):100}%</b><span>Calidad de técnica</span></div></div>
 <table><tr><th>Ejercicio</th><th>Series</th><th>Buenas</th><th>Malas</th><th>Meta</th></tr>${Object.entries(by).map(([k,o])=>`<tr><td>${esc(EX[k]?EX[k].name:k)}</td><td>${o.sets}</td><td>${o.good}</td><td>${o.bad}</td><td>${o.target}</td></tr>`).join('')}</table>
 <button id="dl">Borrar</button></div>`;
 $('#dl').onclick=async()=>{if(confirm('¿Borrar esta sesión?')){await tx('readwrite',x=>x.delete(s.id),'sess');$('#det').innerHTML='';list()}}}
