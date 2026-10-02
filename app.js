import {StepDetector} from './detector.js';
const $=id=>document.getElementById(id);
let saved={total:0,sessions:[]};
try{const data=JSON.parse(localStorage.getItem('stride-v1'));if(data && Number.isSafeInteger(data.total) && data.total>=0 && Array.isArray(data.sessions))saved=data;}catch{}
let active=false,steps=0,elapsed=0,started=0,lastStep=0,lastSensor=0,timer,wakeLock,startPending=false;
let sensorReady=false,lastEvent=0,sensorSamples=0;
const detector=new StepDetector();
const formatTime=ms=>{const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function persist(){try{saved.activeSession=active?{steps,started}:null;localStorage.setItem('stride-v1',JSON.stringify(saved));}catch{$('status').textContent='Steps counted, but browser storage is unavailable. Your total may not survive a reload.';}}
function render(){ $('steps').textContent=steps.toLocaleString();$('total').textContent=saved.total.toLocaleString();$('history').replaceChildren();
  if(!saved.sessions.length){const p=document.createElement('div');p.className='empty';p.textContent='Your next walk is the beginning of something good.';$('history').append(p);}
  for(const session of saved.sessions.slice(0,10)){const row=document.createElement('div');row.className='row';const date=document.createElement('span');date.textContent=new Date(session.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const value=document.createElement('strong');value.textContent=`${Number(session.steps).toLocaleString()} steps`;const duration=document.createElement('small');duration.textContent=formatTime(session.duration);value.append(duration);row.append(date,value);$('history').append(row);}
}
function onMotion(event){if(!active)return;lastEvent=performance.now();const a=event.accelerationIncludingGravity;if(!a || ![a.x,a.y,a.z].every(Number.isFinite))return;lastSensor=lastEvent;sensorSamples++;if(sensorSamples===1){$('badge').textContent='Motion connected';$('status').textContent='Motion sensor connected. Walk steadily for at least five strides to confirm steps.';$('motion').hidden=true;}const result=detector.feed(lastSensor,a,event.rotationRate||{});if(!result)return;lastStep=lastSensor;steps+=result.steps;saved.total+=result.steps;$('cadence').textContent=result.cadence;$('movement').textContent=result.cadence>=150?'Fast cadence':'Walking pace';$('badge').textContent='In your stride';$('status').textContent='Consistent movement detected. Keep going!';persist();render();}
async function enableMotion(){
  if(!window.isSecureContext)throw new Error('Open this app over HTTPS to access your phone’s motion sensors.');
  const Motion=window.DeviceMotionEvent;
  if(!Motion)throw new Error('Motion tracking is unavailable. Open this app on a phone with motion sensors.');
  if(typeof Motion.requestPermission==='function' && await Motion.requestPermission()!=='granted')throw new Error('Motion permission was declined. Allow Motion and Orientation access in Safari’s website settings, then tap Enable motion tracking.');
  window.removeEventListener('devicemotion',onMotion);
  window.addEventListener('devicemotion',onMotion);
  sensorReady=true;sensorSamples=0;lastEvent=0;lastSensor=performance.now();lastStep=0;detector.reset();$('motion').hidden=true;
}
async function retryMotion(){if(startPending || !active)return;startPending=true;$('motion').disabled=true;try{await enableMotion();$('badge').textContent='Listening for steps';$('status').textContent='Motion access enabled. Walk steadily with your phone in a snug pocket.';}catch(error){sensorReady=false;$('status').textContent=error.message;}finally{startPending=false;$('motion').disabled=false;}}
async function start(){if(startPending)return;startPending=true;$('start').disabled=true;try{
  await enableMotion();
  if(document.hidden)return;
  active=true;steps=0;elapsed=0;started=Date.now();lastSensor=performance.now();lastStep=0;detector.reset();persist();render();$('time').textContent='00:00';$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent='Listening for steps';$('start').textContent='■   Finish session';$('status').textContent='Walk steadily with your phone in a snug pocket. The first steps appear after rhythm is confirmed.';
  window.addEventListener('devicemotion',onMotion);
  timer=setInterval(tick,500);
  await acquireWakeLock();
}catch(error){$('status').textContent=error.message;}finally{startPending=false;$('start').disabled=false;}}
function stop(message='Session saved. Ready when you are.'){if(!active)return;active=false;elapsed=Math.max(0,Date.now()-started);window.removeEventListener('devicemotion',onMotion);clearInterval(timer);if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}if(steps){saved.sessions.unshift({date:new Date().toISOString(),steps,duration:elapsed});saved.sessions=saved.sessions.slice(0,10);} $('time').textContent=formatTime(elapsed);$('start').textContent='▶   Start a new session';$('badge').textContent='Session complete';$('movement').textContent='Standing by';$('cadence').textContent='—';$('status').textContent=message;persist();render();}
$('start').addEventListener('click',()=>{if(active){stop();$('motion').hidden=true;}else return start();});
function tick(){if(!active || document.hidden)return;elapsed=Math.max(0,Date.now()-started);$('time').textContent=formatTime(elapsed);if(!sensorReady)return;if(performance.now()-lastSensor>6000){$('status').textContent=lastEvent && performance.now()-lastEvent<6000?'This browser is sending motion events without usable acceleration. Check Motion and Orientation access in Safari’s website settings.':'No motion data received. Tap Enable motion tracking and allow access. Use Safari on your phone with this page visible.';$('motion').hidden=false;$('badge').textContent='Waiting for sensor';$('cadence').textContent='—';$('movement').textContent='Standing by';}else if(!lastStep && sensorSamples>0){$('badge').textContent='Motion connected';$('status').textContent='Motion data is arriving. Walk steadily for at least five strides with your phone in a snug pocket.';}else if(lastStep && performance.now()-lastStep>2500){$('cadence').textContent='—';$('movement').textContent='Standing by';$('badge').textContent='Listening for steps';}}
async function acquireWakeLock(){if(!active || document.hidden || !navigator.wakeLock || wakeLock)return;try{const lock=await navigator.wakeLock.request('screen');if(active && !document.hidden){wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}else await lock.release();}catch{}}
function resume(){if(!active)return;detector.reset();lastStep=0;lastSensor=performance.now();sensorSamples=0;lastEvent=0;tick();$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent=sensorReady?'Session resumed':'Motion access needed';$('status').textContent=sensorReady?'Your session is still open. Steps may be missed while another app is open or the screen is locked.':'Your session was restored. Tap Enable motion tracking to allow Safari to use the motion sensor.';$('motion').hidden=sensorReady;acquireWakeLock();}
$('motion').addEventListener('click',retryMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}}else resume();});
window.addEventListener('pagehide',persist);
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
render();
const pending=saved.activeSession;
if(pending && Number.isSafeInteger(pending.steps) && pending.steps>=0 && pending.steps<=saved.total && Number.isFinite(pending.started) && pending.started>0 && pending.started<=Date.now()){
  active=true;steps=pending.steps;started=pending.started;
  if(window.isSecureContext && window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission!=='function'){sensorReady=true;window.addEventListener('devicemotion',onMotion);}
  timer=setInterval(tick,500);$('start').textContent='■   Finish session';render();resume();
}
