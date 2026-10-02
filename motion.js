const valid=a=>Boolean(a && [a.x,a.y,a.z].every(Number.isFinite));

// Keep sample time independent of callback delivery time (callbacks can arrive in bursts).
export class MotionInput {
  constructor(){this.reset();}
  reset(){this.previous=null;this.time=0;this.mode=null;}
  read(event,received){
    const gravity=valid(event.accelerationIncludingGravity);
    const acceleration=gravity?event.accelerationIncludingGravity:event.acceleration;
    if(!valid(acceleration))return null;
    const timestamp=Number.isFinite(event.timeStamp) && event.timeStamp>=0?event.timeStamp:received;
    if(this.previous!==null && timestamp<=this.previous)return null;
    const reset=this.mode!==null && this.mode!==gravity;
    const delta=this.previous===null?0:timestamp-this.previous;
    this.time+=delta;this.previous=timestamp;this.mode=gravity;
    return {time:this.time,acceleration,rotation:event.rotationRate||{},gravity,reset};
  }
}
