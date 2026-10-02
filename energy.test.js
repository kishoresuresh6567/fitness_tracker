import {test} from 'node:test';
import assert from 'node:assert/strict';
import {energyPerKg} from './energy.js';
test('30 minutes of moderate walking yields net activity calories',()=>{
  assert.ok(Math.abs(energyPerKg(3600,120)*70-102.9)<1e-9);
});
test('user-selected jogging uses its own intensity assumption',()=>{
  assert.ok(Math.abs(energyPerKg(5400,180,'jogging')*70-238.875)<1e-9);
});
test('invalid readings and no steps yield zero energy',()=>{
  for(const args of [[0,120],[5,0],[-1,100],[5,NaN],[Infinity,120]])assert.equal(energyPerKg(...args),0);
});
