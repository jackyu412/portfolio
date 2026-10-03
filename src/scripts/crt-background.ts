const cv = document.getElementById("crt-bg") as HTMLCanvasElement | null;
if (cv) start(cv);

function start(cv: HTMLCanvasElement) {
  const GAIN = parseFloat(cv.dataset.gain || "0.34");
  const CELL = parseFloat(cv.dataset.cell || "3.8"); // Smaller cells create a denser dot field.
  const TEXT_OPACITY = 1; // 0 = nearly absent under text; 1 = full local strength.
  const TEXT_DOT_SCALE = 0.75; // Dot radius under text; raise toward 1 for more visible texture.
  const HOVER_STRENGTH = 0.4; // 0 = no cursor response; 1 = full shader response.
  const HOVER_RADIUS = 130; // CSS-pixel radius of the cursor influence.
  const SEL = cv.dataset.selectors || "main";
  const MAX_DPR = 1.5;
  const FPS = 30;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!(GAIN > 0)) { cv.remove(); return; }

  const gl = cv.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" }) as WebGLRenderingContext | null;
  if (!gl) { cv.remove(); return; }

  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define FEATHER 48.
uniform vec2 res, mouse;
uniform float dpr, time, cell, gain, mAmt, dark, rs;
uniform vec3 bg, fg, acc;
uniform vec4 rects[8];

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
// horizontal brightness bands: long in x, narrow in y, drifting slowly upward, with a gentle wave
float band(vec2 c, float yo, float b){
  vec2 w = c + vec2(0., yo);
  w.x += 30. * sin(c.y * .012 + time * .25);
  w += (mouse - c) * b * .5;
  float f = fbm(vec2(w.x * .0014, w.y * .0042 + time * .016)) + b * .55;
  return smoothstep(.36, .76, f);
}
// 1 inside text containers, fading to 0 over FEATHER px outside
float textMask(vec2 q){
  float m = 0.;
  for (int i = 0; i < 8; i++){
    vec4 r = rects[i];
    float ok = step(r.x + 1., r.z);
    vec2 cen = (r.xy + r.zw) * .5, hs = (r.zw - r.xy) * .5;
    vec2 d = abs(q - cen) - hs;
    float od = length(max(d, 0.)) + min(max(d.x, d.y), 0.);
    m = max(m, ok * (1. - smoothstep(0., FEATHER, od)));
  }
  return m;
}
void main(){
  vec2 q = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y) / dpr;
  vec2 id = floor(q / cell);
  vec2 c = (id + .5) * cell;
  float r1 = hash(id), r2 = hash(id + 17.3), r3 = hash(id + 41.7), r4 = hash(id + 7.9), r5 = hash(id + 3.3), r6 = hash(id + 9.1);
  float tm = textMask(c);
  vec2 dm = c - mouse;
  float b = exp(-dot(dm, dm) / (2. * ${HOVER_RADIUS.toFixed(1)} * ${HOVER_RADIUS.toFixed(1)})) * mAmt * ${HOVER_STRENGTH.toFixed(2)} * (1. - .7 * tm);
  float fa = band(c, 5., b), fb = band(c, 0., b), fc = band(c, -5., b);
  float I = max(max(fa, fb), fc);
  float edge = smoothstep(.15, .8, abs(c.x / (res.x / dpr) - .5) * 2.);
  float lvl = gain * mix(.55, 1., edge) * mix(1., ${TEXT_OPACITY.toFixed(2)}, tm) * (1. + .35 * b);
  vec2 p = (q - c) - (vec2(r1, r2) - .5) * .16 * cell;
  float ang = (r3 - .5) * 1.2, ca = cos(ang), sa = sin(ang);
  p = vec2(ca * p.x + sa * p.y, -sa * p.x + ca * p.y) / cell;
  float asp = mix(.85, 1.15, r4); p.x /= asp; p.y *= asp;
  float n = mix(2., 2.8, r5);
  vec2 ap = max(abs(p), 1e-4);
  float nrm = pow(pow(ap.x, n) + pow(ap.y, n), 1. / n);
  float rad = .38 * rs * mix(1., ${TEXT_DOT_SCALE.toFixed(2)}, tm) * (1. + (r6 - .5) * .2) * (1. + .4 * b) * sqrt(I);
  float fe = .9 / cell;
  float shape = 1. - smoothstep(rad - fe, rad + fe, nrm);
  float halo = .15 * exp(-pow(nrm / .34, 2.)) * I;
  float a = clamp(shape + halo, 0., 1.);
  vec3 cB = acc, cR = acc * vec3(1., .62, .6), cG = acc * vec3(1., 1.12, .7);
  vec3 tint = (cB * fb * .6 + cR * fa * .4 + cG * fc * .4) * .75;
  vec3 col;
  if (dark > .5) col = bg + tint * a * lvl;
  else { vec3 ink = mix(fg, acc, .25); col = mix(bg, ink, clamp(a * I * lvl * 1.2, 0., .45)); }
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
    for (const k of ["res", "mouse", "dpr", "time", "cell", "gain", "mAmt", "dark", "rs", "bg", "fg", "acc", "rects"]) U[k] = g.getUniformLocation(p, k);
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
    D = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    W = cv.width = Math.round(innerWidth * D); H = cv.height = Math.round(innerHeight * D);
    gl!.viewport(0, 0, W, H); invalidate();
  }
  function rects(): Float32Array {
    const a = new Float32Array(32);
    const lines: DOMRect[] = [];
    document.querySelectorAll(SEL).forEach((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      lines.push(...Array.from(range.getClientRects()).filter((r) => r.width && r.height));
    });
    lines.sort((a, b) => {
      const distance = (r: DOMRect) => {
        const x = Math.max(r.left - m.x, 0, m.x - r.right);
        const y = Math.max(r.top - m.y, 0, m.y - r.bottom);
        return x * x + y * y;
      };
      return distance(a) - distance(b);
    });
    lines.slice(0, 8).forEach((r, i) => a.set([r.left, r.top, r.right, r.bottom], i * 4));
    return a;
  }
  const m = { x: -999, y: -999, tx: -999, ty: -999, a: 0, ta: 0 };
  addEventListener("pointermove", (e) => { m.tx = e.clientX; m.ty = e.clientY; if (m.ta === 0 && m.a < .01) { m.x = m.tx; m.y = m.ty; } m.ta = 1; wake(); }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { m.ta = 0; wake(); });
  addEventListener("pointerup", (e) => { if (e.pointerType === "touch") { m.ta = 0; wake(); } });

  let raf = 0, last = 0, dirty = true;
  const t0 = performance.now();
  function wake() { if (!raf && !document.hidden && !lost) raf = requestAnimationFrame(tick); }
  function invalidate() { dirty = true; wake(); }
  function draw(now: number) {
    const g = gl!, narrow = innerWidth < 720;
    g.uniform2f(U.res, W, H); g.uniform2f(U.mouse, m.x, m.y);
    g.uniform1f(U.dpr, D); g.uniform1f(U.time, reduce ? 40 : 37 + (now - t0) / 1000);
    g.uniform1f(U.cell, CELL); g.uniform1f(U.gain, GAIN * (narrow ? .6 : 1)); g.uniform1f(U.rs, narrow ? .8 : 1);
    g.uniform1f(U.mAmt, m.a); g.uniform1f(U.dark, dark);
    g.uniform3fv(U.bg, bg); g.uniform3fv(U.fg, fg); g.uniform3fv(U.acc, acc);
    g.uniform4fv(U.rects, rects());
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
  }
  function tick(now: number) {
    raf = 0; if (document.hidden || lost) return;
    if (dirty || now - last >= 1000 / FPS - 1) {
      last = now; dirty = false;
      m.x += (m.tx - m.x) * .2; m.y += (m.ty - m.y) * .2; m.a += (m.ta - m.a) * .18;
      draw(now);
    }
    const moving = Math.abs(m.ta - m.a) > .004 || Math.abs(m.tx - m.x) > .5 || Math.abs(m.ty - m.y) > .5;
    if (!reduce || moving) wake();
  }

  let rt = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = window.setTimeout(size, 150); });
  addEventListener("scroll", () => invalidate(), { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) invalidate(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", colors);
  new MutationObserver(colors).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
  cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  cv.addEventListener("webglcontextrestored", () => { lost = false; U = {}; if (setup()) invalidate(); else cv.remove(); });

  size(); colors();

  if (location.hash === "#crt-debug") {
    const ratio = (a: number, b: number) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const peak = dark ? bg.map((v, i) => Math.min(1, v + acc[i] * 1.05 * GAIN * .55 * 1.06)) : bg.map((v, i) => v + (fg[i] * .75 + acc[i] * .25 - v) * .45);
    console.table({
      "text on plain background": ratio(lum(fg), lum(bg)).toFixed(2),
      "text on brightest dot behind text (worst case)": ratio(lum(fg), lum(peak)).toFixed(2),
      "required (WCAG AA body text)": "4.50",
    });
  }
}
