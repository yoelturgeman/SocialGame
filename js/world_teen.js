import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { seeded, emojiSprite } from './util.js';

// World for the 10-16 section: a waterside campus with physically based materials,
// a real sky, reflections and soft shadows. Same layout contract as the voxel World.
const PITCH = 32, HALF = 12;
const GRID = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2]];

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}

export class TeenWorld {
  constructor(scene, renderer) {
    this.scene = scene; this.t = 0; this.N = GRID.length - 1; this.center = { x: 32, z: 32 };
    this.colliders = []; this.bridges = []; this.mats = {};
    this.plots = GRID.map(([gx, gz]) => ({ x: gx * PITCH, z: gz * PITCH }));
    this.dirs = [];
    for (let i = 0; i < this.N; i++) this.dirs.push({ x: GRID[i + 1][0] - GRID[i][0], z: GRID[i + 1][1] - GRID[i][1] });
    this.textures();
    this.sky(renderer);
    this.plots.forEach((c, i) => this.plot(c, i));
    this.makeBridges();
  }

  textures() {
    const r = seeded(11);
    this.grassTex = canvasTex(256, (c, s) => {
      c.fillStyle = '#5d9440'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) {
        c.strokeStyle = `hsl(${92 + r() * 26}, ${38 + r() * 22}%, ${26 + r() * 20}%)`;
        const x = r() * s, y = r() * s; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r() * 3 - 1.5, y - 2 - r() * 4); c.stroke();
      }
    }, 7);
    this.paveTex = canvasTex(256, (c, s) => {
      c.fillStyle = '#8f8a82'; c.fillRect(0, 0, s, s);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const v = 172 + r() * 34; c.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
        c.fillRect(x * 32 + (y % 2 ? 16 : 0) - 16 + 1.5, y * 32 + 1.5, 29, 29); c.fillRect(x * 32 + (y % 2 ? 16 : 0) + 240 + 1.5, y * 32 + 1.5, 29, 29);
      }
    }, 1);
    this.woodTex = canvasTex(128, (c, s) => {
      c.fillStyle = '#a8743f'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(70,40,15,${0.08 + r() * 0.2})`; const y = r() * s; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(40, y + r() * 6 - 3, 90, y + r() * 6 - 3, s, y); c.stroke(); }
    }, 1);
    this.noiseTex = canvasTex(256, (c, s) => {
      const img = c.createImageData(s, s);
      for (let i = 0; i < s * s; i++) { const v = 110 + r() * 60; img.data.set([v, v, v, 255], i * 4); }
      c.putImageData(img, 0, 0); c.filter = 'blur(3px)'; c.drawImage(c.canvas, 0, 0);
    }, 70);
    this.noiseTex.colorSpace = THREE.NoColorSpace;
  }

  mat(color, o = {}) {
    const key = color + JSON.stringify(o);
    return this.mats[key] || (this.mats[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o }));
  }
  add(geo, material, x, y, z, parent = this.scene, cast = true) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  box(w, h, d, color, x, y, z, o, parent) { return this.add(new THREE.BoxGeometry(w, h, d), typeof color === 'object' ? color : this.mat(color, o), x, y, z, parent); }
  cyl(rt, rb, h, color, x, y, z, o, parent) { return this.add(new THREE.CylinderGeometry(rt, rb, h, 24), this.mat(color, o), x, y, z, parent); }
  circle(x, z, r) { this.colliders.push({ x, z, r }); }
  aabb(minX, maxX, minZ, maxZ) { this.colliders.push({ minX, maxX, minZ, maxZ }); }

  sky(renderer) {
    const s = this.scene;
    const sky = new Sky(); sky.scale.setScalar(10000);
    const u = sky.material.uniforms;
    u.turbidity.value = 3.5; u.rayleigh.value = 1.1; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 42), THREE.MathUtils.degToRad(35));
    u.sunPosition.value.copy(this.sunDir);
    // image-based lighting from the sky gives soft ambient light and reflections
    const pm = new THREE.PMREMGenerator(renderer), tmp = new THREE.Scene(); tmp.add(sky);
    s.environment = pm.fromScene(tmp, 0, 1, 20000).texture; s.environmentIntensity = 0.55;
    s.add(sky);
    s.fog = new THREE.Fog(0xc9dcec, 90, 300);
    s.add(new THREE.HemisphereLight(0xdcecff, 0x6f8552, 0.5));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 200;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    s.add(sun, sun.target);
    this.water = this.add(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ color: 0x2c7a9c, roughness: 0.08, metalness: 0.35, bumpMap: this.noiseTex, bumpScale: 0.8, transparent: true, opacity: 0.93 }), 32, -0.5, 32, s, false);
    this.water.rotation.x = -Math.PI / 2;
    const bed = this.add(new THREE.PlaneGeometry(700, 700), this.mat('#1d4d63'), 32, -2.2, 32, s, false); bed.rotation.x = -Math.PI / 2;
    // distant hills for depth
    const r = seeded(5);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + r() * 0.3, d = 150 + r() * 60;
      const h = this.add(new THREE.SphereGeometry(1, 24, 12), this.mat(i % 3 ? '#5f8a52' : '#6d9a5c', { roughness: 1 }), 32 + Math.cos(a) * d, -3, 32 + Math.sin(a) * d, s, false);
      h.scale.set(30 + r() * 30, 10 + r() * 14, 30 + r() * 30);
    }
  }

  tree(x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); this.scene.add(g);
    this.cyl(0.16, 0.26, 2.4, '#6a4a2e', 0, 1.2, 0, { roughness: 1 }, g);
    const greens = ['#4f8f3a', '#5c9c44', '#467f34', '#69a84e'];
    [[0, 3.2, 0, 1.5], [0.9, 2.7, 0.3, 1.05], [-0.8, 2.8, -0.4, 1.1], [0.1, 2.6, 0.9, 0.95], [0.2, 4.1, -0.2, 0.9]].forEach(([px, py, pz, pr], i) => {
      const b = this.add(new THREE.IcosahedronGeometry(pr, 2), this.mat(greens[i % 4], { roughness: 1 }), px, py, pz, g);
      b.scale.y = 0.85;
    });
    this.circle(x, z, 0.5 * s);
  }
  bench(x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
    const wood = new THREE.MeshStandardMaterial({ map: this.woodTex, roughness: 0.7 });
    for (const dz of [-0.16, 0, 0.16]) this.box(1.9, 0.05, 0.13, wood, 0, 0.47, dz, null, g);
    for (const dy of [0.72, 0.9]) this.box(1.9, 0.13, 0.05, wood, 0, dy, -0.27, null, g);
    for (const dx of [-0.8, 0.8]) { this.box(0.07, 0.47, 0.5, '#2c3138', dx, 0.235, 0, { metalness: 0.6, roughness: 0.4 }, g); this.box(0.07, 0.55, 0.06, '#2c3138', dx, 0.72, -0.27, { metalness: 0.6, roughness: 0.4 }, g); }
    this.circle(x, z, 0.75);
  }
  lamp(x, z) {
    this.cyl(0.06, 0.09, 3.4, '#2c3138', x, 1.7, z, { metalness: 0.7, roughness: 0.35 });
    this.add(new THREE.SphereGeometry(0.22, 16, 12), this.mat('#fff6dd', { emissive: '#ffe9b0', emissiveIntensity: 0.8 }), x, 3.5, z, this.scene, false);
    this.circle(x, z, 0.2);
  }
  hedge(x, z, w, d) { this.box(w, 0.9, d, '#3f7a35', x, 0.45, z, { roughness: 1 }); this.aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2); }
  building(x, z, w, d, h, color, sign, awning) {
    this.box(w, h, d, color, x, h / 2, z, { roughness: 0.9 });
    this.box(w + 0.6, 0.3, d + 0.6, '#4a4f58', x, h + 0.15, z);
    const glass = this.mat('#a9d6f5', { roughness: 0.08, metalness: 0.5 });
    const n = Math.max(2, Math.floor(w / 2.4));
    for (let i = 0; i < n; i++) {
      const wx = x - w / 2 + (i + 0.5) * (w / n);
      if (Math.abs(wx - x) < 0.9 && n % 2) { this.box(1.2, 2.3, 0.1, '#5a3d28', wx, 1.15, z + d / 2 + 0.03); continue; }
      this.box(1.3, 1.5, 0.08, glass, wx, h * 0.55, z + d / 2 + 0.03);
    }
    if (awning) { const a = this.box(w * 0.9, 0.1, 1.6, awning, x, h * 0.86, z + d / 2 + 0.75); a.rotation.x = 0.22; }
    if (sign) { const sp = emojiSprite(sign, 1.5); sp.position.set(x, h + 1.3, z + d / 2); this.scene.add(sp); }
    this.aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }

  plot(c, i) {
    const s = this.scene, at = (dx, dz) => [c.x + dx, c.z + dz];
    this.box(24.8, 1.8, 24.8, '#9a958c', c.x, -1.0, c.z, { roughness: 0.95 });
    this.add(new THREE.BoxGeometry(24, 0.3, 24), new THREE.MeshStandardMaterial({ map: this.grassTex, roughness: 1 }), c.x, -0.15, c.z, s, false);
    // paved centre and walkways towards the bridges
    const pave = new THREE.MeshStandardMaterial({ map: this.paveTex, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const disc = this.add(new THREE.CircleGeometry(5.2, 48), pave, c.x, 0.012, c.z, s, false); disc.rotation.x = -Math.PI / 2;
    disc.geometry.attributes.uv.array.forEach((v, k, a) => { a[k] = (v - 0.5) * 3.2; });
    const lanes = [];
    if (i > 0) lanes.push({ x: -this.dirs[i - 1].x, z: -this.dirs[i - 1].z });
    if (i < this.N) lanes.push(this.dirs[i]);
    for (const d of lanes) {
      const p = this.add(new THREE.PlaneGeometry(3, 7.6), pave, c.x + d.x * 8.3, 0.012, c.z + d.z * 8.3, s, false);
      p.rotation.x = -Math.PI / 2; if (d.x) p.rotation.z = Math.PI / 2;
      p.geometry.attributes.uv.array.forEach((v, k, a) => { a[k] = v * (k % 2 ? 2.4 : 1); });
    }
    const isLane = (dx, dz) => lanes.some((d) => (d.x && Math.sign(dx) === d.x && Math.abs(dz) < 3.5 && Math.abs(dx) > 5) || (d.z && Math.sign(dz) === d.z && Math.abs(dx) < 3.5 && Math.abs(dz) > 5));
    const skip = { 1: [0, 1], 3: [1], 4: [0, 1], 7: [0, 1] }[i] || [];
    [[-9.6, -9.6], [9.6, -9.6], [-9.6, 9.6], [9.6, 9.6]].forEach(([dx, dz], k) => { if (!skip.includes(k)) this.tree(...at(dx, dz), 0.95 + (k * 7 + i) % 3 * 0.12); });
    for (const [dx, dz] of [[-7.2, 7.2], [7.2, 7.2]]) if (!isLane(dx, dz)) this.lamp(...at(dx, dz));

    const B = (w, h, d, col, dx, y, dz, o) => this.box(w, h, d, col, c.x + dx, y, c.z + dz, o);
    if (i === 0) { // quiet garden with a pond
      const pond = this.add(new THREE.CircleGeometry(2.4, 40), this.mat('#2c7a9c', { roughness: 0.05, metalness: 0.4 }), c.x - 6.5, 0.05, c.z - 6.5, s, false); pond.rotation.x = -Math.PI / 2;
      const rim = this.add(new THREE.TorusGeometry(2.5, 0.22, 10, 40), this.mat('#b3aca0'), c.x - 6.5, 0.1, c.z - 6.5); rim.rotation.x = Math.PI / 2;
      this.circle(c.x - 6.5, c.z - 6.5, 2.8);
      this.bench(...at(4.5, -8.5)); this.hedge(...at(0, -11), 8, 0.9);
    }
    if (i === 1) { // cafe
      this.building(c.x, c.z - 9.5, 11, 4, 4.2, '#efe2c8', '☕', '#c0503c');
      for (const dx of [-6, 6]) { this.cyl(0.65, 0.65, 0.06, '#f4f1ea', c.x + dx, 0.78, c.z - 4.6); this.cyl(0.06, 0.06, 0.78, '#2c3138', c.x + dx, 0.39, c.z - 4.6, { metalness: 0.6 }); this.circle(c.x + dx, c.z - 4.6, 0.8); }
    }
    if (i === 2) { // project yard: poster board
      B(3.6, 2.2, 0.1, '#fbfaf5', 0, 1.9, -7); for (const dx of [-1.5, 1.5]) B(0.1, 2.9, 0.1, '#2c3138', dx, 1.45, -7.1, { metalness: 0.6 });
      this.aabb(c.x - 1.9, c.x + 1.9, c.z - 7.4, c.z - 6.7); this.bench(...at(-7.5, -3), Math.PI / 2);
    }
    if (i === 3) { this.building(c.x + 6.5, c.z - 9.3, 8, 4, 4.6, '#6e63b8', '🎮', '#f2b632'); for (const dx of [-8.4, -5.6]) { this.cyl(0.07, 0.07, 2, '#ffffff', c.x + dx, 1, c.z + 8.5); this.circle(c.x + dx, c.z + 8.5, 0.2); } B(2.9, 0.1, 0.1, '#ffffff', -7, 2, 8.5); }
    if (i === 4) { // debate corner: backdrop and steps for the audience
      B(7, 3, 0.2, '#31496b', 0, 1.9, -8.6); for (const dx of [-3.3, 3.3]) B(0.14, 3.6, 0.14, '#2c3138', dx, 1.8, -8.6, { metalness: 0.6 });
      const sp = emojiSprite('💬', 1.6); sp.position.set(c.x, 2.2, c.z - 8.4); s.add(sp);
      this.aabb(c.x - 3.6, c.x + 3.6, c.z - 9, c.z - 8.3);
    }
    if (i === 5) { this.tree(...at(-5.5, -6.5), 1.9); this.bench(...at(3, -7.5)); this.hedge(...at(8, -11), 6, 0.9); }
    if (i === 6) { // fence and a skate ramp
      for (let k = -5; k <= 5; k++) this.cyl(0.05, 0.05, 2.2, '#70777f', c.x - 10.8, 1.1, c.z + k * 2, { metalness: 0.7, roughness: 0.4 });
      this.add(new THREE.BoxGeometry(0.04, 2, 20), new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.6, roughness: 0.5, transparent: true, opacity: 0.35 }), c.x - 10.8, 1.15, c.z, s, false);
      const ramp = B(3, 0.14, 3.4, '#8a6b4a', 7, 0.62, 6.5); ramp.rotation.z = 0.4; this.aabb(c.x + 5.5, c.x + 8.6, c.z + 4.8, c.z + 8.2);
    }
    if (i === 7) { // bus stop
      for (const dx of [-2, 2]) for (const dz of [-9.2, -7.8]) B(0.1, 2.7, 0.1, '#2c3138', dx, 1.35, dz, { metalness: 0.6 });
      B(4.5, 0.12, 2, '#3b4654', 0, 2.75, -8.5); this.add(new THREE.BoxGeometry(4, 2, 0.05), new THREE.MeshStandardMaterial({ color: '#bfe3f7', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35 }), c.x, 1.4, c.z - 9.2, s, false);
      this.bench(...at(0, -8.6)); const sp = emojiSprite('🚌', 1.3); sp.position.set(c.x + 2.9, 3.2, c.z - 8); s.add(sp);
    }
    if (i === 8) { // plaza fountain
      this.cyl(2.3, 2.5, 0.55, '#b3aca0', c.x, 0.27, c.z - 6.5); const w = this.add(new THREE.CircleGeometry(2.05, 40), this.mat('#3a8fb5', { roughness: 0.05, metalness: 0.4 }), c.x, 0.56, c.z - 6.5, s, false); w.rotation.x = -Math.PI / 2;
      this.cyl(0.25, 0.35, 1.6, '#b3aca0', c.x, 1.1, c.z - 6.5); this.cyl(0.9, 0.3, 0.25, '#b3aca0', c.x, 1.95, c.z - 6.5); this.circle(c.x, c.z - 6.5, 2.7);
    }
  }

  makeBridges() {
    const stone = this.mat('#a8a299', { roughness: 0.9 }), metal = this.mat('#2c3138', { metalness: 0.7, roughness: 0.35 });
    for (let i = 0; i < this.N; i++) {
      const c = this.plots[i], d = this.dirs[i], g = new THREE.Group();
      g.position.set(c.x + d.x * 16, 0, c.z + d.z * 16); g.rotation.y = d.x ? 0 : Math.PI / 2; this.scene.add(g);
      this.box(8.4, 0.4, 3.4, stone, 0, -0.2, 0, null, g);
      for (const sz of [-1.6, 1.6]) {
        this.box(8.4, 0.08, 0.1, metal, 0, 0.95, sz, null, g);
        for (let k = -4; k <= 4; k += 2) this.box(0.08, 0.95, 0.08, metal, k, 0.47, sz, null, g);
      }
      // barrier gate: red bar that lifts and turns green when the island is completed
      const gate = new THREE.Group(); gate.position.set(c.x + d.x * 11.7, 0, c.z + d.z * 11.7); gate.rotation.y = d.x ? Math.PI / 2 : 0; this.scene.add(gate);
      for (const sx of [-1.7, 1.7]) this.cyl(0.1, 0.12, 1.3, '#2c3138', sx, 0.65, 0, { metalness: 0.7, roughness: 0.35 }, gate);
      const arm = new THREE.Group(); arm.position.set(-1.7, 1.1, 0); gate.add(arm);
      const barMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e5484d', emissiveIntensity: 0.9, roughness: 0.5 });
      this.add(new THREE.BoxGeometry(3.4, 0.14, 0.14), barMat, 1.7, 0, 0, arm);
      const lock = emojiSprite('🔒', 1.0); lock.position.y = 2.1; gate.add(lock);
      const a = { x: c.x + d.x * 11.5, z: c.z + d.z * 11.5 }, b = { x: c.x + d.x * 20.5, z: c.z + d.z * 20.5 }, pad = (v) => (v ? 0 : 1.25);
      this.bridges.push({
        open: false, arm, barMat, lock, lift: 0, popped: true,
        rect: { minX: Math.min(a.x, b.x) - pad(d.x), maxX: Math.max(a.x, b.x) + pad(d.x), minZ: Math.min(a.z, b.z) - pad(d.z), maxZ: Math.max(a.z, b.z) + pad(d.z) },
      });
    }
  }
  openBridge(i, animate = true) {
    const b = this.bridges[i]; if (!b || b.open) return;
    b.open = true; b.lock.visible = false; b.barMat.emissive.set('#3ccf6e'); b.popped = !animate;
    if (!animate) { b.lift = 1; b.arm.rotation.z = 1.45; }
  }

  walkable(x, z) {
    const lim = HALF - 0.35;
    for (const c of this.plots) if (Math.abs(x - c.x) <= lim && Math.abs(z - c.z) <= lim) return true;
    for (const b of this.bridges) if (b.open && x >= b.rect.minX && x <= b.rect.maxX && z >= b.rect.minZ && z <= b.rect.maxZ) return true;
    return false;
  }
  resolve(p, r) {
    for (const c of this.colliders) {
      if (c.r !== undefined) {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
        if (d < m && d > 1e-4) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
      } else if (p.x > c.minX - r && p.x < c.maxX + r && p.z > c.minZ - r && p.z < c.maxZ + r) {
        const l = p.x - (c.minX - r), rr = c.maxX + r - p.x, t = p.z - (c.minZ - r), b = c.maxZ + r - p.z, m = Math.min(l, rr, t, b);
        if (m === l) p.x = c.minX - r; else if (m === rr) p.x = c.maxX + r; else if (m === t) p.z = c.minZ - r; else p.z = c.maxZ + r;
      }
    }
  }

  update(dt, focus, onPop) {
    this.t += dt;
    this.noiseTex.offset.set(this.t * 0.012, this.t * 0.008);
    for (const b of this.bridges) {
      if (!b.open || b.lift >= 1) continue;
      if (!b.popped) { b.popped = true; onPop?.(); }
      b.lift = Math.min(1, b.lift + dt * 0.9); b.arm.rotation.z = 1.45 * b.lift * (2 - b.lift);
    }
    const fx = Math.round(focus.x), fz = Math.round(focus.z);
    this.sun.position.set(fx + this.sunDir.x * 90, this.sunDir.y * 90, fz + this.sunDir.z * 90); this.sun.target.position.set(fx, 0, fz);
  }
}
