import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MotionInput} from './motion.js';
import {StepDetector} from './detector.js';

test('sample timestamps retain cadence when callbacks arrive in batches, including epoch timestamps',()=>{
  for(const base of [0,1790000000000])for(const hz of [20,30,60,100]){
    const input=new MotionInput(),detector=new StepDetector();let steps=0;
    for(let t=0;t<10000;t+=1000/hz){
      const event={timeStamp:base+t,accelerationIncludingGravity:{x:0,y:9.81+1.4*Math.sin(t/1000*4*Math.PI),z:0}};
      const sample=input.read(event,Math.ceil(t/500)*500);
      steps+=detector.feed(sample.time,sample.acceleration,sample.rotation,sample.gravity)?.steps||0;
    }
    assert.ok(steps>=17 && steps<=21,`${base}, ${hz}Hz: ${steps}`);
  }
});
test('gravity-free acceleration counts without treating it as a gravity vector',()=>{
  const input=new MotionInput(),detector=new StepDetector();let steps=0;
  for(let t=0;t<10000;t+=20){
    const sample=input.read({timeStamp:t,accelerationIncludingGravity:{x:null,y:null,z:null},acceleration:{x:1.4*Math.sin(t/1000*4*Math.PI),y:0,z:0}},t);
    steps+=detector.feed(sample.time,sample.acceleration,sample.rotation,sample.gravity)?.steps||0;
  }
  assert.ok(steps>=17 && steps<=21,`steps=${steps}`);
});
test('duplicate and stale events are ignored; reset permits a new stream',()=>{
  const input=new MotionInput(),acceleration={x:0,y:0,z:9.81};
  assert.ok(input.read({timeStamp:500,accelerationIncludingGravity:acceleration},600));
  assert.equal(input.read({timeStamp:500,accelerationIncludingGravity:acceleration},700),null);
  assert.equal(input.read({timeStamp:400,accelerationIncludingGravity:acceleration},800),null);
  input.reset();assert.ok(input.read({timeStamp:10,accelerationIncludingGravity:acceleration},900));
});
test('switching gravity mode signals a detector reset; invalid data is never counted',()=>{
  const input=new MotionInput();assert.equal(input.read({acceleration:{x:null,y:0,z:0}},0),null);
  input.read({timeStamp:10,accelerationIncludingGravity:{x:0,y:0,z:9.81}},10);
  assert.equal(input.read({timeStamp:20,acceleration:{x:0,y:1,z:0}},20).reset,true);
});
test('an absent gravity-inclusive field explicitly selects gravity-free detection',()=>{
  const sample=new MotionInput().read({timeStamp:1,acceleration:{x:0,y:1,z:0}},1);
  assert.equal(sample.gravity,false);
});
