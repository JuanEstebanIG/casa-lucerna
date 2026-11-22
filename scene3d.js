import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FluidSpring, rubberband } from './springs.js';

const stage = document.getElementById('patio-3d-stage');
const canvasWrap = document.getElementById('patio-3d-canvas');
const posterEl = document.getElementById('patio-3d-poster');
const orbitHint = document.getElementById('patio-orbit-hint');
const viewButtons = Array.from(document.querySelectorAll('[data-cam-preset]'));
const dimmerTrack = document.getElementById('lantern-dimmer');
const dimmerFill = document.getElementById('lantern-dimmer-fill');
const dimmerThumb = document.getElementById('lantern-dimmer-thumb');
const dimmerValueLabel = document.getElementById('lantern-dimmer-value');

if (stage && canvasWrap) {
  initPatio3D().catch((err) => {
    console.warn('Casa Lucerna 3D fallback active:', err);
    stage.classList.add('is-fallback');
  });
}

async function initPatio3D() {
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let prefersReduced = reducedQuery.matches;
  reducedQuery.addEventListener?.('change', (e) => {
    prefersReduced = e.matches;
  });

  // ==========================================================================
  // 1. RENDERER & SCENE
  // ==========================================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 45);

  // Camera viewpoint presets — framed asymmetrically on desktop so Mikan & the
  // streetlamp live harmoniously alongside the hero typography, and centered on narrow viewports.
  function getPresets() {
    const wide = (canvasWrap.clientWidth || window.innerWidth) >= 960;
    const xShift = wide ? -0.50 : 0.0;
    return {
      patio: {
        pos: new THREE.Vector3(-0.78 + xShift * 0.48, 0.80, wide ? 3.05 : 2.86),
        target: new THREE.Vector3(0.02 + xShift, 0.50, -0.02)
      },
      mikan: {
        pos: new THREE.Vector3(-0.22 + xShift * 0.35, 0.68, wide ? 1.76 : 1.82),
        target: new THREE.Vector3(0.06 + xShift * 0.45, 0.52, 0.04)
      },
      farola: {
        pos: new THREE.Vector3(-1.38 + xShift * 0.28, 0.96, wide ? 2.28 : 2.38),
        target: new THREE.Vector3(-0.34 + xShift * 0.38, 0.66, -0.08)
      },
      jardin: {
        pos: new THREE.Vector3(1.18 + xShift * 0.32, 1.06, wide ? 2.58 : 2.7),
        target: new THREE.Vector3(0.0 + xShift * 0.42, 0.44, -0.04)
      }
    };
  }

  let presets = getPresets();
  let activePresetKey = 'patio';

  camera.position.copy(presets.patio.pos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(presets.patio.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false; // Never hijack vertical page scrolling
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.51;
  controls.minAzimuthAngle = -Math.PI * 0.62;
  controls.maxAzimuthAngle = Math.PI * 0.48;
  controls.rotateSpeed = 0.62;
  controls.update();

  // Interruptible critically damped 3D camera springs (X, Y, Z independent!)
  const camSprings = {
    px: new FluidSpring(camera.position.x, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 }),
    py: new FluidSpring(camera.position.y, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 }),
    pz: new FluidSpring(camera.position.z, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 }),
    tx: new FluidSpring(controls.target.x, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 }),
    ty: new FluidSpring(controls.target.y, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 }),
    tz: new FluidSpring(controls.target.z, { response: 0.55, dampingRatio: 1.0, precision: 0.0005 })
  };
  let springCamActive = false;
  let hasOrbited = false;

  function setPresetButtonUI(key) {
    viewButtons.forEach((btn) => {
      const active = btn.dataset.camPreset === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function flyToPreset(key) {
    const preset = presets[key];
    if (!preset) return;
    activePresetKey = key;
    setPresetButtonUI(key);

    if (prefersReduced) {
      camera.position.copy(preset.pos);
      controls.target.copy(preset.target);
      controls.update();
      springCamActive = false;
      return;
    }

    // Start from LIVE presentation camera position (interruptible, zero jump!)
    if (!springCamActive) {
      camSprings.px.snap(camera.position.x);
      camSprings.py.snap(camera.position.y);
      camSprings.pz.snap(camera.position.z);
      camSprings.tx.snap(controls.target.x);
      camSprings.ty.snap(controls.target.y);
      camSprings.tz.snap(controls.target.z);
    }

    camSprings.px.setTarget(preset.pos.x);
    camSprings.py.setTarget(preset.pos.y);
    camSprings.pz.setTarget(preset.pos.z);
    camSprings.tx.setTarget(preset.target.x);
    camSprings.ty.setTarget(preset.target.y);
    camSprings.tz.setTarget(preset.target.z);
    springCamActive = true;
  }

  // Interruptible camera: grabbing the 3D canvas cancels any active spring immediately!
  controls.addEventListener('start', () => {
    springCamActive = false;
    activePresetKey = null;
    setPresetButtonUI(null);
    if (!hasOrbited) {
      hasOrbited = true;
      if (orbitHint) orbitHint.classList.add('is-hidden');
    }
  });

  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      flyToPreset(btn.dataset.camPreset);
    });
  });

  function resize() {
    const w = canvasWrap.clientWidth || window.innerWidth;
    const h = canvasWrap.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const nextPresets = getPresets();
    presets = nextPresets;
    if (activePresetKey && !springCamActive) {
      camera.position.copy(presets[activePresetKey].pos);
      controls.target.copy(presets[activePresetKey].target);
      controls.update();
    }
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasWrap);

  // ==========================================================================
  // 2. SHARED HAND-DRAWN NOCTURNAL ANIME GLSL UNIFORMS & 1:1 LANTERN DIMMER
  // ==========================================================================
  const LAMP_GLASS_POS = new THREE.Vector3(-0.54, 0.85, -0.22);
  const LAMP_LIGHT_POS = new THREE.Vector3(-0.54, 0.88, 0.24);
  const HERO_FF_BASE = new THREE.Vector3(-0.30, 0.72, 0.32);

  const sharedUniforms = {
    uLampPos: { value: LAMP_LIGHT_POS.clone() },
    uLampIntensity: { value: 1.0 },
    uMoonDir: { value: new THREE.Vector3(2.6, 2.6, -1.2).normalize() },
    uHeroFFPos: { value: HERO_FF_BASE.clone() },
    uTime: { value: 0.0 },
    uBgColor: { value: new THREE.Color('#0B1020') }
  };

  // Lantern dimmer spring (0.12 = moonlight glow, 1.0 = full honey lantern)
  const lampSpring = new FluidSpring(1.0, { response: 0.32, dampingRatio: 1.0, precision: 0.001 });
  let dimmerLevel = 1.0; // Normalized 0..1 UI slider value
  let dimmerDragging = false;
  const rubberSpring = new FluidSpring(0, { response: 0.28, dampingRatio: 0.82, precision: 0.01 });

  function applyDimmerUI(level, stretchPx = 0) {
    const pct = Math.round(level * 100);
    if (dimmerFill) dimmerFill.style.transform = `scaleX(${Math.max(0.04, level)})`;
    if (dimmerThumb) dimmerThumb.style.left = `calc(14px + (100% - 28px) * ${level})`;
    if (dimmerTrack) {
      dimmerTrack.setAttribute('aria-valuenow', String(pct));
      dimmerTrack.style.transform = stretchPx ? `translateX(${stretchPx.toFixed(2)}px)` : '';
    }
    if (dimmerValueLabel) {
      dimmerValueLabel.textContent = pct <= 12 ? 'Luna' : `${pct}%`;
    }
  }

  function setDimmerFromClientX(clientX) {
    if (!dimmerTrack) return;
    const rect = dimmerTrack.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.max(0, Math.min(1, raw));
    dimmerLevel = clamped;
    const targetLamp = 0.12 + clamped * 0.96;
    lampSpring.setTarget(targetLamp);

    // Soft rubber-banding past edges!
    let overshootPx = 0;
    if (raw < 0) overshootPx = rubberband(raw * rect.width, 42, 0.45);
    else if (raw > 1) overshootPx = rubberband((raw - 1) * rect.width, 42, 0.45);
    rubberSpring.snap(overshootPx);
    applyDimmerUI(clamped, overshootPx);
  }

  if (dimmerTrack) {
    applyDimmerUI(dimmerLevel, 0);

    dimmerTrack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dimmerDragging = true;
      dimmerTrack.setPointerCapture(e.pointerId);
      dimmerTrack.classList.add('is-dragging');
      setDimmerFromClientX(e.clientX);
    });

    dimmerTrack.addEventListener('pointermove', (e) => {
      if (!dimmerDragging) return;
      setDimmerFromClientX(e.clientX);
    });

    const endDimmerDrag = () => {
      if (!dimmerDragging) return;
      dimmerDragging = false;
      dimmerTrack.classList.remove('is-dragging');
      rubberSpring.setTarget(0);
    };

    dimmerTrack.addEventListener('pointerup', endDimmerDrag);
    dimmerTrack.addEventListener('pointercancel', endDimmerDrag);

    dimmerTrack.addEventListener('keydown', (e) => {
      let next = dimmerLevel;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(1, dimmerLevel + 0.1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, dimmerLevel - 0.1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 1;
      else return;
      e.preventDefault();
      dimmerLevel = next;
      lampSpring.setTarget(0.12 + next * 0.96);
      applyDimmerUI(next, 0);
    });
  }

  // Subtle pointer gaze tracking for the hero firefly & Mikan's curious head tilt
  const pointerTarget = { x: 0, y: 0 };
  const pointerSmooth = { x: 0, y: 0 };
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    pointerTarget.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointerTarget.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  });
  stage.addEventListener('pointerleave', () => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
  });

  // ==========================================================================
  // 3. CUSTOM REAL-TIME HAND-DRAWN ANIME NIGHT CEL + HATCHING SHADER
  // ==========================================================================
  function createAnimeNightShaderMaterial(origMat, meshName) {
    const hasMap = Boolean(origMat.map);
    const baseColor = origMat.color ? origMat.color.clone() : new THREE.Color(0xffffff);
    const matName = origMat.name || '';

    const isMeadow = meshName.includes('Meadow');
    const isGlossy = matName.includes('Bell') || matName.includes('BowlBlue') || matName.includes('Nose');
    const isCloud = matName.includes('Cloud');
    const isSakura = matName.includes('Sakura') && !matName.includes('Bark');
    const isIron = matName.includes('IronLamp');

    const celThresh = isMeadow ? 0.34 : isCloud ? 0.26 : isSakura ? 0.24 : 0.27;
    const hatchAmt = isCloud ? 0.06 : isSakura ? 0.14 : isIron ? 0.16 : 0.26;
    const specAmt = isGlossy ? 0.72 : 0.0;
    const rimAmt = isMeadow ? 0.12 : isCloud ? 0.42 : 0.36;

    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: origMat.map || null },
        uHasMap: { value: hasMap ? 1.0 : 0.0 },
        uBaseColor: { value: baseColor },
        uLampPos: sharedUniforms.uLampPos,
        uLampIntensity: sharedUniforms.uLampIntensity,
        uMoonDir: sharedUniforms.uMoonDir,
        uHeroFFPos: sharedUniforms.uHeroFFPos,
        uBgColor: sharedUniforms.uBgColor,
        uCelThresh: { value: celThresh },
        uHatchAmt: { value: hatchAmt },
        uSpecAmt: { value: specAmt },
        uRimAmt: { value: rimAmt },
        uIsMeadow: { value: isMeadow ? 1.0 : 0.0 },
        uIsCloud: { value: isCloud ? 1.0 : 0.0 }
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform float uHasMap;
        uniform vec3 uBaseColor;
        uniform vec3 uLampPos;
        uniform float uLampIntensity;
        uniform vec3 uMoonDir;
        uniform vec3 uHeroFFPos;
        uniform vec3 uBgColor;
        uniform float uCelThresh;
        uniform float uHatchAmt;
        uniform float uSpecAmt;
        uniform float uRimAmt;
        uniform float uIsMeadow;
        uniform float uIsCloud;

        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv;

        float hash31(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }

        float noise3(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
                mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z
          );
        }

        void main() {
          vec3 N = normalize(vWorldNormal);
          if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(cameraPosition - vWorldPos);

          vec3 albedo = uBaseColor;
          if (uHasMap > 0.5) {
            albedo = texture2D(uMap, vUv).rgb;
          }

          vec3 toLamp = uLampPos - vWorldPos;
          float lampDist = length(toLamp);
          vec3 L_lamp = toLamp / max(lampDist, 0.001);
          float atten = 1.0 / (1.0 + 0.42 * lampDist * lampDist);
          float ndlLamp = max(dot(N, L_lamp), 0.0) * atten * 1.48 * uLampIntensity;

          vec3 toFF = uHeroFFPos - vWorldPos;
          float ffDist = length(toFF);
          float ndlFF = max(dot(N, normalize(toFF)), 0.0) * (0.26 / (1.0 + 3.0 * ffDist * ffDist));

          float ndlMoon = max(dot(N, uMoonDir), 0.0) * (uIsCloud > 0.5 ? 0.55 : 0.26);

          float lightVal = ndlLamp + ndlFF + ndlMoon;
          float wob = (noise3(vWorldPos * 12.0) - 0.5) * 0.085;
          float lw = clamp(lightVal + wob, 0.0, 1.5);

          float maskLit = smoothstep(uCelThresh - 0.04, uCelThresh + 0.04, lw);
          float maskMid = smoothstep(0.08, 0.16, lw);

          float warmth = clamp(ndlLamp * 1.35, 0.0, 1.0);
          vec3 colLit = mix(albedo, mix(albedo, vec3(1.0, 0.80, 0.46), 0.24), warmth);
          vec3 colMid = albedo * vec3(0.42, 0.46, 0.76) + vec3(0.025, 0.03, 0.095);
          vec3 colDeep = albedo * vec3(0.20, 0.24, 0.48) + vec3(0.014, 0.02, 0.065);

          vec3 col = mix(mix(colDeep, colMid, maskMid), colLit, maskLit);

          float termBand = clamp(1.0 - abs(lw - uCelThresh) * 14.0, 0.0, 1.0);
          col = mix(col, col * vec3(0.68, 0.65, 0.86), termBand * 0.22);

          float diagCoord = (vWorldPos.x * 0.72 + vWorldPos.y * 0.69 - vWorldPos.z * 0.45) * 95.0;
          float hatchWave = sin(diagCoord + noise3(vWorldPos * 9.0) * 2.2);
          float hatchLine = smoothstep(0.62, 0.84, hatchWave);
          float hatchPatch = smoothstep(0.30, 0.70, noise3(vWorldPos * 4.5 + 3.1));
          float inShadow = 1.0 - maskLit;
          col = mix(col, col * vec3(0.45, 0.45, 0.68), hatchLine * hatchPatch * inShadow * uHatchAmt);

          float grain = noise3(vWorldPos * 75.0) * 0.6 + noise3(vWorldPos * 10.0) * 0.4;
          col *= mix(0.92, 1.03, grain);

          float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 3.0);
          float rimStep = smoothstep(0.38, 0.56, fresnel);
          vec3 rimColor = mix(vec3(0.62, 0.83, 1.0), vec3(1.0, 0.89, 0.62), warmth);
          col = mix(col, rimColor, rimStep * uRimAmt * (0.45 + 0.55 * maskLit));

          if (uSpecAmt > 0.01) {
            vec3 H = normalize(L_lamp + V);
            float sp = smoothstep(0.92, 0.96, max(dot(N, H), 0.0)) * uLampIntensity;
            col = mix(col, vec3(1.0, 0.98, 0.88), sp * uSpecAmt);
          }

          if (uIsMeadow > 0.5) {
            float dEdge = length(vWorldPos.xz - vec2(0.05, -0.30));
            float edgeFade = smoothstep(1.36, 1.88, dEdge);
            col = mix(col, uBgColor, edgeFade);
          }

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `
    });
  }

  // ==========================================================================
  // 4. GLOW SPRITES (Lantern Halo, Moon Glow, 22 Fireflies & Stars)
  // ==========================================================================
  function makeRadialGlowTexture(innerRgba, midRgba, outerRgba) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0.0, innerRgba);
    g.addColorStop(0.32, midRgba);
    g.addColorStop(1.0, outerRgba);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const lampHaloTex = makeRadialGlowTexture('rgba(255,244,195,0.74)', 'rgba(246,169,72,0.30)', 'rgba(246,169,72,0)');
  const lampHaloMat = new THREE.SpriteMaterial({
    map: lampHaloTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.92
  });
  const lampHaloSprite = new THREE.Sprite(lampHaloMat);
  lampHaloSprite.position.copy(LAMP_GLASS_POS);
  lampHaloSprite.scale.set(0.98, 0.98, 1);
  scene.add(lampHaloSprite);

  const moonHaloTex = makeRadialGlowTexture('rgba(232,244,255,0.45)', 'rgba(130,175,235,0.16)', 'rgba(130,175,235,0)');
  const moonHaloSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonHaloTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  moonHaloSprite.position.set(1.72, 1.66, -3.36);
  moonHaloSprite.scale.set(1.15, 1.15, 1);
  scene.add(moonHaloSprite);

  const ffTex = makeRadialGlowTexture('rgba(255,255,205,1.0)', 'rgba(218,252,110,0.52)', 'rgba(162,232,68,0)');
  const fireflySeeds = [
    [-0.30, 0.72, 0.32, 0.145, 0.0, 1.35, 0.032],
    [-0.44, 0.56, 0.18, 0.085, 1.1, 0.95, 0.045],
    [-0.14, 0.92, 0.20, 0.075, 2.4, 0.82, 0.050],
    [0.24, 0.86, 0.16, 0.095, 3.7, 1.05, 0.055],
    [0.44, 0.68, 0.14, 0.085, 0.7, 0.90, 0.050],
    [0.58, 0.42, 0.08, 0.105, 4.3, 1.12, 0.045],
    [0.46, 0.21, 0.26, 0.100, 1.9, 1.25, 0.038],
    [0.68, 0.16, 0.20, 0.080, 5.1, 0.88, 0.040],
    [0.84, 0.32, 0.05, 0.078, 2.9, 0.92, 0.050],
    [-0.46, 0.22, 0.22, 0.085, 3.3, 1.00, 0.035],
    [-0.64, 0.46, -0.14, 0.085, 0.4, 0.86, 0.042],
    [-0.82, 0.28, -0.12, 0.072, 4.9, 0.78, 0.038],
    [-0.34, 0.60, -0.34, 0.075, 2.1, 0.94, 0.048],
    [0.28, 0.54, -0.38, 0.080, 5.5, 0.84, 0.045],
    [0.78, 0.60, -0.28, 0.090, 1.4, 0.96, 0.052],
    [0.94, 0.50, -0.18, 0.074, 3.9, 0.80, 0.046],
    [-0.44, 1.04, -0.04, 0.080, 0.9, 0.92, 0.042],
    [0.04, 1.12, -0.14, 0.070, 2.7, 0.76, 0.045],
    [0.64, 0.96, -0.22, 0.080, 4.6, 0.88, 0.050],
    [0.34, 0.12, 0.34, 0.068, 1.6, 1.08, 0.032],
    [-0.24, 0.14, 0.36, 0.068, 5.8, 1.02, 0.032],
    [0.90, 0.12, 0.26, 0.075, 3.1, 0.90, 0.038]
  ];

  const fireflies = fireflySeeds.map(([x, y, z, sz, phase, speed, amp], idx) => {
    const mat = new THREE.SpriteMaterial({
      map: ffTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.95
    });
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, y, z);
    sp.scale.set(sz, sz, 1);
    scene.add(sp);
    return { sp, mat, base: new THREE.Vector3(x, y, z), sz, phase, speed, amp, isHero: idx === 0 };
  });

  const starTex = makeRadialGlowTexture('rgba(255,250,224,1.0)', 'rgba(220,234,255,0.35)', 'rgba(220,234,255,0)');
  const stars = [];
  const starCoords = [
    [-2.4, 2.3, -3.5, 0.08], [-1.8, 2.5, -3.6, 0.06], [-1.4, 2.2, -3.6, 0.08],
    [-0.9, 2.4, -3.8, 0.06], [-0.3, 2.1, -3.7, 0.09], [0.2, 2.3, -3.8, 0.07],
    [0.7, 2.2, -3.6, 0.08], [1.2, 2.4, -3.7, 0.10], [1.9, 2.1, -3.5, 0.07],
    [2.2, 1.6, -3.6, 0.06], [1.5, 1.2, -3.6, 0.07], [0.9, 1.4, -3.7, 0.06],
    [-0.5, 1.7, -3.8, 0.06], [-1.6, 1.7, -3.5, 0.07], [-2.5, 1.8, -3.2, 0.07],
    [2.5, 2.0, -3.2, 0.08], [-2.1, 2.0, -3.1, 0.07], [0.4, 1.6, -3.8, 0.05]
  ];
  starCoords.forEach(([sx, sy, sz, sc], idx) => {
    const sm = new THREE.SpriteMaterial({
      map: starTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85
    });
    const st = new THREE.Sprite(sm);
    st.position.set(sx, sy, sz);
    st.scale.set(sc, sc, 1);
    scene.add(st);
    stars.push({ sm, phase: idx * 1.37 });
  });

  // ==========================================================================
  // 5. LOAD REAL 3D MODEL (HTTP fetch OR automatic file:// fallback)
  // ==========================================================================
  const loader = new GLTFLoader();
  let gltf;

  if (window.location.protocol === 'file:') {
    await loadScriptOnce('assets/mikan-glb-fallback.js');
    if (!window.__MIKAN_GLB_B64__) throw new Error('Missing file:// GLB bundle');
    const bin = atob(window.__MIKAN_GLB_B64__);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    gltf = await new Promise((resolve, reject) => loader.parse(bytes.buffer, '', resolve, reject));
  } else {
    gltf = await loader.loadAsync('assets/mikan-jardin-noche.glb');
  }

  let catRoot = null;
  let catHeadRoot = null;
  let lanternGlassMat = null;
  const sakuraPetals = [];

  gltf.scene.traverse((node) => {
    if (node.name === 'Cat_Root') catRoot = node;
    if (node.name === 'Cat_Head_Root') catHeadRoot = node;
    if (node.name.includes('SakuraPetal')) {
      sakuraPetals.push({
        node,
        baseY: node.position.y,
        baseRotZ: node.rotation.z,
        phase: sakuraPetals.length * 1.15
      });
    }
    if (!node.isMesh) return;

    const processMat = (m) => {
      if (!m) return m;
      const mn = m.name || '';
      if (mn.startsWith('GLB_INK_')) {
        const inkHex = mn.includes('CLOUD') ? '#3F5380' : mn.includes('MID') ? '#22203E' : '#151328';
        return new THREE.MeshBasicMaterial({
          color: new THREE.Color(inkHex),
          side: THREE.FrontSide
        });
      }
      if (mn.startsWith('GLB_UNLIT_')) {
        const unlitMat = new THREE.MeshBasicMaterial({
          color: m.map ? new THREE.Color(0xffffff) : m.color ? m.color.clone() : new THREE.Color(0xffffff),
          map: m.map || null,
          side: THREE.DoubleSide
        });
        if (mn.includes('LanternGlass')) {
          lanternGlassMat = unlitMat;
        }
        return unlitMat;
      }
      return createAnimeNightShaderMaterial(m, node.name);
    };

    if (Array.isArray(node.material)) {
      node.material = node.material.map(processMat);
    } else {
      node.material = processMat(node.material);
    }
  });

  scene.add(gltf.scene);

  const headBaseRot = catHeadRoot ? catHeadRoot.rotation.clone() : null;

  renderer.render(scene, camera);
  if (posterEl) posterEl.classList.add('is-loaded');
  stage.classList.add('is-ready');

  // ==========================================================================
  // 6. 60/120 FPS ANIMATION LOOP (Paused off-screen via IntersectionObserver)
  // ==========================================================================
  let isVisible = true;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.02 }
    );
    io.observe(stage);
  }

  const clock = new THREE.Clock();
  const glassLitColor = new THREE.Color('#FFF2BE');
  const glassDimColor = new THREE.Color('#6F5844');

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    sharedUniforms.uTime.value = t;

    // Step dimmer rubber-band settle spring
    if (!dimmerDragging && Math.abs(rubberSpring.value) > 0.01) {
      rubberSpring.step(dt);
      applyDimmerUI(dimmerLevel, rubberSpring.value);
    }

    // Step lantern intensity spring + subtle candle breath
    lampSpring.step(dt);
    const breath = prefersReduced ? 0.0 : Math.sin(t * 1.45) * 0.04 * dimmerLevel;
    const lInt = THREE.MathUtils.clamp(lampSpring.value + breath, 0.08, 1.15);
    sharedUniforms.uLampIntensity.value = lInt;

    lampHaloMat.opacity = Math.max(0.06, lInt * 0.88);
    const haloScale = 0.68 + lInt * 0.34;
    lampHaloSprite.scale.set(haloScale, haloScale, 1);
    if (lanternGlassMat) {
      lanternGlassMat.color.copy(glassDimColor).lerp(glassLitColor, THREE.MathUtils.clamp(lInt, 0, 1));
    }

    // Smooth pointer gaze vector
    pointerSmooth.x += (pointerTarget.x - pointerSmooth.x) * Math.min(1, dt * 4.5);
    pointerSmooth.y += (pointerTarget.y - pointerSmooth.y) * Math.min(1, dt * 4.5);

    if (!prefersReduced) {
      for (const f of fireflies) {
        const s = t * f.speed + f.phase;
        let fx = f.base.x + Math.sin(s * 0.9) * f.amp;
        let fy = f.base.y + Math.cos(s * 1.15) * (f.amp * 0.75);
        let fz = f.base.z + Math.sin(s * 0.7 + 1.2) * (f.amp * 0.65);

        if (f.isHero) {
          fx += pointerSmooth.x * 0.12;
          fy += pointerSmooth.y * 0.07;
          sharedUniforms.uHeroFFPos.value.set(fx, fy, fz);
        }

        f.sp.position.set(fx, fy, fz);
        const pulse = 0.58 + 0.42 * Math.sin(s * 2.1);
        const nightBoost = 1.0 + (1.0 - THREE.MathUtils.clamp(lInt, 0.12, 1.0)) * 0.55;
        f.mat.opacity = Math.min(1.0, pulse * nightBoost);
        const sc = f.sz * (0.86 + 0.26 * pulse);
        f.sp.scale.set(sc, sc, 1);
      }

      for (const st of stars) {
        st.sm.opacity = 0.42 + 0.54 * (0.5 + 0.5 * Math.sin(t * 1.55 + st.phase));
      }

      if (catRoot) {
        catRoot.scale.y = 1.0 + Math.sin(t * 1.8) * 0.008;
      }
      if (catHeadRoot && headBaseRot) {
        catHeadRoot.rotation.z = headBaseRot.z + Math.sin(t * 0.95) * 0.03 - pointerSmooth.x * 0.05;
        catHeadRoot.rotation.y = headBaseRot.y + Math.cos(t * 0.72) * 0.025 + pointerSmooth.x * 0.07;
      }

      for (const p of sakuraPetals) {
        if (p.baseY > 0.08) {
          p.node.position.y = p.baseY + Math.sin(t * 1.2 + p.phase) * 0.016;
          p.node.rotation.z = p.baseRotZ + Math.sin(t * 0.9 + p.phase) * 0.14;
        }
      }
    }

    // Step interruptible spring camera preset transition
    if (springCamActive) {
      const m1 = camSprings.px.step(dt);
      const m2 = camSprings.py.step(dt);
      const m3 = camSprings.pz.step(dt);
      const m4 = camSprings.tx.step(dt);
      const m5 = camSprings.ty.step(dt);
      const m6 = camSprings.tz.step(dt);
      camera.position.set(camSprings.px.value, camSprings.py.value, camSprings.pz.value);
      controls.target.set(camSprings.tx.value, camSprings.ty.value, camSprings.tz.value);
      if (!(m1 || m2 || m3 || m4 || m5 || m6)) {
        springCamActive = false;
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
