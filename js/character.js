import * as THREE from 'three';
import { clamp, angDiff, rand, EMOJI_FONT } from './util.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const mats = {};
const mat = (c) => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));

// ---------- pixel-art faces (expressions are the main teaching cue) ----------
export function drawFace(ctx, S, skin, expr = 'neutral', blink = false, ox = 0, oy = 0) {
  const u = S / 32;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * u, oy + y * u, w * u, h * u); };
  const dark = '#2b2230', brow = '#4a3a34';
  R(0, 0, 32, 32, skin);
  const big = expr === 'scared' || expr === 'surprised';
  const eye = (x) => {
    if (blink || expr === 'cry' || expr === 'laugh') {
      R(x, 15, 4, 1, dark);
      if (expr === 'cry') { R(x + 1, 17, 2, 3, '#5db7ff'); R(x + 1, 21, 2, 2, '#5db7ff'); }
    } else if (expr === 'joy') {
      R(x, 14, 1, 2, dark); R(x + 1, 13, 2, 1, dark); R(x + 3, 14, 1, 2, dark);
    } else if (big) {
      R(x, 11, 4, 6, '#fff'); R(x + 1, 13, 2, 2, dark);
    } else {
      R(x, 13, 4, 4, '#fff'); R(x + 1, 14, 2, 3, dark);
    }
  };
  eye(7); eye(21);
  // eyebrows
  const by = big ? 8 : 10;
  if (expr === 'angry') { R(6, by - 1, 3, 1, brow); R(9, by + 1, 3, 1, brow); R(20, by + 1, 3, 1, brow); R(23, by - 1, 3, 1, brow); }
  else if (['sad', 'cry', 'scared', 'uneasy'].includes(expr)) { R(6, by + 1, 3, 1, brow); R(9, by - 1, 3, 1, brow); R(20, by - 1, 3, 1, brow); R(23, by + 1, 3, 1, brow); }
  else if (expr === 'puzzled') { R(6, 10, 5, 1, brow); R(21, 8, 5, 1, brow); }
  else if (expr !== 'joy' && expr !== 'laugh') { R(6, by, 5, 1, brow); R(21, by, 5, 1, brow); }
  // mouth
  switch (expr) {
    case 'happy': R(11, 22, 1, 1, dark); R(12, 23, 8, 1, dark); R(20, 22, 1, 1, dark); break;
    case 'joy': case 'laugh': R(11, 21, 10, 1, dark); R(12, 22, 8, 3, dark); R(13, 24, 6, 1, '#e2606a'); break;
    case 'sad': case 'angry': R(11, 24, 1, 1, dark); R(12, 23, 8, 1, dark); R(20, 24, 1, 1, dark); break;
    case 'cry': R(12, 22, 8, 1, dark); R(12, 23, 1, 2, dark); R(19, 23, 1, 2, dark); R(13, 23, 6, 2, '#7a2e3a'); break;
    case 'uneasy': for (let i = 0; i < 8; i++) R(12 + i, 23 + (i % 2), 1, 1, dark); break;
    case 'puzzled': R(14, 23, 5, 1, dark); R(19, 22, 1, 1, dark); break;
    case 'surprised': case 'scared': R(14, 21, 4, 4, dark); R(15, 22, 2, 2, '#7a2e3a'); break;
    default: R(13, 23, 6, 1, dark);
  }
  if (expr === 'happy' || expr === 'joy') { R(4, 19, 3, 1, '#f29a9a'); R(25, 19, 3, 1, '#f29a9a'); }
  if (expr === 'angry') { R(4, 18, 3, 2, '#e8836f'); R(25, 18, 3, 2, '#e8836f'); }
}

// ---------- smooth faces and shared geometry for the 10-16 section ----------
const smats = {};
const smat = (c, rough = 0.75) => smats[c + rough] || (smats[c + rough] = new THREE.MeshStandardMaterial({ color: c, roughness: rough }));
const SPH = new THREE.SphereGeometry(1, 28, 20);
const HEMI = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45);
const FACE_GEO = new THREE.SphereGeometry(1, 24, 18, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.8, 1.6);
const caps = {};
const capsule = (r, len) => caps[r + '_' + len] || (caps[r + '_' + len] = new THREE.CapsuleGeometry(r, len, 8, 18));

export function drawFaceSmooth(ctx, S, expr = 'neutral', blink = false, ox = 0, oy = 0) {
  ctx.save(); ctx.translate(ox, oy); ctx.scale(S / 100, S / 100);
  if (!ox && !oy) ctx.clearRect(0, 0, 100, 100);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const dark = '#2a2028';
  const ell = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
  const curve = (x0, y0, cx, cy, x1, y1, w = 3, c = dark) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); };
  const big = expr === 'scared' || expr === 'surprised';
  if (expr === 'happy' || expr === 'joy') { ell(21, 61, 7, 5, 'rgba(240,120,120,0.32)'); ell(79, 61, 7, 5, 'rgba(240,120,120,0.32)'); }
  if (expr === 'angry') { ell(21, 60, 7, 5, 'rgba(230,80,60,0.4)'); ell(79, 60, 7, 5, 'rgba(230,80,60,0.4)'); }
  for (const x of [33, 67]) {
    if (blink || expr === 'cry' || expr === 'laugh') {
      curve(x - 6, 47, x, 51, x + 6, 47);
      if (expr === 'cry') { ell(x, 58, 2.4, 5, '#5db7ff'); ell(x, 70, 2, 3.4, '#5db7ff'); }
    } else if (expr === 'joy') curve(x - 6, 49, x, 40, x + 6, 49);
    else { ell(x, 46, big ? 7.5 : 6.5, big ? 10 : 7.5, '#ffffff'); ell(x, 47, big ? 3.2 : 4.2, big ? 3.2 : 4.4, '#3b2a22'); ell(x + 1.5, 45, 1.2, 1.2, '#ffffff'); }
  }
  const by = big ? 30 : 34;
  let o = by, n = by - 1, ro = by, rn = by - 1;   // outer / inner brow heights, left and right
  if (expr === 'angry') { o = ro = by - 3; n = rn = by + 4; }
  else if (['sad', 'cry', 'scared', 'uneasy'].includes(expr)) { o = ro = by + 3; n = rn = by - 3; }
  else if (expr === 'puzzled') { ro = rn = by - 6; }
  else if (expr === 'joy' || expr === 'laugh') { o = ro = by - 2; n = rn = by - 4; }
  curve(25, o, 33, (o + n) / 2 - 1.5, 41, n, 3, '#3a2c28'); curve(75, ro, 67, (ro + rn) / 2 - 1.5, 59, rn, 3, '#3a2c28');
  curve(48, 60, 50, 63, 52, 60, 2, 'rgba(0,0,0,0.2)');   // nose
  switch (expr) {
    case 'happy': curve(40, 71, 50, 80, 60, 71); break;
    case 'joy': case 'laugh':
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(37, 69); ctx.lineTo(63, 69); ctx.quadraticCurveTo(50, 92, 37, 69); ctx.fill(); ell(50, 79, 6, 3.2, '#e2606a'); break;
    case 'sad': case 'angry': curve(40, 77, 50, 69, 60, 77); break;
    case 'cry': ell(50, 76, 7, 4.5, dark); break;
    case 'uneasy':
      ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(39, 74);
      for (let i = 1; i <= 4; i++) ctx.lineTo(39 + i * 5.5, 74 + (i % 2 ? -2.5 : 2.5));
      ctx.stroke(); break;
    case 'puzzled': curve(43, 75, 50, 74, 57, 72); break;
    case 'surprised': case 'scared': ell(50, 75, 4.5, 6, dark); break;
    default: curve(43, 74, 50, 74.5, 57, 74);
  }
  ctx.restore();
}

// 2D portrait for HTML buttons (avatar picker, pass targets).
export function faceIcon(look, expr = 'happy') {
  const c = document.createElement('canvas'); c.width = c.height = 80;
  const ctx = c.getContext('2d');
  if (look.smooth) {
    ctx.fillStyle = look.hair;
    if (look.style === 'long') { ctx.beginPath(); ctx.roundRect(8, 18, 64, 62, 22); ctx.fill(); }
    if (look.style === 'curly') for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(12 + i * 7, 20 - Math.sin(i / 8 * Math.PI) * 10, 9, 0, 7); ctx.fill(); }
    if (look.style === 'pony') { ctx.beginPath(); ctx.ellipse(70, 40, 7, 18, 0.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(40, 44, 27, 32, 0, 0, 7); ctx.fill();
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(40, 30, 29, 22, 0, Math.PI, Math.PI * 2); ctx.quadraticCurveTo(40, 22, 11, 30); ctx.fill();
    drawFaceSmooth(ctx, 62, expr, false, 9, 13);
    return c.toDataURL();
  }
  ctx.fillStyle = look.hair; ctx.fillRect(4, 0, 72, look.style === 'long' ? 80 : 40);
  if (look.style === 'curly') ctx.fillRect(0, 0, 80, 34);
  if (look.style === 'pony') ctx.fillRect(66, 20, 14, 36);
  drawFace(ctx, 64, look.skin, expr, false, 8, 12);
  ctx.fillStyle = look.hair; ctx.fillRect(8, 8, 64, 12);
  return c.toDataURL();
}

// ---------- blocky animated character ----------
export class Character {
  constructor(look) {
    this.look = look;
    this.root = new THREE.Group();
    this.root.scale.setScalar(look.scale || 0.92);
    this.body = new THREE.Group(); this.root.add(this.body);
    this.upper = new THREE.Group(); this.upper.position.y = 0.6; this.body.add(this.upper);
    const part = (parent, w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(BOX, mat(color));
      m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
    };
    const { skin, hair, shirt, pants } = look;
    const limb = (parent, x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
    if (look.smooth) this.buildSmooth(limb); else {
    part(this.upper, 0.5, 0.6, 0.28, shirt, 0, 0.3, 0);
    if (look.skirt) part(this.body, 0.58, 0.26, 0.38, pants, 0, 0.55, 0);
    this.legL = limb(this.body, 0.125, 0.6); this.legR = limb(this.body, -0.125, 0.6);
    for (const l of [this.legL, this.legR]) {
      part(l, 0.23, 0.5, 0.23, look.skirt ? skin : pants, 0, -0.25, 0);
      part(l, 0.24, 0.1, 0.28, '#3a3038', 0, -0.55, 0.02);
    }
    this.armL = limb(this.upper, 0.345, 0.55); this.armR = limb(this.upper, -0.345, 0.55);
    for (const a of [this.armL, this.armR]) {
      part(a, 0.19, 0.3, 0.19, shirt, 0, -0.1, 0);
      part(a, 0.16, 0.3, 0.16, skin, 0, -0.39, 0);
    }
    this.head = limb(this.upper, 0, 0.6);
    part(this.head, 0.46, 0.46, 0.46, skin, 0, 0.24, 0);
    // face
    this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = this.faceCanvas.height = 32;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas);
    this.faceTex.magFilter = THREE.NearestFilter; this.faceTex.minFilter = THREE.NearestFilter;
    this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshLambertMaterial({ map: this.faceTex }));
    face.position.set(0, 0.24, 0.232); this.head.add(face);
    // hair
    const st = look.style;
    const cap = st === 'curly' ? 0.58 : 0.5;
    part(this.head, cap, st === 'curly' ? 0.2 : 0.12, cap, hair, 0, st === 'curly' ? 0.5 : 0.49, 0);
    part(this.head, 0.5, 0.07, 0.06, hair, 0, 0.44, 0.24);
    const long = st === 'long';
    part(this.head, cap, long ? 0.72 : 0.36, 0.09, hair, 0, long ? 0.1 : 0.29, -0.25);
    for (const sx of [1, -1]) part(this.head, 0.07, long ? 0.6 : 0.26, 0.36, hair, sx * (cap / 2 - 0.01), long ? 0.16 : 0.33, -0.07);
    if (st === 'pony') { part(this.head, 0.14, 0.4, 0.14, hair, 0, 0.2, -0.36); part(this.head, 0.1, 0.1, 0.1, look.shirt, 0, 0.38, -0.32); }
    }
    // props
    this.props = {};
    const book = new THREE.Group(); book.position.set(0, 0.26, 0.36); book.rotation.x = -0.7;
    part(book, 0.34, 0.24, 0.05, '#c0392b', 0, 0, 0); part(book, 0.3, 0.2, 0.02, '#f6f1e4', 0, 0, 0.03);
    this.upper.add(book); this.props.book = book;
    const ice = new THREE.Group(); ice.position.set(0, -0.6, 0);
    part(ice, 0.1, 0.18, 0.1, '#d9a066', 0, 0, 0); part(ice, 0.17, 0.15, 0.17, '#ff9ec4', 0, -0.15, 0);
    this.armR.add(ice); this.props.icecream = ice;
    const bal = new THREE.Group(); bal.position.set(0.55, 2.2, 0);
    part(bal, 0.42, 0.48, 0.42, '#ef5350', 0, 0, 0); part(bal, 0.02, 1.0, 0.02, '#ffffff', 0, -0.72, 0);
    this.root.add(bal); this.props.balloon = bal;
    const phone = new THREE.Group(); phone.position.set(0, -0.6, 0.05);
    part(phone, 0.1, 0.19, 0.025, '#1d2330', 0, 0, 0); part(phone, 0.085, 0.16, 0.01, '#8fd0ff', 0, 0, 0.012);
    this.armR.add(phone); this.props.phone = phone;
    for (const k in this.props) this.props[k].visible = false;
    // speech / emotion bubble
    this.bubCanvas = document.createElement('canvas'); this.bubCanvas.width = 256; this.bubCanvas.height = 128;
    this.bubTex = new THREE.CanvasTexture(this.bubCanvas); this.bubTex.colorSpace = THREE.SRGBColorSpace;
    this.bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubTex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.bub.position.y = 2.45; this.bub.renderOrder = 10; this.bub.visible = false;
    this.root.add(this.bub);
    this.bubT = 0; this.bubDur = 0;

    this.anim = 'idle'; this.gest = null; this.gestT = 0; this.sit = false;
    this.expr = 'neutral'; this.blink = false; this.blinkT = rand(1, 4); this.faceKey = '';
    this.t = rand(0, 10); this.phase = 0; this.headYaw = 0;
    this.cur = this.pose();
    this.redraw();
  }

  // Rounded, physically shaded body for the 10-16 section (same joints as the blocky one).
  buildSmooth(limb) {
    const { skin, hair, shirt, pants, style } = this.look;
    const add = (parent, geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rough = 0.75) => {
      const m = new THREE.Mesh(geo, smat(color, rough)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
    };
    add(this.upper, capsule(0.17, 0.28), shirt, 0, 0.31, 0, 1.06, 1, 0.74);
    add(this.body, SPH, pants, 0, 0.6, 0, 0.19, 0.14, 0.14);
    this.legL = limb(this.body, 0.1, 0.6); this.legR = limb(this.body, -0.1, 0.6);
    for (const l of [this.legL, this.legR]) { add(l, capsule(0.078, 0.4), pants, 0, -0.27, 0); add(l, SPH, '#2d2a32', 0, -0.555, 0.045, 0.085, 0.048, 0.145, 0.5); }
    this.armL = limb(this.upper, 0.25, 0.54); this.armR = limb(this.upper, -0.25, 0.54);
    for (const a of [this.armL, this.armR]) { add(a, capsule(0.058, 0.2), shirt, 0, -0.12, 0); add(a, capsule(0.045, 0.2), skin, 0, -0.38, 0); add(a, SPH, skin, 0, -0.55, 0, 0.052, 0.06, 0.045); }
    add(this.upper, capsule(0.05, 0.06), skin, 0, 0.62, 0);
    this.head = limb(this.upper, 0, 0.62);
    add(this.head, SPH, skin, 0, 0.21, 0, 0.165, 0.19, 0.175);
    for (const sx of [1, -1]) add(this.head, SPH, skin, sx * 0.163, 0.2, 0, 0.025, 0.04, 0.03);
    this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = this.faceCanvas.height = 128;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas); this.faceTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(FACE_GEO, new THREE.MeshStandardMaterial({ map: this.faceTex, transparent: true, roughness: 0.75 }));
    face.position.y = 0.21; face.scale.set(0.167, 0.192, 0.177); this.head.add(face);
    const H = (x, y, z, sx, sy, sz) => add(this.head, SPH, hair, x, y, z, sx, sy, sz, 0.95);
    add(this.head, HEMI, hair, 0, 0.215, -0.012, 0.178, 0.205, 0.188, 0.95).rotation.x = -0.38;
    if (style === 'long') H(0, 0.06, -0.065, 0.18, 0.27, 0.15);
    else if (style === 'pony') { H(0, 0.1, -0.21, 0.055, 0.17, 0.06); H(0, 0.27, -0.17, 0.05, 0.05, 0.05); }
    else if (style === 'bun') H(0, 0.42, -0.06, 0.07, 0.07, 0.07);
    else if (style === 'curly') {
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; H(Math.cos(a) * 0.125, 0.33, Math.sin(a) * 0.125 - 0.03, 0.075, 0.075, 0.075); }
      H(0, 0.4, -0.02, 0.09, 0.07, 0.09); H(0.09, 0.2, -0.14, 0.07, 0.08, 0.07); H(-0.09, 0.2, -0.14, 0.07, 0.08, 0.07);
    } else H(0, 0.335, 0.1, 0.13, 0.05, 0.08);
  }

  setAnim(a) { this.anim = a; }
  setExpr(e) { this.expr = e; }
  gesture(a, dur = 1.2) { this.gest = a; this.gestT = dur; }
  setProp(name) { for (const k in this.props) this.props[k].visible = k === name; }

  // Show pictograms in a bubble above the head.
  bubble(txt, dur = 2) {
    const c = this.bubCanvas, ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    const n = [...txt].length, fs = n <= 2 ? 72 : n <= 4 ? 54 : 40;
    ctx.font = `${fs}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = clamp(ctx.measureText(txt).width + 44, 100, 252);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#33405a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(128 - w / 2, 8, w, 96, 26); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(116, 102); ctx.lineTo(128, 124); ctx.lineTo(140, 102); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillText(txt, 128, 60);
    this.bubTex.needsUpdate = true;
    this.bubT = this.bubDur = dur; this.bub.visible = true;
  }
  hideBubble() { this.bubT = 0; this.bub.visible = false; }

  redraw() {
    const key = this.expr + (this.blink ? 'b' : '');
    if (key === this.faceKey) return;
    this.faceKey = key;
    if (this.look.smooth) drawFaceSmooth(this.faceCanvas.getContext('2d'), 128, this.expr, this.blink);
    else drawFace(this.faceCanvas.getContext('2d'), 32, this.look.skin, this.expr, this.blink);
    this.faceTex.needsUpdate = true;
  }

  pose() {
    const t = this.t, s = Math.sin, br = s(t * 2) * 0.03;
    const p = { y: 0, bx: 0, bz: 0, hx: 0, hy: this.headYaw, hz: 0, lax: 0, laz: 0.06, rax: 0, raz: 0.06, llx: 0, rlx: 0 };
    switch (this.gest || this.anim) {
      case 'walk': { const w = s(this.phase) * 0.75; p.llx = -w; p.rlx = w; p.lax = w * 0.8; p.rax = -w * 0.8; p.y = Math.abs(Math.cos(this.phase)) * 0.03; break; }
      case 'idle': p.lax = br; p.rax = -br; break;
      case 'lookAround': p.hy += s(t * 0.8) * 0.8; p.lax = br; break;
      case 'wave': p.rax = -2.9; p.raz = 0.35 + s(t * 10) * 0.3; break;
      case 'waveSmall': p.rax = -2.3; p.raz = 0.2 + s(t * 9) * 0.2; break;
      case 'openArms': p.lax = p.rax = -1.25; p.laz = p.raz = 0.85 + s(t * 3) * 0.08; break;
      case 'hug': p.lax = p.rax = -1.45; p.laz = p.raz = -0.3; p.bx = 0.06; p.hz = 0.22; break;
      case 'five': p.rax = -2.7; p.raz = 0.12; break;
      case 'fiveHit': p.rax = -1.9; p.bx = 0.08; break;
      case 'crossed': p.lax = p.rax = -0.95; p.laz = p.raz = -0.55; p.bx = -0.08; break;
      case 'leanBack': p.bx = -0.25; p.lax = p.rax = -0.6; p.laz = p.raz = 0.3; break;
      case 'talk': p.rax = -0.9 + s(t * 4.2) * 0.35; p.lax = -0.35 + s(t * 3.1) * 0.2; p.hx = s(t * 3) * 0.05; break;
      case 'listen': p.hx = 0.04 + s(t * 2.6) * 0.07; break;
      case 'read': p.lax = p.rax = -1.05; p.laz = p.raz = -0.2; p.hx = 0.42; p.hy = 0; break;
      case 'cry': p.lax = p.rax = -2.45; p.laz = p.raz = -0.38; p.hx = 0.38; p.y = s(t * 9) * 0.012; break;
      case 'cheer': p.lax = p.rax = -3.0; p.laz = p.raz = 0.3 + s(t * 8) * 0.15; p.y = Math.abs(s(t * 6)) * 0.22; break;
      case 'angry': p.lax = p.rax = 0.15; p.laz = p.raz = 0.3; p.hx = 0.14; p.bz = s(t * 22) * 0.025; p.rlx = -Math.max(0, s(t * 7)) * 0.5; break;
      case 'scared': p.lax = p.rax = -2.2; p.laz = p.raz = -0.3; p.bx = -0.12; p.bz = s(t * 30) * 0.03; break;
      case 'raise': p.rax = -3.0; p.raz = 0.3 + s(t * 6) * 0.25; p.y = Math.abs(s(t * 3)) * 0.06; break;
      case 'tend': p.bx = 0.5; p.lax = p.rax = -1.0 + s(t * 3) * 0.25; p.hy = 0; break;
      case 'comfort': p.rax = -1.35 + s(t * 5) * 0.12; p.hz = 0.12; break;
      case 'laugh': p.bx = -0.15; p.hx = -0.2; p.y = Math.abs(s(t * 10)) * 0.04; p.lax = p.rax = -0.5; break;
      case 'point': p.rax = -1.5; break;
      case 'eat': p.rax = -1.9; p.raz = -0.15; break;
      case 'squirm': p.bz = s(t * 9) * 0.09; p.lax = p.rax = -0.5; p.laz = p.raz = 0.5; p.bx = -0.1; break;
      case 'hold': p.lax = p.rax = -1.0; p.laz = p.raz = -0.25; break;
    }
    if (this.sit) { p.llx = p.rlx = -1.5; p.y = -0.5; }
    return p;
  }

  update(dt) {
    this.t += dt;
    if (this.gest && (this.gestT -= dt) <= 0) this.gest = null;
    const target = this.pose(), c = this.cur, k = 1 - Math.exp(-dt * 14);
    for (const key in target) c[key] += (target[key] - c[key]) * k;
    this.body.position.y = c.y;
    this.upper.rotation.set(c.bx, 0, c.bz);
    this.head.rotation.set(c.hx, c.hy, c.hz);
    this.armL.rotation.set(c.lax, 0, c.laz);
    this.armR.rotation.set(c.rax, 0, -c.raz);
    this.legL.rotation.x = c.llx; this.legR.rotation.x = c.rlx;
    // blinking
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blink = !this.blink; this.blinkT = this.blink ? 0.12 : rand(2, 5); }
    this.redraw();
    if (this.props.balloon.visible) this.props.balloon.position.y = 2.2 + Math.sin(this.t * 2) * 0.06;
    // bubble pop-in / fade-out
    if (this.bubT > 0) {
      this.bubT -= dt;
      const a = Math.min(1, (this.bubDur - this.bubT) * 8), f = Math.min(1, this.bubT * 4);
      this.bub.scale.set(1.9 * a, 0.95 * a, 1); this.bub.material.opacity = f;
      if (this.bubT <= 0) this.bub.visible = false;
    }
  }
}

// A character that lives in the world: position, heading, simple walking.
export class Actor {
  constructor(look, x, z, heading = 0) {
    this.look = look;
    this.char = new Character(look);
    this.pos = { x, z }; this.heading = this.th = heading;
    this.speed = 2.2; this.dest = null; this.lookTarget = null; this.radius = 0.36;
    this.sync();
  }
  walkTo(p, cb, speed = 2.2) { this.dest = { x: p.x, z: p.z, cb }; this.speed = speed; this.char.setAnim('walk'); }
  stop() { this.dest = null; }
  face(p) { this.th = Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  sync() { this.char.root.position.set(this.pos.x, 0, this.pos.z); this.char.root.rotation.y = this.heading; }
  update(dt) {
    if (this.dest) {
      const dx = this.dest.x - this.pos.x, dz = this.dest.z - this.pos.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) {
        this.pos.x = this.dest.x; this.pos.z = this.dest.z;
        const cb = this.dest.cb; this.dest = null;
        if (this.char.anim === 'walk') this.char.setAnim('idle');
        cb?.();
      } else {
        this.pos.x += dx / d * step; this.pos.z += dz / d * step;
        this.th = Math.atan2(dx, dz); this.char.phase += step * 5.2;
      }
    }
    this.heading += angDiff(this.th, this.heading) * Math.min(1, dt * 10);
    if (this.lookTarget) {
      const rel = angDiff(Math.atan2(this.lookTarget.x - this.pos.x, this.lookTarget.z - this.pos.z), this.heading);
      this.char.headYaw = clamp(rel, -1.1, 1.1);
    } else this.char.headYaw = 0;
    this.sync();
    this.char.update(dt);
  }
}
