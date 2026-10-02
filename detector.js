// Conservative heuristic, not an activity classifier. Real-device calibration is required.
export class StepDetector {
  constructor(){this.reset();}
  reset(){this.magnitude=null;this.axis=null;this.armed=true;this.filtered=0;this.previous=0;this.before=0;this.lastTime=null;this.lastPeak=null;this.peaks=[];this.confirmed=false;this.rotationUntil=0;}
  feed(time, acceleration, rotation={},includesGravity=true){
    if(!acceleration || ![acceleration.x,acceleration.y,acceleration.z].every(Number.isFinite))return null;
    if(!Number.isFinite(time) || (this.lastTime!==null && time<=this.lastTime))return null;
    if(this.lastTime!==null && time-this.lastTime>1500)this.reset();
    const dt=this.lastTime===null?20:Math.max(1,time-this.lastTime);this.lastTime=time;
    const v=[acceleration.x,acceleration.y,acceleration.z];
    const magnitude=Math.hypot(...v);
    if(this.magnitude===null){this.magnitude=magnitude;if(includesGravity)return null;}
    const alpha=1-Math.exp(-dt/650);
    this.magnitude+=alpha*(magnitude-this.magnitude);
    let vertical=magnitude-this.magnitude;
    if(!includesGravity){
      // Follow the acceleration direction continuously instead of switching axes.
      // Align opposite vectors to the same axis so a stride retains its sign.
      if(!this.axis && magnitude>0.15)this.axis=v.map(a=>a/magnitude);
      const sign=this.axis && v.reduce((sum,a,i)=>sum+a*this.axis[i],0)<0?-1:1;
      vertical=sign*magnitude;
      if(this.axis && magnitude>0.15)this.axis=v.map(a=>sign*a/magnitude);
    }
    const spin=Math.hypot(rotation.alpha||0,rotation.beta||0,rotation.gamma||0);
    // Loose-pocket swing can exceed 170 degrees/second without being a false step.
    if(spin>900 || Math.abs(vertical)>22){this.rotationUntil=time+600;this.peaks=[];this.confirmed=false;}
    this.filtered+= (1-Math.exp(-dt/55))*(vertical-this.filtered);
    let result=null;
    if(this.filtered<0.1)this.armed=true;
    if(this.armed && this.previous>this.before && this.previous>=this.filtered && this.previous>0.55 && this.previous<13 && time>this.rotationUntil){
      this.armed=false;
      const interval=this.lastPeak===null?null:time-this.lastPeak;
      if(interval!==null && interval<280){this.lastPeak=time;this.peaks=[];this.confirmed=false;}
      if(interval===null || interval>=280){
        if(interval===null || interval>1600){this.peaks=[];this.confirmed=false;}
        this.lastPeak=time;this.peaks.push(time);this.peaks=this.peaks.slice(-6);
        if(this.peaks.length>=5){
          const intervals=this.peaks.slice(1).map((t,i)=>t-this.peaks[i]);
          const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
          const cv=Math.sqrt(intervals.reduce((s,n)=>s+(n-mean)**2,0)/intervals.length)/mean;
          if(cv<.32){result={steps:this.confirmed?1:this.peaks.length,cadence:Math.round(60000/mean)};this.confirmed=true;}
          else{this.confirmed=false;this.peaks=this.peaks.slice(-2);}
        }
      }
    }
    this.before=this.previous;this.previous=this.filtered;return result;
  }
}
