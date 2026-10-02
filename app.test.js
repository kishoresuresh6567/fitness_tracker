import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {StepDetector} from './detector.js';
import {MotionInput} from './motion.js';

const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace("import {StepDetector} from './detector.js';",'').replace("import {MotionInput} from './motion.js';",'');
function boot(storage=new Map(),motion={}){
  let now=100000;
  const handlers={},elements=new Map(),intervals=new Set();
  const element=()=>({textContent:'',disabled:false,append(){},replaceChildren(){},addEventListener(type,fn){this[type]=fn;}});
  const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(type,fn){handlers[type]=fn;}};
  const window={isSecureContext:true,DeviceMotionEvent:motion,addEventListener(type,fn){handlers[type]=fn;},removeEventListener(type){delete handlers[type];}};
  const context=vm.createContext({document,window,DeviceMotionEvent:window.DeviceMotionEvent,navigator:{},StepDetector,MotionInput,Date:class extends Date{static now(){return now;}},performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn)});
  vm.runInContext(source,context);
  return {storage,document,window,handlers,elements,context,advance(ms){now+=ms;for(const tick of intervals)tick();},async click(){await elements.get('start').click();},async enable(){await elements.get('motion').click();},state(){return JSON.parse(storage.get('stride-v1'));}};
}
test('switching apps and pagehide keep the session; return catches up without invented steps',async()=>{
  const app=boot();await app.click();
  app.document.hidden=true;app.handlers.visibilitychange();app.handlers.pagehide();
  assert.ok(app.state().activeSession);
  assert.ok(app.handlers.devicemotion);
  app.advance(65000);app.document.hidden=false;app.handlers.visibilitychange();
  assert.equal(app.elements.get('time').textContent,'01:05');
  assert.equal(app.state().total,0);
  await app.click();assert.equal(app.state().activeSession,null);
});
test('reload restores counted progress and finishing records it only once',async()=>{
  const app=boot();await app.click();
  vm.runInContext('steps=7;saved.total=7;persist();',app.context);
  const restored=boot(app.storage);restored.advance(90000);
  assert.equal(restored.elements.get('steps').textContent,'7');
  assert.equal(restored.elements.get('time').textContent,'01:30');
  await restored.click();
  assert.equal(restored.state().sessions.length,1);
  assert.equal(restored.state().sessions[0].steps,7);
  assert.equal(restored.state().sessions[0].duration,90000);
  assert.equal(restored.state().total,7);
  assert.equal(boot(app.storage).elements.get('steps').textContent,'0');
});
test('Safari restored session requests permission on a tap without losing steps',async()=>{
  const app=boot();await app.click();vm.runInContext('steps=7;saved.total=7;persist();',app.context);
  let requests=0;
  const restored=boot(app.storage,{requestPermission:async()=>{requests++;return 'granted';}});
  assert.equal(requests,0);
  assert.equal(restored.handlers.devicemotion,undefined);
  assert.equal(restored.elements.get('motion').hidden,false);
  await restored.enable();
  assert.equal(requests,1);
  assert.equal(restored.state().activeSession.steps,7);
  for(let t=0;t<10000;t+=20){restored.advance(20);restored.handlers.devicemotion({accelerationIncludingGravity:{x:0,y:9.81+0.9*Math.sin(t/1000*4*Math.PI),z:0}});}
  assert.ok(restored.state().activeSession.steps>=24);
  assert.equal(restored.state().total,restored.state().activeSession.steps);
});
test('denied Safari permission does not start a silent zero-step session',async()=>{
  const app=boot(new Map(),{requestPermission:async()=> 'denied'});await app.click();
  assert.equal(app.handlers.devicemotion,undefined);
  assert.match(app.elements.get('status').textContent,/permission was declined/);
  assert.equal(app.elements.get('start').disabled,false);
});
test('missing and null sensor readings expose recovery instead of claiming tracking works',async()=>{
  const app=boot();await app.click();app.advance(6500);
  assert.equal(app.elements.get('motion').hidden,false);
  assert.match(app.elements.get('status').textContent,/No motion data/);
  app.handlers.devicemotion({accelerationIncludingGravity:{x:null,y:null,z:null}});app.advance(500);
  assert.match(app.elements.get('status').textContent,/without usable acceleration/);
  assert.equal(app.state().total,0);
});
test('Chromium accelerometer fallback counts once and stops on background and finish',async()=>{
  const app=boot();let sensor;
  app.window.Accelerometer=class {
    constructor(){sensor=this;this.handlers={};this.stopped=false;}
    addEventListener(type,fn){this.handlers[type]=fn;}
    start(){}stop(){this.stopped=true;}
  };
  await app.click();app.advance(2100);assert.ok(sensor);
  for(let t=0;t<10000;t+=20){app.advance(20);sensor.x=0;sensor.y=9.81+1.4*Math.sin(t/1000*4*Math.PI);sensor.z=0;sensor.timestamp=t; sensor.handlers.reading();app.handlers.devicemotion({timeStamp:t,accelerationIncludingGravity:{x:sensor.x,y:sensor.y,z:0}});}
  assert.ok(app.state().total>=17 && app.state().total<=21);
  app.document.hidden=true;app.handlers.visibilitychange();assert.equal(sensor.stopped,true);
  app.document.hidden=false;app.handlers.visibilitychange();app.advance(2100);assert.equal(sensor.stopped,false);
  await app.click();assert.equal(sensor.stopped,true);
});
test('permissions policy blocks tracking with an actionable error',async()=>{
  const app=boot();app.document.permissionsPolicy={allowsFeature:()=>false};await app.click();
  assert.match(app.elements.get('status').textContent,/permissions policy/);
  assert.equal(app.handlers.devicemotion,undefined);
});
test('a fallback that has not produced readings does not block returning motion events',async()=>{
  const app=boot();let stopped=false;
  app.window.Accelerometer=class {addEventListener(){}start(){}stop(){stopped=true;}};
  await app.click();app.advance(2100);
  for(let t=0;t<10000;t+=20){app.advance(20);app.handlers.devicemotion({timeStamp:t,accelerationIncludingGravity:{x:0,y:9.81+1.4*Math.sin(t/1000*4*Math.PI),z:0}});}
  assert.equal(stopped,true);assert.ok(app.state().total>=17);
  assert.match(app.elements.get('sensor-status').textContent,/Motion \+ gravity/);
});
test('loose-pocket motion reaches the displayed counter through permission-required and permission-free paths',async()=>{
  for(const motion of [{},{requestPermission:async()=> 'granted'}])for(const gravity of [true,false]){
    const app=boot(new Map(),motion);await app.click();
    for(let t=0;t<12000;t+=20){
      app.advance(20);const seconds=t/1000,angle=0.8*Math.sin(seconds*4*Math.PI);
      const radius=(gravity?9.81:0)+1.6*Math.sin(seconds*4*Math.PI)+0.3*Math.sin(seconds*8*Math.PI);
      const event={timeStamp:t,rotationRate:{gamma:576*Math.cos(seconds*4*Math.PI)}};
      event[gravity?'accelerationIncludingGravity':'acceleration']={x:radius*Math.sin(angle),y:radius*Math.cos(angle),z:0};
      app.handlers.devicemotion(event);
    }
    assert.ok(app.state().total>=20 && app.state().total<=25,`gravity=${gravity}, count=${app.state().total}`);
    assert.equal(app.elements.get('steps').textContent,String(app.state().total));
  }
});
