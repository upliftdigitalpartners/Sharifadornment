/*
 * Sharif Adornment — 3D stage
 * A fanned stack of gold kangan bangles set with ruby and emerald stones,
 * a pearl mala with a ruby drop, gem-carrying gold orbits and drifting
 * gold dust. Each <section>
 * carries data-ring="x,y,scale,tilt"; the jewel glides between those
 * poses as the visitor scrolls.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const canvas = document.getElementById("stage");
const ready = () => window.dispatchEvent(new Event("stage:ready"));

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (err) {
  console.warn("WebGL unavailable — showing static background.", err);
  ready();
  throw err; // stop the module; the CSS fallback background remains
}

renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 9);

/* ---------- Background: charcoal with a soft warm glow ---------- */
{
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(256, 220, 10, 256, 256, 380);
  grad.addColorStop(0, "#2a2620");
  grad.addColorStop(0.45, "#19181a");
  grad.addColorStop(1, "#0e0e0f");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}

/* ---------- Lighting: studio environment for reflections ---------- */
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 1.0;

const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
key.position.set(3, 4, 5);
scene.add(key);
const rim = new THREE.PointLight(0xffd28a, 30, 20);
rim.position.set(-4, 2, -2);
scene.add(rim);

/* ---------- Materials ---------- */
const gold = new THREE.MeshPhysicalMaterial({
  color: 0xf0c674,
  metalness: 1,
  roughness: 0.15,
  clearcoat: 0.35,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.2,
});
const antiqueGold = gold.clone();
antiqueGold.roughness = 0.34;
antiqueGold.color.set(0xd9a85a);

const pearl = new THREE.MeshPhysicalMaterial({
  color: 0xd9d0c0,
  metalness: 0,
  roughness: 0.3,
  clearcoat: 1,
  clearcoatRoughness: 0.12,
  iridescence: 0.75,
  iridescenceIOR: 1.35,
  sheen: 0.6,
  sheenColor: new THREE.Color(0xffe2c4),
  envMapIntensity: 0.75,
});

// Faceted, see-through stones: kundan reds and greens
const stone = (color, deep, ior) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.02,
    transmission: 0.7,
    thickness: 0.6,
    ior,
    emissive: new THREE.Color(deep),
    emissiveIntensity: 0.35,
    attenuationColor: new THREE.Color(deep),
    attenuationDistance: 0.35,
    specularIntensity: 1,
    envMapIntensity: 2.4,
    flatShading: true,
  });
const ruby = stone(0xff3355, 0x8f0a22, 1.77);
const emerald = stone(0x35d18a, 0x07613a, 1.58);

// Low-segment lathe + flat shading = a faceted cut
const cutGeo = (segments = 12) =>
  new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, -0.42),
      new THREE.Vector2(0.2, -0.22),
      new THREE.Vector2(0.5, 0.0),
      new THREE.Vector2(0.5, 0.04),
      new THREE.Vector2(0.34, 0.17),
      new THREE.Vector2(0.0, 0.19),
    ],
    segments
  );

/* ---------- The jewel: a stack of kangan bangles ---------- */
const jewel = new THREE.Group();     // receives scroll choreography
const spinner = new THREE.Group();   // continuous slow spin
jewel.add(spinner);
scene.add(jewel);

const R = 1.0;          // bangle radius
const TUBE = 0.07;      // band thickness
const WIDTH = 2.3;      // stretch along the axis → a broad kada
const dummy = new THREE.Object3D();

function makeBangle({ material, stones }) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 40, 220), material);
  band.scale.z = WIDTH;
  g.add(band);

  // Milgrain: a row of tiny gold beads along each rim
  const N = 150;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 10, 8), gold, N * 2);
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      dummy.position.set(Math.cos(a) * (R + 0.035), Math.sin(a) * (R + 0.035), (side ? 1 : -1) * TUBE * WIDTH * 0.82);
      dummy.updateMatrix();
      beads.setMatrixAt(side * N + i, dummy.matrix);
    }
  }
  g.add(beads);

  // A band of set stones around the outside, alternating ruby / emerald
  if (stones) {
    const S = 22;
    const geo = cutGeo(8);
    const reds = new THREE.InstancedMesh(geo, ruby, S / 2);
    const greens = new THREE.InstancedMesh(geo, emerald, S / 2);
    const cups = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.06, 0.05, 16), gold, S);
    for (let i = 0; i < S; i++) {
      const a = (i / S) * Math.PI * 2;
      const n = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
      dummy.position.copy(n).multiplyScalar(R + TUBE + 0.035);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      dummy.scale.setScalar(0.19);
      dummy.updateMatrix();
      (i % 2 ? greens : reds).setMatrixAt(i >> 1, dummy.matrix);
      dummy.position.copy(n).multiplyScalar(R + TUBE + 0.005);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      cups.setMatrixAt(i, dummy.matrix);
    }
    g.add(reds, greens, cups);
  }
  return g;
}

// Fanned stack: two plain kadas framing a stone-set one
[
  { material: antiqueGold, stones: false, z: -0.42, rot: -0.12 },
  { material: gold, stones: true, z: 0, rot: 0 },
  { material: antiqueGold, stones: false, z: 0.42, rot: 0.12 },
].forEach((b) => {
  const bangle = makeBangle(b);
  bangle.position.z = b.z;
  bangle.rotation.x = b.rot;
  spinner.add(bangle);
});

/* ---------- Pearl mala with a ruby drop, drifting around the stack ---------- */
const mala = new THREE.Group();
jewel.add(mala);
const malaCurve = new THREE.CatmullRomCurve3(
  Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const droop = Math.max(0, -Math.sin(a)) * 0.45; // heavier at the bottom
    return new THREE.Vector3(Math.cos(a) * 1.75, Math.sin(a) * 1.55 - droop, Math.sin(a * 2) * 0.35);
  }),
  true
);
const PEARLS = 120;
const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.058, 20, 14), pearl, PEARLS);
for (let i = 0; i < PEARLS; i++) {
  dummy.position.copy(malaCurve.getPointAt(i / PEARLS));
  dummy.quaternion.identity();
  dummy.scale.setScalar(0.85 + 0.15 * Math.abs(Math.sin(i * 1.7)));
  dummy.updateMatrix();
  pearls.setMatrixAt(i, dummy.matrix);
}
mala.add(pearls);

// Pendant at the lowest point of the strand
const lowest = malaCurve.getPointAt(0.75);
const pendant = new THREE.Group();
pendant.position.copy(lowest);
const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 16, 48), gold);
bezel.scale.y = 1.35;
const drop = new THREE.Mesh(cutGeo(10), ruby);
drop.rotation.x = Math.PI / 2;
drop.scale.set(0.34, 0.34, 0.46);
pendant.add(bezel, drop);
pendant.position.y -= 0.24;
const bail = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 10, 24), gold);
bail.position.set(lowest.x, lowest.y - 0.04, lowest.z);
mala.add(pendant, bail);
mala.rotation.x = -0.35;

/* ---------- Orbits: hairline gold rings carrying gems ---------- */
const orbitGroup = new THREE.Group();
scene.add(orbitGroup);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xc9a45c, transparent: true, opacity: 0.3 });
const orbits = [];
[
  { r: 2.5, tilt: [1.2, 0.2, 0], speed: 0.16, mat: ruby },
  { r: 3.0, tilt: [1.45, -0.5, 0.3], speed: -0.11, mat: emerald },
  { r: 3.7, tilt: [1.0, 0.6, -0.2], speed: 0.07, mat: pearl },
].forEach((o) => {
  const g = new THREE.Group();
  g.rotation.set(...o.tilt);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(o.r, 0.004, 6, 256), lineMat));
  const bead = o.mat === pearl
    ? new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 16), pearl)
    : new THREE.Mesh(cutGeo(10), o.mat);
  if (o.mat !== pearl) bead.scale.setScalar(0.22);
  g.add(bead);
  orbitGroup.add(g);
  orbits.push({ ...o, bead, phase: Math.random() * Math.PI * 2 });
});

/* ---------- Gold dust ---------- */
const DUST = coarse ? 600 : 1400;
const dustGeo = new THREE.BufferGeometry();
const pos = new Float32Array(DUST * 3);
const seed = new Float32Array(DUST);
for (let i = 0; i < DUST; i++) {
  const r = 2.5 + Math.random() * 10;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  pos[i * 3] = r * Math.sin(ph) * Math.cos(th) * 1.6;
  pos[i * 3 + 1] = r * Math.cos(ph);
  pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 3;
  seed[i] = Math.random();
}
dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
dustGeo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
const dustMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uPixel: { value: renderer.getPixelRatio() },
  },
  vertexShader: /* glsl */ `
    attribute float seed;
    uniform float uTime, uScroll, uPixel;
    varying float vAlpha;
    void main() {
      vec3 p = position;
      p.y += sin(uTime * 0.25 + seed * 40.0) * 0.35 + uScroll * (0.6 + seed);
      p.y = mod(p.y + 12.0, 24.0) - 12.0;
      p.x += cos(uTime * 0.2 + seed * 20.0) * 0.25;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (8.0 + seed * 22.0) * uPixel / -mv.z;
      vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + seed * 2.0) + seed * 60.0));
    }`,
  fragmentShader: /* glsl */ `
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      a = pow(a, 2.2) * vAlpha;
      gl_FragColor = vec4(vec3(1.0, 0.82, 0.5) * a, a);
    }`,
});
const dust = new THREE.Points(dustGeo, dustMat);
scene.add(dust);

/* ---------- Post: gentle bloom on highlights (desktop) ---------- */
let composer = null;
if (!coarse) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.5, 0.9));
  composer.addPass(new OutputPass());
}

/* ---------- Scroll choreography ---------- */
const poses = [];
function measure() {
  poses.length = 0;
  document.querySelectorAll("[data-ring]").forEach((el) => {
    const [x, y, s, tilt] = el.dataset.ring.split(",").map(Number);
    const top = el.getBoundingClientRect().top + scrollY;
    poses.push({ at: top + el.offsetHeight / 2, x, y, s, tilt });
  });
}
const smooth = (t) => t * t * (3 - 2 * t);
function poseAt(v) {
  if (!poses.length) return { x: 0, y: 0, s: 1, tilt: 0 };
  if (v <= poses[0].at) return poses[0];
  for (let i = 0; i < poses.length - 1; i++) {
    const a = poses[i], b = poses[i + 1];
    if (v < b.at) {
      const t = smooth((v - a.at) / (b.at - a.at));
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        s: a.s + (b.s - a.s) * t,
        tilt: a.tilt + (b.tilt - a.tilt) * t,
      };
    }
  }
  return poses[poses.length - 1];
}

/* ---------- Input ---------- */
const mouse = new THREE.Vector2();
const mouseEase = new THREE.Vector2();
addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
let lastScroll = scrollY, scrollVel = 0;

function resize() {
  const w = innerWidth, h = innerHeight;
  camera.aspect = w / h;
  // pull back on portrait screens so the ring fits
  camera.position.z = w < h ? 9 + (h / w - 1) * 5 : 9;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  composer?.setSize(w, h);
  measure();
}
addEventListener("resize", resize);
new ResizeObserver(measure).observe(document.body);
resize();

/* ---------- Loop ---------- */
const clock = new THREE.Clock();
let intro = 0;          // 0 → 1 entrance animation
let spin = 0;
const current = { x: 0, y: 0, s: 1, tilt: 0 };

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const motion = reduceMotion ? 0.25 : 1;

  // scroll velocity → extra spin and dust drift
  const sv = scrollY - lastScroll;
  lastScroll = scrollY;
  scrollVel += (sv - scrollVel) * 0.1;

  // ease toward the pose for the current scroll position
  const target = poseAt(scrollY + innerHeight / 2);
  const k = 1 - Math.pow(0.001, dt);
  for (const key in current) current[key] += (target[key] - current[key]) * k * 0.9;

  const narrow = innerWidth < 860;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const halfW = halfH * camera.aspect;
  const xMul = narrow ? 0.25 : 1;
  const yLift = narrow && scrollY < innerHeight * 0.6 ? 0.5 : 0;

  intro = Math.min(intro + dt * 0.6, 1);
  const introE = 1 - Math.pow(1 - intro, 4);

  mouseEase.lerp(mouse, 0.05);

  jewel.position.set(
    current.x * halfW * xMul + mouseEase.x * 0.15,
    (current.y + yLift) * halfH + Math.sin(t * 0.8) * 0.06 * motion,
    0
  );
  jewel.scale.setScalar(current.s * (narrow ? 0.7 : 1) * (0.6 + 0.4 * introE));
  jewel.rotation.x = 0.35 + current.tilt * 0.35 - mouseEase.y * 0.25;
  jewel.rotation.z = Math.sin(current.tilt) * 0.2 + (1 - introE) * 0.8;

  spin += dt * (0.35 + Math.abs(scrollVel) * 0.02) * motion;
  spinner.rotation.y = spin + mouseEase.x * 0.4 + (1 - introE) * -2.2;

  orbitGroup.position.copy(jewel.position);
  orbitGroup.scale.setScalar(jewel.scale.x * 1.05);
  orbitGroup.rotation.y = t * 0.05 * motion;
  orbits.forEach((o) => {
    const a = o.phase + t * o.speed * motion * 2;
    o.bead.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0);
    o.bead.rotation.y = t * 0.8;
  });
  mala.rotation.z = -t * 0.1 * motion - spin * 0.15;
  pendant.rotation.y = Math.sin(t * 0.7) * 0.5;
  lineMat.opacity = 0.3 * introE;

  // slowly turn the reflections so light rolls across the gold
  scene.environmentRotation.y = t * 0.08 * motion;
  rim.position.x = Math.cos(t * 0.3) * 4;

  dustMat.uniforms.uTime.value = t * motion;
  dustMat.uniforms.uScroll.value = scrollY * 0.0015;
  dust.rotation.y = t * 0.01 * motion + mouseEase.x * 0.05;

  camera.position.x = mouseEase.x * 0.25;
  camera.position.y = mouseEase.y * 0.15;
  camera.lookAt(0, 0, 0);

  composer ? composer.render() : renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Compile shaders up front so the first frame doesn't stutter.
renderer.compile(scene, camera);
requestAnimationFrame(() => { frame(); ready(); });
