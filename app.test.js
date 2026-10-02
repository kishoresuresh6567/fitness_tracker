import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {StepDetector} from './detector.js';

const source=readFileSync(new URL('./app.js',import.meta.url),'utf8').replace("import {StepDetector} from './detector.js';",'');
function boot(storage=new Map()){
  let now=100000;
  const handlers={},elements=new Map(),intervals=new Set();
  const element=()=>({textContent:'',disabled:false,append(){},replaceChildren(){},addEventListener(type,fn){this[type]=fn;}});
  const document={hidden:false,getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(type,fn){handlers[type]=fn;}};
  const window={isSecureContext:true,DeviceMotionEvent:{},addEventListener(type,fn){handlers[type]=fn;},removeEventListener(type){delete handlers[type];}};
  const context=vm.createContext({document,window,DeviceMotionEvent:window.DeviceMotionEvent,navigator:{},StepDetector,Date:class extends Date{static now(){return now;}},performance:{now:()=>now},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn)});
  vm.runInContext(source,context);
  return {storage,document,handlers,elements,context,advance(ms){now+=ms;for(const tick of intervals)tick();},async click(){await elements.get('start').click();},state(){return JSON.parse(storage.get('stride-v1'));}};
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
