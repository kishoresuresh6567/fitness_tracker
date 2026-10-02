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
test('walking continues while the phone orientation changes',()=>{
  const detector=new StepDetector();let count=0;
  for(let t=0;t<12000;t+=20){
    const angle=t/1000*1.8,radius=9.81+1.5*Math.sin(t/1000*4*Math.PI);
    count+=detector.feed(t,{x:radius*Math.sin(angle),y:radius*Math.cos(angle),z:0},{alpha:100})?.steps||0;
  }
  assert.ok(count>=20 && count<=25,`count=${count}`);
});
test('changing orientation without walking does not produce steps',()=>{
  const detector=new StepDetector();let count=0;
  for(let t=0;t<12000;t+=20){const angle=t/1000*1.8;count+=detector.feed(t,{x:9.81*Math.sin(angle),y:9.81*Math.cos(angle),z:0})?.steps||0;}
  assert.equal(count,0);
});
test('slow walking cadence counts',()=>{
  const count=simulate({frequency:0.75,amplitude:1.5,duration:16000});assert.ok(count>=9 && count<=13,`count=${count}`);
});
