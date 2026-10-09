/*
 * Siege Smash - medieval catapult game
 * Canvas 2D rendering + Matter.js physics (loaded from a CDN, with a fallback).
 * Sections: audio, data tables, level generation, input, update, drawing, maps, guide.
 */
(function(){
var urls=['https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js','https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js'],k=0;
function boot(){
if(!window.Matter){document.body.insertAdjacentHTML('afterbegin','<p>Game engine failed to load. Check your connection and reload.</p>');throw new Error('Matter missing')}
const {Engine,Bodies,Body,Events,Composite}=Matter;
const World={add:(w,b)=>Composite.add(w,b),remove:(w,b)=>Composite.remove(w,b)};
let err='';
const startBtn=document.getElementById('start'),endBtn=document.getElementById('end');
function newGame(){err='';level=1;lives=3;total=0;try{load()}catch(e){err=String(e&&e.message||e);S='title'}if(S==='play')startBtn.textContent='RESTART GAME'}
function endGame(){if(S==='title'||S==='over')return;if(S==='play')total+=lvScore;if(total>best){best=total;try{localStorage.setItem('ss-best',best)}catch(e){}}
  S='over';kt=0;drag=false;dpos=null;fl=[];startBtn.textContent='START GAME';sfx.lose()}
startBtn.onclick=()=>{au();if(S==='play')newGame();else begin()};endBtn.onclick=endGame;document.getElementById('how').onclick=()=>{au();openGuide()};document.getElementById('mapb').onclick=()=>{au();openMaps()};
const W=480,H=270,GY=246,AX=52,AY=214,MAXD=45,G=.278;
const cv=document.getElementById('c');let ctx=cv.getContext('2d');cv.width=W;cv.height=H;ctx.imageSmoothingEnabled=false;
let best=0;try{best=+localStorage.getItem('ss-best')||0}catch(e){}
/* ---------- audio ---------- */
let ac,mg,muted=false,lastS=0;
function tone(f,d,t,v,s,w){if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t0=ac.currentTime+(w||0);o.type=t||'square';o.frequency.setValueAtTime(f,t0);if(s)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+s),t0+d);g.gain.setValueAtTime(v||.08,t0);g.gain.exponentialRampToValueAtTime(.0001,t0+d);o.connect(g);g.connect(mg);o.start(t0);o.stop(t0+d)}
function au(){if(!ac){try{ac=new(window.AudioContext||window.webkitAudioContext)();mg=ac.createGain();mg.gain.value=muted?0:1;mg.connect(ac.destination);music()}catch(e){ac=null}}if(ac&&ac.state==='suspended')ac.resume()}
function music(){const L=[0,3,7,12,10,7,3,7,0,3,7,12,14,12,10,7],B=[0,0,7,7,5,5,7,7];let i=0;setInterval(()=>{const k=i++%16;tone(220*2**(L[k]/12),.18,'square',.03);if(k%2==0)tone(110*2**(B[k>>1]/12),.35,'triangle',.07)},230)}
const sfx={launch:()=>tone(200,.3,'square',.1,500),split:()=>{tone(500,.1,'square',.08,300);tone(700,.1,'square',.08,300,.05)},
hit:()=>{const n=performance.now();if(n-lastS<60)return;lastS=n;tone(90+Math.random()*80,.09,'sawtooth',.08,-40)},
crash:()=>{tone(140,.25,'sawtooth',.12,-100);tone(70,.3,'square',.1,-30)},
win:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.2,'square',.08,0,i*.12)),
lose:()=>[330,262,196].forEach((f,i)=>tone(f,.25,'triangle',.1,0,i*.18))};
const muteBtn=document.getElementById('mute');
function setMute(){muted=!muted;if(mg)mg.gain.value=muted?0:1;muteBtn.textContent='SOUND: '+(muted?'OFF':'ON')+' (M)'}
muteBtn.onclick=()=>{au();setMute()};addEventListener('keydown',e=>{if(e.key==='m'||e.key==='M')setMute()});
/* ---------- data ---------- */
const M={wood:{hp:30,pw:.4,c:'#a8743a',d:.0012,v:50},stone:{hp:70,pw:.8,c:'#8d93a0',d:.002,v:100},iron:{hp:150,pw:1.2,c:'#4a5d78',d:.004,v:200}};
const E={soldier:{hp:12,w:11,h:11,c:'#d9a066',v:500},archer:{hp:12,w:11,h:11,c:'#5fa05f',v:600},knight:{hp:55,w:12,h:12,c:'#b8c0cc',v:800},troll:{hp:140,w:16,h:18,c:'#5d8a3a',v:1500},king:{hp:40,w:13,h:13,c:'#e8c14a',v:0}};
const P={stone:{r:4,pw:1,c:'#aab0bb',k:.26,d:.004},split:{r:4,pw:.5,c:'#d9b27a',k:.26,d:.004},fire:{r:4,pw:.7,c:'#ff7a1a',k:.26,d:.003},boulder:{r:7,pw:3,c:'#5b5f6a',k:.23,d:.006}};
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
/* ---------- state ---------- */
let eng,ground,ents=[],fl=[],parts=[],ammo=[],S='title',level=1,lives=3,total=0,lvScore=0,par=0,wind=0,drag=false,dpos=null,settle=0,kt=0,stars=0,bonus=0,frame=0,clouds=[[40,30],[200,50],[360,24]];
function mk(x,y,w,h,s,o){const b=Bodies.rectangle(x,y,w,h,{density:s.d,friction:.9,frictionStatic:1,restitution:.05,sleepThreshold:40});Object.assign(b,{hp:s.hp,hp0:s.hp,pw:s.pw,w,h,c:s.c,v:s.v},o);World.add(eng.world,b);ents.push(b);return b}
function load(){
  eng=Engine.create({enableSleeping:true});eng.positionIterations=10;eng.velocityIterations=8;
  ground=Bodies.rectangle(W/2,GY+20,W*3,40,{isStatic:true,friction:1});ground.hp=Infinity;ground.pw=.3;World.add(eng.world,ground);
  ents=[];fl=[];parts=[];drag=false;dpos=null;settle=0;kt=0;lvScore=0;php=100;hurt=0;arrows=[];loseWhy='';
  const n=level,r=rng(n*7919+13),floors=Math.min(2+(n>>1),6),towers=n>=2?[352,416]:[392];
  const ps=Math.min(.12+.08*n,.5),pi=n>=3?Math.min(.06*(n-2),.35):0;
  const pick=()=>{const q=r();return q<pi?M.iron:q<pi+ps?M.stone:M.wood};
  const kf=n<3?floors-1:Math.max(0,floors-1-Math.floor(n*.6)),slots=[];
  towers.forEach((cx,ti)=>{for(let f=0;f<floors;f++){const base=GY-f*28;
    [-24,24].forEach(dx=>{const s=pick();mk(cx+dx,base-11,6,22,s,{mat:s})});
    const s=pick();mk(cx,base-25,66,6,s,{mat:s});
    if(ti===towers.length-1&&f===kf)slots.push({cx,base,king:1});else slots.push({cx,base})}});
  slots.sort((a,b)=>b.king?1:a.king?-1:r()-.5);const ks=slots.find(s=>s.king);
  const ec=Math.min(2+(n>>1),slots.length-1);let cnt=0;
  const en=(k,x,y,o)=>{const s=E[k];mk(x,y,s.w,s.h,{...s,pw:.3,d:.0015},{enemy:1,kind:k,...o})};
  en('king',ks.cx,ks.base-E.king.h/2,{king:1});
  for(const s of slots){if(s.king||cnt>=ec)continue;cnt++;
    const k=n>=4&&r()<.25?'troll':r()<Math.min(.15+.07*n,.5)?'knight':'soldier';en(k,s.cx,s.base-E[k].h/2)}
  const spots=[];[22,-22,0].forEach(dx=>towers.forEach(cx=>spots.push(cx+dx)));
  const na=Math.min(1+((n-1)>>1),spots.length);
  for(let i=0;i<na;i++)en('archer',spots[i],GY-floors*28-5.5,{cd:220+Math.random()*140+i*50});
  wind=n>=2?Math.round((r()*2-1)*Math.min(.6+.25*n,3)*10)/10:0;
  const types=['stone','stone','split','fire','boulder'];ammo=['stone'];while(ammo.length<6)ammo.push(types[Math.floor(r()*(n>=2?5:4))]);
  par=ents.filter(e=>!e.king).reduce((a,e)=>a+e.v,0)*.6+1000;
  Events.on(eng,'collisionStart',ev=>{for(const p of ev.pairs){const a=p.bodyA,b=p.bodyB,rv=Math.hypot(a.velocity.x-b.velocity.x,a.velocity.y-b.velocity.y);if(rv<1.2)continue;hit(a,b,rv);hit(b,a,rv);if(rv>3)sfx.hit()}});
  Events.on(eng,'beforeUpdate',()=>{for(const f of fl){Body.applyForce(f.b,f.b.position,{x:wind*.008*f.b.mass/277.8,y:0})}
    for(const e of ents)if(e.burn&&!e.dead){e.hp-=.12;if(frame%6==0)puff(e.position.x,e.position.y-e.h/2,'#ff9a1f',1);if(e.hp<=0)kill(e)}});
  S='play'}
function hit(a,b,rv){if(a.hp===undefined||!isFinite(a.hp)||a.dead)return;const d=(rv-1.2)*(b.pw||0)*6;if(d<=0)return;a.hp-=d;if(b.fire&&a.mat===M.wood)a.burn=1;if(a.hp<=0)kill(a)}
function puff(x,y,c,n){for(let i=0;i<n;i++)parts.push({x,y,vx:(Math.random()-.5)*2,vy:-Math.random()*2,l:30,c})}
function kill(e){e.dead=true;World.remove(eng.world,e);lvScore+=e.v;puff(e.position.x,e.position.y,e.c,10);sfx.crash();if(e.king&&!kt)kt=70}
/* ---------- input ---------- */
const pt=e=>{const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
function clampPull(p){let dx=p.x-AX,dy=p.y-AY,d=Math.hypot(dx,dy);if(d>MAXD){dx*=MAXD/d;dy*=MAXD/d}return{x:AX+dx,y:AY+dy}}
cv.addEventListener('pointerdown',e=>{au();const p=pt(e);
  if(S==='guide'){guideClick(p);return}
  if(S==='maps'){mapsClick(p);return}
  if(S==='title'){begin();return}
  if(S==='win'){level++;nextLoad();return}
  if(S==='lose'){nextLoad();return}
  if(S==='over'){S='title';return}
  const f=fl.find(f=>f.type==='split'&&!f.sp);if(f){split(f);return}
  if(!fl.length&&ammo.length&&!kt&&Math.hypot(p.x-AX,p.y-AY)<32){drag=true;cv.setPointerCapture(e.pointerId);dpos=clampPull(p)}});
cv.addEventListener('pointermove',e=>{if(drag)dpos=clampPull(pt(e));else if(S==='maps')hov=mapHit(pt(e))});
cv.addEventListener('pointerup',()=>{if(!drag)return;drag=false;const dx=AX-dpos.x,dy=AY-dpos.y;if(Math.hypot(dx,dy)<8){dpos=null;return}
  const t=ammo.shift(),s=P[t],b=Bodies.circle(dpos.x,dpos.y,s.r,{density:s.d,restitution:.2,friction:.6,frictionAir:0});
  Object.assign(b,{pw:s.pw,fire:t==='fire',c:s.c,r:s.r});Body.setVelocity(b,{x:dx*s.k,y:dy*s.k});World.add(eng.world,b);fl.push({b,t:0,type:t,sp:false});dpos=null;sfx.launch()});
function nextLoad(){err='';try{load()}catch(e){err=String(e&&e.message||e);S='title'}}
function split(f){f.sp=true;const b=f.b,v=b.velocity;sfx.split();World.remove(eng.world,b);fl.splice(fl.indexOf(f),1);
  [-1.8,0,1.8].forEach(dy=>{const n=Bodies.circle(b.position.x,b.position.y+dy*2,3,{density:.004,restitution:.2,friction:.6,frictionAir:0});Object.assign(n,{pw:.5,c:P.split.c,r:3});Body.setVelocity(n,{x:v.x,y:v.y+dy});World.add(eng.world,n);fl.push({b:n,t:0,type:'split',sp:true})})}
/* ---------- update ---------- */
function step(){frame++;if(S==='guide'||S==='maps')return;
  if(S==='play'||kt){Engine.update(eng,1000/60);gameAI();
    for(const f of fl.slice()){f.t++;const b=f.b,sp=Math.hypot(b.velocity.x,b.velocity.y);if(f.t>240||b.position.x>W+40||b.position.y>H+40||(f.t>60&&sp<.25)){World.remove(eng.world,b);fl.splice(fl.indexOf(f),1)}}
    if(kt&&--kt===0){bonus=ammo.length*500+Math.round(php)*5;const ratio=.5*ammo.length/6+.5*Math.min(1,lvScore/par);stars=ratio>=.7?3:ratio>=.45?2:1;lvScore+=bonus;total+=lvScore;
      if(total>best){best=total;try{localStorage.setItem('ss-best',best)}catch(e){}}S='win';sfx.win()}
    else if(S==='play'&&!kt&&!fl.length&&!ammo.length&&!drag){if(++settle>150){lives--;S=lives>0?'lose':'over';if(S==='over'&&total>best){best=total;try{localStorage.setItem('ss-best',best)}catch(e){}}sfx.lose()}}}
  parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.08;p.l--});parts=parts.filter(p=>p.l>0)}
/* ---------- draw ---------- */
function tx(s,x,y,sz,col,al){ctx.font='bold '+Math.round((sz||8)*1.25)+'px "Courier New",Consolas,monospace';ctx.textBaseline='top';ctx.textAlign=al||'left';ctx.fillStyle='#1b1220';ctx.fillText(s,x+1,y+1);ctx.fillStyle=col||'#fff';ctx.fillText(s,x,y)}
function R(c,x,y,w,h){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function star(x,y,on){['..#..','.###.','#####','.###.','.#.#.'].forEach((row,j)=>{for(let i=0;i<5;i++)if(row[i]==='#')R(on?'#ffd84a':'#4a4060',x+i*3,y+j*3,3,3)})}
function drawBody(b){ctx.save();ctx.translate(Math.round(b.position.x),Math.round(b.position.y));ctx.rotate(b.angle);const w=b.w,h=b.h,x=-Math.round(w/2),y=-Math.round(h/2);
  R('#1b1220',x-1,y-1,w+2,h+2);
  if(!b.enemy){const m=b.mat,hz=w>=h;R(b.c,x,y,w,h);
    if(m===M.wood){R('#c48c4c',x,y,w,1);R('#7a4f26',x,y+h-1,w,1);for(let i=hz?5:3;i<(hz?w:h);i+=hz?7:6){if(hz)R('rgba(60,30,10,.35)',x+i,y+1,1,h-2);else R('rgba(60,30,10,.35)',x+1,y+i,w-2,1)}R('#3a2a1a',x+1,y+1,1,1);R('#3a2a1a',x+w-2,y+h-2,1,1)}
    else if(m===M.stone){R('#b4bac6',x,y,w,1);R('#6a707c',x,y+h-1,w,1);if(hz){for(let i=6;i<w;i+=11)R('rgba(0,0,0,.28)',x+i,y+1,1,h-2)}else{for(let i=5;i<h;i+=7)R('rgba(0,0,0,.25)',x+1,y+i,w-2,1)}}
    else{R('#8fa6c4',x,y,w,1);R('#2e3d52',x,y+h-1,w,1);R('rgba(255,255,255,.18)',x,y+1,w,1);for(let i=2;i<(hz?w:h);i+=hz?12:9){if(hz)R('#a9bdd6',x+i,(y+h/2)|0,2,2);else R('#a9bdd6',(x+w/2-1)|0,y+i,2,2)}}
    if(b.hp<b.hp0*.5)R('rgba(0,0,0,.45)',-1,y,1,Math.min(h,10))}
  else{const k=b.kind,sk='#f0c08a';R(b.c,x,y,w,h);
    if(k==='troll'){R('#6fa044',x,y,w,h);R('#3d5e25',x,y+2,w,3);R('#f33',x+3,y+4,2,2);R('#f33',x+w-5,y+4,2,2);R('#fff',x+3,y+h-7,2,3);R('#fff',x+w-5,y+h-7,2,3);R('#6b4528',x,y+h-4,w,4)}
    else{R(sk,x+2,y+1,w-4,5);R('#111',x+3,y+3,1,1);R('#111',x+w-4,y+3,1,1);R('#8a4a3a',(x+w/2-1)|0,y+5,2,1);
      if(k==='soldier')R('#7b7f8a',x+1,y,w-2,2);
      if(k==='archer'){R('#2f6a2f',x,y-1,w,3);R('#d33',x+w-3,y-3,1,3)}
      if(k==='knight'){R('#c9d0da',x,y-1,w,7);R('#111',x+2,y+3,w-4,1);R('#c02a2a',-1,y-4,2,3);R('#2a5db0',x-3,y+5,4,6);R('#fff',x-2,y+7,2,1)}
      if(k==='king'){R('#c02a2a',x,y+6,w,h-6);R('#eee',x+2,y+6,w-4,3);R('#1b1220',x,y-4,w,4);R('#ffd84a',x+1,y-3,w-2,2);R('#ffd84a',x+1,y-5,2,2);R('#ffd84a',-1,y-5,2,2);R('#ffd84a',x+w-3,y-5,2,2)}}
    if(b.hp<b.hp0*.5)R('rgba(200,30,30,.35)',x,y,w,h)}
  if(b.burn){R(frame>>2&1?'#ff9a1f':'#ffd23a',x+(frame%3),y-3,3,3);R('#ff5a1f',x+w-4-(frame%3),y-2,3,2)}ctx.restore()}
function drawProj(x,y,t,rot){const s=P[t],r=s.r;R('#1b1220',x-r-1,y-r-1,2*r+2,2*r+2);R(s.c,x-r,y-r,2*r,2*r);R('rgba(255,255,255,.35)',x-r,y-r,r,1);
  if(t==='fire'){R('#ffd23a',x-1,y-1,2,2);R(frame>>2&1?'#ff5a1f':'#ffd23a',x-r+1,y-r-3,3,3)}}
function hs(i){let t=Math.imul(i^61,2654435761);t^=t>>>13;return(Math.imul(t,1274126177)>>>0)%1000/1000}
function circ(cx,cy,r,c){for(let d=-r;d<=r;d++){const w=Math.round(Math.sqrt(r*r-d*d));R(c,cx-w,cy+d,2*w,1)}}
function grad(st,hh){for(let y=0;y<hh;y+=3){const k=y/hh*(st.length-1),i=Math.min(st.length-2,k|0),f=k-i,a=st[i],b=st[i+1];R('rgb('+[0,1,2].map(j=>Math.round(a[j]+(b[j]-a[j])*f)).join()+')',0,y,W,4)}}
const SKY=[
 ()=>{grad([[58,108,214],[205,230,255]],GY);circ(390,52,34,'rgba(255,244,200,.12)');circ(390,52,24,'rgba(255,244,200,.2)');circ(390,52,13,'#fff6c8')},
 ()=>{grad([[24,32,78],[84,66,124],[220,132,104],[250,196,118]],GY);for(let i=0;i<30;i++)R('rgba(255,255,255,'+(.3+hs(i)*.5)+')',Math.round(hs(i+3)*W),Math.round(hs(i+9)*80),1,1);circ(150,GY-62,36,'rgba(255,190,110,.15)');circ(150,GY-62,25,'rgba(255,200,120,.25)');circ(150,GY-62,15,'#ffe0a0')},
 ()=>{grad([[70,146,232],[150,202,246],[253,234,176]],GY);circ(110,46,40,'rgba(255,240,170,.14)');circ(110,46,28,'rgba(255,240,170,.22)');circ(110,46,15,'#fffadc')}];
function pine(x,by,hg,c1,c2){R('#3a2818',x-1,by-4,2,6);for(let t=0;t<3;t++){const w=6+t*4,yy=by-hg+t*Math.round(hg/3);R(c1,x-w/2,yy,w,Math.round(hg/3)+2);R(c2,x-w/2,yy,w/2,Math.round(hg/3)+2)}}
const LAND=[
 ()=>{
  for(let x=0;x<W;x+=4){const h1=Math.round(78+Math.sin(x*.012+1)*26+Math.sin(x*.05)*8);R('#8fa3c8',x,GY-h1,4,h1);R('rgba(255,255,255,.3)',x,GY-h1,4,1);if(h1>92)R('#f2f6ff',x,GY-h1,4,Math.min(7,h1-92))}
  R('rgba(205,230,255,.25)',0,GY-52,W,52);
  for(let x=0;x<W;x+=4){const h2=Math.round(46+Math.sin(x*.02+3)*15+Math.sin(x*.09)*4);R('#6a86a8',x,GY-h2,4,h2);R('rgba(255,255,255,.18)',x,GY-h2,4,1)}
  for(let x=0;x<W;x+=4){const h3=Math.round(16+Math.sin(x*.03+1)*7);R('#4c8b46',x,GY-h3,4,h3)}
  for(let i=0;i<19;i++)pine(Math.round(i*26+hs(i)*14),GY-6,Math.round(20+hs(i+50)*12),'#285a3a','#3a8650');
  R('#5da23f',0,GY,W,5);R('#86c85c',0,GY,W,2);for(let x=0;x<W;x+=5)if(hs(x)>.45)R('#3f7a2c',x,GY-2,1,2);
  R('#7a5233',0,GY+5,W,H);R('#6b4528',0,GY+24,W,H);for(let x=0;x<W;x+=9){const k=hs(x+7);R(k>.5?'#9a8468':'#5a3a20',x+Math.round(k*5),GY+8+Math.round(hs(x)*30),3,2)}},
 ()=>{
  for(let x=0;x<W;x+=4){const h1=Math.round(60+Math.sin(x*.015+2)*18+Math.sin(x*.06)*6);R('#3e3a6e',x,GY-h1,4,h1);R('rgba(255,160,100,.3)',x,GY-h1,4,1)}
  R('rgba(250,170,110,.22)',0,GY-48,W,48);
  const sil='#201c40',tw=(x,w,hh)=>{R(sil,x,GY-hh,w,hh);for(let i=0;i<w;i+=4)R(sil,x+i,GY-hh-3,2,3);for(let j=0;j<hh-12;j+=14)if(hs(x+j)>.3)R('#ffc864',x+(w>>1)-1,GY-hh+8+j,2,4)};
  const cone=(x,w,y,hh)=>{for(let r=0;r<hh;r++){const ww=Math.max(2,Math.round((w+4)*(1-r/hh)));R('#2c2658',x+(w-ww)/2,y-r,ww,1)}};
  R(sil,60,GY-34,244,34);for(let x=60;x<304;x+=6)R(sil,x,GY-37,3,3);
  tw(120,38,76);tw(96,14,88);tw(172,14,88);tw(264,16,72);tw(66,14,60);cone(96,14,GY-88,16);cone(172,14,GY-88,16);cone(264,16,GY-72,15);cone(66,14,GY-60,14);
  R('#14102c',134,GY-22,10,22);R('#ffc864',137,GY-19,4,3);
  [[20,18],[28,12],[318,16]].forEach(a=>pine(a[0],GY-4,a[1]+20,'#14132e','#1d1b40'));
  R('#2f5a3a',0,GY-1,W,3);for(let r=0;r<10;r++)for(let x=-6;x<W;x+=12){const o=(r%2)*6,k=hs(x+r*31);R(k>.5?'#6b6872':'#5d5a66',x+o,GY+2+r*7,11,6);R('rgba(255,255,255,.14)',x+o,GY+2+r*7,11,1)}
  for(let x=0;x<W;x+=5)if(hs(x)>.5)R('#3f7a4a',x,GY-3,2,3);
  [80,300].forEach(x=>{R('#3a2a1a',x,GY-26,3,27);R('#555',x-2,GY-30,7,4)})},
 ()=>{
  for(let x=0;x<W;x+=4){const h1=Math.round(54+Math.sin(x*.01+1)*14+Math.sin(x*.04)*4);R('#86a98a',x,GY-h1,4,h1);R('rgba(255,255,255,.25)',x,GY-h1,4,1)}
  R('rgba(253,234,176,.3)',0,GY-46,W,46);
  for(let x=0;x<W;x+=4){const h2=Math.round(30+Math.sin(x*.018+4)*12);R((x>>3)%2?'#cfa83e':'#c19a36',x,GY-h2,4,h2);R('rgba(255,255,255,.2)',x,GY-h2,4,1)}
  for(let r=0;r<46;r++){const ww=Math.round(13-r*.1);R('#eadfbf',250-ww,GY-12-r,ww*2,1);R('#cdbf98',250+ww-4,GY-12-r,4,1)}
  for(let r=0;r<10;r++)R('#7a3f24',250-10+r,GY-58-r,20-r*2,1);
  R('#a63a2a',92,GY-30,44,30);for(let r=0;r<14;r++)R('#5a2a22',90+r*1.6,GY-30-r,48-r*3.2,1);R('#fff',104,GY-22,20,2);R('#fff',112,GY-22,2,22);R('#5a2a22',108,GY-20,12,20);R('#fff',108,GY-20,12,1);
  for(let x=0;x<W;x+=18){R('#8a6a3a',x,GY-13,2,13)}R('#a07c46',0,GY-10,W,1);R('#a07c46',0,GY-5,W,1);
  for(let x=0;x<W;x+=2){const hg=14+hs(x)*8|0;R('#bd9a38',x,GY-hg,1,hg);R('#e8c14a',x-1,GY-hg-4,3,5)}
  R('#9a6e34',0,GY,W,H);R('#84592a',0,GY+22,W,H);for(let x=0;x<W;x+=7){const k=hs(x+3);R(k>.5?'#d9b45a':'#6a4520',x+Math.round(k*4),GY+4+Math.round(hs(x)*38),3,1)}}];
const CL=[[[40,34,1],[190,60,.6],[300,28,.8],[110,86,.5]],[[30,30,.5],[170,52,.4],[330,24,.6],[250,70,.3]],[[50,26,.8],[160,56,.5],[290,36,1],[390,70,.6],[10,80,.4]]],CC=[['#fff','#d3e1f4'],['#5a4a7e','#f09a6a'],['#fff','#f4e8c6']];
function drawClouds(){const c=CC[map];CL[map].forEach(q=>{const x=((q[0]+frame*(.08+wind*.02)*q[2])%(W+80)+W+80)%(W+80)-40,y=q[1];R(c[0],x,y,34,6);R(c[0],x+6,y-5,18,6);R(c[0],x+20,y-3,12,5);R(c[1],x,y+4,34,2)})}
function birds(n,col,seed,sz){for(let i=0;i<n;i++){const x=(frame*(.4+hs(i+seed)*.3)+i*97+seed*40)%(W+60)-30,y=28+hs(i+seed)*60+Math.sin(frame*.06+i)*5,up=(frame*.2+i)%2<1,w=3*sz;R(col,x-w-1,y+(up?-sz:sz),w,sz);R(col,x+1,y+(up?-sz:sz),w,sz);R(col,x-1,y,2*sz,sz)}}
function grass(c1,c2,hh){for(let x=0;x<W;x+=3){const sw=Math.round(Math.sin(frame*.05+x*.08)*1.5+wind*1.2),g=hh+(hs(x+5)*hh|0);R(c1,x,GY-g+2,1,g-2);R(c1,x+Math.round(sw/2),GY-g+1,1,2);if(c2)R(c2,x+sw-1,GY-g-2,3,4)}}
const DYN=[
 ()=>{grass('#3f7a2c',0,3);birds(5,'#233',0,1)},
 ()=>{[[103,GY-104],[179,GY-104],[271,GY-87]].forEach(f=>{R('#222',f[0],f[1],1,14);for(let i=0;i<9;i++)R('#c02a2a',f[0]+1+i,f[1]+Math.round(Math.sin(frame*.15+i*.5)*1.2),1,5)});
  [81,301].forEach(x=>{const fl=frame>>2&1,fy=GY-33;circ(x+1,fy,11,'rgba(255,170,60,.12)');R('#ff8a1f',x-1,fy-3-fl,5,4);R('#ffd23a',x,fy-2-fl,3,2)});
  for(let k=0;k<6;k++){const t=(frame*.4+k*17)%100;circ(Math.round(133+Math.sin(t*.08+k)*3+t*.1*wind),Math.round(GY-80-t*.5),2+(t/30|0),'rgba(200,200,225,'+((1-t/100)*.35).toFixed(2)+')')}
  birds(4,'#0d0b1c',7,2)},
 ()=>{const ax=250,ay=GY-52;ctx.lineWidth=2;for(let k=0;k<4;k++){const a=frame*.025*(1+Math.abs(wind)*.3)+k*Math.PI/2,ex=ax+Math.cos(a)*24,ey=ay+Math.sin(a)*24;ctx.strokeStyle='#1b1220';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ex,ey);ctx.stroke();ctx.strokeStyle='#d9c9a0';ctx.lineWidth=2;ctx.stroke()}R('#7a3f24',ax-2,ay-2,5,5);
  grass('#c9a43a','#f0cd55',10);
  for(let i=0;i<2;i++){const bx=(frame*.3+i*220)%(W+40)-20,by=GY-30-i*14+Math.sin(frame*.07+i)*8,f=frame>>2&1;R(i?'#f7a':'#fff',bx,by,f?3:1,2)}
  for(let i=0;i<14;i++)R('rgba(255,240,170,.6)',(hs(i)*W+frame*(.3+hs(i+4)*.4)*(1+wind*.2)+W*2)%W,GY-20-hs(i+9)*70+Math.sin(frame*.03+i)*4,1,1);
  birds(5,'#222',3,1)}];
const LAY={};
function layers(m){if(LAY[m])return LAY[m];const mkc=fn=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');g.imageSmoothingEnabled=false;const o=ctx;ctx=g;fn();ctx=o;return c};return LAY[m]={sky:mkc(SKY[m]),land:mkc(LAND[m])}}
function bg(){const L=layers(map);ctx.drawImage(L.sky,0,0);drawClouds();ctx.drawImage(L.land,0,0);DYN[map]()}
function cat(tip){R('rgba(0,0,0,.25)',AX-30,GY-1,44,3);
  R('#1b1220',AX-26,226,36,12);R('#8a5a30',AX-25,227,34,10);R('#b07a42',AX-25,227,34,2);R('#5a3a1c',AX-25,235,34,2);
  [AX-19,AX+3].forEach(x=>{R('#1b1220',x-5,GY-11,11,11);R('#6a4a2a',x-4,GY-10,9,9);R('#3a2814',x,GY-10,1,9);R('#3a2814',x-4,GY-6,9,1);R('#c9a46a',x-1,GY-7,3,3)});
  R('#1b1220',AX-13,214,8,14);R('#7a4e2a',AX-12,215,6,13);
  ctx.strokeStyle='#1b1220';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(AX-9,224);ctx.lineTo(tip.x,tip.y);ctx.stroke();ctx.strokeStyle='#a8743a';ctx.lineWidth=3;ctx.stroke()}
let gp=0,gprev='title',seen=false,php=100,hurt=0,arrows=[],loseWhy='',map=0,hov=-1,mprev='title';const MN=['FOREST','CASTLE','WHEAT FIELD'];
const GP=[
{t:'1. AIM & FIRE',l:['Press the catapult and drag it back.','Release to fire! Dots show the start of the path;','you must judge the rest. Wind pushes shots sideways.']},
{t:'2. YOUR AMMO',r:[['stone','STONE','Solid all-rounder. Reliable damage.'],['split','SPLIT ROCK','Tap while flying: it splits into 3 rocks.'],['fire','FIREBALL','Sets wooden blocks ablaze. Burns over time.'],['boulder','BOULDER','Slow and heavy. Crushes stone and iron.']]},
{t:'3. THE ENEMY',r:[['king','THE KING','Topple him to win the level. He hides!'],['soldier','SOLDIER','No armour. Falls in one hit.'],['knight','KNIGHT','Armoured. Takes several hits.'],['archer','ARCHER','Shoots at YOU! 8 arrows and you fall.'],['troll','TROLL','Huge elite guard. Very tough.']]},
{t:'4. CASTLE & SCORE',r:[['wood','WOOD','Weak, and it burns. Use fire!'],['stone','STONE','Sturdy. Needs heavy hits.'],['iron','IRON','Toughest. Bring the boulder.']],l:['Smash the walls so things fall on the king.','Fewer shots and more damage earn more stars.','Out of ammo or HP: lose 1 of 3 lives.','Every level is harder. Beat your best score!']}];
const AG=.1;
function gameAI(){
  if(S==='play'&&!kt)for(const a of ents){if(a.dead||a.kind!=='archer')continue;a.cd--;
    if(a.cd<=0&&a.position.y<GY-4&&Math.abs(a.angle)<.5){const sx=a.position.x-6,sy=a.position.y-3,tx=30+(Math.random()-.5)*44,ty=226+(Math.random()-.5)*26,dx=tx-sx,dy=ty-sy,T=Math.max(40,Math.hypot(dx,dy)/4.4);
      arrows.push({x:sx,y:sy,vx:dx/T,vy:(dy-.5*AG*T*T)/T,s:0});a.cd=Math.max(140,330-level*14)+Math.random()*110;tone(700,.1,'triangle',.05,-400)}}
  for(const r of arrows){if(r.s){if(r.s<900)r.s++;continue}r.x+=r.vx;r.y+=r.vy;r.vy+=AG;
    if(r.x>8&&r.x<62&&r.y>206&&r.y<GY){r.s=999;php-=12.5;hurt=16;tone(120,.2,'sawtooth',.12,-60);puff(r.x,r.y,'#e04040',6)}
    else if(r.y>=GY){r.y=GY-1;r.s=1}else if(r.x<-10||r.x>W+20)r.s=999}
  arrows=arrows.filter(r=>r.s<90);if(hurt>0)hurt--;
  if(php<=0&&!kt&&S==='play'){php=0;lives--;loseWhy='shot';S=lives>0?'lose':'over';if(S==='over'&&total>best){best=total;try{localStorage.setItem('ss-best',best)}catch(e){}}sfx.lose()}}
function drawBow(b){const x=Math.round(b.position.x)-8,y=Math.round(b.position.y),ch=b.cd<26;R('#8a5a30',x,y-5,1,10);R('#8a5a30',x+1,y-6,1,1);R('#8a5a30',x+1,y+5,1,1);R('#e8e8e8',ch?x-2:x+1,y-4,1,8);if(ch)R('#d9c9a0',x-4,y,6,1)}
function drawArrows(){arrows.forEach(r=>{ctx.save();ctx.translate(Math.round(r.x),Math.round(r.y));ctx.rotate(r.s?.5:Math.atan2(r.vy,r.vx));R('#1b1220',-6,-1,12,3);R('#d9c9a0',-5,0,9,1);R('#cfd6e4',4,-1,3,3);R('#d33',-6,-1,2,3);ctx.restore()})}
function drawPlayer(tip){const px=16,hy=GY,bob=(frame>>5&1)&&!drag?1:0,fl=hurt>0&&(hurt>>1&1),c1=fl?'#ff6a6a':'#3b6fc4',c2=fl?'#ffb0a0':'#f0c08a';
  R('rgba(0,0,0,.25)',px-7,GY-1,14,3);R('#2b3a67',px-3,hy-8,3,7);R('#2b3a67',px+1,hy-8,3,7);R('#3a2a1a',px-4,hy-2,4,2);R('#3a2a1a',px+1,hy-2,5,2);
  R('#1b1220',px-5,hy-18+bob,11,11);R(c1,px-4,hy-17+bob,9,10);R('#6b4528',px-4,hy-10,9,2);R('#ffd84a',px,hy-10,2,2);
  R('#1b1220',px-4,hy-25+bob,9,8);R(c2,px-3,hy-24+bob,7,7);R('#111',px+1,hy-21+bob,1,1);R('#111',px+3,hy-21+bob,1,1);
  R('#9aa3b2',px-4,hy-27+bob,9,4);R('#c9d0da',px-4,hy-27+bob,9,1);R('#d33',px-1,hy-30+bob,3,3);
  const hx=drag&&dpos?dpos.x:px+10,hyy=drag&&dpos?dpos.y:hy-9;ctx.strokeStyle='#1b1220';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px+3,hy-15+bob);ctx.lineTo(hx,hyy);ctx.stroke();ctx.strokeStyle=c1;ctx.lineWidth=2;ctx.stroke();R(c2,Math.round(hx)-1,Math.round(hyy)-1,3,3);
  R('#1b1220',4,GY-40,30,5);R('#5a2020',5,GY-39,28,3);R(php>30?'#4ec24e':'#e04040',5,GY-39,Math.max(0,Math.round(28*php/100)),3)}
function openMaps(f){mprev=f||(S==='maps'?mprev:S);S='maps';hov=-1}
function pickMap(i){map=i;newGame()}
function mapHit(p){for(let i=0;i<3;i++){const x=24+i*150;if(p.x>=x&&p.x<=x+132&&p.y>=60&&p.y<=134)return i}return -1}
function mapsClick(p){const i=mapHit(p);if(i>=0){pickMap(i);return}if(p.y>H-34&&Math.abs(p.x-W/2)<45)S=mprev==='guide'?'title':mprev}
function drawMaps(){R('rgba(10,6,20,.88)',0,0,W,H);tx('CHOOSE YOUR BATTLEFIELD',W/2,14,12,'#ffd84a','center');
  for(let i=0;i<3;i++){const x=24+i*150,L=layers(i);R(i===hov?'#ffd84a':'#4a4060',x-3,57,138,80);ctx.drawImage(L.sky,x,60,132,74);ctx.drawImage(L.land,x,60,132,74);tx((i+1)+'. '+MN[i],x+66,142,8,i===hov?'#ffd84a':'#fff','center')}
  tx('Click a map or press 1, 2 or 3.',W/2,176,8,'#cfe8ff','center');btn(W/2-35,H-26,70,'BACK','#cfd6e4')}
addEventListener('keydown',e=>{if(S!=='maps')return;if(e.key>='1'&&e.key<='3')pickMap(+e.key-1);else if(e.key==='Escape')S=mprev==='guide'?'title':mprev});
function fk(x,y,k,m){if(m)return{position:{x,y},angle:0,w:k[0],h:k[1],c:m.c,mat:m,hp:1,hp0:1};const e=E[k];return{position:{x,y},angle:0,w:e.w,h:e.h,c:e.c,enemy:1,kind:k,hp:1,hp0:1}}
function btn(x,y,w,t,c){R('#1b1220',x-1,y-1,w+2,18);R(c,x,y,w,16);tx(t,x+w/2,y+4,8,'#1b1220','center')}
function drawGuide(){
  R('rgba(10,6,20,.86)',0,0,W,H);const g=GP[gp];tx(g.t,W/2,12,12,'#ffd84a','center');
  if(g.r)g.r.forEach((r,i)=>{const y=40+i*(g.r.length>4?28:30),k=r[0];
    if(P[k])drawProj(34,y+7,k);else if(M[k])drawBody(fk(34,y+7,[28,8],M[k]));else drawBody(fk(34,y+7,k));
    tx(r[1],62,y,8,'#ffd84a');tx(r[2],62,y+12,8,'#fff')});
  if(g.l)g.l.forEach((s,i)=>tx(s,W/2,(gp===0?36:140)+i*12,8,'#fff','center'));
  if(gp===0){const tt=frame%280,vx=33*.26,vy=-22*.26,k=Math.min(1,tt/70),dp={x:AX-33*k,y:AY+22*k},fire=tt>=90,ft=tt-90,px=dp.x+vx*ft,py=dp.y+vy*ft+.5*G*ft*ft;
    [[330,235,6,22],[354,235,6,22],[342,221,30,6],[330,207,6,22],[354,207,6,22],[342,193,30,6]].forEach((t,i)=>{const b=fk(t[0],t[1],[t[2],t[3]],M.wood);if(fire&&ft>36){const f=Math.min(ft-36,60);b.position.x+=(i%3+1)*f*.35;b.position.y=Math.min(b.position.y+f*f*.06*(i>2?1:.3),GY-t[3]/2);b.angle=f*.04*(i%2?1:-1)}drawBody(b)});
    cat(fire?{x:AX,y:AY}:dp);if(!fire)drawProj(Math.round(dp.x),Math.round(dp.y),'stone');else if(ft<=38)drawProj(Math.round(px),Math.round(py),'stone');
    if(tt>=40&&tt<90)for(let i=4;i<=20;i+=4)R('#fff',Math.round(dp.x+vx*i)-1,Math.round(dp.y+vy*i+.5*G*i*i)-1,3,3);
    if(tt<70)tx('DRAG BACK...',W/2,112,8,'#cfe8ff','center');else if(tt<90)tx('AIM...',W/2,112,8,'#cfe8ff','center');else tx('RELEASE!',W/2,112,8,'#ffd84a','center')}
  for(let i=0;i<GP.length;i++)R(i===gp?'#ffd84a':'#4a4060',W/2-19+i*10,H-32,6,6);
  btn(10,H-24,70,'< BACK',gp>0?'#cfd6e4':'#5a5470');btn(W/2-35,H-24,70,'SKIP','#cfd6e4');btn(W-100,H-24,90,gp===GP.length-1?'START!':'NEXT >','#ffd84a')}
function gNext(){if(gp<GP.length-1)gp++;else finishGuide()}
function finishGuide(){seen=true;if(gprev==='title'||gprev==='over')openMaps(gprev);else S=gprev}
function openGuide(){if(S==='guide')return;gprev=S;gp=0;S='guide'}
function begin(){if(!seen)openGuide();else openMaps()}
function guideClick(p){if(p.y<H-34)return;if(p.x<100){if(gp>0)gp--}else if(p.x>W-120)gNext();else if(p.x>W/2-45&&p.x<W/2+45)finishGuide()}
addEventListener('keydown',e=>{if(S!=='guide')return;if(e.key==='ArrowRight'||e.key==='Enter'||e.key===' '){e.preventDefault();gNext()}else if(e.key==='ArrowLeft'){if(gp>0)gp--}else if(e.key==='Escape')finishGuide()});
function draw(){bg();const tip=drag&&dpos?dpos:{x:AX,y:AY};cat(tip);drawPlayer(tip);
  ents&&ents.forEach(b=>{if(!b.dead){drawBody(b);if(b.kind==='archer')drawBow(b)}});drawArrows();
  if(fl)fl.forEach(f=>{const b=f.b;drawProj(Math.round(b.position.x),Math.round(b.position.y),f.type)});
  if(S==='play'&&ammo.length&&!fl.length&&!kt){const t=ammo[0];drawProj(Math.round(tip.x),Math.round(tip.y),t);
    if(drag&&dpos){let vx=(AX-dpos.x)*P[t].k,vy=(AY-dpos.y)*P[t].k,x=dpos.x,y=dpos.y;for(let i=1;i<=20;i++){x+=vx;y+=vy;vy+=G;if(i%4===0)R('#fff',Math.round(x)-1,Math.round(y)-1,3,3)}}}
  parts.forEach(p=>R(p.c,Math.round(p.x),Math.round(p.y),2,2));
  // HUD
  tx('SCORE '+(total+lvScore),6,5);tx('LEVEL '+level,6,17,8,'#ffd84a');tx('BEST '+best,W-6,5,8,'#fff','right');
  for(let i=0;i<3;i++)R(i<lives?'#e04040':'#4a4060',W-50+i*14,18,10,8);
  tx('HP',6,29,8,'#fff');R('#1b1220',26,28,64,10);R('#5a2020',27,29,62,8);R(php>30?'#4ec24e':'#e04040',27,29,Math.max(0,Math.round(62*php/100)),8);
  if(hurt>0)R('rgba(220,30,30,.16)',0,0,W,H);
  if(S==='play'){tx(wind?('WIND '+(wind<0?'<< ':'>> ')+Math.abs(wind)):'WIND CALM',W/2,5,8,'#cfe8ff','center');
    ammo.forEach((t,i)=>{R('#1b1220',6+i*14,H-18,12,12);R(P[t].c,7+i*14,H-17,10,10)});
    if(ammo[0])tx(ammo[0].toUpperCase(),6,H-30,8,'#ffd84a');
    if(ammo[0]==='split'&&fl.some(f=>f.type==='split'&&!f.sp))tx('TAP TO SPLIT!',W/2,H-30,8,'#ffd84a','center')}
  if(err)tx('ERROR: '+err.slice(0,50),6,H-14,8,'#ff6060');
  if(S==='guide')drawGuide();else if(S==='maps')drawMaps();else if(S!=='play'){R('rgba(10,6,20,.72)',0,0,W,H);const c=W/2;
    if(S==='title'){tx('SIEGE SMASH',c,48,24,'#ffd84a','center');tx('Drag the catapult back, aim, release.',c,100,8,'#fff','center');tx('Topple the hidden KING to win!',c,116,8,'#fff','center');tx('Tap during a split-rock flight!',c,132,8,'#fff','center');tx('CLICK TO START',c,172,12,'#fff','center');tx('A quick guide comes first.',c,196,8,'#cfe8ff','center')}
    if(S==='win'){tx('VICTORY!',c,50,20,'#ffd84a','center');for(let i=0;i<3;i++)star(c-27+i*18,92,i<stars);tx('Level score  '+lvScore,c,130,8,'#fff','center');tx('Ammo+HP bonus  '+bonus,c,146,8,'#fff','center');tx('CLICK FOR LEVEL '+(level+1),c,190,10,'#fff','center')}
    if(S==='lose'){tx(loseWhy==='shot'?'YOU WERE SHOT DOWN':'THE KING SURVIVES',c,60,16,'#e04040','center');tx('Lives left: '+lives,c,110,8,'#fff','center');tx('CLICK TO RETRY',c,160,12,'#fff','center')}
    if(S==='over'){tx('GAME OVER',c,50,20,'#e04040','center');tx('Reached level '+level,c,100,8,'#fff','center');tx('Final score  '+total,c,118,8,'#fff','center');tx('Best score   '+best,c,134,8,'#ffd84a','center');tx('CLICK TO PLAY AGAIN',c,180,10,'#fff','center')}}}
let last=performance.now(),acc=0;
function loop(t){acc+=Math.min(100,t-last);last=t;try{while(acc>=1000/60){step();acc-=1000/60}}catch(e){err=String(e&&e.message||e);acc=0}try{draw()}catch(e){err=String(e&&e.message||e);if(!window.__le){window.__le=1;console.error('draw: '+(e&&e.stack||e))}}requestAnimationFrame(loop)}
requestAnimationFrame(loop);
}
function next(){if(window.Matter)return boot();
 if(k>=urls.length){document.body.insertAdjacentHTML('afterbegin','<p style="font-size:12px">Game engine failed to load. Check your connection and reload.</p>');return}
 var s=document.createElement('script'),d=false,t=setTimeout(function(){if(!d){d=true;next()}},7000);s.src=urls[k++];
 s.onload=function(){if(d)return;d=true;clearTimeout(t);boot()};s.onerror=function(){if(d)return;d=true;clearTimeout(t);next()};document.head.appendChild(s)}
next()})();
