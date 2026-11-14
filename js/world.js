import * as THREE from 'three';
import { seeded, emojiSprite } from './util.js';

export const PITCH = 32, HALF = 12;
// Thirteen islands in a snake: 12 challenges + a party island.
const GRID = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [1, 3], [0, 3], [0, 4]];
export const N_CH = GRID.length - 1;
export const CENTER = { x: 32, z: 64 };
const BOX = new THREE.BoxGeometry(1, 1, 1);

// ----- 16x16 pixel textures, generated in code -----
function pixTex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function noise(ctx, colors, rnd, y0 = 0, y1 = 16) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < 16; x++) {
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]; ctx.fillRect(x, y, 1, 1);
  }
}
const PAL = {
  grass: ['#6fb44a', '#63a742', '#7bc152', '#5c9c3d'],
  dirt: ['#8a5e3c', '#7b5234', '#946843', '#6d482d'],
  stone: ['#9a9a9a', '#8c8c8c', '#a6a6a6', '#7f7f7f'],
  sand: ['#e6d59a', '#dccb8e', '#efdfa8'],
  leaves: ['#3f8a35', '#357a2d', '#4a9a3e', '#2d6a27'],
  water: ['#3f8fd8', '#4a9ae0', '#3585cc', '#5aa6e6'],
  wool: ['#ffffff', '#f3f3f3', '#eaeaea'],
  planks: ['#b8894f', '#b08148', '#c09257'],
  log: ['#6b4a2b', '#5f4126', '#775433'],
  brick: ['#b5553c', '#a94e37', '#c05e44'],
};

export class World {
  constructor(scene) {
    this.scene = scene; this.t = 0;
    this.bins = {}; this.colliders = []; this.bridges = []; this.clouds = [];
    this.plots = GRID.map(([gx, gz]) => ({ x: gx * PITCH, z: gz * PITCH }));
    this.dirs = [];
    for (let i = 0; i < N_CH; i++) this.dirs.push({ x: GRID[i + 1][0] - GRID[i][0], z: GRID[i + 1][1] - GRID[i][1] });
    this.makeMaterials();
    this.makeSky();
    this.plots.forEach((c, i) => this.makePlot(c, i));
    this.makeBridges();
    this.flush();
  }

  makeMaterials() {
    const r = seeded(7), T = {};
    for (const k in PAL) T[k] = pixTex((c) => noise(c, PAL[k], r));
    T.grassSide = pixTex((c) => {
      noise(c, PAL.dirt, r); noise(c, PAL.grass, r, 0, 3);
      for (let x = 0; x < 16; x++) if (r() < 0.5) { c.fillStyle = PAL.grass[0]; c.fillRect(x, 3, 1, 1); }
    });
    T.planks = pixTex((c) => { noise(c, PAL.planks, r); c.fillStyle = '#8f6636'; for (const y of [3, 7, 11, 15]) c.fillRect(0, y, 16, 1); });
    T.log = pixTex((c) => { noise(c, PAL.log, r); c.fillStyle = '#4f3620'; for (const x of [2, 6, 9, 13]) c.fillRect(x, 0, 1, 16); });
    T.logTop = pixTex((c) => { c.fillStyle = '#6b4a2b'; c.fillRect(0, 0, 16, 16); c.fillStyle = '#c9a26b'; c.fillRect(2, 2, 12, 12); c.fillStyle = '#a8834f'; c.fillRect(5, 5, 6, 6); });
    T.brick = pixTex((c) => {
      noise(c, PAL.brick, r); c.fillStyle = '#d8cfc4';
      for (const y of [3, 7, 11, 15]) c.fillRect(0, y, 16, 1);
      for (let row = 0; row < 4; row++) for (let x = row % 2 ? 4 : 0; x < 16; x += 8) c.fillRect(x, row * 4, 1, 3);
    });
    const M = (map, opt = {}) => new THREE.MeshLambertMaterial({ map, ...opt });
    const side = M(T.grassSide), logSide = M(T.log), logTop = M(T.logTop);
    this.mats = {
      grass: [side, side, M(T.grass), M(T.dirt), side, side],
      dirt: M(T.dirt), sand: M(T.sand), stone: M(T.stone), planks: M(T.planks), brick: M(T.brick),
      leaves: M(T.leaves), wool: M(T.wool),
      log: [logSide, logSide, logTop, logTop, logSide, logSide],
    };
    this.waterTex = T.water; this.waterTex.repeat.set(560, 560);
  }

  makeSky() {
    const s = this.scene;
    s.background = new THREE.Color('#8fd0f5');
    s.fog = new THREE.Fog('#8fd0f5', 70, 190);
    s.add(new THREE.HemisphereLight(0xffffff, 0x9fb58a, 1.25));
    const sun = this.sun = new THREE.DirectionalLight(0xfff3d6, 1.9);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 1; sc.far = 160;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    s.add(sun, sun.target);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.set(CENTER.x, -0.32, CENTER.z); water.receiveShadow = true; s.add(water);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ color: '#2f6fae' }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(CENTER.x, -1.6, CENTER.z); s.add(floor);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const r = seeded(21);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(BOX, white);
        m.scale.set(6 + r() * 8, 1.6, 4 + r() * 5); m.position.set((r() - 0.5) * 8, k * 0.8, (r() - 0.5) * 5); g.add(m);
      }
      g.position.set(-80 + r() * 230, 26 + r() * 10, -70 + r() * 270);
      s.add(g); this.clouds.push(g);
    }
    const sunBlock = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false }));
    sunBlock.scale.set(14, 14, 1); sunBlock.position.set(-50, 90, -170); sunBlock.lookAt(32, 0, 32); s.add(sunBlock);
  }

  // Queue a static block; everything is drawn with a few instanced meshes.
  put(type, x, y, z, sx = 1, sy = 1, sz = 1, color = null) {
    (this.bins[type] ||= []).push({ x, y, z, sx, sy, sz, color });
  }
  flush() {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
    for (const type in this.bins) {
      const list = this.bins[type];
      const im = new THREE.InstancedMesh(BOX, this.mats[type], list.length);
      list.forEach((b, i) => {
        m4.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sz));
        im.setMatrixAt(i, m4);
        if (type === 'wool') im.setColorAt(i, col.set(b.color || '#ffffff'));
      });
      im.castShadow = type !== 'grass' && type !== 'sand' && type !== 'dirt';
      im.receiveShadow = true;
      this.scene.add(im);
    }
  }
  circle(x, z, r) { this.colliders.push({ x, z, r }); }
  aabb(minX, maxX, minZ, maxZ) { this.colliders.push({ minX, maxX, minZ, maxZ }); }

  tree(x, z, h = 3) {
    for (let y = 0; y < h; y++) this.put('log', x, y + 0.5, z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx || dz) this.put('leaves', x + dx, h - 0.5, z + dz);
      this.put('leaves', x + dx, h + 0.5, z + dz);
    }
    this.put('leaves', x, h + 1.5, z);
    this.circle(x, z, 0.75);
  }
  flower(x, z, color) {
    this.put('wool', x, 0.2, z, 0.08, 0.4, 0.08, '#3f9a3a');
    this.put('wool', x, 0.47, z, 0.24, 0.2, 0.24, color);
  }
  house(x0, z0, w, d, h, wall, roof) {
    const door = Math.floor(w / 2);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) {
      if (i > 0 && i < w - 1 && j > 0 && j < d - 1) continue;
      for (let y = 0; y < h; y++) {
        const south = j === d - 1;
        if (south && i === door && y < 2) { this.put('wool', x0 + i, y + 0.5, z0 + j - 0.3, 0.9, 1, 0.2, '#6b4424'); continue; }
        if (south && y === 1 && (i === 1 || i === w - 2)) { this.put('wool', x0 + i, y + 0.5, z0 + j, 1, 1, 0.8, '#bfe6fa'); continue; }
        this.put(wall, x0 + i, y + 0.5, z0 + j);
      }
    }
    for (let k = 0; w + 2 - 2 * k > 0 && d + 2 - 2 * k > 0; k++)
      for (let i = -1 + k; i < w + 1 - k; i++) for (let j = -1 + k; j < d + 1 - k; j++)
        this.put('wool', x0 + i, h + k * 0.5 + 0.25, z0 + j, 1, 0.5, 1, roof);
    this.aabb(x0 - 0.5, x0 + w - 0.5, z0 - 0.5, z0 + d - 0.5);
  }

  makePlot(c, idx) {
    const r = seeded(100 + idx * 17);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
      const x = c.x - 11.5 + i, z = c.z - 11.5 + j, edge = i === 0 || j === 0 || i === 23 || j === 23;
      this.put(edge ? 'sand' : 'grass', x, -0.5, z);
      if (edge) this.put('dirt', x, -1.5, z);
    }
    const at = (dx, dz) => [c.x + dx, c.z + dz];
    const lane = (dx, dz) => (Math.abs(dx) < 3 && Math.abs(dz) > 7) || (Math.abs(dz) < 3 && Math.abs(dx) > 7);
    const skip = { 0: [0], 3: [1], 4: [0, 1], 9: [1] }[idx] || [];
    [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]].forEach(([dx, dz], k) => {
      if (!skip.includes(k)) this.tree(...at(dx, dz), 3 + Math.floor(r() * 2));
    });
    const colors = ['#ff6b8a', '#ffd23f', '#ffffff', '#b784f5', '#ff8c42'];
    for (let n = 0; n < 16; n++) {
      const dx = Math.floor(r() * 21) - 10 + 0.5, dz = Math.floor(r() * 21) - 10 + 0.5;
      if (Math.max(Math.abs(dx), Math.abs(dz)) < 8 || lane(dx, dz)) continue;
      this.flower(...at(dx, dz), colors[Math.floor(r() * colors.length)]);
    }
    const P = (type, dx, y, dz, sx, sy, sz, col) => this.put(type, c.x + dx, y, c.z + dz, sx, sy, sz, col);
    if (idx === 0) this.house(c.x - 9.5, c.z - 10.5, 5, 4, 3, 'planks', '#c0503c');
    if (idx === 1) { for (const dx of [5.5, 6.5, 7.5]) P('planks', dx, 0.25, -9.5, 1, 0.5, 1); }
    if (idx === 2) {
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (i || j) P('stone', 7.5 + i, 0.3, -7.5 + j, 1, 0.6, 1);
        else { P('wool', 7.5, 0.25, -7.5, 1, 0.5, 1, '#4a9ae0'); P('stone', 7.5, 0.9, -7.5, 0.4, 1.8, 0.4); P('wool', 7.5, 1.85, -7.5, 0.9, 0.15, 0.9, '#7fc4f5'); }
      }
      this.circle(c.x + 7.5, c.z - 7.5, 2);
    }
    if (idx === 3) this.house(c.x + 5.5, c.z - 10.5, 5, 4, 3, 'brick', '#5f7fb8');
    if (idx === 4) { // ice-cream stand
      for (const dx of [-1, 0, 1]) P('wool', dx, 0.5, -8, 1, 1, 1, dx ? '#ffd9e6' : '#ffffff');
      for (const dx of [-1.6, 1.6]) for (const dz of [-9.4, -7.6]) P('log', dx, 1.4, dz, 0.2, 2.8, 0.2);
      for (let i = 0; i < 4; i++) P('wool', -1.5 + i, 2.9, -8.5, 1, 0.25, 2.6, i % 2 ? '#ff8fb5' : '#ffffff');
      const sign = emojiSprite('🍦', 1.6); sign.position.set(c.x, 4.1, c.z - 8.5); this.scene.add(sign);
      this.aabb(c.x - 1.6, c.x + 1.6, c.z - 9.6, c.z - 7.5);
    }
    if (idx === 5) { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) P('wool', -7.5 + i, 0.03, 6.5 + j, 1, 0.06, 1, (i + j) % 2 ? '#e8524f' : '#ffffff'); }
    if (idx === 6) { // playground
      for (const dx of [5.5, 8.5]) { P('log', dx, 1.5, -8.5, 0.3, 3, 0.3); this.circle(c.x + dx, c.z - 8.5, 0.5); }
      P('planks', 7, 3.1, -8.5, 3.6, 0.25, 0.4); P('wool', 7, 0.9, -8.5, 0.8, 0.1, 0.4, '#f2b632');
      for (const s of [-0.35, 0.35]) P('wool', 7 + s, 2, -8.5, 0.04, 2.1, 0.04, '#888888');
      for (let k = 0; k < 3; k++) P('wool', -8.5 + k, 0.5 + k * 0.5, -8.5, 1, 1 + k, 1, ['#35b5b0', '#f2b632', '#e8524f'][k]);
      this.aabb(c.x - 9, c.x - 6, c.z - 9, c.z - 8);
    }
    if (idx === 7) { // goal
      for (const dx of [-2, 2]) { P('wool', dx, 1, -10, 0.2, 2, 0.2); this.circle(c.x + dx, c.z - 10, 0.3); }
      P('wool', 0, 2.1, -10, 4.2, 0.2, 0.2);
    }
    if (idx === 8) { // race track: start line, chequered finish line, flag
      for (let j = -3; j <= 3; j++) { P('wool', -6.5, 0.02, j, 0.3, 0.04, 1, '#ffffff'); P('wool', 7.5, 0.02, j, 0.6, 0.04, 1, j % 2 ? '#222222' : '#ffffff'); }
      P('log', 8.5, 1.3, -3.5, 0.16, 2.6, 0.16); P('wool', 9, 2.25, -3.5, 0.9, 0.6, 0.08, '#e8524f');
    }
    if (idx === 9) this.house(c.x + 5.5, c.z - 10.5, 5, 4, 3, 'planks', '#4caf6a');
    if (idx === 11) { // tall block (a ball gets stuck on it) and a quiet bench
      P('wool', 3.5, 1.25, -3.5, 1, 2.5, 1, '#8e6bd6'); this.circle(c.x + 3.5, c.z - 3.5, 0.8);
      for (const dx of [-7.5, -6.5]) P('planks', dx, 0.25, 6.5, 1, 0.5, 1);
    }
    if (idx === N_CH) { // party table with cake
      P('planks', 0, 0.45, -4, 3, 0.9, 1.4);
      P('wool', 0, 1.1, -4, 1, 0.4, 1, '#fff4f8'); P('wool', 0, 1.45, -4, 0.7, 0.3, 0.7, '#ff9ec4'); P('wool', 0, 1.7, -4, 0.1, 0.2, 0.1, '#ffd23f');
      this.aabb(c.x - 1.5, c.x + 1.5, c.z - 4.7, c.z - 3.3);
    }
  }

  makeBridges() {
    const plank = this.mats.planks;
    for (let i = 0; i < N_CH; i++) {
      const c = this.plots[i], d = this.dirs[i], lat = { x: d.z, z: d.x };
      const blocks = [];
      for (let k = 0; k < 8; k++) for (let l = -1; l <= 1; l++) {
        const m = new THREE.Mesh(BOX, plank);
        m.position.set(c.x + d.x * (12.5 + k) + lat.x * l, -0.5, c.z + d.z * (12.5 + k) + lat.z * l);
        m.receiveShadow = true; m.scale.setScalar(0.001); m.visible = false;
        if (l && k % 2 === 0) { const post = new THREE.Mesh(BOX, this.mats.log); post.scale.set(0.16, 0.9, 0.16); post.position.set(lat.x * l * 0.4, 0.95, lat.z * l * 0.4); post.castShadow = true; m.add(post); }
        this.scene.add(m); blocks.push({ m, at: -1, s: 0 });
      }
      const gate = new THREE.Group();
      for (let l = -1; l <= 1; l++) { const g = new THREE.Mesh(BOX, this.mats.log); g.scale.set(lat.x ? 1 : 0.3, 0.9, lat.z ? 1 : 0.3); g.position.set(lat.x * l, 0.45, lat.z * l); g.castShadow = true; gate.add(g); }
      const lock = emojiSprite('🔒', 1.1); lock.position.y = 1.9; gate.add(lock);
      gate.position.set(c.x + d.x * 11.5, 0, c.z + d.z * 11.5); this.scene.add(gate);
      const a = { x: c.x + d.x * 11.5, z: c.z + d.z * 11.5 }, b = { x: c.x + d.x * 20.5, z: c.z + d.z * 20.5 };
      const pad = (v) => (v ? 0 : 1.2);
      this.bridges.push({
        blocks, gate, open: false, t: 0,
        rect: { minX: Math.min(a.x, b.x) - pad(d.x), maxX: Math.max(a.x, b.x) + pad(d.x), minZ: Math.min(a.z, b.z) - pad(d.z), maxZ: Math.max(a.z, b.z) + pad(d.z) },
      });
    }
  }

  openBridge(i, animate = true) {
    const b = this.bridges[i]; if (!b || b.open) return;
    b.open = true; b.t = 0;
    b.blocks.forEach((bl, n) => { bl.at = animate ? 0.6 + Math.floor(n / 3) * 0.16 : 0; bl.m.visible = true; if (!animate) { bl.s = 1; bl.m.scale.setScalar(1); } });
    if (!animate) b.gate.visible = false;
  }
  closeAll() {
    for (const b of this.bridges) { b.open = false; b.gate.visible = true; b.gate.position.y = 0; b.blocks.forEach((bl) => { bl.s = 0; bl.at = -1; bl.m.visible = false; bl.m.scale.setScalar(0.001); }); }
  }

  walkable(x, z) {
    const lim = HALF - 0.35;
    for (const c of this.plots) if (Math.abs(x - c.x) <= lim && Math.abs(z - c.z) <= lim) return true;
    for (const b of this.bridges) if (b.open && x >= b.rect.minX && x <= b.rect.maxX && z >= b.rect.minZ && z <= b.rect.maxZ) return true;
    return false;
  }
  // Push a point out of static obstacles.
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
    this.waterTex.offset.set(this.t * 0.03, this.t * 0.02);
    for (const c of this.clouds) { c.position.x += dt * 0.8; if (c.position.x > 160) c.position.x = -90; }
    for (const b of this.bridges) {
      if (!b.open) continue;
      b.t += dt;
      if (b.gate.visible) { b.gate.position.y -= dt * 2.5; if (b.gate.position.y < -2.2) b.gate.visible = false; }
      for (const bl of b.blocks) {
        if (bl.s >= 1 || b.t < bl.at) continue;
        if (bl.s === 0 && bl === b.blocks[Math.floor(b.blocks.indexOf(bl) / 3) * 3]) onPop?.();
        bl.s = Math.min(1, bl.s + dt * 6); bl.m.scale.setScalar(bl.s * (2 - bl.s));
      }
    }
    const fx = Math.round(focus.x), fz = Math.round(focus.z);
    this.sun.position.set(fx + 28, 60, fz + 22); this.sun.target.position.set(fx, 0, fz);
  }
}
