/* Fuerza en casa: pose con cámara (MediaPipe), repeticiones bien hechas y sesiones tipo gimnasio */
const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let FT=null,LT=0,SS=null,PL=null,stream=null,raf=0,facing='user',routines=[],AUD;
const VW=()=>$('#cam').videoWidth||640,VH=()=>$('#cam').videoHeight||480;
function ang(a,b,c){const W=VW(),H=VH(),x1=(a.x-b.x)*W,y1=(a.y-b.y)*H,x2=(c.x-b.x)*W,y2=(c.y-b.y)*H,m=Math.hypot(x1,y1)*Math.hypot(x2,y2);return m?Math.acos(Math.max(-1,Math.min(1,(x1*x2+y1*y2)/m)))*180/Math.PI:180}
const vis=(lm,t)=>t.every(i=>(lm[i].visibility==null?1:lm[i].visibility)>.5);
const angs=(lm,T)=>{const o=T.filter(t=>vis(lm,t)).map(t=>ang(lm[t[0]],lm[t[1]],lm[t[2]]));return o.length?o:null};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
/* up/mid/target: ángulo de extensión, de inicio de fase y mínimo para que la repetición cuente */
const EX={
 squat:{name:'Sentadillas',unit:'reps',up:160,mid:135,target:100,measure:lm=>{const a=angs(lm,[[23,25,27],[24,26,28]]);return a&&{v:mean(a)}}},
 pushup:{name:'Flexiones',unit:'reps',up:155,mid:125,target:92,measure:lm=>{const a=angs(lm,[[11,13,15],[12,14,16]]);if(!a)return null;const b=angs(lm,[[11,23,27],[12,24,28]]);return{v:mean(a),err:b&&mean(b)<150?'Mantén el cuerpo recto':null}}},
 lunge:{name:'Zancadas',unit:'reps',up:160,mid:135,target:105,measure:lm=>{const a=angs(lm,[[23,25,27],[24,26,28]]);return a&&a.length==2?{v:Math.min(...a)}:null}},
 plank:{name:'Plancha',unit:'s',measure:lm=>{const b=angs(lm,[[11,23,27],[12,24,28]]);return b&&{err:mean(b)<155?'Alinea hombros, cadera y tobillos':null}}}};
function repStep(E,st,m){const v=st.v=st.v==null?m.v:st.v*.4+m.v*.6;
 if(st.ph!=='down'){if(v<E.mid){st.ph='down';st.min=v;st.err=null}return null}
 st.min=Math.min(st.min,v);if(m.err)st.err=m.err;
 if(v>E.up){st.ph='up';const ok=st.min<=E.target&&!st.err;st.why=ok?null:(st.err||'Baja más: no cuenta');return ok?'ok':'bad'}
 return null}
function beep(f=880){try{AUD=AUD||new AudioContext();const o=AUD.createOscillator(),g=AUD.createGain();o.frequency.value=f;g.gain.value=.15;o.connect(g);g.connect(AUD.destination);o.start();o.stop(AUD.currentTime+.1)}catch{}}
const cue=(t,c)=>{const M=SS||FT;if(M)M.cueCls=c;const e=$('#cue');e.textContent=t;e.className=c||''};

/* ----- Rutinas por usuario ----- */
const DEFR=()=>[{name:'Cuerpo completo',items:[{ex:'squat',sets:3,reps:15,rest:45},{ex:'pushup',sets:3,reps:10,rest:45},{ex:'lunge',sets:3,reps:10,rest:45},{ex:'plank',sets:3,reps:30,rest:30}]}];
function loadR(){try{routines=JSON.parse(localStorage['rt_'+S.uid]);if(!Array.isArray(routines)||!routines.length)throw 0}catch{routines=DEFR()}}
const saveR=()=>localStorage['rt_'+S.uid]=JSON.stringify(routines);
function strInit(){loadR();const sel=$('#rt'),cur=Math.min(+sel.value||0,routines.length-1);
 sel.replaceChildren(...routines.map((r,i)=>{const o=document.createElement('option');o.value=i;o.textContent=r.name;return o}));sel.value=cur;builder();
 if(SS&&SS.paused){SS.paused=0;camStart().then(()=>loop()).catch(()=>{})}}
function builder(){const R=routines[+$('#rt').value],box=$('#rtc');box.replaceChildren();
 R.items.forEach((it,i)=>{const d=document.createElement('div');d.className='irow';
  const s=document.createElement('select');s.setAttribute('aria-label','Ejercicio');Object.keys(EX).forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=EX[k].name;o.selected=k==it.ex;s.append(o)});s.onchange=()=>{it.ex=s.value;saveR();builder()};
  const num=(k,lb,min)=>{const n=document.createElement('input');n.type='number';n.min=min;n.value=it[k];n.setAttribute('aria-label',lb);n.placeholder=lb;n.onchange=()=>{it[k]=Math.max(min,+n.value||min);saveR()};return n};
  d.append(s,num('sets','Series',1),num('reps',EX[it.ex].unit=='s'?'Segundos':'Reps',1),num('rest','Descanso s',0),btn('✕',()=>{R.items.splice(i,1);saveR();builder()}));box.append(d)});
 const c=document.createElement('div');c.className='bar';
 c.append(btn('+ Ejercicio',()=>{R.items.push({ex:'squat',sets:3,reps:12,rest:45});saveR();builder()}),
  btn('Renombrar',()=>{const n=(prompt('Nombre de la rutina',R.name)||'').trim().slice(0,40);if(n){R.name=n;saveR();strInit()}}),
  btn('Borrar rutina',()=>{if(routines.length>1&&confirm('¿Borrar esta rutina?')){routines.splice(+$('#rt').value,1);saveR();$('#rt').value=0;strInit()}}));box.append(c);
 const h=document.createElement('p');h.className='mut';h.textContent='Campos: ejercicio · series · repeticiones (o segundos) · descanso en segundos.';box.append(h)}
$('#rt').onchange=builder;
$('#rtn').onclick=()=>{const n=(prompt('Nombre de la nueva rutina')||'').trim().slice(0,40);if(!n)return;routines.push({name:n,items:[{ex:'squat',sets:3,reps:12,rest:45}]});saveR();strInit();$('#rt').value=routines.length-1;builder()};

/* ----- Cámara y pose ----- */
async function camStart(){camStop();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facing,width:{ideal:640},height:{ideal:480}},audio:false});
 const v=$('#cam');v.srcObject=stream;await v.play();$('#vid').classList.toggle('mir',facing=='user')}
function camStop(){if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;cancelAnimationFrame(raf)}
async function poseInit(){if(PL)return;const m=await import(MP+'/vision_bundle.mjs'),v=await m.FilesetResolver.forVisionTasks(MP+'/wasm');
 const mk=d=>m.PoseLandmarker.createFromOptions(v,{baseOptions:{modelAssetPath:MODEL,delegate:d},runningMode:'VIDEO',numPoses:1});
 try{PL=await mk('GPU')}catch{PL=await mk('CPU')}}
const BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
function draw(lm){const v=$('#cam'),c=$('#ov'),bw=c.clientWidth,bh=c.clientHeight;c.width=bw;c.height=bh;if(!lm||!v.videoWidth)return;
 const g=c.getContext('2d'),sc=Math.min(bw/v.videoWidth,bh/v.videoHeight),ox=(bw-v.videoWidth*sc)/2,oy=(bh-v.videoHeight*sc)/2,P=i=>[ox+lm[i].x*v.videoWidth*sc,oy+lm[i].y*v.videoHeight*sc];
 g.lineWidth=4;const cc=(SS||FT||{}).cueCls;g.strokeStyle=cc=='bad'?'#d9363e':cc=='warn'?'#e6c229':'#2f9e5b';
 BONES.forEach(([a,b])=>{if(vis(lm,[a,b])){g.beginPath();g.moveTo(...P(a));g.lineTo(...P(b));g.stroke()}})}
function loop(){cancelAnimationFrame(raf);const f=ts=>{raf=requestAnimationFrame(f);const M=SS||FT;if(!M||M.paused||ts-LT<66)return;LT=ts;
  const v=$('#cam');if(!PL||v.readyState<2)return;let r;try{r=PL.detectForVideo(v,performance.now())}catch{return}
  const lm=r.landmarks&&r.landmarks[0];draw(lm);if(SS){if(SS.phase=='work')step(lm,performance.now())}else fitStep(lm)};raf=requestAnimationFrame(f)}

/* ----- Sesión ----- */
function step(lm,now){const it=SS.R.items[SS.i],E=EX[it.ex];
 if(!lm){cue('No te veo: encuadra todo tu cuerpo','warn');return}
 const m=E.measure(lm);if(!m){cue('Ajusta la cámara: no veo bien las articulaciones','warn');return}
 if(E.unit=='s'){const dt=Math.min((now-SS.last)/1000,.3);SS.last=now;
  if(m.err)cue(m.err,'warn');else{SS.secs+=dt;cue('¡Mantén!','ok');SS.good=Math.floor(SS.secs)}}
 else{const r=repStep(E,SS.st,m);
  if(r=='ok'){SS.good++;beep();say(String(SS.good));cue('¡Buena!','ok')}
  else if(r=='bad'){SS.bad++;beep(300);cue(SS.st.why,'bad')}
  else if(SS.st.ph=='down')cue(SS.st.min<=E.target?'¡Sube!':'Baja más','warn')}
 if(SS.good>=it.reps)endSet();sui()}
function logSet(){const it=SS.R.items[SS.i];SS.log.push({ex:it.ex,set:SS.set,target:it.reps,good:SS.good,bad:SS.bad,man:SS.man})}
function resetSet(){Object.assign(SS,{good:0,bad:0,man:0,secs:0,st:{ph:'up',v:null}})}
function endSet(){const it=SS.R.items[SS.i];logSet();beep(1000);
 if(SS.set<it.sets)SS.set++;else{SS.i++;SS.set=1}
 if(SS.i>=SS.R.items.length)return finish();
 resetSet();SS.phase='rest';SS.tm=it.rest||1;cue('Descansa','');say('Descansa');sui()}
function sTick(){if(!SS||SS.paused)return;
 if(SS.phase=='ready'){if(--SS.tm<=0){SS.phase='work';SS.last=performance.now();beep(1200);say('Ya');cue('¡Empieza!','ok')}else if(SS.tm<=3)beep(660)}
 else if(SS.phase=='rest'){if(--SS.tm<=0){SS.phase='ready';SS.tm=5}else if(SS.tm<=3)beep(660)}
 sui()}
function sui(){if(!SS)return;const it=SS.R.items[Math.min(SS.i,SS.R.items.length-1)],E=EX[it.ex],pl=E.unit=='s';
 set('sx-name',E.name);set('sx-set',`Serie ${SS.set}/${it.sets} · ejercicio ${SS.i+1}/${SS.R.items.length}`);
 set('sx-rep',`${SS.good}/${it.reps}${pl?' s':''}`);$('#sx-bar').style.width=Math.min(100,SS.good/it.reps*100)+'%';
 set('sx-msg',SS.phase=='ready'?`Prepárate… ${SS.tm}`:SS.phase=='rest'?`Descanso: ${SS.tm} s`:SS.bad?`${SS.bad} repeticiones no contadas por técnica`:'')}
async function startSession(){const R=routines[+$('#rt').value];if(!R||!R.items.length)return toast('Agrega ejercicios a la rutina');
 SS={R,i:0,set:1,good:0,bad:0,man:0,secs:0,phase:'ready',tm:5,st:{ph:'up',v:null},log:[],t0:Date.now(),cueCls:''};
 $('#str-setup').classList.add('hide');$('#str-run').classList.remove('hide');cue('Cargando detección de pose…','');wake();
 SS.timer=setInterval(sTick,1000);sui();
 try{await camStart();await poseInit();cue('Colócate de cuerpo completo','warn');loop()}catch(e){toast('Cámara o IA no disponible: '+(e.message||e)+'. Puedes contar con +1 manual.');cue('Modo manual','warn')}}
async function finish(){const s=SS;if(!s)return;SS=null;clearInterval(s.timer);camStop();try{wl&&wl.release()}catch{}
 if(s.log.length)await tx('readwrite',x=>x.put({id:Date.now(),t0:s.t0,uid:S.uid,routine:s.R.name,dur:(Date.now()-s.t0)/1000,log:s.log}),'sess');
 $('#str-run').classList.add('hide');$('#str-setup').classList.remove('hide');say('Sesión terminada');toast(s.log.length?'Sesión guardada en Actividades':'Sesión sin series');list()}
function strPause(){if(SS){SS.paused=1;camStop()}}
$('#rts').onclick=startSession;
$('#sx-man').onclick=()=>{if(SS&&SS.phase=='work'){SS.good++;SS.man++;if(SS.good>=SS.R.items[SS.i].reps)endSet();sui()}};
$('#sx-skip').onclick=()=>{if(!SS)return;SS.i++;SS.set=1;if(SS.i>=SS.R.items.length)return finish();resetSet();SS.phase='ready';SS.tm=5;sui()};
$('#sx-flip').onclick=()=>{facing=facing=='user'?'environment':'user';camStart().catch(e=>toast('Cámara: '+e.message))};
$('#sx-end').onclick=()=>{if(SS&&confirm('¿Terminar la sesión?')){if(SS.good||SS.bad)logSet();finish()}};
