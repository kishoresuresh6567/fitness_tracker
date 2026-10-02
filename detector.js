// Conservative heuristic, not an activity classifier. Real-device calibration is required.
export class StepDetector {
  constructor(){this.reset();}
  reset(){this.gravity=null;this.filtered=0;this.previous=0;this.before=0;this.lastTime=null;this.lastPeak=null;this.peaks=[];this.confirmed=false;this.rotationUntil=0;}
  feed(time, acceleration, rotation={},includesGravity=true){
    if(!acceleration || ![acceleration.x,acceleration.y,acceleration.z].every(Number.isFinite))return null;
    if(!Number.isFinite(time) || (this.lastTime!==null && time<=this.lastTime))return null;
    if(this.lastTime!==null && time-this.lastTime>1500)this.reset();
    const dt=this.lastTime===null?20:Math.max(1,time-this.lastTime);this.lastTime=time;
    const v=[acceleration.x,acceleration.y,acceleration.z];
    if(!this.gravity){this.gravity=includesGravity?v.slice():[0,0,0];if(includesGravity)return null;}
    const alpha=1-Math.exp(-dt/650);
    if(includesGravity)this.gravity=this.gravity.map((g,i)=>g+alpha*(v[i]-g));
    const norm=Math.hypot(...this.gravity);if(includesGravity && norm<1)return null;
    const vertical=includesGravity?v.reduce((sum,a,i)=>sum+(a-this.gravity[i])*this.gravity[i]/norm,0):v.reduce((largest,a)=>Math.abs(a)>Math.abs(largest)?a:largest,0);
    const linear=Math.hypot(...v.map((a,i)=>a-this.gravity[i]));
    const lateral=Math.sqrt(Math.max(0,linear*linear-vertical*vertical));
    const spin=Math.hypot(rotation.alpha||0,rotation.beta||0,rotation.gamma||0);
    if(spin>170 || linear>22){this.rotationUntil=time+600;this.peaks=[];this.confirmed=false;}
    this.filtered+= (1-Math.exp(-dt/55))*(vertical-this.filtered);
    let result=null;
    if(this.previous>this.before && this.previous>=this.filtered && this.previous>0.55 && this.previous<13 && lateral<Math.max(3.5,Math.abs(vertical)*2) && time>this.rotationUntil){
      const interval=this.lastPeak===null?null:time-this.lastPeak;
      if(interval!==null && interval<280){this.lastPeak=time;this.peaks=[];this.confirmed=false;}
      if(interval===null || interval>=280){
        if(interval===null || interval>1200){this.peaks=[];this.confirmed=false;}
        this.lastPeak=time;this.peaks.push(time);this.peaks=this.peaks.slice(-6);
        if(this.peaks.length>=5){
          const intervals=this.peaks.slice(1).map((t,i)=>t-this.peaks[i]);
          const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
          const cv=Math.sqrt(intervals.reduce((s,n)=>s+(n-mean)**2,0)/intervals.length)/mean;
          if(cv<.22){result={steps:this.confirmed?1:this.peaks.length,cadence:Math.round(60000/mean)};this.confirmed=true;}
          else{this.confirmed=false;this.peaks=this.peaks.slice(-2);}
        }
      }
    }
    this.before=this.previous;this.previous=this.filtered;return result;
  }
}
