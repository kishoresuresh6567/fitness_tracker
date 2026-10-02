import {StepDetector} from './detector.js';
import {MotionInput} from './motion.js';
import {energyPerKg} from './energy.js';
const $=id=>document.getElementById(id);
let saved={total:0,sessions:[]};
try{const data=JSON.parse(localStorage.getItem('stride-v1'));if(data && Number.isSafeInteger(data.total) && data.total>=0 && Array.isArray(data.sessions))saved=data;}catch{}
let active=false,steps=0,elapsed=0,started=0,lastStep=0,lastSensor=0,timer,wakeLock,startPending=false;
let sensorReady=false,lastEvent=0,sensorSamples=0;
let energy=0;
saved.weight=Number.isFinite(saved.weight) && saved.weight>=30 && saved.weight<=300?saved.weight:70;
saved.activity=saved.activity==='jogging'?'jogging':'walking';
function renderCalories(){$('calories').textContent=(energy*saved.weight).toFixed(1);}
$('weight').value=saved.weight;$('activity').value=saved.activity;
$('weight').addEventListener('change',()=>{const weight=Number($('weight').value);if(!Number.isFinite(weight) || weight<30 || weight>300){$('weight').value=saved.weight;$('calorie-note').textContent='Enter a weight between 30 and 300 kg.';return;}saved.weight=weight;$('calorie-note').textContent='Estimated active calories from confirmed steps. Pauses and missing sensor data add no calories.';persist();renderCalories();});
$('activity').addEventListener('change',()=>{saved.activity=$('activity').value==='jogging'?'jogging':'walking';persist();});
const detector=new StepDetector();
const motionInput=new MotionInput();
let accelerometer=null,fallbackTried=false;
let fallbackStarted=0,sensorSource='Waiting',firstSampleTime=null,lastSampleTime=null;
function updateSensorStatus(){
  const duration=lastSampleTime-firstSampleTime;
  const hz=sensorSamples>1 && duration>0?Math.round((sensorSamples-1)*1000/duration):0;
  const state=!sensorReady?'Permission needed':!sensorSamples?'Waiting for readings':performance.now()-lastSensor>2000?'Readings stopped':`${sensorSource} · ${hz} Hz · ${sensorSamples} readings`;
  $('sensor-status').textContent=`Motion v2.2 · ${state}`;
}
function resetSensors(){motionInput.reset();detector.reset();sensorSamples=0;lastEvent=0;lastSensor=performance.now();lastStep=0;fallbackTried=false;sensorSource='Waiting';firstSampleTime=null;lastSampleTime=null;}
function stopFallback(){if(accelerometer){const sensor=accelerometer;accelerometer=null;try{sensor.stop();}catch{}motionInput.reset();detector.reset();}}
function tryFallback(){if(fallbackTried || !active || document.hidden || typeof window.Accelerometer!=='function')return;fallbackTried=true;try{const sensor=new window.Accelerometer({frequency:50});accelerometer=sensor;fallbackStarted=performance.now();sensor.addEventListener('reading',()=>{if(accelerometer!==sensor)return;onMotion({accelerationIncludingGravity:{x:sensor.x,y:sensor.y,z:sensor.z},timeStamp:sensor.timestamp,_fallback:true});});sensor.addEventListener('error',()=>{if(accelerometer===sensor)stopFallback();});sensor.start();}catch{stopFallback();}}
const formatTime=ms=>{const s=Math.floor(ms/1000);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
function persist(){try{saved.activeSession=active?{steps,started,energy}:null;localStorage.setItem('stride-v1',JSON.stringify(saved));}catch{$('status').textContent='Steps counted, but browser storage is unavailable. Your total may not survive a reload.';}}
function render(){renderCalories(); $('steps').textContent=steps.toLocaleString();$('total').textContent=saved.total.toLocaleString();$('history').replaceChildren();
  if(!saved.sessions.length){const p=document.createElement('div');p.className='empty';p.textContent='Your next walk is the beginning of something good.';$('history').append(p);}
  for(const session of saved.sessions.slice(0,10)){const row=document.createElement('div');row.className='row';const date=document.createElement('span');date.textContent=new Date(session.date).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});const value=document.createElement('strong');value.textContent=`${Number(session.steps).toLocaleString()} steps`;const duration=document.createElement('small');duration.textContent=formatTime(session.duration)+(Number.isFinite(session.calories)?` · ${session.calories.toFixed(1)} kcal`:'');value.append(duration);row.append(date,value);$('history').append(row);}
}
function onMotion(event){if(!active || document.hidden)return;if(accelerometer && !event._fallback){if(sensorSource==='Accelerometer')return;const a=event.accelerationIncludingGravity||event.acceleration;if(!a || ![a.x,a.y,a.z].every(Number.isFinite))return;stopFallback();}lastEvent=performance.now();const sample=motionInput.read(event,lastEvent);if(!sample)return;lastSensor=lastEvent;sensorSource=event._fallback?'Accelerometer':sample.gravity?'Motion + gravity':'Linear motion';lastSampleTime=sample.time;if(firstSampleTime===null)firstSampleTime=sample.time;sensorSamples++;if(sample.reset)detector.reset();if(sensorSamples===1){$('badge').textContent='Motion connected';$('status').textContent='Motion sensor connected. Walk steadily for at least five strides to confirm steps.';$('motion').hidden=true;}const result=detector.feed(sample.time,sample.acceleration,sample.rotation,sample.gravity);if(!result)return;lastStep=lastSensor;steps+=result.steps;energy+=energyPerKg(result.steps,result.cadence,saved.activity);saved.total+=result.steps;$('cadence').textContent=result.cadence;$('movement').textContent=result.cadence>=150?'Fast cadence':'Walking pace';$('badge').textContent='In your stride';$('status').textContent='Consistent movement detected. Keep going!';persist();render();}
async function enableMotion(){
  if(!window.isSecureContext)throw new Error('Open this app over HTTPS to access your phone’s motion sensors.');
  const Motion=window.DeviceMotionEvent;
  if(!Motion && typeof window.Accelerometer!=='function')throw new Error('Motion tracking is unavailable. Open this app on a phone with motion sensors.');
  const policy=document.permissionsPolicy || document.featurePolicy;
  if(policy && !policy.allowsFeature('accelerometer'))throw new Error('Motion sensors are blocked by this page’s permissions policy. Open the app directly rather than inside another website.');
  if(typeof Motion?.requestPermission==='function' && await Motion.requestPermission()!=='granted')throw new Error('Motion permission was declined. Allow motion sensor access for this website in your browser settings, then retry.');
  stopFallback();motionInput.reset();fallbackTried=false;
  window.removeEventListener('devicemotion',onMotion);
  window.addEventListener('devicemotion',onMotion);
  sensorReady=true;resetSensors();$('motion').hidden=true;if(active && !Motion)tryFallback();
}
async function retryMotion(){if(startPending || !active)return;startPending=true;$('motion').disabled=true;try{await enableMotion();$('badge').textContent='Listening for steps';$('status').textContent='Motion access enabled. Walk steadily with your phone in a trouser pocket.';}catch(error){sensorReady=false;$('status').textContent=error.message;}finally{startPending=false;$('motion').disabled=false;}}
async function start(){if(startPending)return;startPending=true;$('start').disabled=true;try{
  await enableMotion();
  if(document.hidden)return;
  active=true;steps=0;energy=0;elapsed=0;started=Date.now();lastSensor=performance.now();lastStep=0;detector.reset();persist();render();$('time').textContent='00:00';$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent='Listening for steps';$('start').textContent='■   Finish session';$('status').textContent='Walk steadily with your phone in a trouser pocket. The first steps appear after rhythm is confirmed.';
  if(!window.DeviceMotionEvent)tryFallback();
  timer=setInterval(tick,500);
  await acquireWakeLock();
}catch(error){$('status').textContent=error.message;}finally{startPending=false;$('start').disabled=false;}}
function stop(message='Session saved. Ready when you are.'){if(!active)return;active=false;elapsed=Math.max(0,Date.now()-started);window.removeEventListener('devicemotion',onMotion);clearInterval(timer);if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}if(steps){saved.sessions.unshift({date:new Date().toISOString(),steps,duration:elapsed,calories:energy*saved.weight,weight:saved.weight});saved.sessions=saved.sessions.slice(0,10);} $('time').textContent=formatTime(elapsed);$('start').textContent='▶   Start a new session';$('badge').textContent='Session complete';$('movement').textContent='Standing by';$('cadence').textContent='—';$('status').textContent=message;persist();render();}
$('start').addEventListener('click',()=>{if(active){stop();stopFallback();$('motion').hidden=true;}else return start();});
function tick(){if(!active || document.hidden)return;updateSensorStatus();if(accelerometer && sensorSource!=='Accelerometer' && performance.now()-fallbackStarted>3000)stopFallback();if(sensorReady && performance.now()-lastSensor>2000 && !accelerometer && !fallbackTried){motionInput.reset();detector.reset();tryFallback();}elapsed=Math.max(0,Date.now()-started);$('time').textContent=formatTime(elapsed);if(!sensorReady)return;if(performance.now()-lastSensor>6000){$('status').textContent=lastEvent && performance.now()-lastEvent<6000?'This browser is sending motion events without usable acceleration. Check motion sensor access for this website in your browser settings.':'No motion data received. Tap Enable motion tracking and allow access. Keep this page visible on a phone with motion sensors.';$('motion').hidden=false;$('badge').textContent='Waiting for sensor';$('cadence').textContent='—';$('movement').textContent='Standing by';}else if(!lastStep && sensorSamples>0){$('badge').textContent='Motion connected';$('status').textContent='Motion data is arriving. Walk steadily for at least five strides with your phone in a trouser pocket.';}else if(lastStep && performance.now()-lastStep>2500){$('cadence').textContent='—';$('movement').textContent='Standing by';$('badge').textContent='Listening for steps';}}
async function acquireWakeLock(){if(!active || document.hidden || !navigator.wakeLock || wakeLock)return;try{const lock=await navigator.wakeLock.request('screen');if(active && !document.hidden){wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}else await lock.release();}catch{}}
function resume(){if(!active)return;stopFallback();resetSensors();tick();$('cadence').textContent='—';$('movement').textContent='Finding rhythm';$('badge').textContent=sensorReady?'Session resumed':'Motion access needed';$('status').textContent=sensorReady?'Your session is still open. Steps may be missed while another app is open or the screen is locked.':'Your session was restored. Tap Enable motion tracking to allow your browser to use the motion sensor.';$('motion').hidden=sensorReady;acquireWakeLock();}
$('motion').addEventListener('click',retryMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden){persist();stopFallback();if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}}else resume();});
window.addEventListener('pagehide',()=>{persist();stopFallback();});
window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
render();
const pending=saved.activeSession;
if(pending && Number.isSafeInteger(pending.steps) && pending.steps>=0 && pending.steps<=saved.total && Number.isFinite(pending.started) && pending.started>0 && pending.started<=Date.now()){
  active=true;steps=pending.steps;started=pending.started;energy=Number.isFinite(pending.energy) && pending.energy>=0?pending.energy:0;
  if(window.isSecureContext && window.DeviceMotionEvent && typeof window.DeviceMotionEvent.requestPermission!=='function'){sensorReady=true;window.addEventListener('devicemotion',onMotion);}
  timer=setInterval(tick,500);$('start').textContent='■   Finish session';render();resume();
}
