"use client";

import { sortColors } from "@/lib/images";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteAttribution } from "./SiteAttribution";

type ArtSettings = {
  flow: number;
  swirl: number;
  brushSize: number;
  pointerForce: number;
  ambientDrift: number;
  viscosity: number;
  paused: boolean;
};
type AdvancedSettings = {
  simResolution: number;
  dyeResolution: number;
  pressureIterations: number;
};
type ColorSettings = {
  colorSoftness: number;
  paletteAttraction: number;
  minimumChroma: number;
  gammaCorrection: boolean;
};
type Pointer = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  moved: boolean;
  last: number;
};
type GLTarget = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
};
type DoubleTarget = { read: GLTarget; write: GLTarget; swap: () => void };

const presets: Record<"CALM" | "SILK" | "MARBLE", ArtSettings> = {
  CALM: {
    flow: 0.975,
    swirl: 5,
    brushSize: 0.13,
    pointerForce: 0.75,
    ambientDrift: 0.018,
    viscosity: 0.32,
    paused: false,
  },
  SILK: {
    flow: 0.987,
    swirl: 11,
    brushSize: 0.105,
    pointerForce: 1.35,
    ambientDrift: 0.03,
    viscosity: 0.2,
    paused: false,
  },
  MARBLE: {
    flow: 0.993,
    swirl: 17,
    brushSize: 0.085,
    pointerForce: 1.75,
    ambientDrift: 0.038,
    viscosity: 0.1,
    paused: false,
  },
};
const vertex = `#version 300 es
in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const shaders = {
  copy: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D source;out vec4 outColor;void main(){outColor=texture(source,uv);}`,
  init: `#version 300 es
precision highp float;in vec2 uv;uniform vec3 colors[12];uniform vec2 centers[12];uniform float radii[12];uniform float seed;uniform float aspect;out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+2.7;a*=.5;}return v;}
void main(){vec2 q=uv;q+=vec2(fbm(uv*1.2+seed),fbm(uv*1.4+seed+6.7)-.5)*.115;vec3 sum=vec3(0);float total=0.;for(int i=0;i<12;i++){vec2 d=q-centers[i];d.x*=aspect;float w=exp(-dot(d,d)/(radii[i]*radii[i]));w=pow(w,3.)*(.84+.25*fbm(q*1.3+float(i)*1.91+seed));sum+=colors[i]*w;total+=w;}outColor=vec4(sum/max(total,.001),1.);}`,
  advect: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D velocity;uniform sampler2D source;uniform vec2 texel;uniform float dt;uniform float dissipation;uniform float viscosity;out vec4 outColor;
void main(){vec2 v=texture(velocity,uv).xy;vec2 coord=clamp(uv-dt*v,texel*.5,vec2(1.)-texel*.5);vec4 c=texture(source,coord);if(viscosity>0.){vec4 near=(texture(source,coord+vec2(texel.x,0))+texture(source,coord-vec2(texel.x,0))+texture(source,coord+vec2(0,texel.y))+texture(source,coord-vec2(0,texel.y)))*.25;c=mix(c,near,viscosity);}outColor=c/(1.+dissipation*dt);}`,
  splat: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D target;uniform vec2 point;uniform vec2 force;uniform float radius;uniform float aspect;out vec4 outColor;void main(){vec2 d=uv-point;d.x*=aspect;float influence=exp(-dot(d,d)/(radius*radius));vec4 base=texture(target,uv);outColor=vec4(base.xy+force*influence,base.zw);}`,
  ambient: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D velocity;uniform float time;uniform float strength;out vec4 outColor;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){float e=.006;vec2 p=uv*1.35+vec2(time*.021,-time*.016);float nx=noise(p+vec2(e,0))-noise(p-vec2(e,0));float ny=noise(p+vec2(0,e))-noise(p-vec2(0,e));vec2 curl=vec2(ny,-nx)/e;outColor=vec4(texture(velocity,uv).xy+curl*strength*.00022,0,1);}`,
  curl: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D velocity;uniform vec2 texel;out vec4 outColor;void main(){float l=texture(velocity,uv-vec2(texel.x,0)).y,r=texture(velocity,uv+vec2(texel.x,0)).y,b=texture(velocity,uv-vec2(0,texel.y)).x,t=texture(velocity,uv+vec2(0,texel.y)).x;outColor=vec4(.5*(r-l-b+t),0,0,1);}`,
  vorticity: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D velocity;uniform sampler2D curlTex;uniform vec2 texel;uniform float curlStrength;uniform float dt;out vec4 outColor;void main(){float l=abs(texture(curlTex,uv-vec2(texel.x,0)).x),r=abs(texture(curlTex,uv+vec2(texel.x,0)).x),b=abs(texture(curlTex,uv-vec2(0,texel.y)).x),t=abs(texture(curlTex,uv+vec2(0,texel.y)).x),c=texture(curlTex,uv).x;vec2 f=.5*vec2(t-b,r-l);f/=length(f)+.0001;f*=curlStrength*c;vec2 v=texture(velocity,uv).xy+f*dt;outColor=vec4(clamp(v,vec2(-2),vec2(2)),0,1);}`,
  divergence: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D velocity;uniform vec2 texel;out vec4 outColor;void main(){float l=texture(velocity,uv-vec2(texel.x,0)).x,r=texture(velocity,uv+vec2(texel.x,0)).x,b=texture(velocity,uv-vec2(0,texel.y)).y,t=texture(velocity,uv+vec2(0,texel.y)).y;outColor=vec4(.5*(r-l+t-b),0,0,1);}`,
  pressure: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D pressure;uniform sampler2D divergence;uniform vec2 texel;out vec4 outColor;void main(){float l=texture(pressure,uv-vec2(texel.x,0)).x,r=texture(pressure,uv+vec2(texel.x,0)).x,b=texture(pressure,uv-vec2(0,texel.y)).x,t=texture(pressure,uv+vec2(0,texel.y)).x,d=texture(divergence,uv).x;outColor=vec4((l+r+b+t-d)*.25,0,0,1);}`,
  gradient: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D pressure;uniform sampler2D velocity;uniform vec2 texel;uniform float pressureStrength;out vec4 outColor;void main(){float l=texture(pressure,uv-vec2(texel.x,0)).x,r=texture(pressure,uv+vec2(texel.x,0)).x,b=texture(pressure,uv-vec2(0,texel.y)).x,t=texture(pressure,uv+vec2(0,texel.y)).x;vec2 v=texture(velocity,uv).xy-vec2(r-l,t-b)*pressureStrength;outColor=vec4(v,0,1);}`,
  preserve: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D dye;uniform vec3 palette[12];uniform float paletteAttraction;uniform float minimumChroma;uniform float chromaRecovery;out vec4 outColor;
vec3 linearToOklab(vec3 c){vec3 lms=mat3(.4122214708,.2119034982,.0883024619,.5363325363,.6806995451,.2817188376,.0514459929,.1073969566,.6299787005)*c;lms=sign(lms)*pow(abs(lms),vec3(1./3.));return mat3(.2104542553,1.9779984951,.0259040371,.793617785,-2.428592205,.7827717662,-.0040720468,.4505937099,-.808675766)*lms;}
vec3 oklabToLinear(vec3 c){vec3 lms=mat3(1.,1.,1.,.3963377774,-.1055613458,-.0894841775,.2158037573,-.0638541728,-1.291485548)*c;lms=lms*lms*lms;return mat3(4.0767416621,-1.2684380046,-.0041960863,-3.3077115913,2.6097574011,-.7034186147,.2309699292,-.3413193965,1.707614701)*lms;}
void main(){vec3 lab=linearToOklab(max(texture(dye,uv).rgb,vec3(0))),nearest=linearToOklab(palette[0]);float best=999.;for(int i=0;i<12;i++){vec3 candidate=linearToOklab(palette[i]);float d=dot(lab-candidate,lab-candidate);if(d<best){best=d;nearest=candidate;}}lab.yz=mix(lab.yz,nearest.yz,paletteAttraction);float chroma=length(lab.yz),sourceChroma=length(nearest.yz),target=min(minimumChroma,sourceChroma*.92);if(chroma<target){vec2 direction=chroma>.0001?lab.yz/chroma:normalize(nearest.yz+vec2(.0001));lab.yz=direction*mix(chroma,target,chromaRecovery);}outColor=vec4(max(oklabToLinear(lab),vec3(0)),1);}`,
  display: `#version 300 es
precision highp float;in vec2 uv;uniform sampler2D dye;uniform vec2 texel;uniform float softness;uniform float gammaCorrection;out vec4 outColor;vec3 linearToSrgb(vec3 c){c=max(c,vec3(0));return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}void main(){vec4 c=texture(dye,uv);vec4 blur=(texture(dye,uv+vec2(texel.x,0))+texture(dye,uv-vec2(texel.x,0))+texture(dye,uv+vec2(0,texel.y))+texture(dye,uv-vec2(0,texel.y)))*.25;vec3 linear=mix(c.rgb,blur.rgb,softness);outColor=vec4(mix(linear,linearToSrgb(linear),gammaCorrection),1);}`,
};

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block px-5 py-2">
      <span className="flex items-baseline justify-between gap-4">
        <span className="text-[12px]">{label}</span>
        <output className="muted text-[11px] tabular-nums">{value}</output>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="fluid-range mt-1 block"
      />
    </label>
  );
}
function Check({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between px-5 py-3 text-left text-[12px] disabled:opacity-40"
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`grid h-[15px] w-[15px] place-items-center rounded-[2px] border line text-[10px] leading-none ${checked ? "bg-[var(--ink)] text-[var(--bg)]" : ""}`}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}
const linearChannel = (v: number) =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
function hexLinear(hex: string) {
  return [
    linearChannel(parseInt(hex.slice(1, 3), 16) / 255),
    linearChannel(parseInt(hex.slice(3, 5), 16) / 255),
    linearChannel(parseInt(hex.slice(5, 7), 16) / 255),
  ];
}
function linearLab([r, g, b]: number[]) {
  let l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  l = Math.cbrt(l);
  m = Math.cbrt(m);
  s = Math.cbrt(s);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function labLinear([L, a, b]: number[]) {
  let l = L + 0.3963377774 * a + 0.2158037573 * b,
    m = L - 0.1055613458 * a - 0.0638541728 * b,
    s = L - 0.0894841775 * a - 1.291485548 * b;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return [
    Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
const distance = (a: number[], b: number[]) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
function average(points: number[][]) {
  return points[0].map(
    (_, i) => points.reduce((sum, p) => sum + p[i], 0) / points.length,
  );
}
function hueFamily(lab: number[]) {
  const c = Math.hypot(lab[1], lab[2]);
  if (c < 0.025) return "neutral";
  const h = ((Math.atan2(lab[2], lab[1]) * 180) / Math.PI + 360) % 360;
  if (h < 30 || h >= 350) return "red";
  if (h < 55) return "orange";
  if (h < 120) return "yellow";
  if (h < 180) return "green";
  if (h < 230) return "cyan";
  if (h < 280) return "blue";
  if (h < 325) return "purple";
  return "pink";
}
function clusterOklab(points: number[][], count: number, seed: number) {
  if (!points.length) return [];
  const centers = [points[seed % points.length].slice()];
  while (centers.length < count) {
    let candidate = points[0],
      best = -1;
    for (const point of points) {
      const nearest = Math.min(...centers.map((c) => distance(point, c)));
      if (nearest > best) {
        best = nearest;
        candidate = point;
      }
    }
    centers.push(candidate.slice());
  }
  for (let pass = 0; pass < 12; pass++) {
    const groups = centers.map(() => [] as number[][]);
    for (const point of points) {
      let at = 0,
        best = Infinity;
      centers.forEach((c, i) => {
        const d = distance(point, c);
        if (d < best) {
          best = d;
          at = i;
        }
      });
      groups[at].push(point);
    }
    groups.forEach((group, i) => {
      if (group.length) centers[i] = average(group);
    });
  }
  return centers;
}
function paletteSeed(colors: string[]) {
  let hash = 2166136261;
  for (const char of [...colors].sort().join("|")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function buildInitialSkyTexture(source: string[]) {
  const sorted = sortColors(source),
    seed = paletteSeed(sorted),
    points = sorted.map((hex) => linearLab(hexLinear(hex))),
    buckets = new Map<string, number[][]>();
  for (const point of points) {
    const family = hueFamily(point),
      bucket = buckets.get(family) || [];
    bucket.push(point);
    buckets.set(family, bucket);
  }
  const meaningful = [...buckets.entries()]
    .filter(
      ([, items]) =>
        items.length >= Math.max(1, Math.ceil(points.length * 0.025)),
    )
    .sort(([a], [b]) => a.localeCompare(b));
  const diverse = meaningful.map(([, items]) => average(items)),
    frequency = clusterOklab(points, Math.max(1, 12 - diverse.length), seed),
    labs: number[][] = [];
  for (const color of [...diverse, ...frequency])
    if (!labs.some((existing) => distance(existing, color) < 0.00018))
      labs.push(color);
  while (labs.length < 12) {
    let candidate =
        points[labs.length % points.length] || linearLab(hexLinear("#7E8FA8")),
      best = -1;
    for (const point of points) {
      const nearest = Math.min(...labs.map((c) => distance(point, c)));
      if (nearest > best) {
        best = nearest;
        candidate = point;
      }
    }
    labs.push(candidate.slice());
  }
  const bases = [
      [0.06, 0.18],
      [0.2, 0.2],
      [0.48, 0.12],
      [0.78, 0.2],
      [0.94, 0.3],
      [0.9, 0.58],
      [0.76, 0.86],
      [0.5, 0.94],
      [0.2, 0.86],
      [0.08, 0.6],
      [-0.13, 0.42],
      [1.14, 0.7],
    ],
    inside = bases.slice(0, 10).map((_, i) => i);
  let state = seed || 1;
  const random = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = inside.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [inside[i], inside[j]] = [inside[j], inside[i]];
  }
  const order = [...inside, 10, 11];
  const centers = order.flatMap((index) => [
      bases[index][0] + (random() - 0.5) * 0.06,
      bases[index][1] + (random() - 0.5) * 0.06,
    ]),
    radii = order.map(() => 0.45 + random() * 0.28);
  return {
    colors: labs.slice(0, 12).map(labLinear),
    centers,
    radii,
    seed: (seed % 10000) / 997,
  };
}

export function FluidColorField({ colors }: { colors: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    raf = useRef(0),
    wakeRenderer = useRef(() => {}),
    pointer = useRef<Pointer>({
      x: 0.5,
      y: 0.5,
      dx: 0,
      dy: 0,
      moved: false,
      last: 0,
    }),
    resetRequested = useRef(false),
    reducedRef = useRef(false);
  const [settings, setSettings] = useState<ArtSettings>(presets.SILK),
    settingsRef = useRef(settings),
    [colorSettings, setColorSettings] = useState<ColorSettings>({
      colorSoftness: 0.48,
      paletteAttraction: 0.07,
      minimumChroma: 0.52,
      gammaCorrection: true,
    }),
    colorRef = useRef(colorSettings),
    [advanced, setAdvanced] = useState<AdvancedSettings>({
      simResolution: 128,
      dyeResolution: 768,
      pressureIterations: 22,
    }),
    advancedRef = useRef(advanced),
    [panel, setPanel] = useState(false),
    [advancedOpen, setAdvancedOpen] = useState(false),
    [preset, setPreset] = useState<"CALM" | "SILK" | "MARBLE" | null>("SILK"),
    [reduced, setReduced] = useState(false),
    initial = useMemo(() => buildInitialSkyTexture(colors), [colors]);
  const [viewportVersion, setViewportVersion] = useState(0);
  settingsRef.current = settings;
  colorRef.current = colorSettings;
  advancedRef.current = advanced;
  const sourceMetrics = useMemo(() => {
    const labs = initial.colors.map(linearLab);
    return {
      luminance: labs.reduce((n, c) => n + c[0], 0) / labs.length,
      chroma:
        labs.reduce((n, c) => n + Math.hypot(c[1], c[2]), 0) / labs.length,
    };
  }, [initial]);
  const set = <K extends keyof ArtSettings>(key: K, value: ArtSettings[K]) => {
    setPreset(null);
    setSettings((s) => ({ ...s, [key]: value }));
    wakeRenderer.current();
  };
  const setColor = <K extends keyof ColorSettings>(
    key: K,
    value: ColorSettings[K],
  ) => {
    setColorSettings((s) => ({ ...s, [key]: value }));
    wakeRenderer.current();
  };
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedRef.current = media.matches;
      setReduced(media.matches);
      wakeRenderer.current();
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const move = useCallback((clientX: number, clientY: number) => {
    const c = canvas.current,
      s = settingsRef.current;
    if (!c || s.paused || reducedRef.current) return;
    const r = c.getBoundingClientRect(),
      now = performance.now(),
      x = (clientX - r.left) / r.width,
      y = 1 - (clientY - r.top) / r.height,
      p = pointer.current,
      dt = Math.max(12, now - p.last),
      dx = ((x - p.x) * 1000) / dt,
      dy = ((y - p.y) * 1000) / dt;
    p.x = x;
    p.y = y;
    p.last = now;
    p.dx = Math.max(-2, Math.min(2, dx));
    p.dy = Math.max(-2, Math.min(2, dy));
    p.moved = Math.hypot(p.dx, p.dy) > 0.008;
    wakeRenderer.current();
  }, []);
  useEffect(() => {
    const canvasEl = canvas.current;
    if (!canvasEl) return;
    const gl = canvasEl.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) return;
    const linear = !!gl.getExtension("OES_texture_float_linear");
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(s) || "Shader error";
        gl.deleteShader(s);
        throw Error(error);
      }
      return s;
    };
    const programs = Object.fromEntries(
      Object.entries(shaders).map(([name, frag]) => {
        const p = gl.createProgram()!,
          vs = compile(gl.VERTEX_SHADER, vertex),
          fs = compile(gl.FRAGMENT_SHADER, frag);
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          const error = gl.getProgramInfoLog(p) || "Program error";
          gl.deleteProgram(p);
          throw Error(error);
        }
        return [name, p];
      }),
    ) as Record<string, WebGLProgram>;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    for (const p of Object.values(programs)) {
      const loc = gl.getAttribLocation(p, "position");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    const targets: GLTarget[] = [];
    const makeTarget = (
      w: number,
      h: number,
      internal: number,
      format: number,
      filter: number,
    ) => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internal,
        w,
        h,
        0,
        format,
        gl.HALF_FLOAT,
        null,
      );
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      const target = { texture, fbo, width: w, height: h };
      targets.push(target);
      return target;
    };
    const makeDouble = (
      w: number,
      h: number,
      internal: number,
      format: number,
      filter: number,
    ): DoubleTarget => {
      let read = makeTarget(w, h, internal, format, filter),
        write = makeTarget(w, h, internal, format, filter);
      return {
        get read() {
          return read;
        },
        get write() {
          return write;
        },
        swap() {
          const t = read;
          read = write;
          write = t;
        },
      };
    };
    const sim = advancedRef.current.simResolution,
      dyeLong =
        innerWidth < 640
          ? Math.min(512, advancedRef.current.dyeResolution)
          : advancedRef.current.dyeResolution,
      aspect = canvasEl.clientWidth / canvasEl.clientHeight,
      simW = aspect > 1 ? Math.round(sim * aspect) : sim,
      simH = aspect > 1 ? sim : Math.round(sim / aspect),
      dyeW = aspect > 1 ? Math.round(dyeLong * aspect) : dyeLong,
      dyeH = aspect > 1 ? dyeLong : Math.round(dyeLong / aspect),
      filter = linear ? gl.LINEAR : gl.NEAREST;
    const velocity = makeDouble(simW, simH, gl.RG16F, gl.RG, filter),
      dye = makeDouble(dyeW, dyeH, gl.RGBA16F, gl.RGBA, filter),
      initialDye = makeTarget(dyeW, dyeH, gl.RGBA16F, gl.RGBA, filter),
      curl = makeTarget(simW, simH, gl.R16F, gl.RED, gl.NEAREST),
      divergence = makeTarget(simW, simH, gl.R16F, gl.RED, gl.NEAREST),
      pressure = makeDouble(simW, simH, gl.R16F, gl.RED, gl.NEAREST);
    const use = (
      name: string,
      target: GLTarget | null,
      uniforms: Record<string, number | number[] | WebGLTexture>,
    ) => {
      const p = programs[name];
      gl.useProgram(p);
      let unit = 0;
      for (const [key, value] of Object.entries(uniforms)) {
        const loc = gl.getUniformLocation(p, key);
        if (value instanceof WebGLTexture) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, value);
          gl.uniform1i(loc, unit++);
        } else if (Array.isArray(value)) {
          if (key === "centers") gl.uniform2fv(loc, value);
          else if (key === "radii") gl.uniform1fv(loc, value);
          else if (key === "colors" || key === "palette")
            gl.uniform3fv(loc, value);
          else if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
          else if (value.length === 3)
            gl.uniform3f(loc, value[0], value[1], value[2]);
        } else gl.uniform1f(loc, value);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, target?.fbo || null);
      gl.viewport(
        0,
        0,
        target?.width || canvasEl.width,
        target?.height || canvasEl.height,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    const clear = (target: GLTarget) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
    const linearPalette = initial.colors.flat();
    use("init", initialDye, {
      colors: linearPalette,
      centers: initial.centers,
      radii: initial.radii,
      seed: initial.seed,
      aspect,
    });
    use("copy", dye.read, { source: initialDye.texture });
    use("copy", dye.write, { source: initialDye.texture });
    const dpr = Math.min(devicePixelRatio, 1.25);
    let resizeTimer = 0,
      visible = document.visibilityState === "visible",
      onscreen = true,
      disposed = false,
      previous = performance.now(),
      elapsed = 0,
      lastRender = 0;
    pointer.current.last = previous;
    const resizeCanvas = () => {
      const width = Math.round(canvasEl.clientWidth * dpr),
        height = Math.round(canvasEl.clientHeight * dpr);
      if (
        Math.abs(canvasEl.width - width) > 2 ||
        Math.abs(canvasEl.height - height) > 2
      ) {
        canvasEl.width = width;
        canvasEl.height = height;
      }
    };
    const resizeBasis = {
      width: canvasEl.clientWidth,
      height: canvasEl.clientHeight,
    };
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const materiallyChanged =
          Math.abs(canvasEl.clientWidth - resizeBasis.width) > 24 ||
          Math.abs(canvasEl.clientHeight - resizeBasis.height) > 24;
        if (materiallyChanged) setViewportVersion((version) => version + 1);
        else {
          resizeCanvas();
          schedule();
        }
      }, 180);
    };
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      previous = performance.now();
      if (visible) schedule();
    };
    const observer = new IntersectionObserver(
      (entries) => {
        onscreen = entries[0]?.isIntersecting ?? true;
        previous = performance.now();
        if (onscreen) schedule();
      },
      { threshold: 0.01 },
    );
    observer.observe(canvasEl);
    resizeCanvas();
    addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    let frame: FrameRequestCallback;
    const schedule = () => {
      if (!disposed && !raf.current) raf.current = requestAnimationFrame(frame);
    };
    frame = (now: number) => {
      raf.current = 0;
      if (disposed) return;
      const hidden = !visible || !onscreen,
        idle = now - pointer.current.last > 2000,
        minimumFrameTime = hidden ? 250 : idle ? 1000 / 28 : 0;
      if (hidden) return;
      const paused = settingsRef.current.paused || reducedRef.current;
      if (!paused && now - lastRender < minimumFrameTime) {
        schedule();
        return;
      }
      const s = settingsRef.current,
        color = colorRef.current,
        a = advancedRef.current,
        dt = Math.min(idle ? 0.036 : 0.018, (now - previous) / 1000);
      previous = now;
      lastRender = now;
      elapsed += dt;
      let restored = false;
      if (resetRequested.current) {
        resetRequested.current = false;
        restored = true;
        elapsed = 0;
        use("copy", dye.read, { source: initialDye.texture });
        use("copy", dye.write, { source: initialDye.texture });
        [
          velocity.read,
          velocity.write,
          pressure.read,
          pressure.write,
          divergence,
          curl,
        ].forEach(clear);
        pointer.current = {
          x: 0.5,
          y: 0.5,
          dx: 0,
          dy: 0,
          moved: false,
          last: now,
        };
      }
      if (!restored && !paused) {
        const simTexel: [number, number] = [1 / simW, 1 / simH];
        use("advect", velocity.write, {
          velocity: velocity.read.texture,
          source: velocity.read.texture,
          texel: simTexel,
          dt,
          dissipation: (1 - s.flow) * 7,
          viscosity: s.viscosity * 0.14,
        });
        velocity.swap();
        use("ambient", velocity.write, {
          velocity: velocity.read.texture,
          time: elapsed,
          strength: s.ambientDrift,
        });
        velocity.swap();
        const p = pointer.current;
        if (p.moved) {
          use("splat", velocity.write, {
            target: velocity.read.texture,
            point: [p.x, p.y],
            force: [
              p.dx * s.pointerForce * 0.085,
              p.dy * s.pointerForce * 0.085,
            ],
            radius: s.brushSize,
            aspect,
          });
          velocity.swap();
          p.moved = false;
        }
        use("curl", curl, { velocity: velocity.read.texture, texel: simTexel });
        use("vorticity", velocity.write, {
          velocity: velocity.read.texture,
          curlTex: curl.texture,
          texel: simTexel,
          curlStrength: s.swirl,
          dt,
        });
        velocity.swap();
        use("divergence", divergence, {
          velocity: velocity.read.texture,
          texel: simTexel,
        });
        gl.bindFramebuffer(gl.FRAMEBUFFER, pressure.read.fbo);
        gl.viewport(0, 0, simW, simH);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        for (let i = 0; i < a.pressureIterations; i++) {
          use("pressure", pressure.write, {
            pressure: pressure.read.texture,
            divergence: divergence.texture,
            texel: simTexel,
          });
          pressure.swap();
        }
        use("gradient", velocity.write, {
          pressure: pressure.read.texture,
          velocity: velocity.read.texture,
          texel: simTexel,
          pressureStrength: 0.8,
        });
        velocity.swap();
        use("advect", dye.write, {
          velocity: velocity.read.texture,
          source: dye.read.texture,
          texel: [1 / dyeW, 1 / dyeH],
          dt,
          dissipation: 0,
          viscosity: 0,
        });
        dye.swap();
        use("preserve", dye.write, {
          dye: dye.read.texture,
          palette: linearPalette,
          paletteAttraction: color.paletteAttraction * dt,
          minimumChroma: sourceMetrics.chroma * color.minimumChroma,
          chromaRecovery: 0.35 * dt,
        });
        dye.swap();
      }
      use("display", null, {
        dye: dye.read.texture,
        texel: [1 / dyeW, 1 / dyeH],
        softness: color.colorSoftness,
        gammaCorrection: color.gammaCorrection ? 1 : 0,
      });
      if (!paused) schedule();
    };
    wakeRenderer.current = schedule;
    schedule();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf.current);
      raf.current = 0;
      wakeRenderer.current = () => {};
      clearTimeout(resizeTimer);
      removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      targets.forEach((target) => {
        gl.deleteFramebuffer(target.fbo);
        gl.deleteTexture(target.texture);
      });
      Object.values(programs).forEach((program) => gl.deleteProgram(program));
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    };
  }, [
    initial.seed,
    advanced.simResolution,
    advanced.dyeResolution,
    sourceMetrics.chroma,
    viewportVersion,
  ]);
  const choose = (name: "CALM" | "SILK" | "MARBLE") => {
    setPreset(name);
    setSettings((current) => ({
      ...presets[name],
      paused: current.paused,
    }));
    wakeRenderer.current();
  };
  const changeAdvanced = <K extends keyof AdvancedSettings>(
    key: K,
    value: AdvancedSettings[K],
  ) => {
    setAdvanced((a) => ({ ...a, [key]: value }));
    wakeRenderer.current();
  };
  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-neutral-500">
      <canvas
        ref={canvas}
        className="block h-full w-full touch-none"
        aria-label="Interactive fluid field made from archived sky colors"
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerDown={(e) => move(e.clientX, e.clientY)}
      />
      {panel && (
        <aside
          aria-label="Fluid settings"
          className="absolute right-4 top-4 z-20 max-h-[calc(100%-4.5rem)] w-[310px] overflow-auto border line bg-[var(--bg)] text-[var(--ink)] shadow-[0_10px_35px_rgba(20,20,20,.08)] backdrop-blur-md dark:bg-[#161718] max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:top-auto max-sm:max-h-[72vh] max-sm:w-auto"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-[13px] font-medium">Fluid settings</span>
            <button
              onClick={() => setPanel(false)}
              aria-label="Close settings"
              className="muted text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="mx-5 grid grid-cols-3 border-b line">
            {(["CALM", "SILK", "MARBLE"] as const).map((name) => (
              <button
                key={name}
                onClick={() => choose(name)}
                className={`site-mark border-b px-1 py-2 text-[9px] tracking-[.1em] transition-colors ${preset === name ? "border-[var(--ink)] text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
              >
                {name[0] + name.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="py-3">
            <Range
              label="Flow"
              value={settings.flow}
              min={0.94}
              max={0.998}
              step={0.001}
              onChange={(v) => set("flow", v)}
            />
            <Range
              label="Swirl"
              value={settings.swirl}
              min={0}
              max={25}
              step={1}
              onChange={(v) => set("swirl", v)}
            />
            <Range
              label="Brush size"
              value={settings.brushSize}
              min={0.04}
              max={0.2}
              step={0.005}
              onChange={(v) => set("brushSize", v)}
            />
            <Range
              label="Pointer force"
              value={settings.pointerForce}
              min={0.2}
              max={2.8}
              step={0.05}
              onChange={(v) => set("pointerForce", v)}
            />
            <Range
              label="Ambient drift"
              value={settings.ambientDrift}
              min={0}
              max={0.08}
              step={0.002}
              onChange={(v) => set("ambientDrift", v)}
            />
            <Range
              label="Viscosity"
              value={settings.viscosity}
              min={0}
              max={0.6}
              step={0.02}
              onChange={(v) => set("viscosity", v)}
            />
            <Range
              label="Color softness"
              value={colorSettings.colorSoftness}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => setColor("colorSoftness", v)}
            />
            <Check
              label="Paused"
              checked={settings.paused}
              disabled={reduced}
              onChange={(v) => set("paused", v)}
            />
            <button
              onClick={() => setAdvancedOpen((x) => !x)}
              className="muted mt-2 flex w-full justify-between border-t line px-5 py-3 text-[11px] hover:text-[var(--ink)]"
            >
              <span>Advanced</span>
              <span>{advancedOpen ? "−" : "+"}</span>
            </button>
            {advancedOpen && (
              <div className="pb-2">
                <label className="flex items-center justify-between px-5 py-2 text-[11px]">
                  <span>Simulation resolution</span>
                  <select
                    value={advanced.simResolution}
                    onChange={(e) =>
                      changeAdvanced("simResolution", Number(e.target.value))
                    }
                    className="border line bg-transparent px-2 py-1 text-[11px] text-[var(--ink)]"
                  >
                    <option>64</option>
                    <option>128</option>
                    <option>192</option>
                  </select>
                </label>
                <label className="flex items-center justify-between px-5 py-2 text-[11px]">
                  <span>Dye resolution</span>
                  <select
                    value={advanced.dyeResolution}
                    onChange={(e) =>
                      changeAdvanced("dyeResolution", Number(e.target.value))
                    }
                    className="border line bg-transparent px-2 py-1 text-[11px] text-[var(--ink)]"
                  >
                    <option>512</option>
                    <option>768</option>
                    <option>1024</option>
                  </select>
                </label>
                <Range
                  label="Pressure iterations"
                  value={advanced.pressureIterations}
                  min={10}
                  max={30}
                  step={1}
                  onChange={(v) => changeAdvanced("pressureIterations", v)}
                />
                {process.env.NODE_ENV !== "production" && (
                  <div className="mt-2 border-t line pt-2">
                    <p className="muted px-5 py-2 text-[11px]">
                      Color diagnostics
                    </p>
                    <div className="muted grid grid-cols-2 gap-y-2 px-5 pb-2 text-[10px]">
                      <span>Color dissipation</span>
                      <span className="text-right">0</span>
                      <span>Source luminance</span>
                      <span className="text-right">
                        {sourceMetrics.luminance.toFixed(3)}
                      </span>
                      <span>Source chroma</span>
                      <span className="text-right">
                        {sourceMetrics.chroma.toFixed(3)}
                      </span>
                    </div>
                    <Check
                      label="Gamma correction"
                      checked={colorSettings.gammaCorrection}
                      onChange={(v) => setColor("gammaCorrection", v)}
                    />
                    <Range
                      label="Palette attraction"
                      value={colorSettings.paletteAttraction}
                      min={0}
                      max={0.15}
                      step={0.01}
                      onChange={(v) => setColor("paletteAttraction", v)}
                    />
                    <Range
                      label="Minimum chroma × source"
                      value={colorSettings.minimumChroma}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => setColor("minimumChroma", v)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
      <div className="theme-ui pointer-events-none absolute bottom-4 left-5 z-20 bg-[var(--bg)]/70 px-2 py-1 text-[10px] text-[var(--ink)] backdrop-blur-sm max-sm:bottom-20">
        {reduced ? "Static field · reduced motion" : "Move through the color"}
      </div>
      <SiteAttribution className="theme-ui absolute bottom-4 left-1/2 z-30 -translate-x-1/2 text-center drop-shadow-sm max-sm:left-5 max-sm:translate-x-0" />
      <div className="theme-ui absolute bottom-4 right-5 z-30 flex gap-4 bg-[var(--bg)]/75 px-3 py-2 text-[11px] text-[var(--ink)] backdrop-blur-sm max-sm:bottom-14">
        <span className="flex gap-4">
          <button
            className="muted hover:text-[var(--ink)]"
            onClick={() => {
              resetRequested.current = true;
              wakeRenderer.current();
            }}
          >
            Reset
          </button>
          <button
            className="hover:text-[var(--ink)]"
            onClick={() => setPanel((x) => !x)}
          >
            Settings
          </button>
        </span>
      </div>
    </div>
  );
}
