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
