'use client';

import { sortColors } from '@/lib/images';
import { useCallback, useEffect, useRef, useState } from 'react';

type Stir = { x:number; y:number; dx:number; dy:number; born:number };
type Quality = 'low'|'medium'|'high';
type Settings = {
 quality:Quality; ambientSpeed:number; ambientStrength:number; pointerForce:number;
 vorticity:number; rippleStrength:number; splatRadius:number; persistence:number;
 trailSpacing:number; effectOpacity:number; gestureStretch:number; flowLength:number;
 swirlSpeed:number; waveScale:number; waveSpeed:number; paused:boolean;
};

const defaults:Settings={quality:'medium',ambientSpeed:.025,ambientStrength:.06,pointerForce:.07,vorticity:.035,rippleStrength:.008,splatRadius:.42,persistence:22,trailSpacing:68,effectOpacity:.82,gestureStretch:3.2,flowLength:1.2,swirlSpeed:3,waveScale:14,waveSpeed:8,paused:false};
const vertexShader=`attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragmentShader=`
precision mediump float;
varying vec2 uv;
uniform sampler2D palette;
uniform float time,motion,aspect,ambientSpeed,ambientStrength,pointerForce,vorticity,rippleStrength,splatRadius;
uniform float effectOpacity,gestureStretch,flowLength,swirlSpeed,waveScale,waveSpeed;
uniform vec4 stirs[12];
uniform float ages[12];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 p=uv;
 if(motion>.5){
  float n1=noise(p*2.6+vec2(time*ambientSpeed,-time*ambientSpeed*.7));
  float n2=noise(p*2.6+vec2(-time*ambientSpeed*.76,time*ambientSpeed*.91)+8.3);
  p+=(vec2(n1,n2)-.5)*ambientStrength;
  for(int i=0;i<12;i++){
   float age=ages[i],life=max(0.,1.-age);vec2 velocity=stirs[i].zw;velocity.x/=aspect;
   vec2 center=stirs[i].xy+velocity*age*pointerForce*flowLength,d=p-center;d.x*=aspect;
   float speed=min(2.,length(velocity));vec2 direction=normalize(velocity+vec2(.0001));
   vec2 normal=vec2(-direction.y,direction.x);vec2 shaped=vec2(dot(d,direction)/gestureStretch,dot(d,normal));
   float r=length(shaped)+.003;
   float fall=exp(-(r*r)/(splatRadius*splatRadius))*pow(life,.55);
   vec2 radial=d/r,tangent=vec2(-radial.y,radial.x);
   float rotation=sin(age*swirlSpeed+r*4.)*.35+.8;
   p+=tangent*fall*vorticity*(.35+speed)*rotation;
   p-=velocity*fall*pointerForce*exp(-age*2.2);
   p+=radial*sin(r*waveScale-age*waveSpeed)*fall*rippleStrength*(.5+speed);
  }
 }
 p=clamp(p,vec2(.002),vec2(.998));vec4 base=texture2D(palette,uv),flowed=texture2D(palette,p);gl_FragColor=mix(base,flowed,effectOpacity);
}`;

function compile(gl:WebGLRenderingContext,type:number,source:string){const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)||'Shader error');return shader}

function Range({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void}){
 const percent=(value-min)/(max-min)*100;
 return <label className="grid grid-cols-[1fr_56px] items-center gap-3 border-t border-white/10 px-4 py-2.5"><span><span className="mb-1.5 block text-[11px] text-white/75">{label}</span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="block h-1 w-full cursor-pointer accent-sky-400" style={{background:`linear-gradient(90deg,#4aa8d2 ${percent}%,#363636 ${percent}%)`}}/></span><output className="bg-white/10 px-2 py-1 text-right text-[11px] tabular-nums text-sky-300">{value}</output></label>
}

export function FluidColorField({colors}:{colors:string[]}){
 const canvas=useRef<HTMLCanvasElement>(null),animation=useRef(0),stirs=useRef<Stir[]>([]),last=useRef({x:0,y:0,time:0}),lastStir=useRef(0);
 const [settings,setSettings]=useState(defaults),settingsRef=useRef(settings),[reduced,setReduced]=useState(false),[reset,setReset]=useState(0),[panel,setPanel]=useState(false),sorted=sortColors(colors),sortedKey=sorted.join(',');
 settingsRef.current=settings;
 const set=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReduced(media.matches);if(media.matches)set('paused',true)};update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const stir=useCallback((clientX:number,clientY:number)=>{const c=canvas.current,s=settingsRef.current;if(!c||s.paused||reduced)return;const rect=c.getBoundingClientRect(),now=performance.now(),x=(clientX-rect.left)/rect.width,y=1-(clientY-rect.top)/rect.height,elapsed=Math.max(12,now-last.current.time),dx=(x-last.current.x)*1000/elapsed,dy=(y-last.current.y)*1000/elapsed;last.current={x,y,time:now};if(now-lastStir.current>s.trailSpacing&&Math.hypot(dx,dy)>.015){lastStir.current=now;stirs.current.push({x,y,dx:Math.max(-2,Math.min(2,dx)),dy:Math.max(-2,Math.min(2,dy)),born:now});stirs.current=stirs.current.slice(-12)}},[reduced]);
 useEffect(()=>{const c=canvas.current;if(!c)return;const gl=c.getContext('webgl',{antialias:false,alpha:false,powerPreference:'high-performance'});if(!gl)return;const program=gl.createProgram()!;gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,vertexShader));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,fragmentShader));gl.linkProgram(program);gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const resize=()=>{const scale={low:.5,medium:.8,high:1.25}[settingsRef.current.quality],d=Math.min(devicePixelRatio,scale);c.width=Math.round(c.clientWidth*d);c.height=Math.round(c.clientHeight*d);gl.viewport(0,0,c.width,c.height);const columns=innerWidth>=1024?6:innerWidth>=640?4:3,rows=Math.ceil(sorted.length/columns),pixels=new Uint8Array(columns*rows*4);for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const index=(rows-1-row)*columns+col,color=sorted[Math.min(index,sorted.length-1)]||'#777777',at=(row*columns+col)*4;pixels[at]=parseInt(color.slice(1,3),16);pixels[at+1]=parseInt(color.slice(3,5),16);pixels[at+2]=parseInt(color.slice(5,7),16);pixels[at+3]=255}gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,columns,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels)};
  resize();addEventListener('resize',resize);const started=performance.now(),locations=Object.fromEntries(['time','motion','aspect','ambientSpeed','ambientStrength','pointerForce','vorticity','rippleStrength','splatRadius','effectOpacity','gestureStretch','flowLength','swirlSpeed','waveScale','waveSpeed','stirs','ages'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const draw=(now:number)=>{const s=settingsRef.current,duration=s.persistence*1000,active=stirs.current.filter(item=>now-item.born<duration);stirs.current=active;const values=new Float32Array(48),ages=new Float32Array(12).fill(2);active.forEach((item,i)=>{values.set([item.x,item.y,item.dx,item.dy],i*4);ages[i]=(now-item.born)/duration});gl.uniform1f(locations.time,(now-started)/1000);gl.uniform1f(locations.motion,!s.paused&&!reduced?1:0);gl.uniform1f(locations.aspect,c.clientWidth/c.clientHeight);gl.uniform1f(locations.ambientSpeed,s.ambientSpeed);gl.uniform1f(locations.ambientStrength,s.ambientStrength);gl.uniform1f(locations.pointerForce,s.pointerForce);gl.uniform1f(locations.vorticity,s.vorticity);gl.uniform1f(locations.rippleStrength,s.rippleStrength);gl.uniform1f(locations.splatRadius,s.splatRadius);gl.uniform1f(locations.effectOpacity,s.effectOpacity);gl.uniform1f(locations.gestureStretch,s.gestureStretch);gl.uniform1f(locations.flowLength,s.flowLength);gl.uniform1f(locations.swirlSpeed,s.swirlSpeed);gl.uniform1f(locations.waveScale,s.waveScale);gl.uniform1f(locations.waveSpeed,s.waveSpeed);gl.uniform4fv(locations.stirs,values);gl.uniform1fv(locations.ages,ages);gl.drawArrays(gl.TRIANGLES,0,6);animation.current=requestAnimationFrame(draw)};animation.current=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(animation.current);removeEventListener('resize',resize);gl.deleteTexture(texture);gl.deleteProgram(program);gl.deleteBuffer(buffer)}},[sortedKey,reduced,reset,settings.quality]);
 const restore=()=>{setSettings(defaults);stirs.current=[];setReset(x=>x+1)};
 return <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-neutral-500"><canvas ref={canvas} className="block h-full w-full touch-none" aria-label="Interactive mesh gradient made from archived sky colors" onPointerMove={e=>stir(e.clientX,e.clientY)} onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();last.current={x:(e.clientX-r.left)/r.width,y:1-(e.clientY-r.top)/r.height,time:performance.now()}}}/>
  {panel&&<aside aria-label="Fluid settings" className="absolute right-4 top-4 z-20 max-h-[calc(100%-4.5rem)] w-[min(330px,calc(100vw-2rem))] overflow-auto bg-[#111]/95 text-white shadow-2xl backdrop-blur-md"><div className="flex items-center justify-between px-4 py-3"><span className="site-mark text-[11px] font-semibold tracking-[.14em]">FLUID SETTINGS</span><button onClick={()=>setPanel(false)} className="text-lg text-white/60">×</button></div><label className="grid grid-cols-[1fr_120px] items-center border-t border-white/10 px-4 py-2.5 text-[11px] text-white/75"><span>render quality</span><select value={settings.quality} onChange={e=>set('quality',e.target.value as Quality)} className="bg-white/10 px-2 py-1.5 text-white"><option className="text-black">low</option><option className="text-black">medium</option><option className="text-black">high</option></select></label>
   <Range label="effect translucency" value={settings.effectOpacity} min={0} max={1} step={.02} onChange={v=>set('effectOpacity',v)}/>
   <Range label="ambient speed" value={settings.ambientSpeed} min={0} max={.15} step={.005} onChange={v=>set('ambientSpeed',v)}/>
   <Range label="ambient strength" value={settings.ambientStrength} min={0} max={.15} step={.005} onChange={v=>set('ambientStrength',v)}/>
   <Range label="pointer force" value={settings.pointerForce} min={0} max={.25} step={.005} onChange={v=>set('pointerForce',v)}/>
   <Range label="affected area" value={settings.splatRadius} min={.05} max={.85} step={.01} onChange={v=>set('splatRadius',v)}/>
   <Range label="gesture stretch" value={settings.gestureStretch} min={1} max={8} step={.1} onChange={v=>set('gestureStretch',v)}/>
   <Range label="flow travel" value={settings.flowLength} min={0} max={3} step={.05} onChange={v=>set('flowLength',v)}/>
   <Range label="vorticity / curl" value={settings.vorticity} min={0} max={.2} step={.005} onChange={v=>set('vorticity',v)}/>
   <Range label="swirl speed" value={settings.swirlSpeed} min={0} max={15} step={.25} onChange={v=>set('swirlSpeed',v)}/>
   <Range label="ripple strength" value={settings.rippleStrength} min={0} max={.05} step={.002} onChange={v=>set('rippleStrength',v)}/>
   <Range label="wave scale" value={settings.waveScale} min={3} max={70} step={1} onChange={v=>set('waveScale',v)}/>
   <Range label="wave speed" value={settings.waveSpeed} min={0} max={40} step={1} onChange={v=>set('waveSpeed',v)}/>
   <Range label="persistence (seconds)" value={settings.persistence} min={2} max={40} step={1} onChange={v=>set('persistence',v)}/>
   <Range label="trail spacing (ms)" value={settings.trailSpacing} min={16} max={180} step={4} onChange={v=>set('trailSpacing',v)}/>
   <label className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-[11px] text-white/75"><span>paused</span><input type="checkbox" checked={settings.paused} disabled={reduced} onChange={e=>set('paused',e.target.checked)} className="accent-sky-500"/></label><button onClick={restore} className="w-full border-t border-white/10 px-4 py-3 text-left text-[11px] text-sky-300">Restore sunset defaults</button></aside>}
  <div className="pointer-events-none absolute bottom-4 left-5 text-[10px] text-white/80 mix-blend-difference">{reduced?'Static field · reduced motion':'Move to stir the sky'}</div><div className="absolute bottom-4 right-5 flex gap-5 text-[11px] text-white mix-blend-difference"><button onClick={()=>{stirs.current=[];setReset(x=>x+1)}}>Reset field</button><button onClick={()=>setPanel(x=>!x)}>Settings</button></div></div>
}
