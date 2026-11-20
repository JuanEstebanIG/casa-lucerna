import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const stage = document.getElementById('patio-3d-stage');
const canvasWrap = document.getElementById('patio-3d-canvas');
const posterEl = document.getElementById('patio-3d-poster');
const lampToggleBtn = document.getElementById('toggle-lamp-btn');
const resetCamBtn = document.getElementById('reset-cam-btn');
const orbitHint = document.getElementById('patio-orbit-hint');

if (stage && canvasWrap) {
  initPatio3D().catch((err) => {
    console.warn('Casa Lucerna 3D fallback active:', err);
    if (lampToggleBtn) lampToggleBtn.hidden = true;
    if (orbitHint) orbitHint.hidden = true;
  });
}

async function initPatio3D() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // 1. RENDERER & SCENE (Standard color matching Blender's crisp anime palette!)
  // ============================================================
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // Matches Blender Standard view transform!
  canvasWrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, 1520 / 1080, 0.1, 40);
  // Matches Blender MainCamera (-0.78, -2.76, 0.78) -> glTF Y-up (-0.78, 0.78, +2.76)
  const HOME_CAM_POS = new THREE.Vector3(-0.78, 0.80, 2.74);
  const HOME_TARGET = new THREE.Vector3(0.02, 0.50, -0.02);
  camera.position.copy(HOME_CAM_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.enablePan = false;
  controls.enableZoom = false; // Never hijack vertical page scrolling!
  controls.minPolarAngle = Math.PI * 0.24;
  controls.maxPolarAngle = Math.PI * 0.505;
  controls.minAzimuthAngle = -Math.PI * 0.58;
  controls.maxAzimuthAngle = Math.PI * 0.42;
  controls.rotateSpeed = 0.65;
  controls.update();

  let hasInteracted = false;
  let resettingCam = false;

  controls.addEventListener('start', () => {
    resettingCam = false;
    if (!hasInteracted) {
      hasInteracted = true;
      if (orbitHint) orbitHint.classList.add('is-hidden');
      if (resetCamBtn) resetCamBtn.hidden = false;
    }
  });

  if (resetCamBtn) {
    resetCamBtn.addEventListener('click', () => {
      resettingCam = true;
    });
  }

  function resize() {
    const w = canvasWrap.clientWidth || 720;
    const h = canvasWrap.clientHeight || 512;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasWrap);

  // ============================================================
  // 2. SHARED HAND-DRAWN NOCTURNAL ANIME GLSL UNIFORMS
  // ============================================================
  // Blender -> glTF Y-up: (x, y, z) -> (x, z, -y)
  const LAMP_GLASS_POS = new THREE.Vector3(-0.54, 0.85, -0.22);
  const LAMP_LIGHT_POS = new THREE.Vector3(-0.54, 0.88, 0.24);
  const HERO_FF_BASE = new THREE.Vector3(-0.30, 0.72, 0.32);

  const sharedUniforms = {
    uLampPos: { value: LAMP_LIGHT_POS.clone() },
    uLampIntensity: { value: 1.0 },
    uMoonDir: { value: new THREE.Vector3(2.6, 2.6, -1.2).normalize() },
    uHeroFFPos: { value: HERO_FF_BASE.clone() },
    uTime: { value: 0.0 },
    uBgColor: { value: new THREE.Color('#131B32') }
  };

  let lampTargetIntensity = 1.0;
  let lampOn = true;

  if (lampToggleBtn) {
    lampToggleBtn.addEventListener('click', () => {
      lampOn = !lampOn;
      lampTargetIntensity = lampOn ? 1.0 : 0.14;
      lampToggleBtn.setAttribute('aria-pressed', String(lampOn));
      lampToggleBtn.textContent = lampOn ? 'Atenuar farola' : 'Encender farola';
    });
  }

  // ============================================================
  // 3. CUSTOM REAL-TIME HAND-DRAWN ANIME NIGHT CEL + HATCHING SHADER
  // ============================================================
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

        // Smooth lightweight 3D value noise for painterly brush edge wobble & paper grain
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

          // Sample baked hand-painted base color or solid color
          vec3 albedo = uBaseColor;
          if (uHasMap > 0.5) {
            albedo = texture2D(uMap, vUv).rgb;
          }

          // 1. Warm Streetlamp Point Light with natural nocturnal garden falloff
          vec3 toLamp = uLampPos - vWorldPos;
          float lampDist = length(toLamp);
          vec3 L_lamp = toLamp / max(lampDist, 0.001);
          float atten = 1.0 / (1.0 + 0.42 * lampDist * lampDist);
          float ndlLamp = max(dot(N, L_lamp), 0.0) * atten * 1.48 * uLampIntensity;

          // 2. Hero Firefly gentle warm kiss light near Mikan's face
          vec3 toFF = uHeroFFPos - vWorldPos;
          float ffDist = length(toFF);
          float ndlFF = max(dot(N, normalize(toFF)), 0.0) * (0.24 / (1.0 + 3.2 * ffDist * ffDist));

          // 3. Cool Silvery Moonlight directional key from upper-right-back
          float ndlMoon = max(dot(N, uMoonDir), 0.0) * (uIsCloud > 0.5 ? 0.55 : 0.24);

          float lightVal = ndlLamp + ndlFF + ndlMoon;

          // Painterly brush-edge wobble on the cel shadow boundary
          float wob = (noise3(vWorldPos * 12.0) - 0.5) * 0.085;
          float lw = clamp(lightVal + wob, 0.0, 1.5);

          // Two-step crisp hand-painted cel shading
          float maskLit = smoothstep(uCelThresh - 0.04, uCelThresh + 0.04, lw);
          float maskMid = smoothstep(0.08, 0.16, lw);

          // Hue-shifted nocturnal palette: warm honey-amber under lamp -> twilight indigo/plum in shadows!
          float warmth = clamp(ndlLamp * 1.35, 0.0, 1.0);
          vec3 colLit = mix(albedo, mix(albedo, vec3(1.0, 0.80, 0.46), 0.24), warmth);
          vec3 colMid = albedo * vec3(0.45, 0.48, 0.78) + vec3(0.035, 0.035, 0.11);
          vec3 colDeep = albedo * vec3(0.24, 0.27, 0.52) + vec3(0.02, 0.025, 0.08);

          vec3 col = mix(mix(colDeep, colMid, maskMid), colLit, maskLit);

          // Watercolor pigment pooling right along cel shadow terminator
          float termBand = clamp(1.0 - abs(lw - uCelThresh) * 14.0, 0.0, 1.0);
          col = mix(col, col * vec3(0.68, 0.65, 0.86), termBand * 0.22);

          // Crisp fine 48-degree diagonal pen hatching STRICTLY inside shadows!
          float diagCoord = (vWorldPos.x * 0.72 + vWorldPos.y * 0.69 - vWorldPos.z * 0.45) * 95.0;
          float hatchWave = sin(diagCoord + noise3(vWorldPos * 9.0) * 2.2);
          float hatchLine = smoothstep(0.62, 0.84, hatchWave);
          float hatchPatch = smoothstep(0.30, 0.70, noise3(vWorldPos * 4.5 + 3.1));
          float inShadow = 1.0 - maskLit;
          col = mix(col, col * vec3(0.45, 0.45, 0.68), hatchLine * hatchPatch * inShadow * uHatchAmt);

          // Cold-press watercolor paper grain
          float grain = noise3(vWorldPos * 75.0) * 0.6 + noise3(vWorldPos * 10.0) * 0.4;
          col *= mix(0.92, 1.03, grain);

          // Rim highlight: warm lantern gold near lamp, cool silvery moonlight elsewhere!
          float fresnel = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 3.0);
          float rimStep = smoothstep(0.38, 0.56, fresnel);
          vec3 rimColor = mix(vec3(0.62, 0.83, 1.0), vec3(1.0, 0.89, 0.62), warmth);
          col = mix(col, rimColor, rimStep * uRimAmt * (0.45 + 0.55 * maskLit));

          // Crisp anime specular dot on golden bell & ceramic bowl
          if (uSpecAmt > 0.01) {
            vec3 H = normalize(L_lamp + V);
            float sp = smoothstep(0.92, 0.96, max(dot(N, H), 0.0)) * uLampIntensity;
            col = mix(col, vec3(1.0, 0.98, 0.88), sp * uSpecAmt);
          }

          // Seamless nocturnal edge dissolve on the outer perimeter of the rounded meadow diorama!
          if (uIsMeadow > 0.5) {
            float dEdge = length(vWorldPos.xz - vec2(0.05, -0.30));
            float edgeFade = smoothstep(1.38, 1.90, dEdge);
            col = mix(col, uBgColor, edgeFade);
          }

          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }
      `
    });
  }

  // ============================================================
  // 4. ANIMATED GLOW SPRITES (Breathing Lantern Halo, Moon Glow, 22 Drifting 3D Fireflies & Stars!)
  // ============================================================
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

  const lampHaloTex = makeRadialGlowTexture('rgba(255,244,195,0.72)', 'rgba(246,169,72,0.28)', 'rgba(246,169,72,0)');
  const lampHaloMat = new THREE.SpriteMaterial({
    map: lampHaloTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.92
  });
  const lampHaloSprite = new THREE.Sprite(lampHaloMat);
  lampHaloSprite.position.copy(LAMP_GLASS_POS);
  lampHaloSprite.scale.set(0.95, 0.95, 1);
  scene.add(lampHaloSprite);

  // Soft silvery moon halo behind crescent moon (Blender (1.72, 3.30, 1.66) -> glTF (1.72, 1.66, -3.30))
  const moonHaloTex = makeRadialGlowTexture('rgba(232,244,255,0.45)', 'rgba(130,175,235,0.16)', 'rgba(130,175,235,0)');
  const moonHaloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonHaloTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  moonHaloSprite.position.set(1.72, 1.66, -3.36);
  moonHaloSprite.scale.set(1.1, 1.1, 1);
  scene.add(moonHaloSprite);

  // 22 Animated Real-Time 3D Fireflies floating gently across the garden!
  const ffTex = makeRadialGlowTexture('rgba(255,255,205,1.0)', 'rgba(218,252,110,0.52)', 'rgba(162,232,68,0)');
  const fireflySeeds = [
    // [x, y, z, size, phase, speed, amp]  (glTF Y-up coords!)
    [-0.30, 0.72,  0.32, 0.14, 0.0, 1.35, 0.032], // HERO firefly right in front of Mikan's curious gaze!
    [-0.44, 0.56,  0.18, 0.085, 1.1, 0.95, 0.045],
    [-0.14, 0.92,  0.20, 0.075, 2.4, 0.82, 0.050],
    [ 0.24, 0.86,  0.16, 0.095, 3.7, 1.05, 0.055],
    [ 0.44, 0.68,  0.14, 0.085, 0.7, 0.90, 0.050],
    [ 0.58, 0.42,  0.08, 0.105, 4.3, 1.12, 0.045],
    [ 0.46, 0.21,  0.26, 0.100, 1.9, 1.25, 0.038], // Dancing above the lavender yarn ball
    [ 0.68, 0.16,  0.20, 0.080, 5.1, 0.88, 0.040],
    [ 0.84, 0.32,  0.05, 0.078, 2.9, 0.92, 0.050],
    [-0.46, 0.22,  0.22, 0.085, 3.3, 1.00, 0.035], // Near blue ceramic bowl
    [-0.64, 0.46, -0.14, 0.085, 0.4, 0.86, 0.042],
    [-0.82, 0.28, -0.12, 0.072, 4.9, 0.78, 0.038],
    [-0.34, 0.60, -0.34, 0.075, 2.1, 0.94, 0.048],
    [ 0.28, 0.54, -0.38, 0.080, 5.5, 0.84, 0.045],
    [ 0.78, 0.60, -0.28, 0.090, 1.4, 0.96, 0.052],
    [ 0.94, 0.50, -0.18, 0.074, 3.9, 0.80, 0.046],
    [-0.44, 1.04, -0.04, 0.080, 0.9, 0.92, 0.042], // Near Sakura blossoms
    [ 0.04, 1.12, -0.14, 0.070, 2.7, 0.76, 0.045],
    [ 0.64, 0.96, -0.22, 0.080, 4.6, 0.88, 0.050],
    [ 0.34, 0.12,  0.34, 0.068, 1.6, 1.08, 0.032],
    [-0.24, 0.14,  0.36, 0.068, 5.8, 1.02, 0.032],
    [ 0.90, 0.12,  0.26, 0.075, 3.1, 0.90, 0.038]
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

  // Twinkling 3D night sky stars arcing gracefully behind the diorama
  const starTex = makeRadialGlowTexture('rgba(255,250,224,1.0)', 'rgba(220,234,255,0.35)', 'rgba(220,234,255,0)');
  const stars = [];
  const starCoords = [
    [-1.4, 2.2, -3.6, 0.08], [-0.9, 2.4, -3.8, 0.06], [-0.3, 2.1, -3.7, 0.09],
    [ 0.2, 2.3, -3.8, 0.07], [ 0.7, 2.2, -3.6, 0.08], [ 1.2, 2.4, -3.7, 0.10],
    [ 1.9, 2.1, -3.5, 0.07], [ 2.2, 1.6, -3.6, 0.06], [ 1.5, 1.2, -3.6, 0.07],
    [ 0.9, 1.4, -3.7, 0.06], [-0.5, 1.7, -3.8, 0.06], [-1.6, 1.7, -3.5, 0.07],
    [ 2.5, 2.0, -3.2, 0.08], [-2.1, 2.0, -3.1, 0.07], [ 0.4, 1.6, -3.8, 0.05]
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

  // ============================================================
  // 5. LOAD REAL 3D MODEL (HTTP fetch OR automatic file:// fallback!)
  // ============================================================
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
      sakuraPetals.push({ node, baseY: node.position.y, baseRotZ: node.rotation.z, phase: sakuraPetals.length * 1.15 });
    }
    if (!node.isMesh) return;

    const processMat = (m) => {
      if (!m) return m;
      const mn = m.name || '';
      if (mn.startsWith('GLB_INK_')) {
        // Real 360-degree inverted-hull ink outlines (Solidify flipped normals -> render FrontSide!)
        const inkHex = mn.includes('CLOUD') ? '#3F5380' : mn.includes('MID') ? '#22203E' : '#151328';
        return new THREE.MeshBasicMaterial({
          color: new THREE.Color(inkHex),
          side: THREE.FrontSide
        });
      }
      if (mn.startsWith('GLB_UNLIT_')) {
        const unlitMat = new THREE.MeshBasicMaterial({
          color: m.map ? new THREE.Color(0xffffff) : (m.color ? m.color.clone() : new THREE.Color(0xffffff)),
          map: m.map || null,
          side: THREE.DoubleSide
        });
        if (mn.includes('LanternGlass')) {
          lanternGlassMat = unlitMat;
        }
        return unlitMat;
      }
      // Custom Nocturnal Hand-Drawn Anime Cel + Pen-Hatching GLSL Shader!
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

  // Crossfade away the static poster once first real 3D frame renders!
  renderer.render(scene, camera);
  if (posterEl) {
    posterEl.classList.add('is-loaded');
  }
  stage.classList.add('is-ready');

  // ============================================================
  // 6. ORGANIC 60 FPS ANIMATION LOOP (Only when Hero is in Viewport!)
  // ============================================================
  let isVisible = true;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0.05 });
    io.observe(stage);
  }

  const clock = new THREE.Clock();
  const glassLitColor = new THREE.Color('#FFF1B8');
  const glassDimColor = new THREE.Color('#8E7052');

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    sharedUniforms.uTime.value = t;

    // Smooth streetlamp toggle + subtle warm candle breath
    const breath = prefersReduced ? 0.0 : Math.sin(t * 1.4) * 0.045;
    sharedUniforms.uLampIntensity.value += (lampTargetIntensity + breath - sharedUniforms.uLampIntensity.value) * Math.min(1, dt * 4.5);
    const lInt = sharedUniforms.uLampIntensity.value;
    lampHaloMat.opacity = Math.max(0.08, lInt * 0.88);
    const haloScale = 0.72 + lInt * 0.28;
    lampHaloSprite.scale.set(haloScale, haloScale, 1);
    if (lanternGlassMat) {
      lanternGlassMat.color.copy(glassDimColor).lerp(glassLitColor, THREE.MathUtils.clamp(lInt, 0, 1));
    }

    if (!prefersReduced) {
      // Animate 22 3D fireflies gently wandering & pulsing in real 3D space
      for (const f of fireflies) {
        const s = t * f.speed + f.phase;
        f.sp.position.x = f.base.x + Math.sin(s * 0.9) * f.amp;
        f.sp.position.y = f.base.y + Math.cos(s * 1.15) * (f.amp * 0.75);
        f.sp.position.z = f.base.z + Math.sin(s * 0.7 + 1.2) * (f.amp * 0.65);
        const pulse = 0.58 + 0.42 * Math.sin(s * 2.1);
        // When streetlamp is dimmed, fireflies shine even more vividly!
        const nightBoost = 1.0 + (1.0 - THREE.MathUtils.clamp(lInt, 0.14, 1.0)) * 0.45;
        f.mat.opacity = Math.min(1.0, pulse * nightBoost);
        const sc = f.sz * (0.86 + 0.26 * pulse);
        f.sp.scale.set(sc, sc, 1);
        if (f.isHero) {
          sharedUniforms.uHeroFFPos.value.copy(f.sp.position);
        }
      }

      // Twinkle distant night sky stars
      for (const st of stars) {
        st.sm.opacity = 0.45 + 0.50 * (0.5 + 0.5 * Math.sin(t * 1.6 + st.phase));
      }

      // Gentle alive breathing & curious head tilt on Mikan!
      if (catRoot) {
        catRoot.scale.y = 1.0 + Math.sin(t * 1.8) * 0.008;
      }
      if (catHeadRoot && headBaseRot) {
        catHeadRoot.rotation.z = headBaseRot.z + Math.sin(t * 0.95) * 0.032;
        catHeadRoot.rotation.y = headBaseRot.y + Math.cos(t * 0.72) * 0.028;
      }

      // Subtle breeze sway on floating Sakura petals
      for (const p of sakuraPetals) {
        if (p.baseY > 0.08) {
          p.node.position.y = p.baseY + Math.sin(t * 1.2 + p.phase) * 0.016;
          p.node.rotation.z = p.baseRotZ + Math.sin(t * 0.9 + p.phase) * 0.14;
        }
      }
    }

    // Smooth camera return when user clicks "Centrar vista"
    if (resettingCam) {
      camera.position.lerp(HOME_CAM_POS, Math.min(1, dt * 5.0));
      controls.target.lerp(HOME_TARGET, Math.min(1, dt * 5.0));
      if (camera.position.distanceTo(HOME_CAM_POS) < 0.015) {
        camera.position.copy(HOME_CAM_POS);
        controls.target.copy(HOME_TARGET);
        resettingCam = false;
        if (resetCamBtn) resetCamBtn.hidden = true;
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
