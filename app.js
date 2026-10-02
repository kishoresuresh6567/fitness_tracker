import {StepDetector} from './detector.js';
const $=id=>document.getElementById(id);
let saved={total:0,sessions:[]};
try{const data=JSON.parse(localStorage.getItem('stride-v1'));if(data && Number.isSafeInteger(data.total) && data.total>=0 && Array.isArray(data.sessions))saved=data;}catch{}
let active=false,steps=0,elapsed=0,started=0,lastStep=0,lastSensor=0,timer,wakeLock,startPending=false;
const detector=new StepDetector();
const formatTime=ms=>{const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function persist(){try{saved.activeSession=active?{steps,started}:null;localStorage.setItem('stride-v1',JSON.stringify(saved));}catch{$('status').textContent='Steps counted, but browser storage is unavailable. Your total may not survive a reload.';}}
function render(){ $('steps').textContent=steps.toLocaleString();$('total').textContent=saved.total.toLocaleString();$('history').replaceChildren();
  if(!saved.sessions.length){const p=document.createElement('div');p.className='empty';p.textContent='Your next walk is the beginning of something good.';$('history').append(p);}
  for(const session of saved.sessions.slice(0,10)){const row=document.createElement('div');row.className='row';const date=document.createElement('span');date.textContent=new Date(session.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const value=document.createElement('strong');value.textContent=`${Number(session.steps).toLocaleString()} steps`;const duration=document.createElement('small');duration.textContent=formatTime(session.duration);value.append(duration);row.append(date,value);$('history').append(row);}
}
function onMotion(event){const a=event.accelerationIncludingGravity;if(!a || ![a.x,a.y,a.z].every(Number.isFinite))return;lastSensor=performance.now();const result=detector.feed(lastSensor,a,event.rotationRate||{});if(!result)return;lastStep=lastSensor;steps+=result.steps;saved.total+=result.steps;$('cadence').textContent=result.cadence;$('movement').textContent=result.cadence>=150?'Fast cadence':'Walking pace';$('badge').textContent='In your stride';$('status').textContent='Consistent movement detected. Keep going!';persist();render();}
async function start(){if(startPending)return;startPending=true;$('start').disabled=true;try{
  if(!window.isSecureContext)throw new Error('Open this app over HTTPS to access your phone’s motion sensors.');
  if(!window.DeviceMotionEvent)throw new Error('Motion tracking is unavailable. Open this app on a phone with motion sensors.');
  if(typeof DeviceMotionEvent.requestPermission==='function' && await DeviceMotionEvent.requestPermission()!=='granted')throw new Error('Motion permission was declined. Allow motion access to count steps.');
  if(document.hidden)return;
  active=true;steps=0;elapsed=0;started=Date.now();lastSensor=performance.now();lastStep=0;detector.reset();persist();render();$('time').textContent='00:00';$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent='Listening for steps';$('start').textContent='■   Finish session';$('status').textContent='Walk steadily with your phone in a snug pocket. The first steps appear after rhythm is confirmed.';
  window.addEventListener('devicemotion',onMotion);
  timer=setInterval(tick,500);
  await acquireWakeLock();
}catch(error){$('status').textContent=error.message;}finally{startPending=false;$('start').disabled=false;}}
function stop(message='Session saved. Ready when you are.'){if(!active)return;active=false;elapsed=Math.max(0,Date.now()-started);window.removeEventListener('devicemotion',onMotion);clearInterval(timer);if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}if(steps){saved.sessions.unshift({date:new Date().toISOString(),steps,duration:elapsed});saved.sessions=saved.sessions.slice(0,10);} $('time').textContent=formatTime(elapsed);$('start').textContent='▶   Start a new session';$('badge').textContent='Session complete';$('movement').textContent='Standing by';$('cadence').textContent='—';$('status').textContent=message;persist();render();}
$('start').addEventListener('click',()=>active?stop():start());
function tick(){if(!active || document.hidden)return;elapsed=Math.max(0,Date.now()-started);$('time').textContent=formatTime(elapsed);if(performance.now()-lastSensor>6000){$('status').textContent='No motion sensor data received. Check motion permissions and use a supported phone browser.';$('badge').textContent='Waiting for sensor';$('cadence').textContent='—';$('movement').textContent='Standing by';}else if(lastStep && performance.now()-lastStep>2500){$('cadence').textContent='—';$('movement').textContent='Standing by';$('badge').textContent='Listening for steps';}}
async function acquireWakeLock(){if(!active || document.hidden || !navigator.wakeLock || wakeLock)return;try{const lock=await navigator.wakeLock.request('screen');if(active && !document.hidden){wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}else await lock.release();}catch{}}
function resume(){if(!active)return;detector.reset();lastStep=0;lastSensor=performance.now();tick();$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent='Session resumed';$('status').textContent='Your session is still open. Steps may be missed while another app is open or the screen is locked.';acquireWakeLock();}
document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}}else resume();});
window.addEventListener('pagehide',persist);
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
render();
const pending=saved.activeSession;
if(pending && Number.isSafeInteger(pending.steps) && pending.steps>=0 && pending.steps<=saved.total && Number.isFinite(pending.started) && pending.started>0 && pending.started<=Date.now()){
  active=true;steps=pending.steps;started=pending.started;window.addEventListener('devicemotion',onMotion);timer=setInterval(tick,500);$('start').textContent='■   Finish session';render();resume();
}
