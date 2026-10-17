/**
 * HHSA 3-D Holo-Hilbert Spectrum Interactive Explorer
 * Pinned CDN ESM: Three.js 0.160.0
 * Kidney & Cognition Lab (ckt520728/kidney-cognition-lab)
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

// ============================================================================
// IEEE 754 Float16 Decoder
// ============================================================================
export function decodeFloat16(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  } else if (e === 0x1f) {
    return f ? NaN : ((s ? -1 : 1) * Infinity);
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

export function decodeFloat16Base64(b64String) {
  const binary = atob(b64String);
  const len = binary.length / 2;
  const floats = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const b0 = binary.charCodeAt(i * 2);
    const b1 = binary.charCodeAt(i * 2 + 1);
    const u16 = b0 | (b1 << 8); // little-endian
    floats[i] = decodeFloat16(u16);
  }
  return floats;
}

// ============================================================================
// Turbo / Viridis Color Palette Generator
// ============================================================================
const COLORMAP = [
  [0.18995, 0.07176, 0.23217],
  [0.26668, 0.21950, 0.50526],
  [0.24524, 0.38466, 0.61214],
  [0.19060, 0.53655, 0.60956],
  [0.15082, 0.67295, 0.53032],
  [0.26388, 0.79339, 0.37326],
  [0.55219, 0.88048, 0.17726],
  [0.85878, 0.90226, 0.16016],
  [0.98805, 0.82285, 0.21045],
  [0.98363, 0.62725, 0.21175],
  [0.93282, 0.40795, 0.23847],
  [0.80378, 0.21629, 0.27962]
];

export function getColor(val, min = 0, max = 1) {
  const t = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
  const idx = t * (COLORMAP.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(COLORMAP.length - 1, i0 + 1);
  const f = idx - i0;
  const c0 = COLORMAP[i0];
  const c1 = COLORMAP[i1];
  return [
    c0[0] + f * (c1[0] - c0[0]),
    c0[1] + f * (c1[1] - c0[1]),
    c0[2] + f * (c1[2] - c0[2])
  ];
}

// ============================================================================
// Dataset Metadata & Configurations
// ============================================================================
export const DATASET_CONFIGS = {
  synthetic: {
    id: 'synthetic',
    name: 'Synthetic AM-FM Ground Truth',
    filename: 'synthetic_cube.json',
    glbModel: 'cube_synthetic.glb',
    badge: 'Synthetic Ground Truth (Known fc(t), f_AM(t))',
    badgeClass: 'badge-gold',
    units: { f: 'Hz', t: 's' },
    guide: [
      'Pure synthetic test signal: x(t) = [1 + 0.7 cos(φ_AM(t))] · cos(φ_c(t)).',
      'Ground truth: carrier fc ~ 0.50 Hz modulated by slower rhythm f_AM ~ 0.05 Hz.',
      'Recovers 100% of instantaneous frequency and modulation coordinates in 3-D.',
      'Demonstrates clean separation of carrier vs amplitude modulation axes.'
    ]
  },
  cgm: {
    id: 'cgm',
    name: 'De-identified CGM (n=1, 13 days)',
    filename: 'cgm_cube.json',
    glbModel: 'cube_cgm.glb',
    badge: 'De-identified example (n = 1, 13 days); shown with consent',
    badgeClass: 'badge-teal',
    units: { f: 'cph', t: 'h' },
    guide: [
      'De-identified continuous glucose monitor (CGM) record sampled at 5-min intervals over 312 hours.',
      'Circadian rhythm (24 h / 0.042 c/h) acts as an amplitude envelope modulating faster ultradian and postprandial swings.',
      'Clear energy concentrations in the Circadian (0.04-0.12 c/h) and Meal-related (0.25-0.5 c/h) bands.',
      'HHSA preserves both the 24-h metabolic baseline and rapid postprandial excursions simultaneously.'
    ]
  },
  hrv_sessionA: {
    id: 'hrv_sessionA',
    name: 'HRV Session A (Garmin ~7 min)',
    filename: 'hrv_sessionA_cube.json',
    glbModel: 'cube_hrv_sessionA.glb',
    badge: 'Real Garmin record (~7 min, n = 1); VLF (< 0.007 Hz) greyed as below 3/T',
    badgeClass: 'badge-purple',
    units: { f: 'Hz', t: 's' },
    guide: [
      'Real Garmin wearable optical beat-to-beat PPG session (~7.1 min, 714 beats, mean HR 101 bpm).',
      'Respiratory Sinus Arrhythmia (HF ~0.25 Hz) clearly resolved and modulated by LF (~0.10 Hz) vasomotor waves.',
      'Unresolvable zone: frequencies below 3/T (< 0.007 Hz, VLF) are grey-hatched because record duration is under 15 minutes.',
      'Time-domain validation: RMSSD 24.3 ms, SDNN 42.7 ms.'
    ]
  },
  hrv_sessionB: {
    id: 'hrv_sessionB',
    name: 'HRV Session B (Garmin ~7 min)',
    filename: 'hrv_sessionB_cube.json',
    glbModel: 'cube_hrv_sessionB.glb',
    badge: 'Real Garmin record (~7 min, n = 1); VLF (< 0.007 Hz) greyed as below 3/T',
    badgeClass: 'badge-purple',
    units: { f: 'Hz', t: 's' },
    guide: [
      'Second Garmin wearable recording (~7.4 min, 695 beats, median HR 94 bpm).',
      'Elevated parasympathetic modulation visible in the High Frequency (HF 0.15-0.40 Hz) respiratory band.',
      'VLF bins below 0.0068 Hz grey-hatched as below the 3-cycle resolvable bound (3/T).',
      'Time-domain validation: RMSSD 26.8 ms, SDNN 48.2 ms.'
    ]
  },
  hrv_synthetic: {
    id: 'hrv_synthetic',
    name: 'Synthetic HRV (K4 Benchmark)',
    filename: 'hrv_synthetic_cube.json',
    glbModel: 'cube_synthetic.glb',
    badge: 'Synthetic HRV Benchmark (K4 Model: LF 0.1 Hz, HF 0.25 Hz)',
    badgeClass: 'badge-dim',
    units: { f: 'Hz', t: 's' },
    guide: [
      'Synthetic cardiac benchmark generated from dual respiratory and sympathetic oscillators.',
      'Known LF carrier (0.10 Hz) and HF carrier (0.25 Hz) with slow autonomous AM modulation.',
      'Enables exact validation of cross-frequency coupling recovery without noise artifacts.',
      'Demonstrates ideal HHSA reconstruction on heart rate variability dynamics.'
    ]
  }
};

// ============================================================================
// Core HHSA Cube Model Class
// ============================================================================
export class HhsaCube {
  constructor(rawData) {
    this.raw = rawData;
    this.datasetId = rawData.dataset;
    this.units = rawData.units || { f: 'Hz', t: 's' };
    this.axes = rawData.axes;
    this.bands = rawData.bands || [];
    this.resolvability = rawData.resolvability || {
      unresolvable_below_hz: 0,
      fc_resolvable: new Array(40).fill(true),
      fam_resolvable: new Array(40).fill(true)
    };
    this.admissibleMask = rawData.admissible_mask || null;

    this.nT = this.axes.t.length;
    this.nFc = this.axes.fc.length;
    this.nFam = this.axes.fam.length;

    // Allocate dense 3D tensor
    this.tensor = new Float32Array(this.nT * this.nFc * this.nFam);
    this.maxVal = 0.001;

    // Populate tensor
    if (rawData.H_b64) {
      const decoded = decodeFloat16Base64(rawData.H_b64);
      this.tensor.set(decoded);
    } else if (rawData.H_sparse) {
      for (let i = 0; i < rawData.H_sparse.length; i++) {
        const [t, fc, fam, val] = rawData.H_sparse[i];
        if (t < this.nT && fc < this.nFc && fam < this.nFam) {
          const idx = t * (this.nFc * this.nFam) + fc * this.nFam + fam;
          this.tensor[idx] = val;
        }
      }
    }

    // Precalculate marginal projections
    this.calcProjections();
  }

  calcProjections() {
    this.proj_S_tf = new Float32Array(this.nT * this.nFc);
    this.proj_C_fw = new Float32Array(this.nFc * this.nFam);
    this.proj_M_tw = new Float32Array(this.nT * this.nFam);

    this.maxVal = 0;
    this.max_S = 0;
    this.max_C = 0;
    this.max_M = 0;

    for (let t = 0; t < this.nT; t++) {
      for (let fc = 0; fc < this.nFc; fc++) {
        for (let fam = 0; fam < this.nFam; fam++) {
          const v = this.tensor[t * (this.nFc * this.nFam) + fc * this.nFam + fam];
          if (v > this.maxVal) this.maxVal = v;

          this.proj_S_tf[t * this.nFc + fc] += v;
          this.proj_C_fw[fc * this.nFam + fam] += v;
          this.proj_M_tw[t * this.nFam + fam] += v;
        }
      }
    }

    for (let i = 0; i < this.proj_S_tf.length; i++) if (this.proj_S_tf[i] > this.max_S) this.max_S = this.proj_S_tf[i];
    for (let i = 0; i < this.proj_C_fw.length; i++) if (this.proj_C_fw[i] > this.max_C) this.max_C = this.proj_C_fw[i];
    for (let i = 0; i < this.proj_M_tw.length; i++) if (this.proj_M_tw[i] > this.max_M) this.max_M = this.proj_M_tw[i];
  }

  getVal(t, fc, fam) {
    if (t < 0 || t >= this.nT || fc < 0 || fc >= this.nFc || fam < 0 || fam >= this.nFam) return 0;
    return this.tensor[t * (this.nFc * this.nFam) + fc * this.nFam + fam];
  }

  formatFreq(val) {
    const isCgm = this.units.f === 'cph';
    const period = 1 / val;
    if (isCgm) {
      return `${val.toFixed(3)} c/h · ${period.toFixed(1)} h`;
    } else {
      if (val < 0.05) {
        return `${val.toFixed(4)} Hz · ${period.toFixed(1)} s`;
      }
      return `${val.toFixed(3)} Hz · ${period.toFixed(1)} s`;
    }
  }

  formatTime(val) {
    return `${val.toFixed(1)} ${this.units.t}`;
  }

  getBandName(fc, fam) {
    let fcBand = '';
    let famBand = '';
    for (const b of this.bands) {
      if (fc >= b.lo && fc <= b.hi) fcBand = b.name;
      if (fam >= b.lo && fam <= b.hi) famBand = b.name;
    }
    if (fcBand && famBand) return `${fcBand} / ${famBand}`;
    return fcBand || famBand || 'Unassigned';
  }
}

// ============================================================================
// Explorer UI & 3D WebGL Controller
// ============================================================================
export class ExplorerApp {
  constructor(options = {}) {
    this.container = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
    this.canvas3D = typeof options.canvas3D === 'string' ? document.getElementById(options.canvas3D) : options.canvas3D;
    this.isMiniTurntable = !!options.miniTurntable;

    this.currentDatasetId = options.initialDataset || 'synthetic';
    this.viewMode = 'scatter'; // 'scatter' | 'bands' | 'slices'
    this.energyThreshold = 0.05;
    this.admissibilityMaskEnabled = false;
    this.unresolvableOverlayEnabled = true;
    this.bandPlanesVisible = true;
    this.autoRotate = this.isMiniTurntable;
    this.isPlaying = false;

    // Current slice coordinates
    this.tSlice = 0;
    this.fcSlice = 20;
    this.famSlice = 12;

    this.cache = {};
    this.cube = null;
    this.gltfLoader = new GLTFLoader();

    this.initThree();
    this.init2DCanvases();
    if (!this.isMiniTurntable) {
      this.bindControls();
    }
    this.loadDataset(this.currentDatasetId);
  }

  // --------------------------------------------------------------------------
  // Three.js Scene Setup
  // --------------------------------------------------------------------------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060a14);

    const w = this.canvas3D.clientWidth || 800;
    const h = this.canvas3D.clientHeight || 500;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    this.setCameraPreset('oblique');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas3D,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = this.autoRotate;
    this.controls.autoRotateSpeed = 1.5;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x4dd9cf, 1.2);
    dirLight1.position.set(10, 20, 15);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x8b5cf6, 1.0);
    dirLight2.position.set(-10, -10, -15);
    this.scene.add(dirLight2);

    // Groups
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.axesGroup = new THREE.Group();
    this.dataGroup = new THREE.Group();
    this.slicesGroup = new THREE.Group();
    this.bandsGroup = new THREE.Group();
    this.maskGroup = new THREE.Group();
    this.unresolvableGroup = new THREE.Group();
    this.glbGroup = new THREE.Group();

    this.rootGroup.add(this.axesGroup);
    this.rootGroup.add(this.dataGroup);
    this.rootGroup.add(this.slicesGroup);
    this.rootGroup.add(this.bandsGroup);
    this.rootGroup.add(this.maskGroup);
    this.rootGroup.add(this.unresolvableGroup);
    this.rootGroup.add(this.glbGroup);

    this.buildBoundingBox();

    // Resize Handler
    window.addEventListener('resize', () => this.onResize());

    // Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  buildBoundingBox() {
    this.axesGroup.clear();

    // Box dimensions: x in [-5, 5] (Carrier), y in [-5, 5] (AM), z in [-5, 5] (Time)
    const boxGeo = new THREE.BoxGeometry(10, 10, 10);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x4dd9cf, opacity: 0.35, transparent: true });
    const wireframe = new THREE.LineSegments(boxEdges, boxMat);
    this.axesGroup.add(wireframe);

    // Subtle grid on floor
    const grid = new THREE.GridHelper(10, 10, 0x4dd9cf, 0x162248);
    grid.position.y = -5;
    this.axesGroup.add(grid);
  }

  setCameraPreset(preset) {
    if (!this.camera) return;
    switch (preset) {
      case 'oblique':
        this.camera.position.set(13, 11, 15);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'top': // C(f_c, f_AM)
        this.camera.position.set(0, 20, 0.001);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'side': // S(t, f_c)
        this.camera.position.set(20, 0, 0);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'front': // M(t, f_AM)
        this.camera.position.set(0, 0, 20);
        this.camera.lookAt(0, 0, 0);
        break;
      case 'reset':
      default:
        this.camera.position.set(13, 11, 15);
        this.camera.lookAt(0, 0, 0);
        break;
    }
    if (this.controls) this.controls.target.set(0, 0, 0);
  }

  onResize() {
    if (!this.canvas3D || !this.renderer || !this.camera) return;
    const w = this.canvas3D.clientWidth;
    const h = this.canvas3D.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();
    if (this.isPlaying && this.cube) {
      this.tSlice = (this.tSlice + 1) % this.cube.nT;
      this.syncSlidersFromState();
      this.updateView();
    }
    this.renderer.render(this.scene, this.camera);
  }

  // --------------------------------------------------------------------------
  // Data Loading & Swapping (< 300 ms)
  // --------------------------------------------------------------------------
  async loadDataset(datasetId) {
    const startTime = performance.now();
    const config = DATASET_CONFIGS[datasetId];
    if (!config) return;

    this.currentDatasetId = datasetId;
    this.updateBadgesAndInfo(config);

    if (this.cache[datasetId]) {
      this.cube = this.cache[datasetId];
      this.onDatasetReady();
      console.log(`Switched to ${datasetId} from cache in ${(performance.now() - startTime).toFixed(1)} ms`);
      return;
    }

    try {
      // Try local assets/data first, fallback to ../phase2/cube/
      let res;
      try {
        res = await fetch(`./assets/data/${config.filename}`);
        if (!res.ok) throw new Error('Not in ./assets/data');
      } catch (err) {
        res = await fetch(`../phase2/cube/${config.filename}`);
      }
      const json = await res.json();
      this.cube = new HhsaCube(json);
      this.cache[datasetId] = this.cube;

      this.onDatasetReady();
      console.log(`Loaded and decoded ${datasetId} in ${(performance.now() - startTime).toFixed(1)} ms`);
    } catch (err) {
      console.error(`Failed to load dataset ${datasetId}:`, err);
    }
  }

  onDatasetReady() {
    this.tSlice = Math.min(this.tSlice, this.cube.nT - 1);
    this.fcSlice = Math.min(this.fcSlice, this.cube.nFc - 1);
    this.famSlice = Math.min(this.famSlice, this.cube.nFam - 1);

    this.initSliderRanges();
    this.syncSlidersFromState();

    this.build3DScene();
    this.buildBandPlanes();
    this.buildAdmissibilityMaskMesh();
    this.buildUnresolvableMesh();
    this.loadGlbModel(DATASET_CONFIGS[this.currentDatasetId].glbModel);

    this.draw2DProjections();
    this.updateReadoutHUD();
  }

  loadGlbModel(modelName) {
    this.glbGroup.clear();
    const paths = [`./assets/models/${modelName}`, `../assets/models/${modelName}`];
    
    const tryLoad = (idx) => {
      if (idx >= paths.length) return;
      this.gltfLoader.load(
        paths[idx],
        (gltf) => {
          gltf.scene.scale.set(5, 5, 5);
          this.glbGroup.add(gltf.scene);
        },
        undefined,
        () => tryLoad(idx + 1) // graceful fallback
      );
    };
    tryLoad(0);
  }

  // --------------------------------------------------------------------------
  // 3-D Scene Objects Construction
  // --------------------------------------------------------------------------
  build3DScene() {
    this.dataGroup.clear();
    this.slicesGroup.clear();

    if (!this.cube) return;

    if (this.viewMode === 'scatter') {
      this.buildScatterPoints();
    } else if (this.viewMode === 'slices') {
      this.buildOrthogonalSlicePlanes();
    }
  }

  buildScatterPoints() {
    const pts = [];
    const colors = [];
    const sizes = [];

    const nT = this.cube.nT;
    const nFc = this.cube.nFc;
    const nFam = this.cube.nFam;
    const thresh = this.energyThreshold * this.cube.maxVal;

    for (let t = 0; t < nT; t++) {
      const z = (t / (nT - 1 || 1)) * 10 - 5; // z: time [-5, 5]
      for (let fc = 0; fc < nFc; fc++) {
        const x = (fc / (nFc - 1 || 1)) * 10 - 5; // x: carrier [-5, 5]
        for (let fam = 0; fam < nFam; fam++) {
          const y = (fam / (nFam - 1 || 1)) * 10 - 5; // y: AM [-5, 5]

          // Filter admissibility if enabled
          if (this.admissibilityMaskEnabled && fam >= fc) continue;

          const val = this.cube.getVal(t, fc, fam);
          if (val > thresh) {
            pts.push(x, y, z);
            const [r, g, b] = getColor(val, thresh, this.cube.maxVal);
            colors.push(r, g, b);
            const size = 0.15 + (val / this.cube.maxVal) * 0.45;
            sizes.push(size);
          }
        }
      }
    }

    if (pts.length === 0) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Custom point texture
    const pMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointCloud = new THREE.Points(geo, pMat);
    this.dataGroup.add(pointCloud);
  }

  buildOrthogonalSlicePlanes() {
    this.slicesGroup.clear();
    if (!this.cube) return;

    // 1. Time Slice Plane (Z = constant)
    const zPos = (this.tSlice / (this.cube.nT - 1 || 1)) * 10 - 5;
    const tPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const tTex = this.createSliceTexture('t', this.tSlice);
    const tMat = new THREE.MeshBasicMaterial({
      map: tTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const tMesh = new THREE.Mesh(tPlaneGeo, tMat);
    tMesh.position.set(0, 0, zPos);
    this.slicesGroup.add(tMesh);

    // 2. Carrier Slice Plane (X = constant)
    const xPos = (this.fcSlice / (this.cube.nFc - 1 || 1)) * 10 - 5;
    const fcPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const fcTex = this.createSliceTexture('fc', this.fcSlice);
    const fcMat = new THREE.MeshBasicMaterial({
      map: fcTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const fcMesh = new THREE.Mesh(fcPlaneGeo, fcMat);
    fcMesh.rotation.y = Math.PI / 2;
    fcMesh.position.set(xPos, 0, 0);
    this.slicesGroup.add(fcMesh);

    // 3. AM Frequency Slice Plane (Y = constant)
    const yPos = (this.famSlice / (this.cube.nFam - 1 || 1)) * 10 - 5;
    const famPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const famTex = this.createSliceTexture('fam', this.famSlice);
    const famMat = new THREE.MeshBasicMaterial({
      map: famTex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const famMesh = new THREE.Mesh(famPlaneGeo, famMat);
    famMesh.rotation.x = Math.PI / 2;
    famMesh.position.set(0, yPos, 0);
    this.slicesGroup.add(famMesh);
  }

  createSliceTexture(dim, idx) {
    const canvas = document.createElement('canvas');
    let w, h;
    if (dim === 't') {
      w = this.cube.nFc;
      h = this.cube.nFam;
    } else if (dim === 'fc') {
      w = this.cube.nT;
      h = this.cube.nFam;
    } else { // fam
      w = this.cube.nT;
      h = this.cube.nFc;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);

    let p = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let val = 0;
        if (dim === 't') {
          val = this.cube.getVal(idx, x, y);
        } else if (dim === 'fc') {
          val = this.cube.getVal(x, idx, y);
        } else {
          val = this.cube.getVal(x, y, idx);
        }
        const [r, g, b] = getColor(val, 0, this.cube.maxVal);
        imgData.data[p++] = Math.round(r * 255);
        imgData.data[p++] = Math.round(g * 255);
        imgData.data[p++] = Math.round(b * 255);
        imgData.data[p++] = val > 0 ? 230 : 20;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  buildBandPlanes() {
    this.bandsGroup.clear();
    if (!this.cube || !this.bandPlanesVisible || !this.cube.bands) return;

    const nFc = this.cube.nFc;
    const colors = [0x4dd9cf, 0x8b5cf6, 0xf4a261, 0x22c55e, 0xef4444];

    this.cube.bands.forEach((band, i) => {
      // Find x-coordinates corresponding to band.lo and band.hi
      let fcLoIdx = this.cube.axes.fc.findIndex(f => f >= band.lo);
      let fcHiIdx = this.cube.axes.fc.findIndex(f => f >= band.hi);
      if (fcLoIdx === -1) fcLoIdx = 0;
      if (fcHiIdx === -1) fcHiIdx = nFc - 1;

      const xLo = (fcLoIdx / (nFc - 1)) * 10 - 5;
      const xHi = (fcHiIdx / (nFc - 1)) * 10 - 5;
      const width = Math.max(0.2, xHi - xLo);
      const xMid = (xLo + xHi) / 2;

      const slabGeo = new THREE.BoxGeometry(width, 10, 10);
      const slabMat = new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.set(xMid, 0, 0);
      this.bandsGroup.add(slab);
    });
  }

  buildAdmissibilityMaskMesh() {
    this.maskGroup.clear();
    // Diagonal plane fam = fc (i.e. y = x)
    // Points where fam >= fc (y >= x) violate causality/admissibility
    const geo = new THREE.PlaneGeometry(14.14, 10); // diagonal length sqrt(10^2 + 10^2)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf4a261,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI / 4;
    this.maskGroup.add(mesh);
    this.maskGroup.visible = this.admissibilityMaskEnabled;
  }

  buildUnresolvableMesh() {
    this.unresolvableGroup.clear();
    if (!this.cube) return;

    const unresolvableHz = this.cube.resolvability.unresolvable_below_hz;
    if (unresolvableHz <= 0) return;

    // Find indices for carrier and AM that are below unresolvable bound
    const fcMaxIdx = this.cube.resolvability.fc_resolvable.indexOf(true);
    if (fcMaxIdx > 0) {
      const xBound = (fcMaxIdx / (this.cube.nFc - 1)) * 10 - 5;
      const width = xBound - (-5);
      const geo = new THREE.BoxGeometry(width, 10, 10);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.18,
        wireframe: true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-5 + width / 2, 0, 0);
      this.unresolvableGroup.add(mesh);
    }
    this.unresolvableGroup.visible = this.unresolvableOverlayEnabled;
  }

  // --------------------------------------------------------------------------
  // Live 2-D Linked Projections Canvases
  // --------------------------------------------------------------------------
  init2DCanvases() {
    this.canvasS = document.getElementById('canvas-S-tf');
    this.canvasC = document.getElementById('canvas-C-fw');
    this.canvasM = document.getElementById('canvas-M-tw');

    const bindCanvasClick = (canvas, callback) => {
      if (!canvas) return;
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        callback(normX, 1 - normY); // invert Y for Cartesian
      });
    };

    // S(t, fc): X = time, Y = fc
    bindCanvasClick(this.canvasS, (nx, ny) => {
      if (!this.cube) return;
      this.tSlice = Math.round(nx * (this.cube.nT - 1));
      this.fcSlice = Math.round(ny * (this.cube.nFc - 1));
      this.syncSlidersFromState();
      this.updateView();
    });

    // C(fc, fam): X = fc, Y = fam
    bindCanvasClick(this.canvasC, (nx, ny) => {
      if (!this.cube) return;
      this.fcSlice = Math.round(nx * (this.cube.nFc - 1));
      this.famSlice = Math.round(ny * (this.cube.nFam - 1));
      this.syncSlidersFromState();
      this.updateView();
    });

    // M(t, fam): X = time, Y = fam
    bindCanvasClick(this.canvasM, (nx, ny) => {
      if (!this.cube) return;
      this.tSlice = Math.round(nx * (this.cube.nT - 1));
      this.famSlice = Math.round(ny * (this.cube.nFam - 1));
      this.syncSlidersFromState();
      this.updateView();
    });
  }

  draw2DProjections() {
    if (!this.cube) return;
    this.renderHeatmap(this.canvasS, this.cube.proj_S_tf, this.cube.nT, this.cube.nFc, this.cube.max_S, {
      crossX: this.tSlice / (this.cube.nT - 1),
      crossY: this.fcSlice / (this.cube.nFc - 1),
      unresolvableY: !this.cube.resolvability.fc_resolvable[0] ? this.cube.resolvability.fc_resolvable.indexOf(true) / this.cube.nFc : 0
    });

    this.renderHeatmap(this.canvasC, this.cube.proj_C_fw, this.cube.nFc, this.cube.nFam, this.cube.max_C, {
      crossX: this.fcSlice / (this.cube.nFc - 1),
      crossY: this.famSlice / (this.cube.nFam - 1),
      admissibilityMask: this.admissibilityMaskEnabled,
      unresolvableX: !this.cube.resolvability.fc_resolvable[0] ? this.cube.resolvability.fc_resolvable.indexOf(true) / this.cube.nFc : 0,
      unresolvableY: !this.cube.resolvability.fam_resolvable[0] ? this.cube.resolvability.fam_resolvable.indexOf(true) / this.cube.nFam : 0
    });

    this.renderHeatmap(this.canvasM, this.cube.proj_M_tw, this.cube.nT, this.cube.nFam, this.cube.max_M, {
      crossX: this.tSlice / (this.cube.nT - 1),
      crossY: this.famSlice / (this.cube.nFam - 1),
      unresolvableY: !this.cube.resolvability.fam_resolvable[0] ? this.cube.resolvability.fam_resolvable.indexOf(true) / this.cube.nFam : 0
    });
  }

  renderHeatmap(canvas, dataArray, w, h, maxVal, overlayOpts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;

    // Create offscreen image
    const imgData = ctx.createImageData(w, h);
    let p = 0;
    for (let y = h - 1; y >= 0; y--) { // Cartesian invert Y
      for (let x = 0; x < w; x++) {
        // Check admissibility diagonal if enabled (fam >= fc)
        if (overlayOpts.admissibilityMask && y >= x) {
          imgData.data[p++] = 15;
          imgData.data[p++] = 20;
          imgData.data[p++] = 35;
          imgData.data[p++] = 180;
          continue;
        }

        const v = dataArray[x * h + y];
        const [r, g, b] = getColor(v, 0, maxVal);
        imgData.data[p++] = Math.round(r * 255);
        imgData.data[p++] = Math.round(g * 255);
        imgData.data[p++] = Math.round(b * 255);
        imgData.data[p++] = 255;
      }
    }

    // Stretch to canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    offscreen.getContext('2d').putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, cw, ch);

    // Unresolvable hatching overlay if enabled
    if (this.unresolvableOverlayEnabled) {
      if (overlayOpts.unresolvableX && overlayOpts.unresolvableX > 0) {
        this.drawHatchBox(ctx, 0, 0, overlayOpts.unresolvableX * cw, ch);
      }
      if (overlayOpts.unresolvableY && overlayOpts.unresolvableY > 0) {
        const hatchH = overlayOpts.unresolvableY * ch;
        this.drawHatchBox(ctx, 0, ch - hatchH, cw, hatchH);
      }
    }

    // Crosshairs
    if (overlayOpts.crossX !== undefined && overlayOpts.crossY !== undefined) {
      const cx = overlayOpts.crossX * cw;
      const cy = (1 - overlayOpts.crossY) * ch;

      ctx.strokeStyle = '#4dd9cf';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, ch);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(cw, cy);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }

  drawHatchBox(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.fillRect(x, y, w, h);

    // Diagonal hatch pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = -h; d < w; d += 8) {
      ctx.moveTo(x + Math.max(0, d), y + Math.max(0, -d));
      ctx.lineTo(x + Math.min(w, d + h), y + Math.min(h, h - d));
    }
    ctx.stroke();
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // UI Controls Binding
  // --------------------------------------------------------------------------
  bindControls() {
    // Dataset Switcher Pills
    document.querySelectorAll('[data-dataset]').forEach(el => {
      el.addEventListener('click', (e) => {
        document.querySelectorAll('[data-dataset]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.loadDataset(e.currentTarget.getAttribute('data-dataset'));
      });
    });

    // View Mode Tabs
    document.querySelectorAll('[data-view-mode]').forEach(el => {
      el.addEventListener('click', (e) => {
        document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.viewMode = e.currentTarget.getAttribute('data-view-mode');
        this.build3DScene();
      });
    });

    // Sliders
    this.sliderT = document.getElementById('slider-t');
    this.sliderFc = document.getElementById('slider-fc');
    this.sliderFam = document.getElementById('slider-fam');
    this.sliderThresh = document.getElementById('slider-thresh');

    if (this.sliderT) {
      this.sliderT.addEventListener('input', (e) => {
        this.tSlice = parseInt(e.target.value, 10);
        this.updateView();
      });
    }

    if (this.sliderFc) {
      this.sliderFc.addEventListener('input', (e) => {
        this.fcSlice = parseInt(e.target.value, 10);
        this.updateView();
      });
    }

    if (this.sliderFam) {
      this.sliderFam.addEventListener('input', (e) => {
        this.famSlice = parseInt(e.target.value, 10);
        this.updateView();
      });
    }

    if (this.sliderThresh) {
      this.sliderThresh.addEventListener('input', (e) => {
        this.energyThreshold = parseFloat(e.target.value);
        const valBadge = document.getElementById('val-thresh');
        if (valBadge) valBadge.textContent = `${Math.round(this.energyThreshold * 100)}%`;
        if (this.viewMode === 'scatter') this.buildScatterPoints();
      });
    }

    // Toggles
    const toggleMask = document.getElementById('toggle-admissibility');
    if (toggleMask) {
      toggleMask.addEventListener('change', (e) => {
        this.admissibilityMaskEnabled = e.target.checked;
        this.maskGroup.visible = this.admissibilityMaskEnabled;
        if (this.viewMode === 'scatter') this.buildScatterPoints();
        this.draw2DProjections();
      });
    }

    const toggleUnresolvable = document.getElementById('toggle-unresolvable');
    if (toggleUnresolvable) {
      toggleUnresolvable.addEventListener('change', (e) => {
        this.unresolvableOverlayEnabled = e.target.checked;
        this.unresolvableGroup.visible = this.unresolvableOverlayEnabled;
        this.draw2DProjections();
      });
    }

    const toggleBands = document.getElementById('toggle-bands');
    if (toggleBands) {
      toggleBands.addEventListener('change', (e) => {
        this.bandPlanesVisible = e.target.checked;
        this.bandsGroup.visible = this.bandPlanesVisible;
      });
    }

    const toggleRotate = document.getElementById('toggle-rotate');
    if (toggleRotate) {
      toggleRotate.addEventListener('change', (e) => {
        this.autoRotate = e.target.checked;
        if (this.controls) this.controls.autoRotate = this.autoRotate;
      });
    }

    // Play / Pause Scrubber Button
    const playBtn = document.getElementById('btn-play-pause');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.isPlaying = !this.isPlaying;
        playBtn.innerHTML = this.isPlaying ? '❚❚ Pause' : '▶ Play';
      });
    }

    // Camera Preset Buttons
    document.querySelectorAll('[data-camera-preset]').forEach(el => {
      el.addEventListener('click', (e) => {
        const preset = e.currentTarget.getAttribute('data-camera-preset');
        this.setCameraPreset(preset);
      });
    });

    // Mobile Drawer Toggle
    const drawerToggle = document.getElementById('btn-toggle-drawer');
    const sidebar = document.querySelector('.explorer-sidebar');
    if (drawerToggle && sidebar) {
      drawerToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
      });
    }
  }

  initSliderRanges() {
    if (!this.cube) return;
    if (this.sliderT) {
      this.sliderT.min = 0;
      this.sliderT.max = this.cube.nT - 1;
    }
    if (this.sliderFc) {
      this.sliderFc.min = 0;
      this.sliderFc.max = this.cube.nFc - 1;
    }
    if (this.sliderFam) {
      this.sliderFam.min = 0;
      this.sliderFam.max = this.cube.nFam - 1;
    }
  }

  syncSlidersFromState() {
    if (this.sliderT) this.sliderT.value = this.tSlice;
    if (this.sliderFc) this.sliderFc.value = this.fcSlice;
    if (this.sliderFam) this.sliderFam.value = this.famSlice;
    this.updateReadoutHUD();
  }

  updateView() {
    if (this.viewMode === 'slices') {
      this.buildOrthogonalSlicePlanes();
    }
    this.draw2DProjections();
    this.updateReadoutHUD();
  }

  updateReadoutHUD() {
    if (!this.cube) return;

    const tVal = this.cube.axes.t[this.tSlice];
    const fcVal = this.cube.axes.fc[this.fcSlice];
    const famVal = this.cube.axes.fam[this.famSlice];
    const energy = this.cube.getVal(this.tSlice, this.fcSlice, this.famSlice);
    const band = this.cube.getBandName(fcVal, famVal);

    // Update Slider Badges with frequency AND period
    const tBadge = document.getElementById('val-t');
    const fcBadge = document.getElementById('val-fc');
    const famBadge = document.getElementById('val-fam');

    if (tBadge) tBadge.textContent = this.cube.formatTime(tVal);
    if (fcBadge) fcBadge.textContent = this.cube.formatFreq(fcVal);
    if (famBadge) famBadge.textContent = this.cube.formatFreq(famVal);

    // Update HUD Overlay
    const hudT = document.getElementById('hud-t');
    const hudFc = document.getElementById('hud-fc');
    const hudFam = document.getElementById('hud-fam');
    const hudEnergy = document.getElementById('hud-energy');
    const hudBand = document.getElementById('hud-band');

    if (hudT) hudT.textContent = this.cube.formatTime(tVal);
    if (hudFc) hudFc.textContent = this.cube.formatFreq(fcVal);
    if (hudFam) hudFam.textContent = this.cube.formatFreq(famVal);
    if (hudEnergy) hudEnergy.textContent = energy.toFixed(3);
    if (hudBand) hudBand.textContent = band;
  }

  updateBadgesAndInfo(config) {
    const badgeEl = document.getElementById('dataset-badge');
    if (badgeEl) {
      badgeEl.className = `badge ${config.badgeClass}`;
      badgeEl.textContent = config.badge;
    }

    const titleEl = document.getElementById('dataset-title');
    if (titleEl) titleEl.textContent = config.name;

    const guideList = document.getElementById('dataset-guide-list');
    if (guideList && config.guide) {
      guideList.innerHTML = config.guide.map(item => `<li>${item}</li>`).join('');
    }
  }
}

// ============================================================================
// Mini-Turntable Embeddable Factory for index.html
// ============================================================================
export function initMiniTurntable(canvasId, datasetId = 'synthetic') {
  const canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
  if (!canvas) return null;
  return new ExplorerApp({
    canvas3D: canvas,
    initialDataset: datasetId,
    miniTurntable: true
  });
}
