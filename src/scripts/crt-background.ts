const cv = document.getElementById("crt-bg") as HTMLCanvasElement | null;
if (cv && !cv.dataset.ready) {
  cv.dataset.ready = "1";
  start(cv);
}

function start(cv: HTMLCanvasElement) {
  const GAIN = parseFloat(cv.dataset.gain || "0.22");
  const CELL = parseFloat(cv.dataset.cell || "3.8"); // Grating pitch in CSS px; start at 3.8, try 5–6 if it looks mushy.
  const TEXT_OPACITY = 0.5; // Lower background strength beneath text containers.
  const HOVER_STRENGTH = 0.9; // Local dot growth is noticeable but smoothly feathered.
  const HOVER_RADIUS = 150; // CSS-pixel radius of the cursor influence.
  const SEL = cv.dataset.selectors || "main";
  const MAX_DPR = 2;
  const FPS = 30;
  const LEVEL_TAU = 0.5;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!(GAIN > 0)) { cv.remove(); return; }

  const t0 = performance.now();
  const readState = () => {
    try {
      const value = sessionStorage.getItem("crt-state");
      if (value === null) return null;
      const state = JSON.parse(value);
      if (
        !Number.isFinite(state?.t) ||
        !Number.isFinite(state?.w)
      ) return null;
      return state as {
        t: number; w: number; x?: number; y?: number;
        tx?: number; ty?: number; a?: number; ta?: number; level?: number;
      };
    } catch {
      return null;
    }
  };
  const savedState = readState();
  const freshSession = !savedState;
  const clockStart = savedState
    ? savedState.t + (Date.now() - savedState.w) / 1000
    : 37;
  const curTime = (now: number) => clockStart + (now - t0) / 1000;

  const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) as WebGLRenderingContext | null;
  if (!gl) { cv.remove(); return; }

  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 res, mouse;
uniform float dpr, time, cell, gain, mAmt, dark, rs, feather, tmStrength;
uniform vec3 bg, fg, acc;
uniform vec4 rects[16];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float a = .5, s = 0.;
  for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + vec2(7.1, 3.7); a *= .45; }
  return s / .8;
}
// 1 inside text containers, fading to 0 over feather px outside
float textMask(vec2 q){
  float m = 0.;
  for (int i = 0; i < 16; i++){
    vec4 r = rects[i];
    float ok = step(r.x + 1., r.z);
    vec2 cen = (r.xy + r.zw) * .5, hs = (r.zw - r.xy) * .5;
    vec2 d = abs(q - cen) - hs;
    float od = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
    m = max(m, ok * (1. - smoothstep(0., feather, od)));
  }
  return m;
}
// Beat period ≈ p1·p2/|p1−p2|. At cell=3.8 and ratio 1.05 this is ~80 px.
// Rotation adds a second beat ≈ pitch/ANG. For lazier swells use ratio 1.02, ANG .015;
// for busier swells use ratio 1.08, ANG .06. Change WARP to alter swell size.
#define ANG .03
#define WARP 60.
#define DRIFT .12
#define CONTRAST .6
#define CHROMA 1.0
#define SPREAD .008
#define TINT 0.85
#define SAT 0.75
#define RATIO 1.050

// Antialiased line grating; phase is in cycles, with a 50% duty cycle.
float grating(float ph, float pitch){
  float raw = 1. / (dpr * pitch);
  float aa  = min(raw * .8, .25);
  float l   = 1. - smoothstep(.25 - aa, .25 + aa, abs(fract(ph) - .5));
  return mix(l, .5, smoothstep(.35, .5, raw));
}

// XNOR blend: bright where the gratings agree, dark where they disagree.
float beat(vec2 q, vec2 w, float tm, float ratio){
  float pb = cell * ratio;
  float phA = q.y / cell;
  float phB = dot(w, vec2(sin(ANG), cos(ANG))) / pb + time * DRIFT;
  float A = grating(phA, cell);
  float B = grating(phB, pb);
  float fine = A * B + (1. - A) * (1. - B);
  float soft = .5 + .5 * cos(6.28318 * (phA - phB));
  return mix(fine, soft, smoothstep(.1, .9, tm));
}

void main(){
  vec2 q = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;

  float tm = textMask(q) * tmStrength;
  vec2 dm = q - mouse;
  float b = exp(-dot(dm, dm) / (2. * ${HOVER_RADIUS.toFixed(1)} * ${HOVER_RADIUS.toFixed(1)})) * mAmt * ${HOVER_STRENGTH.toFixed(2)};
  float hover = b * mix(1., .32, tm);

  // Low-frequency warp affects only grating B, so the beat grows into swells.
  vec2 wp = q * .0018 + vec2(time * .004, 0.);
  vec2 warp = vec2(fbm(wp), fbm(wp + vec2(5.2, 2.7))) - .5;
  vec2 w = q + warp * WARP + (mouse - q) * hover * .12;

  float Ig = beat(q, w, tm, RATIO);
  vec3 I = vec3(Ig);
  if (CHROMA > 0.) {
    I = mix(I, vec3(beat(q, w, tm, RATIO + SPREAD),
                    Ig,
                    beat(q, w, tm, RATIO - SPREAD)), CHROMA);
  }
  float lum = dot(I, vec3(.3333));
  I = mix(vec3(lum), I, SAT);
  I = vec3(.5) + (I - vec3(.5)) * CONTRAST;
  I = mix(I, vec3(dot(I, vec3(.3333))), tm);

  float edge = smoothstep(.15, .8, abs(q.x / (res.x / dpr) - .5) * 2.);
  float lvl = gain * mix(.7, 1., edge) * mix(1., ${TEXT_OPACITY.toFixed(2)}, tm) * (1. + .55 * hover);

  vec3 tone = mix(vec3(dot(acc, vec3(.333))), acc, TINT);
  vec3 col;
  if (dark > .5) col = bg + tone * I * lvl;
  else {
    vec3 ink = mix(fg, tone, .25);
    col = mix(bg, ink, clamp(dot(I, vec3(.3333)) * lvl * 1.2, 0., .45));
  }
  gl_FragColor = vec4(col, 1.);
}`;

  let prog: WebGLProgram, U: Record<string, WebGLUniformLocation | null> = {}, lost = false;
  function sh(t: number, s: string) { const x = gl!.createShader(t)!; gl!.shaderSource(x, s); gl!.compileShader(x); return x; }
  function setup(): boolean {
    const g = gl!;
    const p = g.createProgram()!;
    const fs = sh(g.FRAGMENT_SHADER, FS);
    g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, fs); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) { console.warn("crt-bg shader:", g.getShaderInfoLog(fs)); return false; }
    prog = p; g.useProgram(p);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(p, "a"); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    for (const k of ["res", "mouse", "dpr", "time", "cell", "gain", "mAmt", "dark", "rs", "feather", "tmStrength", "bg", "fg", "acc", "rects"]) U[k] = g.getUniformLocation(p, k);
    return true;
  }
  if (!setup()) { cv.remove(); return; }

  const px = document.createElement("canvas"); px.width = px.height = 1;
  const x2 = px.getContext("2d", { willReadFrequently: true })!;
  function rgb(c: string): number[] {
    x2.clearRect(0, 0, 1, 1); x2.fillStyle = "#000"; x2.fillStyle = c; x2.fillRect(0, 0, 1, 1);
    const d = x2.getImageData(0, 0, 1, 1).data; return [d[0] / 255, d[1] / 255, d[2] / 255];
  }
  const lum = (c: number[]) => { const f = (v: number) => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  let bg = [.12, .12, .11], fg = [.95, .94, .91], acc = [.85, .64, .54], dark = 1;
  const clampLevel = (value: number) => Math.max(0, Math.min(1, value));
  const pageLevel = () => {
    const value = Number.parseFloat(document.body.dataset.bgLevel || "1");
    return clampLevel(Number.isFinite(value) ? value : 1);
  };
  const initialLevel = pageLevel();
  let level = savedState && Number.isFinite(savedState.level)
    ? clampLevel(savedState.level!)
    : initialLevel;
  let levelTarget = initialLevel;
  function colors() {
    let b: number[] | null = null;
    for (const el of [document.body, document.documentElement]) {
      const s = getComputedStyle(el).backgroundColor;
      if (s && s !== "transparent" && s !== "rgba(0, 0, 0, 0)") { b = rgb(s); break; }
    }
    bg = b || (matchMedia("(prefers-color-scheme: dark)").matches ? [.12, .12, .11] : [.95, .94, .91]);
    fg = rgb(getComputedStyle(document.body).color);
    acc = rgb(getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#d9a28a");
    dark = lum(bg) < .3 ? 1 : 0;
    invalidate();
  }

  let D = 1, W = 1, H = 1;
  function size() {
    D = Math.min(Math.round(window.devicePixelRatio || 1), MAX_DPR);
    W = cv.width = Math.round(innerWidth * D); H = cv.height = Math.round(innerHeight * D);
    gl!.viewport(0, 0, W, H); invalidate();
  }
  function rects(): Float32Array {
    const a = new Float32Array(64);
    let n = 0;
    document.querySelectorAll(SEL).forEach((el) => {
      if (n >= 16) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
      a.set([r.left, r.top, r.right, r.bottom], n++ * 4);
    });
    return a;
  }
  const savedCoordinate = (value: number | undefined) =>
    Number.isFinite(value) ? value! : -999;
  const m = {
    x: savedCoordinate(savedState?.x),
    y: savedCoordinate(savedState?.y),
    tx: savedCoordinate(savedState?.tx),
    ty: savedCoordinate(savedState?.ty),
    a: savedState && Number.isFinite(savedState.a) ? clampLevel(savedState.a!) : 0,
    ta: savedState && Number.isFinite(savedState.ta) ? clampLevel(savedState.ta!) : 0,
  };
  addEventListener("pointermove", (e) => { m.tx = e.clientX; m.ty = e.clientY; m.ta = 1; wake(); }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { m.ta = 0; wake(); });
  addEventListener("pointerup", (e) => { if (e.pointerType === "touch") { m.ta = 0; wake(); } });

  let raf = 0, last = 0, dirty = true;
  const POS_TAU = 0.30;
  const AMP_TAU = 0.45;
  function wake() { if (!raf && !document.hidden && !lost) raf = requestAnimationFrame(tick); }
  function invalidate() { dirty = true; wake(); }
  function readLevel() {
    levelTarget = pageLevel();
    invalidate();
  }
  function saveSession() {
    try {
      sessionStorage.setItem("crt-state", JSON.stringify({
        t: curTime(performance.now()),
        w: Date.now(),
        x: m.x,
        y: m.y,
        tx: m.tx,
        ty: m.ty,
        a: m.a,
        ta: m.ta,
        level,
      }));
    } catch {
      // Storage may be unavailable; animation continues with in-memory state.
    }
  }
  if (freshSession && !reduce) cv.style.animation = "crt-bg-fade-in 0.5s ease both";
  readLevel();
  document.addEventListener("astro:after-swap", () => {
    colors();
    readLevel();
    invalidate();
  });
  addEventListener("pagehide", saveSession);
  document.addEventListener("astro:before-preparation", saveSession);
  document.addEventListener("click", saveSession, true);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveSession();
    else invalidate();
  });
  function draw(now: number) {
    const g = gl!, narrow = innerWidth < 720;
    g.uniform2f(U.res, W, H); g.uniform2f(U.mouse, m.x, m.y);
    g.uniform1f(U.dpr, D); g.uniform1f(U.time, reduce ? 40 : curTime(now));
    g.uniform1f(U.cell, CELL); g.uniform1f(U.gain, GAIN * level); g.uniform1f(U.rs, narrow ? .8 : 1);
    g.uniform1f(U.feather, narrow ? 18 : 72); g.uniform1f(U.tmStrength, narrow ? .75 : 1);
    g.uniform1f(U.mAmt, m.a); g.uniform1f(U.dark, dark);
    g.uniform3fv(U.bg, bg); g.uniform3fv(U.fg, fg); g.uniform3fv(U.acc, acc);
    g.uniform4fv(U.rects, rects());
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }
  function tick(now: number) {
    raf = 0; if (document.hidden || lost) return;
    if (dirty || now - last >= 1000 / FPS - 1) {
      const dt = Math.min((now - last) / 1000, 0.1);
      const kp = 1 - Math.exp(-dt / POS_TAU);
      const ka = 1 - Math.exp(-dt / AMP_TAU);
      const kl = 1 - Math.exp(-dt / LEVEL_TAU);
      last = now; dirty = false;
      m.x += (m.tx - m.x) * kp; m.y += (m.ty - m.y) * kp; m.a += (m.ta - m.a) * ka;
      level += (levelTarget - level) * kl;
      draw(now);
    }
    const moving = Math.abs(m.ta - m.a) > .004 || Math.abs(m.tx - m.x) > .5 || Math.abs(m.ty - m.y) > .5 || Math.abs(levelTarget - level) > .004;
    if (!reduce || moving) wake();
  }

  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = window.setTimeout(size, 150); });
  addEventListener("scroll", () => invalidate(), { passive: true });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colors);
  new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  cv.addEventListener("webglcontextrestored", () => { lost = false; U = {}; if (setup()) invalidate(); else cv.remove(); });

  size(); colors();
  draw(performance.now());

  if (location.hash === "#crt-debug") {
    const ratio = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const gray = (acc[0] + acc[1] + acc[2]) / 3;
    const tone = acc.map((v) => gray * (1 - .85) + v * .85);
    const maxI = .5 + .5 * .6;
    const textMaskStrength = innerWidth < 720 ? .75 : 1;
    const maxHover = HOVER_STRENGTH * (1 - (1 - .32) * textMaskStrength);
    const textOpacity = 1 + (TEXT_OPACITY - 1) * textMaskStrength;
    const textLevel = GAIN * textOpacity * (1 + .55 * maxHover);
    const peak = dark
      ? bg.map((v, i) => Math.min(1, v + tone[i] * maxI * textLevel))
      : (() => {
          const ink = fg.map((v, i) => v * .75 + tone[i] * .25);
          const alpha = Math.min(.45, maxI * textLevel * 1.2);
          return bg.map((v, i) => v * (1 - alpha) + ink[i] * alpha);
        })();
    console.table({
      "text on plain background": ratio(lum(fg), lum(bg)).toFixed(2),
      "text on brightest dot behind text (worst case)": ratio(lum(fg), lum(peak)).toFixed(2),
      "required (WCAG AA body text)": "4.50",
    });
  }
}
