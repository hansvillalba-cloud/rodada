/* Alertas visuales y sonoras (como un ciclocomputador) */
const AM={hr:['Pulso','lpm'],cad:['Cadencia','rpm'],spd:['Velocidad','km/h'],pow:['Potencia','W'],grade:['Pendiente','%']};
const AV={hr:()=>S.hr,cad:()=>S.cad,spd:()=>S.spd,pow:()=>S.pow,grade:()=>S.grade};
const defA=()=>({rules:[{m:'hr',c:'gt',v:Math.round((curU().maxHr||190)*.9),on:1},{m:'cad',c:'lt',v:60,on:0},{m:'spd',c:'gt',v:50,on:0},{m:'pow',c:'gt',v:Math.round((curU().ftp||250)*1.2),on:0}],drink:{on:1,min:20},eat:{on:1,min:45},km:{on:1}});
let AL,AS={cnt:[],last:{},km:0,kmEl:0,t:{}};
function loadA(){try{AL=JSON.parse(localStorage['al_'+S.uid]);if(!AL||!AL.rules)throw 0}catch{AL=defA()}}
const saveA=()=>localStorage['al_'+S.uid]=JSON.stringify(AL);
function fire(txt,red,hz){const a=$('#alert');a.textContent=txt;a.className=red?'red':'';clearTimeout(AS.hide);AS.hide=setTimeout(()=>a.className='hide',5000);
 beep(hz||880);try{navigator.vibrate&&navigator.vibrate([200,100,200])}catch{}say(txt)}
function alertTick(){if(!S.rec||S.pause)return;const n=Date.now(),el=getEl();
 AL.rules.forEach((r,i)=>{if(!r.on)return;const v=AV[r.m](),hit=r.c=='gt'?v>r.v:(v>0&&v<r.v);AS.cnt[i]=hit?(AS.cnt[i]||0)+1:0;
  if(AS.cnt[i]>=5&&n-(AS.last[i]||0)>30000){AS.last[i]=n;fire(`${AM[r.m][0]} ${r.c=='gt'?'alta':'baja'}: ${Math.round(v)} ${AM[r.m][1]}`,true,r.c=='gt'?990:440)}});
 [['drink','Hidrátate'],['eat','Come algo']].forEach(([k,t])=>{const c=AL[k];if(!c.on||!c.min)return;const q=Math.floor(el/(c.min*60));if(q>(AS.t[k]||0)){AS.t[k]=q;fire(t,false,660)}});
 if(AL.km.on){const k=Math.floor(S.dist/1000);if(k>AS.km){const sp=el-AS.kmEl;AS.km=k;AS.kmEl=el;fire(`Kilómetro ${k} · ${fmtT(sp)} · ${S.sport=='run'?pace(3600/sp)+' /km':(3600/sp).toFixed(1)+' km/h'}`,false,740)}}}
function alertReset(){AS={cnt:[],last:{},km:0,kmEl:0,t:{}}}
function alertsUI(){const box=$('#alc');box.replaceChildren();
 const num=(o,k,lb,min)=>{const n=document.createElement('input');n.type='number';n.min=min;n.value=o[k];n.setAttribute('aria-label',lb);n.onchange=()=>{o[k]=Math.max(min,+n.value||min);saveA()};return n};
 const chk=(o,lb)=>{const c=document.createElement('input');c.type='checkbox';c.checked=!!o.on;c.setAttribute('aria-label',lb);c.style.cssText='width:28px;height:28px;flex:none';c.onchange=()=>{o.on=c.checked?1:0;saveA()};return c};
 const opt=(s,pairs,cur)=>pairs.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;o.selected=v==cur;s.append(o)});
 AL.rules.forEach((r,i)=>{const d=document.createElement('div');d.className='irow';
  const m=document.createElement('select'),c=document.createElement('select');m.setAttribute('aria-label','Métrica');c.setAttribute('aria-label','Condición');
  opt(m,Object.entries(AM).map(([k,v])=>[k,v[0]]),r.m);opt(c,[['gt','Mayor que'],['lt','Menor que']],r.c);
  m.onchange=()=>{r.m=m.value;saveA()};c.onchange=()=>{r.c=c.value;saveA()};
  d.append(chk(r,'Activar alerta'),m,c,num(r,'v','Valor',0),btn('✕',()=>{AL.rules.splice(i,1);saveA();alertsUI()}));box.append(d)});
 const add=btn('+ Alerta',()=>{AL.rules.push({m:'hr',c:'gt',v:170,on:1});saveA();alertsUI()});box.append(add);
 [['drink','Hidratación cada (min)'],['eat','Comida cada (min)']].forEach(([k,t])=>{const d=document.createElement('div'),l=document.createElement('span');d.className='irow';l.textContent=t;l.style.flex='2 1 140px';d.append(chk(AL[k],t),l,num(AL[k],'min',t,1));box.append(d)});
 const d=document.createElement('div'),l=document.createElement('span');d.className='irow';l.textContent='Aviso cada kilómetro (tiempo y ritmo)';l.style.flex='2 1 140px';d.append(chk(AL.km,'Aviso por km'),l);box.append(d)}
setInterval(alertTick,1000);
