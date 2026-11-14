import * as THREE from 'three';
import { dist, rand, pick, shuffle, clamp } from './util.js';
import { faceIcon } from './character.js';

// ---------- cast (a mix of girls and boys, varied looks) ----------
export const KIDS = [
  { skin: '#f1c9a5', hair: '#5a3a22', style: 'long', shirt: '#e86a8a', pants: '#4a5a8a' },
  { skin: '#d9a273', hair: '#2a1c12', style: 'short', shirt: '#3f8fd6', pants: '#3a3f4a' },
  { skin: '#8d5a3b', hair: '#1b1310', style: 'curly', shirt: '#f2b632', pants: '#7a4a8a', skirt: true },
  { skin: '#f3d3b5', hair: '#c98a3a', style: 'short', shirt: '#4caf6a', pants: '#5a4632' },
  { skin: '#e2b48c', hair: '#b5521f', style: 'pony', shirt: '#8e6bd6', pants: '#3d4a5a' },
  { skin: '#a86f48', hair: '#15100d', style: 'curly', shirt: '#e8743b', pants: '#34495e' },
  { skin: '#f6dcc4', hair: '#e2c15a', style: 'pony', shirt: '#35b5b0', pants: '#d05a7a', skirt: true },
  { skin: '#6f4a32', hair: '#201814', style: 'short', shirt: '#d64f4f', pants: '#2f3a44' },
];
export const AVATARS = [
  { skin: '#f1c9a5', hair: '#3a2416', style: 'pony', shirt: '#ff7aa8', pants: '#3b4a7a' },
  { skin: '#a86f48', hair: '#15100d', style: 'long', shirt: '#ffc233', pants: '#40506a' },
  { skin: '#f6dcc4', hair: '#d9b24a', style: 'curly', shirt: '#9a6bff', pants: '#34495e' },
  { skin: '#f3d3b5', hair: '#4a2f1a', style: 'short', shirt: '#2f8fff', pants: '#2f3a44' },
  { skin: '#8d5a3b', hair: '#1b1310', style: 'short', shirt: '#2fbf71', pants: '#3a3f4a' },
  { skin: '#e2b48c', hair: '#b5521f', style: 'curly', shirt: '#ff7b3a', pants: '#3d4a5a' },
];
const VENDOR = { skin: '#e2b48c', hair: '#6a6a72', style: 'short', shirt: '#ffffff', pants: '#5a6a8a', scale: 1.12 };

const PI = Math.PI;
const PICS = ['🐱', '🚲', '🍕', '🌈', '🎮', '📺', '🦕', '🎨', '🚀'];
const BOX = new THREE.BoxGeometry(1, 1, 1);
export const cube = (color, s = 0.4) => { const m = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color })); m.scale.setScalar(s); m.castShadow = true; return m; };
const ballMesh = () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: '#ff7043' })); m.castShadow = true; return m; };
export function ring(inner, outer, color, opacity = 0.4) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -PI / 2; m.position.y = 0.04; return m;
}

// Two kids chatting to each other (shared by several scenes).
class Chatter {
  constructor(a, b) { this.a = a; this.b = b; this.t = 0; this.turn = 0; a.face(b.pos); b.face(a.pos); }
  update(dt) {
    if ((this.t -= dt) > 0) return;
    this.turn ^= 1; this.t = 1.6;
    const [sp, li] = this.turn ? [this.a, this.b] : [this.b, this.a];
    sp.char.setAnim('talk'); li.char.setAnim('listen'); sp.char.bubble(pick(PICS), 1.3);
  }
}

// ---------- base class ----------
export class Challenge {
  rounds = 3;
  constructor(g, i) { this.g = g; this.i = i; this.c = g.world.plots[i]; this.actors = []; this.objs = []; this.timers = []; this.active = false; this.busy = false; }
  P(dx, dz) { return { x: this.c.x + dx, z: this.c.z + dz }; }
  spawn(look, dx, dz, h = 0) { const a = this.g.spawn(look, this.c.x + dx, this.c.z + dz, h); this.actors.push(a); return a; }
  addObj(o) { this.g.scene.add(o); this.objs.push(o); return o; }
  after(t, fn) { this.timers.push({ t, fn }); }
  // Three picture choices in random order: one helpful, two unhelpful.
  choices(good, bads) { this.icons3 = { good, b0: bads[0], b1: bads[1] }; this.g.ui.setButtons(shuffle(Object.keys(this.icons3).map((id) => ({ id, icon: this.icons3[id] })))); }
  iconOf(id) { return this.icons3?.[id]; }
  clear() {
    for (const a of this.actors) this.g.despawn(a);
    for (const o of this.objs) this.g.scene.remove(o);
    this.actors = []; this.objs = []; this.timers = [];
  }
  reset() { this.clear(); this.active = false; this.busy = false; this.demo = false; this.dm = null; this.ambient(); }
  ambient() {}
  // ----- "watch first": the player's own character acts out round one, then control is handed over -----
  // A script is a list of steps: { walk }, { wait }, { until }, { press, hold | until }.
  demoSteps() { return null; }
  toward(target, d) {   // a point d away from target, on the player's side of it
    const p = this.g.player.pos, dx = p.x - target.x, dz = p.z - target.z, m = Math.hypot(dx, dz) || 1;
    return { x: target.x + dx / m * d, z: target.z + dz / m * d };
  }
  begin(real) {
    const g = this.g;
    this.clear(); this.active = true; this.busy = false; this.mistakes = 0; this.round = 0; this.dm = null;
    this.demo = !real && g.wantDemo(this.i);
    g.ui.setGoal(this.icons, this.key + '.goal');
    if (this.demo) { this.home = { x: g.player.pos.x, z: g.player.pos.z }; g.ui.watch(true); }
    this.startRound();
    if (this.demo) this.dm = { steps: this.demoSteps() || [], k: 0, t: 0, on: false, held: null, idle: 0 };
  }
  runDemo(dt) {
    const d = this.dm, s = d.steps[d.k], g = this.g, p = g.player;
    if (!s) { if (!this.busy && (d.idle += dt) > 8) this.endDemo(); return; }   // safety net: never leave the player stuck watching
    const val = (v) => (typeof v === 'function' ? v() : v);
    if (!d.on) {
      d.on = true; d.t = 0;
      if (s.walk) p.walkTo(val(s.walk), null, s.speed || 3);
      if (s.press) { d.held = val(s.press); d.fired = false; g.ui.demoPress(d.held, true); }   // the finger appears a moment before the press
    }
    d.t += dt;
    if (s.press && !d.fired) {
      if (d.t < (s.pre ?? 0.7)) return;
      d.fired = true; d.t = 0; g.sfx.tick(); this.action(d.held, true);
    }
    let next;
    if (s.walk) next = !p.dest;
    else if (s.press) next = s.until ? s.until() : d.t >= (s.hold ?? 0.45);
    else if (s.until) next = s.until();
    else next = d.t >= (s.wait ?? 0);
    if (!next && d.t < 25) return;
    if (d.held) { const id = d.held; d.held = null; g.ui.demoPress(id, false); this.action(id, false); }
    d.on = false; d.k++;
  }
  endDemo(skip) {
    const g = this.g, p = g.player, d = this.dm;
    this.dm = null;
    if (d?.held && d.fired) this.action(d.held, false);
    this.timers = []; this.busy = true;
    g.ui.watch(false); g.ui.setButtons([]); g.ui.setDots(0, 0); g.ui.phone(null); g.ui.breath(null);
    g.lock(true); g.cam.focus = null; g.cam.zoom = 1; g.cam.yaw = 0;
    p.char.hideBubble(); p.char.setProp(null); p.char.setExpr('happy'); p.char.setAnim('idle');
    const go = () => { g.lock(false); this.begin(true); };
    if (skip) { p.stop(); p.pos.x = this.home.x; p.pos.z = this.home.z; go(); return; }
    g.ui.setGoal('👀 ➜ 🎮', 'turn');
    let n = 2; const one = () => { if (--n === 0) go(); };
    p.walkTo(this.home, one, 4.5); this.after(1.8, one);   // back to where the player stood, then it is their turn
  }
  startRound() { this.rm = 0; this.g.ui.setDots(this.rounds, this.round); this.setupRound(this.round); }
  tick(dt) {
    for (let n = this.timers.length - 1; n >= 0; n--) {
      const tm = this.timers[n];
      if ((tm.t -= dt) <= 0) { this.timers.splice(n, 1); tm.fn(); }
    }
    if (this.active && this.dm) this.runDemo(dt);
    if (this.active) this.update(dt);
  }
  update() {}
  action() {}
  oops(key) { this.mistakes++; this.rm++; this.g.sfx.oops(); this.g.ui.flash(false); this.g.say(key); }
  win(key) {
    if (this.busy) return;
    this.busy = true; this.g.sfx.good(); this.g.ui.flash(true); this.g.say(key);
    this.after(2.4, () => {
      if (this.demo) return this.endDemo();
      this.busy = false; this.round++;
      if (this.round >= this.rounds) this.finish(); else this.startRound();
    });
  }
  finish() {
    this.active = false;
    const stars = this.mistakes <= 1 ? 3 : this.mistakes <= 3 ? 2 : 1;
    for (const a of this.actors) { a.char.setAnim('cheer'); a.char.setExpr('joy'); a.char.sit = false; }
    this.after(4, () => { for (const a of this.actors) { a.char.setAnim('idle'); a.char.setExpr('happy'); } });
    this.g.complete(this.i, stars);
  }
}

// ===== 1. Saying hello: personal space =====
class Hello extends Challenge {
  demoSteps() { const p = this.g.player; return [{ walk: () => this.toward(this.kid.pos, 1.9) }, { wait: 0.8 }, { press: 'wave' }]; }
  key = 'c1'; icons = '🚶 ➜ ↔️ ➜ 👋';
  ambient() { this.spawn(KIDS[0], 0, -1).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const [dx, dz] = [[0, -1], [-5, 4], [5, -4]][r];
    this.kid = this.spawn(KIDS[r], dx, dz); this.kid.char.setAnim('lookAround');
    this.rings = new THREE.Group(); this.rings.add(ring(1.2, 2.6, 0x49c96a), ring(0, 1.2, 0xf0685a)); this.addObj(this.rings);
    this.intr = false;
    this.g.ui.setButtons([{ id: 'wave', icon: '👋' }]);
  }
  update() {
    const k = this.kid, p = this.g.player, d = dist(k.pos, p.pos);
    // The coloured comfort zones fade out round by round (and return as a hint after two slips).
    const op = this.rm >= 2 ? 0.5 : [0.45, 0.2, 0][this.round];
    this.rings.children[0].material.opacity = op; this.rings.children[1].material.opacity = op * 0.8;
    this.rings.position.set(k.pos.x, 0, k.pos.z);
    if (this.busy) return;
    if (d < 7) { k.lookTarget = p.pos; if (!k.dest) { k.face(p.pos); if (k.char.anim === 'lookAround') k.char.setAnim('idle'); } } else k.lookTarget = null;
    if (d < 1.15 && !this.intr) { this.intr = true; this.tooClose(); }
    if (d > 1.6) this.intr = false;
  }
  tooClose() {
    const k = this.kid, p = this.g.player;
    this.oops('c1.close');
    k.char.setExpr('uneasy'); k.char.gesture('leanBack', 1.2); k.char.bubble('😬', 1.5);
    const dx = k.pos.x - p.pos.x, dz = k.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    const t = { x: clamp(k.pos.x + dx / d * 1.1, this.c.x - 9, this.c.x + 9), z: clamp(k.pos.z + dz / d * 1.1, this.c.z - 9, this.c.z + 9) };
    this.after(0.5, () => k.walkTo(t, () => k.face(p.pos), 1.6));
    this.after(1.9, () => k.char.setExpr('neutral'));
  }
  action(id, down) {
    if (!down || this.busy) return;
    const k = this.kid, p = this.g.player, d = dist(k.pos, p.pos);
    p.face(k.pos); p.char.gesture('wave', 1);
    if (d < 1.15) this.tooClose();
    else if (d > 2.7) { this.oops('c1.far'); k.char.bubble('❓', 1.5); k.char.setExpr('puzzled'); this.after(1.6, () => k.char.setExpr('neutral')); }
    else { k.stop(); k.face(p.pos); k.char.setAnim('wave'); k.char.setExpr('joy'); k.char.bubble('😊', 2); this.win('c1.good'); }
  }
}

// ===== 2. Who is free to talk right now? =====
class WhoIsFree extends Challenge {
  demoSteps() { const p = this.g.player; return [{ wait: 1.2 }, { walk: () => this.toward(this.free.pos, 2.1) }, { wait: 1.5 }, { press: 'wave' }]; }
  key = 'c2'; icons = '👀 ➜ 🙂 ➜ 👋';
  ambient() {
    this.spawn(KIDS[1], -3, -2).char.setAnim('lookAround');
    const b = this.spawn(KIDS[2], 4, 2); b.char.sit = true; b.char.setAnim('read'); b.char.setProp('book');
  }
  setupRound(r) {
    this.clear(); this.chat = null; this.hint = false;
    const slots = shuffle([[-4.5, -3.5], [5, -3], [0.5, 4.5]]), roles = shuffle(['read', 'pair', 'build']).slice(0, 2);
    let n = r * 3;
    const next = () => KIDS[n++ % 8];
    this.free = this.spawn(next(), ...slots[0]); this.free.char.setAnim('lookAround'); this.waveT = 1.5;
    roles.forEach((role, i) => {
      const [x, z] = slots[i + 1];
      if (role === 'read') { const a = this.spawn(next(), x, z); a.char.sit = true; a.char.setAnim('read'); a.char.setProp('book'); }
      else if (role === 'pair') this.chat = new Chatter(this.spawn(next(), x - 0.7, z), this.spawn(next(), x + 0.7, z));
      else {
        this.spawn(next(), x, z, PI / 2).char.setAnim('tend');
        const pile = new THREE.Group();
        [['#e8524f', 0, 0.2, 0], ['#3f8fd6', 0.42, 0.2, 0.1], ['#f2b632', 0.2, 0.6, 0.05]].forEach(([c, px, py, pz]) => { const m = cube(c); m.position.set(px, py, pz); pile.add(m); });
        pile.position.set(this.c.x + x + 0.9, 0, this.c.z + z); this.addObj(pile);
      }
    });
    this.g.ui.setButtons([{ id: 'wave', icon: '👋' }]);
  }
  update(dt) {
    this.chat?.update(dt);
    if (this.busy) return;
    const f = this.free, p = this.g.player;
    if (dist(f.pos, p.pos) < 6.5) {
      // The available child notices you: eye contact and a smile (plus a small wave in early rounds).
      f.lookTarget = p.pos; f.face(p.pos); f.char.setExpr('happy');
      if (f.char.anim === 'lookAround') f.char.setAnim('idle');
      if (this.round < 2 && (this.waveT -= dt) < 0) { f.char.gesture('waveSmall', 1); this.waveT = 3; }
    } else { f.lookTarget = null; f.char.setExpr('neutral'); f.char.setAnim('lookAround'); }
    if (this.rm >= 2 && !this.hint) { this.hint = true; const h = ring(0.6, 0.9, 0x49c96a, 0.7); h.position.set(f.pos.x, 0.04, f.pos.z); this.addObj(h); }
  }
  action(id, down) {
    if (!down || this.busy) return;
    const p = this.g.player;
    p.char.gesture('wave', 1);
    let best = null, bd = 2.8;
    for (const a of this.actors) { const d = dist(a.pos, p.pos); if (d < bd) { bd = d; best = a; } }
    if (!best) { p.char.bubble('❓', 1.2); return; }
    p.face(best.pos);
    if (best === this.free) { best.char.setAnim('wave'); best.char.setExpr('joy'); best.char.bubble('😊', 2); this.win('c2.good'); }
    else { this.oops('c2.busy'); best.char.bubble('✋', 1.5); }
  }
}

// ===== 3. Joining a conversation: wait for the pause =====
class JoinTalk extends Challenge {
  demoSteps() { const p = this.g.player; return [{ walk: () => this.toward(this.mid, 2.5) }, { until: () => this.phase === 'pause' }, { wait: 0.6 }, { press: 'wave' }]; }
  key = 'c3'; icons = '🧍 ➜ ⏳ ➜ 👋';
  ambient() { const a = this.spawn(KIDS[2], -0.8, 0), b = this.spawn(KIDS[3], 0.8, 0); a.face(b.pos); b.face(a.pos); a.char.setAnim('talk'); b.char.setAnim('listen'); }
  setupRound(r) {
    this.clear();
    const [mx, mz] = [[0, 0], [-4, 3], [4, -3]][r];
    this.mid = this.P(mx, mz);
    this.kids = [this.spawn(KIDS[(r * 2 + 2) % 8], mx - 0.8, mz), this.spawn(KIDS[(r * 2 + 3) % 8], mx + 0.8, mz)];
    this.chat = new Chatter(...this.kids);
    this.talk();
    this.g.ui.setButtons([{ id: 'wave', icon: '👋' }]);
  }
  talk() {
    this.phase = 'talk'; this.pt = [4, 6, 8][this.round] + rand(0, 1.5); this.waited = false;
    for (const k of this.kids) { k.lookTarget = null; k.char.setExpr('neutral'); }
    this.g.ui.pulse('wave', false);
  }
  update(dt) {
    if (this.busy) return;
    const p = this.g.player, near = dist(p.pos, this.mid) < 3.4;
    this.pt -= dt;
    if (this.phase === 'talk') {
      this.chat.update(dt);
      if (near && !this.waited && !p.moving) { this.waited = true; p.char.bubble('⏳', 1.5); }   // waiting nicely
      if (this.pt <= 0) {
        this.phase = 'pause'; this.pt = 2.8;
        for (const k of this.kids) { k.char.setAnim('idle'); k.char.hideBubble(); if (near) { k.lookTarget = p.pos; k.char.setExpr('happy'); } }
        if (this.rm >= 2) this.g.ui.pulse('wave', true);
      }
    } else if (this.pt <= 0) this.talk();
  }
  action(id, down) {
    if (!down || this.busy) return;
    const p = this.g.player, d = dist(p.pos, this.mid);
    p.face(this.mid); p.char.gesture('wave', 1);
    if (d > 3.4) { this.oops('c3.far'); return; }
    if (this.phase === 'talk') {
      this.oops('c3.interrupt');
      const k = this.kids[0]; k.char.bubble('✋', 1.4); k.char.setExpr('uneasy'); this.after(1.4, () => k.char.setExpr('neutral'));
      return;
    }
    for (const k of this.kids) { k.lookTarget = null; k.face(p.pos); k.char.setAnim('wave'); k.char.setExpr('joy'); }
    this.kids[0].char.bubble('😊', 2);
    this.win('c3.good');
  }
}

// ===== 4. Hug, high-five or wave? And how long does a hug last? =====
class HugOrNot extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => this.ready }, { wait: 1 }, { press: 'hug', until: () => !this.hug || (this.hug.arrived && this.hug.t > 2.3) }]; }
  key = 'c4'; icons = '👀 ➜ 🤗 ✋ 👋'; rounds = 4;
  ambient() { this.spawn(KIDS[3], 0, -1).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    this.want = ['hug', 'five', 'wave', 'hug'][r]; this.showRing = r === 0; this.ready = false; this.hug = null;
    g.lock(true); g.cam.focus = this.P(0, 1.2); g.cam.zoom = 0.6; g.cam.yaw = 0.85;
    p.walkTo(this.P(0, 2.6), () => { p.th = PI; }, 3);
    this.fz = { hug: 0.9, five: 1.3, wave: -1.6 }[this.want];
    this.friend = this.spawn(KIDS[(r + 3) % 8], 0, -8);
    this.friend.walkTo(this.P(0, this.fz), () => { this.pose(); this.ready = true; if (r === 0) g.say('c4.hold'); });
    g.ui.setButtons([{ id: 'hug', icon: '🤗' }, { id: 'five', icon: '✋' }, { id: 'wave', icon: '👋' }]);
  }
  pose() {
    const c = this.friend.char; this.friend.th = 0;
    c.setAnim({ hug: 'openArms', five: 'five', wave: 'wave' }[this.want]);
    c.setExpr(this.want === 'hug' ? 'joy' : 'happy');
  }
  backOff() { const p = this.g.player; p.walkTo(this.P(0, 2.6), () => { p.th = PI; }, 3); }
  action(id, down) {
    if (this.busy || !this.ready) return;
    const f = this.friend.char, p = this.g.player;
    if (id === 'hug') {
      if (!down) { if (this.hug) this.endHug(false); return; }
      if (this.hug) return;
      if (this.want !== 'hug') {   // the friend did not invite a hug
        this.oops('c4.nohug'); f.setExpr('uneasy'); f.gesture('leanBack', 1.3); f.bubble('😬', 1.4);
        this.after(1.5, () => this.pose());
        return;
      }
      this.hug = { t: 0, arrived: false }; f.setAnim('hug');
      p.walkTo(this.P(0, this.fz + 0.62), () => { p.char.setAnim('hug'); if (this.hug) this.hug.arrived = true; }, 3.5);
      return;
    }
    if (!down || this.hug) return;
    p.char.gesture(id === 'five' ? 'fiveHit' : 'wave', 0.9);
    if (id === this.want) {
      if (id === 'five') { f.gesture('fiveHit', 0.6); this.g.sfx.clap(); }
      f.setExpr('joy'); f.bubble('😊', 2); this.win('c4.good');
    } else {
      this.oops('c4.look'); f.setExpr('puzzled'); f.bubble('❓', 1.3);
      this.after(1.4, () => this.pose());
    }
  }
  endHug(forced) {
    const f = this.friend.char, t = this.hug.arrived ? this.hug.t : 0;
    this.hug = null; this.g.ui.ring('hug', 0, null);
    this.g.player.char.setAnim('idle'); this.backOff();
    if (forced || t > 3.6) { this.oops('c4.long'); f.setAnim('idle'); f.setExpr('uneasy'); this.after(1.6, () => this.pose()); }
    else if (t < 1.3) { this.oops('c4.short'); f.setExpr('puzzled'); f.bubble('❓', 1.3); this.after(1.4, () => this.pose()); }
    else { f.setAnim('idle'); f.setExpr('joy'); f.bubble('❤️', 2); this.win('c4.hugGood'); }
  }
  update(dt) {
    const h = this.hug;
    if (!h || !h.arrived) return;
    h.t += dt;
    const f = this.friend.char;
    // Body language tells you when to let go: arms relax first, then the friend gets uncomfortable.
    if (h.t > 3.6) { f.setAnim('squirm'); f.setExpr('uneasy'); }
    else if (h.t > 2.5) { f.setAnim('idle'); f.setExpr('happy'); }
    else f.setExpr('joy');
    if (this.showRing || this.rm >= 2) this.g.ui.ring('hug', h.t / 5, [1.3 / 5, 3.6 / 5]);
    if (h.t > 5) this.endHug(true);
  }
  finish() { this.g.player.char.setAnim('idle'); super.finish(); }
}

// ===== 5. Waiting in line =====
const QZ = [-6.6, -5.4, -4.2, -3.0, -1.8];
class Queue extends Challenge {
  demoSteps() {
    const p = this.g.player, gap = () => this.state === 'queue' && !p.dest && this.line.indexOf(p) < this.playerAt;
    const step = [{ until: gap }, { wait: 0.7 }, { press: 'step' }];
    return [{ walk: () => this.P(2.6, -2.4) }, { walk: () => this.P(0, QZ[3]) }, ...step, ...step, ...step];
  }
  key = 'c5'; icons = '🧍🧍🧍 ➜ ⏳ ➜ 🍦'; rounds = 1;
  ambient() { this.build(); }
  build() {
    this.vendor = this.spawn(VENDOR, 0, -9.1);
    this.line = [0, 1, 2].map((i) => this.spawn(KIDS[i + 4], 0, QZ[i], PI));
  }
  setupRound() {
    this.clear(); this.build();
    this.state = 'find'; this.cutIn = false; this.hint = false; this.served = 0; this.playerAt = -1;
    this.g.player.char.setProp(null);
    this.g.lock(false); this.g.ui.setButtons([]);
  }
  update(dt) {
    if (this.busy) return;
    const g = this.g, p = g.player;
    if (this.state === 'find') {
      const lx = p.pos.x - this.c.x, lz = p.pos.z - this.c.z;
      const inCut = Math.abs(lx) < 1.5 && lz < -3.75 && lz > -7.7;   // squeezing in ahead of others
      if (inCut && !this.cutIn) {
        this.cutIn = true; this.oops('c5.cut');
        for (const k of this.line) { k.lookTarget = p.pos; k.char.setExpr('uneasy'); }
        this.vendor.char.gesture('point', 1.4); this.vendor.char.bubble('👉', 1.6);
        this.after(1.7, () => { for (const k of this.line) { k.lookTarget = null; k.char.setExpr('neutral'); } });
        if (this.rm >= 2 && !this.hint) { this.hint = true; const h = ring(0.45, 0.7, 0x49c96a, 0.7); h.position.set(this.c.x, 0.04, this.c.z + QZ[3]); this.addObj(h); }
      }
      if (!inCut) this.cutIn = false;
      if (dist(p.pos, this.P(0, QZ[3])) < 0.6) this.join();
      return;
    }
    if (this.line.indexOf(p) < this.playerAt) {   // a space opened in front of the player
      this.gapT += dt;
      if (this.gapT > 5 && !this.nagged) { this.nagged = true; g.say('c5.step'); g.ui.pulse('step', true); }
    } else if (!p.dest && (this.serveT -= dt) <= 0) this.serve();
  }
  join() {
    const g = this.g, p = g.player;
    this.state = 'queue'; g.lock(true); g.sfx.tick();
    p.walkTo(this.P(0, QZ[3]), () => { p.th = PI; }, 2);
    this.playerAt = 3; this.line.push(p);
    const k = this.spawn(KIDS[7], 4, 5); this.line.push(k); k.walkTo(this.P(0, QZ[4]), () => { k.th = PI; });
    g.ui.setButtons([{ id: 'step', icon: '⬆️' }]); g.say('c5.wait');
    g.cam.focus = this.P(0, -4.5); g.cam.zoom = 0.8;
    this.serveT = this.demo ? 2 : 3.5; this.gapT = 0; this.nagged = false;
  }
  serve() {
    const p = this.g.player, front = this.line[0];
    this.vendor.char.gesture('point', 0.8);
    if (front === p) { p.char.setProp('icecream'); p.char.setAnim('eat'); p.char.bubble('🍦', 2); this.win('c5.good'); return; }
    this.line.shift();
    front.char.setProp('icecream'); front.char.setExpr('joy');
    const n = this.served++;
    front.walkTo(this.P(-4 - n * 1.3, -6 + n * 1.2), () => { front.th = 0; front.char.setAnim('eat'); }, 2);
    const pi = this.line.indexOf(p);
    this.line.forEach((a, i) => { if (i < pi) this.after(0.5, () => a.walkTo(this.P(0, QZ[i]), () => { a.th = PI; }, 1.6)); });
    this.serveT = this.demo ? 2 : rand(3, 5); this.gapT = 0; this.nagged = false;
  }
  finish() { super.finish(); this.after(8, () => this.g.player.char.setProp(null)); }
  action(id, down) {
    const p = this.g.player;
    if (!down || this.busy || this.state !== 'queue' || p.dest) return;
    const pi = this.line.indexOf(p);
    if (pi === 0 && this.playerAt === 0) return;
    if (pi < this.playerAt) {
      this.playerAt = pi; this.g.sfx.tick(); this.g.ui.pulse('step', false);
      p.walkTo(this.P(0, QZ[pi]), () => { p.th = PI; }, 1.8);
      this.line.forEach((a, i) => { if (i > pi) this.after(0.6, () => a.walkTo(this.P(0, QZ[i]), () => { a.th = PI; }, 1.6)); });
    } else {   // pushing forward when there is no room
      this.oops('c5.bump');
      const front = this.line[pi - 1];
      if (front) { front.lookTarget = p.pos; front.char.setExpr('uneasy'); front.char.bubble('😬', 1.3); this.after(1.4, () => { front.lookTarget = null; front.char.setExpr('neutral'); }); }
    }
  }
}

// ===== 6. Taking turns in a conversation (and staying on topic) =====
const TOPICS = [
  { tell: ['🐶', '🦴', '😄'], good: '🐶❓', bad: ['🚀', '🥦'] },
  { tell: ['⚽', '🥅', '🎉'], good: '⚽👍', bad: ['🦖', '🛁'] },
  { tell: ['🎂', '🎈', '🎁'], good: '🎂😋', bad: ['🚂', '🌧️'] },
  { tell: ['🏖️', '🌊', '🐚'], good: '🌊❓', bad: ['🎸', '🧮'] },
  { tell: ['🐱', '🧶', '😻'], good: '🐱❤️', bad: ['🚜', '🍕'] },
];
class Conversation extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => this.phase === 'wait' }, { wait: 0.9 }, { press: 'good' }]; }
  key = 'c6'; icons = '👂 ➜ ⏳ ➜ 💬';
  ambient() { this.spawn(KIDS[5], 0, -0.8).char.setAnim('lookAround'); }
  begin(real) { this.topics = shuffle(TOPICS).slice(0, 3); super.begin(real); }
  setupRound(r) {
    const g = this.g, p = g.player;
    if (r === 0) {
      g.lock(true); p.walkTo(this.P(0, 1.5), () => { p.th = PI; }, 3);
      this.friend = this.spawn(KIDS[5], 0, -0.8);
      g.cam.focus = this.P(0, 0.4); g.cam.zoom = 0.6; g.cam.yaw = 0.85;
    }
    this.topic = this.topics[r];
    g.ui.setButtons(shuffle([{ id: 'good', icon: this.topic.good }, { id: 'b0', icon: this.topic.bad[0] }, { id: 'b1', icon: this.topic.bad[1] }]));
    this.tell();
  }
  tell() {
    const f = this.friend.char;
    this.phase = 'tell'; this.n = 0; this.tt = 1; this.waitT = 0; this.nag = false;
    f.setAnim('talk'); f.setExpr('happy'); f.hideBubble(); this.g.ui.pulse('good', false);
  }
  update(dt) {
    if (this.busy) return;
    const f = this.friend.char;
    if (this.phase === 'tell') {
      if ((this.tt -= dt) > 0) return;
      if (this.n < this.topic.tell.length) { this.n++; f.bubble(this.topic.tell.slice(0, this.n).join(''), 60); this.tt = 1.25; }
      else { this.phase = 'wait'; f.setAnim('listen'); if (this.rm >= 2) this.g.ui.pulse('good', true); }
    } else if (this.phase === 'wait') {
      this.waitT += dt;
      if (this.waitT > 7 && !this.nag) { this.nag = true; this.g.say('c6.turn'); f.gesture('point', 1); }
    }
  }
  action(id, down) {
    if (!down || this.busy || this.phase === 'hold') return;
    const f = this.friend.char, p = this.g.player.char;
    if (this.phase === 'tell') {   // talking over the friend
      this.oops('c6.interrupt'); f.setExpr('uneasy'); f.bubble('✋', 1.3); this.phase = 'hold';
      this.after(1.6, () => this.tell());
      return;
    }
    const icon = id === 'good' ? this.topic.good : this.topic.bad[+id[1]];
    p.gesture('talk', 1.5); p.bubble(icon, 2);
    if (id === 'good') { f.setExpr('joy'); f.bubble('😄', 2); this.win('c6.good'); }
    else {
      this.oops('c6.topic'); f.setExpr('puzzled'); f.bubble('❓', 1.3);
      this.after(1.6, () => { f.setExpr('happy'); f.bubble(this.topic.tell.join(''), 60); });
    }
  }
}

// ===== 7. Reading feelings and responding =====
const FEEL = {
  sad: { icon: '😢', anim: 'cry', expr: 'cry', good: '🫂', bad: ['😂', '🏃'], worse: '😭' },
  happy: { icon: '😀', anim: 'cheer', expr: 'joy', good: '🙌', bad: ['🙄', '😠'], worse: '😕' },
  angry: { icon: '😠', anim: 'angry', expr: 'angry', good: '↔️⏳', bad: ['😂', '🤗'], worse: '💢' },
  scared: { icon: '😨', anim: 'scared', expr: 'scared', good: '🤝', bad: ['👻', '😂'], worse: '😱' },
};
class Feelings extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => !p.dest }, { wait: 1.6 }, { press: () => this.feel }, { wait: 1.8 }, { press: 'good' }]; }
  key = 'c7'; icons = '👀 ➜ ❓ ➜ 💛'; rounds = 4;
  ambient() { this.spawn(KIDS[6], 0, -0.8).char.setAnim('lookAround'); }
  begin(real) { this.order = shuffle(Object.keys(FEEL)); super.begin(real); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    this.feel = this.order[r]; this.f = FEEL[this.feel]; this.step = 1; this.wait = false; this.spider = null;
    g.lock(true); p.char.setExpr('happy'); p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3);
    g.cam.focus = this.P(0, 0.4); g.cam.zoom = 0.58; g.cam.yaw = 0.85;
    this.friend = this.spawn(KIDS[(r * 3 + 6) % 8], 0, -0.8);
    const c = this.friend.char; c.setAnim(this.f.anim); c.setExpr(this.f.expr);
    const grp = new THREE.Group(); grp.position.set(this.c.x, 0, this.c.z);
    const add = (color, s, x, y, z) => { const m = cube(color, s); m.position.set(x, y, z); grp.add(m); return m; };
    if (this.feel === 'sad') { add('#d9a066', 0.16, 0.8, 0.08, -0.2); add('#ff9ec4', 0.3, 1.0, 0.06, -0.15).scale.y = 0.1; }   // dropped ice cream
    if (this.feel === 'happy') c.setProp('balloon');
    if (this.feel === 'angry') [['#e8524f', 0.9, 0.2, -0.3], ['#3f8fd6', 1.3, 0.2, 0.2], ['#f2b632', 0.6, 0.2, 0.5], ['#4caf6a', 1.5, 0.2, -0.6]].forEach(([col, x, y, z]) => { add(col, 0.38, x, y, z).rotation.y = x * 2; });   // toppled tower
    if (this.feel === 'scared') { this.spider = add('#222222', 0.34, 1.7, 0.17, -0.4); add('#e53935', 0.07, 1.62, 0.22, -0.22); add('#e53935', 0.07, 1.78, 0.22, -0.22); }
    this.grp = this.addObj(grp);
    g.ui.setGoal(this.icons, 'c7.goal');
    g.ui.setButtons(Object.keys(FEEL).map((k) => ({ id: k, icon: FEEL[k].icon })));
  }
  update(dt) {
    if (this.feel === 'scared' && this.grp) {
      if (this.calm) this.grp.position.x += dt * 2.5;   // the spider scuttles away
      else this.grp.position.x = this.c.x + Math.sin(performance.now() / 90) * 0.05;
    }
  }
  action(id, down) {
    if (!down || this.busy || this.wait) return;
    const g = this.g, c = this.friend.char;
    if (this.step === 1) {
      if (id === this.feel) {
        g.sfx.tick(); this.step = 2; g.say('c7.goal2');
        g.ui.setButtons(shuffle([{ id: 'good', icon: this.f.good }, { id: 'b0', icon: this.f.bad[0] }, { id: 'b1', icon: this.f.bad[1] }]));
      } else { this.oops('c7.face'); if (this.rm >= 2) g.ui.pulse(this.feel, true); }
      return;
    }
    if (id !== 'good') {
      this.oops('c7.act'); c.bubble(this.f.worse, 1.5);
      if (this.feel === 'happy') { c.setExpr('sad'); this.after(1.6, () => c.setExpr('joy')); }
      if (this.rm >= 2) g.ui.pulse('good', true);
      return;
    }
    this.wait = true; g.ui.setButtons([]);
    const p = g.player, done = () => { this.wait = false; this.win('c7.' + this.feel); };
    if (this.feel === 'sad') {
      p.walkTo(this.P(0, 0.15), () => { p.th = PI; p.char.setAnim('comfort'); p.char.bubble('❓💛', 2); }, 2);
      this.after(2.2, () => { c.setAnim('idle'); c.setExpr('sad'); });
      this.after(3.4, () => { c.setExpr('happy'); c.bubble('🙂', 2); p.char.setAnim('idle'); done(); });
    } else if (this.feel === 'happy') {
      p.char.setAnim('cheer'); p.char.setExpr('joy'); g.sfx.clap();
      this.after(2.2, () => { p.char.setAnim('idle'); p.char.setExpr('happy'); done(); });
    } else if (this.feel === 'angry') {
      p.walkTo(this.P(0, 3.8), () => { p.th = PI; p.char.bubble('⏳', 2); }, 2);   // step back and give time
      this.after(3, () => { c.setAnim('idle'); c.setExpr('neutral'); });
      this.after(4.4, () => { c.setExpr('happy'); c.gesture('waveSmall', 1.2); done(); });
    } else {
      p.walkTo(this.P(-0.95, -0.7), () => { p.th = 0; p.char.bubble('🤝', 2); }, 2);   // stay close and calm
      this.after(1.6, () => { this.calm = true; });
      this.after(2.6, () => { c.setAnim('idle'); c.setExpr('neutral'); });
      this.after(3.6, () => { c.setExpr('happy'); c.bubble('🙂', 2); this.calm = false; this.grp.visible = false; done(); });
    }
  }
}

// ===== 8. Asking to join a game, and sharing the ball =====
class PlayBall extends Challenge {
  demoSteps() { const p = this.g.player; return [{ walk: () => this.toward(this.c, 4.6) }, { wait: 0.8 }, { press: 'ask' }, { until: () => this.holder === p }, { wait: 1.3 }, { press: () => 'k' + this.kids.indexOf(this.waiting) }]; }
  key = 'c8'; icons = '🧍 ➜ 🙋 ➜ ⚽';
  ambient() { this.makeKids(); this.ball.position.set(this.c.x, 0.2, this.c.z); }
  makeKids() {
    this.kids = [this.spawn(KIDS[1], 0, -2.8, 0), this.spawn(KIDS[4], -2.8, 0, PI / 2), this.spawn(KIDS[7], 2.8, 0, -PI / 2)];
    this.ball = this.addObj(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshLambertMaterial({ color: '#ff7043' })));
    this.ball.castShadow = true;
  }
  setupRound(r) {
    if (r === 0) {
      this.makeKids();
      this.holder = this.kids[0]; this.holdT = 1; this.stage = 'ask'; this.inside = false; this.fly = null;
      this.since = 0; this.pHold = 0; this.waiting = null; this.lastWaiting = null;
      this.g.lock(false); this.g.ui.setButtons([{ id: 'ask', icon: '🙋' }]);
    } else this.setWaiting();
  }
  setWaiting() {   // one child keeps being left out and signals for the ball
    const opts = this.kids.filter((k) => k !== this.lastWaiting && k !== this.holder && k !== this.fly?.to);
    this.waiting = pick(opts.length ? opts : this.kids);
    this.waiting.char.setAnim('raise'); this.waiting.char.setExpr('sad'); this.waiting.char.bubble('🙋', 2.5);
  }
  throwTo(target) {
    const from = this.holder;
    this.fly = { fx: this.ball.position.x, fz: this.ball.position.z, to: target, t: 0 };
    from.face(target.pos); from.char.gesture('fiveHit', 0.4);
    this.holder = null;
  }
  choose(h) {
    const p = this.g.player;
    if (this.stage === 'play' && !p.dest && !this.busy && this.since >= 2) return p;
    const opts = this.kids.filter((k) => k !== h && k !== this.waiting);
    return pick(opts.length ? opts : this.kids.filter((k) => k !== h));
  }
  update(dt) {
    const g = this.g, p = g.player, b = this.ball.position;
    if (this.fly) {
      const f = this.fly; f.t = Math.min(1, f.t + dt / 0.7);
      b.set(f.fx + (f.to.pos.x - f.fx) * f.t, 0.8 + Math.sin(f.t * PI) * 1.3, f.fz + (f.to.pos.z - f.fz) * f.t);
      if (f.t >= 1) {
        this.holder = f.to; this.fly = null; this.holdT = rand(0.9, 1.4);
        if (this.holder === p) {
          this.since = 0; this.pHold = 0; p.char.setAnim('hold'); this.waiting?.char.bubble('🙋', 3);
          g.ui.setButtons([1, 0, 2].map((i) => ({ id: 'k' + i, img: faceIcon(this.kids[i].look, this.kids[i] === this.waiting ? 'sad' : 'happy') })));
          if (this.rm >= 2 && this.waiting) g.ui.pulse('k' + this.kids.indexOf(this.waiting), true);
        } else this.since++;
      }
    } else if (this.holder) {
      const h = this.holder;
      if (h === p) b.set(h.pos.x + 0.55, 0.95, h.pos.z - 0.1);   // held to the side so it stays visible
      else b.set(h.pos.x + Math.sin(h.heading) * 0.4, 0.75, h.pos.z + Math.cos(h.heading) * 0.4);
      if (h !== p) { if ((this.holdT -= dt) <= 0) this.throwTo(this.choose(h)); }
      else if (!this.busy && (this.pHold += dt) > 6) { this.pHold = 0; this.oops('c8.hold'); for (const k of this.kids) k.char.bubble('⏳', 1.4); }
    }
    for (const k of this.kids) if (k !== this.holder) k.face({ x: b.x, z: b.z });
    if (this.stage === 'ask' && !this.busy) {
      const d = dist(p.pos, this.c);
      if (d < 2.2 && !this.inside) {   // walking into the middle of the game
        this.inside = true; this.oops('c8.inside');
        for (const k of this.kids) k.char.setExpr('uneasy');
        this.kids[0].char.bubble('✋', 1.5);
        this.after(1.6, () => { for (const k of this.kids) k.char.setExpr('neutral'); });
      }
      if (d > 3) this.inside = false;
    }
  }
  action(id, down) {
    if (!down || this.busy) return;
    const g = this.g, p = g.player;
    if (id === 'ask') {
      const d = dist(p.pos, this.c);
      p.face(this.c); p.char.gesture('raise', 1.2);
      if (d > 6.5) { g.say('c8.far'); return; }
      if (d < 2.2) return;
      g.sfx.good(); g.say('c8.joined');
      for (const k of this.kids) k.char.setExpr('happy');
      this.kids[0].char.bubble('👍', 2);
      g.lock(true); p.walkTo(this.P(0, 2.8), () => { p.th = PI; }, 2.5);
      this.stage = 'play'; g.ui.setButtons([]); g.ui.setGoal('⚽ ➜ 🙋', 'c8.goal2');
      g.cam.focus = this.P(0, 0.5); g.cam.zoom = 0.82;
      this.after(1.5, () => this.setWaiting());
      return;
    }
    if (id[0] !== 'k' || this.holder !== p) return;
    const k = this.kids[+id[1]];
    g.ui.setButtons([]); p.char.setAnim('idle');
    this.throwTo(k);
    if (k === this.waiting) {
      k.char.setAnim('idle'); k.char.setExpr('joy'); k.char.bubble('😊', 2);
      this.lastWaiting = k; this.waiting = null; this.win('c8.good');
    } else { this.oops('c8.pass'); this.waiting?.char.bubble('😢', 1.6); }
  }
}

// ===== 9. Good sportsmanship: winning and losing gracefully =====
class GoodSport extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => this.stage === 'choose' }, { wait: 2 }, { press: 'good' }]; }
  key = 'c9'; icons = '🏃 ➜ 🏁 ➜ 🤝';
  ambient() { this.spawn(KIDS[3], -6, -1, PI / 2).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    this.pWins = [false, true, false][r]; this.stage = 'line'; this.left = 2;
    g.lock(true); g.ui.setButtons([]); p.char.setExpr('happy');
    this.focus = this.P(-5, 0.3); g.cam.focus = this.focus; g.cam.zoom = 0.85; g.cam.yaw = 0;
    p.walkTo(this.P(-6, 1.5), () => { p.th = PI / 2; }, 3.5);
    const f = this.friend = this.spawn(KIDS[(r * 2 + 3) % 8], -6, -1, PI / 2);
    this.after(1.8, () => { f.char.bubble('🏁', 0.9); p.char.bubble('🏁', 0.9); g.sfx.tick(); });
    this.after(2.8, () => {
      this.stage = 'run';
      p.walkTo(this.P(6.5, 1.5), () => this.arrive(), this.pWins ? 4.3 : 3.6);
      f.walkTo(this.P(6.5, -1), () => this.arrive(), this.pWins ? 3.6 : 4.3);
    });
  }
  arrive() {
    if (--this.left > 0) return;
    const p = this.g.player, f = this.friend;
    this.stage = 'choose'; p.face(f.pos); f.face(p.pos);
    this.g.cam.zoom = 0.62; this.g.cam.yaw = 0.7;
    if (this.pWins) { p.char.bubble('🏆', 2.5); f.char.setExpr('sad'); this.choices('🤝', ['😝', '🙄']); }
    else {   // the friend wins, celebrates briefly, then offers a hand: a model of being a good winner
      f.char.setAnim('cheer'); f.char.bubble('🏆', 2); p.char.setExpr('sad');
      this.after(1.5, () => { if (this.stage === 'choose') { f.char.setAnim('five'); f.char.setExpr('happy'); } });
      this.choices('🤝', ['😡', '😭']);
    }
  }
  update() { if (this.stage === 'run') this.focus.x = (this.g.player.pos.x + this.friend.pos.x) / 2; }
  action(id, down) {
    if (!down || this.busy || this.stage !== 'choose') return;
    const p = this.g.player.char, f = this.friend.char;
    if (id === 'good') {
      this.stage = 'done'; p.setExpr('happy'); p.gesture('fiveHit', 0.8); f.setAnim('idle'); f.gesture('fiveHit', 0.8);
      f.setExpr('joy'); f.bubble('😊', 2); this.g.sfx.clap(); this.win(this.pWins ? 'c9.won' : 'c9.lose');
    } else {
      this.oops('c9.bad'); p.gesture(this.iconOf(id) === '😭' ? 'cry' : 'angry', 1.2);
      f.setExpr('sad'); f.bubble('😕', 1.5); this.after(1.7, () => f.setExpr(this.pWins ? 'sad' : 'happy'));
    }
  }
}

// ===== 10. Handling teasing: stay calm, say stop, get an adult =====
class Teasing extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => !this.wait }, { wait: 1.5 }, { press: 'good' }]; }
  key = 'c10'; icons = '😜 ➜ 🧘 ➜ ✋';
  ambient() { this.spawn(KIDS[7], 0, -0.8).char.setAnim('lookAround'); this.spawn(VENDOR, 6, -4).char.setAnim('lookAround'); }
  setupRound(r) {
    const g = this.g, p = g.player;
    if (r === 0) {
      this.clear(); g.lock(true); p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3);
      this.teaser = this.spawn(KIDS[7], 0, -0.8); this.adult = this.spawn(VENDOR, 6, -4, -PI / 2); this.adult.char.setAnim('lookAround');
      g.cam.focus = this.P(1, -0.3); g.cam.zoom = 0.72; g.cam.yaw = 0.8;
    } else this.teaser.walkTo(this.P(0, -0.8), () => { this.teaser.th = 0; });
    this.wait = true; g.ui.setButtons([]);
    this.after(1.3, () => {
      const t = this.teaser.char;
      t.setAnim('laugh'); t.setExpr('laugh'); t.gesture('point', 1.2); t.bubble('😜', 2.5);
      p.char.setExpr('sad'); this.wait = false;
      this.choices(['🤷', '✋', '🧑‍🏫'][r], ['😡', '😭']);
    });
  }
  action(id, down) {
    if (!down || this.busy || this.wait) return;
    const g = this.g, p = g.player, t = this.teaser.char;
    if (id !== 'good') {   // getting upset is exactly what the teaser is after
      this.oops('c10.bad'); t.bubble('😂', 1.6); p.char.gesture(this.iconOf(id) === '😭' ? 'cry' : 'angry', 1.2); return;
    }
    p.char.setExpr('neutral');
    if (this.round === 0) { p.char.bubble('🤷', 2); t.setAnim('idle'); t.setExpr('puzzled'); t.bubble('❓', 1.5); this.win('c10.shrug'); }
    else if (this.round === 1) {
      p.char.gesture('five', 1.5); p.char.bubble('✋', 2); t.setAnim('idle'); t.setExpr('surprised');
      this.teaser.walkTo(this.P(0, -2.6), () => { this.teaser.th = 0; }); this.win('c10.stop');
    } else {
      this.wait = true; g.ui.setButtons([]); g.cam.zoom = 0.9;
      p.walkTo(this.P(4.8, -3), () => {
        p.char.gesture('raise', 1);
        this.adult.walkTo(this.P(1.3, -1.5), () => {
          this.adult.face(this.teaser.pos); this.adult.char.gesture('point', 1);
          t.setAnim('idle'); t.setExpr('sad'); t.bubble('🙏', 2); p.char.setExpr('happy');
          this.wait = false; this.win('c10.adult');
        });
      }, 3);
    }
  }
}

// ===== 11. It is OK to say no: listening to your own comfort =====
class SayNo extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => this.ready }, { wait: 1.8 }, { press: 'no' }]; }
  key = 'c11'; icons = '💭 ➜ 🙂 😖 ➜ 🙅';
  ambient() { this.spawn(KIDS[2], 0, -1).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    const R = this.R = [{ offer: 'hug', ok: false, look: KIDS[2] }, { offer: 'five', ok: true, look: KIDS[5] }, { offer: 'hug', ok: false, look: VENDOR }][r];
    this.ready = false; this.think = R.ok ? '💭🙂' : '💭😖';
    g.lock(true); g.cam.focus = this.P(0, 1.2); g.cam.zoom = 0.62; g.cam.yaw = 0.85;
    p.char.hideBubble(); p.walkTo(this.P(0, 2.6), () => { p.th = PI; }, 3);
    const f = this.friend = this.spawn(R.look, 0, -8);
    f.walkTo(this.P(0, R.offer === 'hug' ? 0.9 : 1.3), () => {
      f.th = 0; f.char.setAnim(R.offer === 'hug' ? 'openArms' : 'five'); f.char.setExpr('joy');
      // The player's own feeling is shown as a thought bubble: that is the cue to follow.
      p.char.setExpr(R.ok ? 'happy' : 'uneasy'); p.char.bubble(this.think, 120); this.ready = true;
    });
    g.ui.setButtons(shuffle([{ id: 'yes', icon: R.offer === 'hug' ? '🤗' : '✋' }, { id: 'no', icon: '🙅👋' }, { id: 'rude', icon: '😡' }]));
  }
  action(id, down) {
    if (!down || this.busy || !this.ready) return;
    const R = this.R, f = this.friend.char, p = this.g.player.char;
    if (id === 'rude') { this.oops('c11.kind'); p.gesture('angry', 1); f.setExpr('sad'); f.bubble('😢', 1.5); this.after(1.6, () => f.setExpr('joy')); return; }
    if ((id === 'yes') !== R.ok) { this.oops('c11.listen'); p.bubble(this.think, 120); return; }
    p.setExpr('happy');
    if (R.ok) { p.hideBubble(); p.gesture('fiveHit', 0.8); f.gesture('fiveHit', 0.6); this.g.sfx.clap(); f.bubble('😊', 2); this.win('c11.yes'); }
    else { p.gesture('wave', 1.2); p.bubble('🙅👋', 2); f.setAnim('wave'); f.setExpr('happy'); f.bubble('👍', 2); this.win('c11.no'); }   // the friend respects the "no"
  }
  finish() { this.g.player.char.hideBubble(); super.finish(); }
}

// ===== 12. Asking for help: a break, a hand, or "say it again" =====
class AskHelp extends Challenge {
  demoSteps() { const p = this.g.player; return [{ wait: 3 }, { press: 'good' }]; }
  key = 'c12'; icons = '😖 ➜ 🙋 ➜ 😌';
  ambient() { this.spawn(VENDOR, 5, 3, -PI / 2).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    this.wait = false; this.quiet = false; this.noisy = null;
    g.lock(true); p.char.hideBubble(); p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3);
    g.cam.focus = this.P(1, 0); g.cam.zoom = 0.8; g.cam.yaw = 0.6;
    this.adult = this.spawn(VENDOR, 5, 3, -PI / 2); this.adult.char.setAnim('lookAround');
    const feel = (expr, bub) => this.after(1.2, () => { p.char.setExpr(expr); p.char.bubble(bub, 120); });
    if (r === 0) {   // too loud
      this.noisy = [[-2, -1.5], [0, -2.3], [2, -1.5]].map(([x, z], i) => { const k = this.spawn(KIDS[i * 2], x, z); k.char.setAnim('cheer'); k.char.setExpr('joy'); return k; });
      this.noiseT = 0; feel('uneasy', '😖🔊'); this.choices('🙋🤫', ['😡', '🙈']);
    } else if (r === 1) {   // the ball is stuck out of reach
      this.ball = this.addObj(ballMesh()); this.ball.position.set(this.c.x + 3.5, 2.7, this.c.z - 3.5);
      feel('sad', '⚽❓'); this.choices('🙋🆘', ['😭', '😡']);
    } else {   // did not understand what was said
      this.friend = this.spawn(KIDS[4], 0, -0.8); this.friend.char.setAnim('talk'); this.friend.char.bubble('💬💨💬', 120);
      feel('puzzled', '❓'); this.choices('🙋❓', ['🙂👍', '🚶']);
    }
  }
  update(dt) {
    if (this.noisy && !this.quiet && (this.noiseT -= dt) <= 0) { this.noiseT = 0.9; pick(this.noisy).char.bubble(pick(['🥁', '📣', '🎺', '🔊']), 0.8); }
  }
  action(id, down) {
    if (!down || this.busy || this.wait) return;
    const g = this.g, p = g.player, a = this.adult;
    if (id !== 'good') { const ic = this.iconOf(id); this.oops('c12.bad'); if (ic === '😡' || ic === '😭') p.char.gesture(ic === '😭' ? 'cry' : 'angry', 1.2); return; }
    this.wait = true; g.ui.setButtons([]); p.char.gesture('raise', 1.5);
    const done = (key, bub) => { p.char.setExpr('happy'); p.char.bubble(bub, 2.2); this.wait = false; this.win(key); };
    if (this.round === 0) a.walkTo(this.P(1.7, 1.3), () => {
      a.face(this.P(0, -2)); a.char.bubble('🤫', 2); this.quiet = true;
      for (const k of this.noisy) { k.char.setAnim('idle'); k.char.hideBubble(); }
      done('c12.break', '😌');
    });
    else if (this.round === 1) a.walkTo(this.P(3.5, -2.3), () => {
      a.th = PI; a.char.gesture('raise', 1);
      this.after(0.9, () => { this.ball.position.set(p.pos.x + 0.55, 0.95, p.pos.z - 0.1); done('c12.help', '⚽😊'); });
    });
    else { this.friend.char.bubble('⚽ ➜ 🥅', 4); this.after(1.8, () => done('c12.again', '💡')); }
  }
  finish() { this.g.player.char.hideBubble(); super.finish(); }
}

// ===== Party island: everyone you met celebrates =====
export class Party extends Challenge {
  cast = KIDS;
  ambient() {
    this.cast.forEach((k, i) => {
      const a = -PI * 0.9 + (i / 7) * PI * 0.8;
      const kid = this.spawn(k, Math.cos(a) * 5.5, -1 + Math.sin(a) * 4.5 + 5);
      kid.char.setAnim('lookAround'); kid.char.setExpr('happy');
      if (i % 3 === 0) kid.char.setProp('balloon');
    });
  }
  begin() {
    for (const a of this.actors) { a.face(this.g.player.pos); a.char.setAnim('cheer'); a.char.setExpr('joy'); }
    this.actors[3].char.bubble('🎉', 4); this.actors[5].char.bubble('❤️', 4);
    this.after(6, () => { for (const a of this.actors) { a.char.setAnim('wave'); } });
    this.after(9, () => { for (const a of this.actors) { a.char.setAnim('idle'); a.char.setExpr('happy'); } });
  }
}

export const STATION_ICONS = ['👋', '👀', '💬', '🤗', '🍦', '🗨️', '😊', '⚽', '🏁', '🧘', '🙅', '🙋'];
export function makeChallenges(g) {
  return [Hello, WhoIsFree, JoinTalk, HugOrNot, Queue, Conversation, Feelings, PlayBall, GoodSport, Teasing, SayNo, AskHelp, Party].map((C, i) => new C(g, i));
}
