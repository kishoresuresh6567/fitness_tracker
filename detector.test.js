import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StepDetector} from './detector.js';
function simulate({frequency=2,amplitude=3,rotation=0,duration=10000}={}){const detector=new StepDetector();let count=0;for(let t=0;t<duration;t+=20){const result=detector.feed(t,{x:0,y:0,z:9.81+amplitude*Math.sin(t/1000*2*Math.PI*frequency)},{alpha:rotation});count+=result?.steps||0;}return count;}
test('stationary device does not count',()=>assert.equal(simulate({amplitude:0}),0));
test('sustained walking cadence confirms buffered steps',()=>{const n=simulate();assert.ok(n>=17 && n<=21,`count=${n}`);});
test('running cadence counts',()=>assert.ok(simulate({frequency:3,amplitude:5})>=25));
test('rapid shaking rejected',()=>assert.equal(simulate({frequency:6}),0));
test('strong rotation rejected',()=>assert.equal(simulate({rotation:250}),0));
test('short burst not counted',()=>assert.equal(simulate({duration:1300}),0));
test('missing sensor values ignored',()=>assert.equal(new StepDetector().feed(0,{x:null,y:0,z:0}),null));
test('gentle walking signal counts instead of remaining at zero',()=>{
  const count=simulate({amplitude:0.9});assert.ok(count>=17 && count<=21,`count=${count}`);
});
test('small stationary sensor noise does not count',()=>assert.equal(simulate({amplitude:0.2}),0));
test('quantized walking readings at 20 Hz work in different pocket orientations',()=>{
  for(const axis of ['x','y','z']){
    const detector=new StepDetector();let count=0;
    for(let t=0;t<10000;t+=50){const a={x:0,y:0,z:0};a[axis]=Math.round((9.81+0.9*Math.sin(t/1000*4*Math.PI))*10)/10;count+=detector.feed(t,a)?.steps||0;}
    assert.ok(count>=17 && count<=21,`${axis}: ${count}`);
  }
});
