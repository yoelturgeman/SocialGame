import * as THREE from 'three';
import { rand, shuffle, clamp } from './util.js';
import { faceIcon } from './character.js';
import { Challenge, Party } from './challenges.js';

// ---------- cast for the 10-16 section ----------
const T = (skin, hair, style, shirt, pants, scale) => ({ smooth: true, skin, hair, style, shirt, pants, scale });
export const TEENS = [
  T('#f1c9a5', '#4a2f1a', 'long', '#d9534f', '#2f3a55', 1.02),
  T('#c98f62', '#1c1410', 'short', '#3b7dd8', '#2c2f38', 1.08),
  T('#7a4e33', '#15100d', 'curly', '#f0b429', '#3a3f4a', 1.03),
  T('#f3d6bb', '#b9792f', 'short', '#3aa76d', '#4a3f35', 1.06),
  T('#e2b48c', '#8a3d1c', 'pony', '#8a63d2', '#2f3a44', 1.02),
  T('#a26b45', '#201512', 'bun', '#e8743b', '#34495e', 1.0),
  T('#f6dcc4', '#d8b24c', 'pony', '#2aa8a1', '#55384f', 1.01),
  T('#5f3d28', '#1a1310', 'short', '#c94b6a', '#2b3440', 1.09),
];
export const TEEN_AVATARS = [
  T('#f1c9a5', '#3a2416', 'pony', '#ff6f91', '#2f3a55', 1.04),
  T('#a26b45', '#15100d', 'long', '#ffc233', '#3a3f4a', 1.04),
  T('#f6dcc4', '#d8b24c', 'curly', '#8f6bff', '#34495e', 1.04),
  T('#f3d6bb', '#4a2f1a', 'short', '#2f8fff', '#2c2f38', 1.04),
  T('#7a4e33', '#1b1310', 'short', '#2fbf71', '#3a3f4a', 1.04),
  T('#e2b48c', '#b5521f', 'curly', '#ff7b3a', '#2f3a44', 1.04),
];
const PI = Math.PI;

// Shared ending: both sides relax, optional bubbles, then the round is won.
const end = (c, done, pb, fb, t = 1.9) => {
  const p = c.g.player.char; p.setExpr('happy'); if (pb) p.bubble(pb, 2.4);
  if (c.friend) { const f = c.friend.char; f.setExpr('joy'); f.setAnim('idle'); if (fb) f.bubble(fb, 2.4); }
  c.after(t, done);
};
const upset = (c, icon) => {
  const p = c.g.player.char;
  if (/😡|💥|📢|🤜|😠/u.test(icon)) p.gesture('angry', 1.2);
  if (/😭/u.test(icon)) p.gesture('cry', 1.2);
  c.friend?.char.bubble('😕', 1.5);
};

// ---------- data-driven scene: watch, (optionally listen), then choose one of three responses ----------
class Scenario extends Challenge {
  begin(real) { this.rounds = this.scenes.length; super.begin(real); }
  demoSteps() { return [{ until: () => !this.wait && this.phase !== 'tell' }, { wait: 1.5 }, { press: 'good' }]; }
  // player and one other teen facing each other, three-quarter camera
  duo(look, heading = 0) {
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.char.setProp(null); p.char.setAnim('idle');
    p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3.2);
    g.cam.focus = this.P(0, 0.4); g.cam.zoom = 0.62; g.cam.yaw = 0.85;
    this.friend = this.spawn(look, 0, -0.8, heading);
    return this.friend;
  }
  setupRound(r) {
    this.clear();
    const g = this.g, s = this.sc = this.scenes[r];
    this.wait = true; this.phase = null; this.friend = null;
    g.ui.setButtons([]); g.ui.phone(null);
    if (r > 0 && s.goal) g.ui.setGoal(this.icons, s.goal);
    s.stage(this);
    this.after(s.delay ?? 1.6, () => {
      this.wait = false; this.choices(s.good, s.bad);
      if (s.tell) { this.phase = 'tell'; this.n = 0; this.tt = 0.5; }
    });
  }
  update(dt) {
    const s = this.sc;
    if (!s || this.busy) return;
    if (this.phase === 'tell' && (this.tt -= dt) <= 0) {   // the other person is still speaking
      const f = this.friend.char;
      if (this.n < s.tell.length) { this.n++; f.setAnim('talk'); f.bubble(s.tell.slice(0, this.n).join(' '), 90); this.tt = 1.2; }
      else { this.phase = 'wait'; f.setAnim('listen'); }
    }
  }
  action(id, down) {
    if (!down || this.busy || this.wait) return;
    const s = this.sc, g = this.g;
    if (this.phase === 'tell') {
      this.oops(this.key + '.interrupt');
      const f = this.friend.char; f.setExpr('uneasy'); f.bubble('✋', 1.2); this.wait = true;
      this.after(1.5, () => { f.setExpr('neutral'); this.wait = false; this.n = 0; this.tt = 0.3; });
      return;
    }
    if (id === 'good') { this.wait = true; g.ui.setButtons([]); s.ok(this, () => { this.wait = false; this.win(s.win); }); }
    else { this.oops(this.key + '.bad'); (s.fail || upset)(this, this.iconOf(id)); if (this.rm >= 2) g.ui.pulse('good', true); }
  }
  finish() {
    const p = this.g.player.char; p.hideBubble(); p.setProp(null); p.setExpr('happy'); p.setAnim('idle');
    this.g.ui.phone(null); super.finish();
  }
}

// ===== 1. Self-calming: breathe first, respond later =====
class Calm extends Scenario {
  demoSteps() { return [...super.demoSteps(), { until: () => !!this.br }, { press: 'breath', hold: 4, pre: 0 }, { until: () => !this.br }]; }
  key = 't1'; icons = '😤 ➜ 😮‍💨 ➜ 😌';
  ambient() { this.spawn(TEENS[3], 2.5, -2).char.setAnim('lookAround'); }
  solo(expr, anim, bub) {
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.walkTo(this.P(0, 0.8), () => { p.th = 0; }, 3.2);   // faces the camera
    g.cam.focus = this.P(0, 0.9); g.cam.zoom = 0.5; g.cam.yaw = 0.45;
    this.after(1.1, () => { p.char.setExpr(expr); p.char.setAnim(anim); p.char.bubble(bub, 120); });
  }
  scenes = [
    { stage: (c) => c.solo('angry', 'angry', '📝❌'), good: '😮‍💨', bad: ['💥', '📢'], ok: (c, d) => c.breathe(d), win: 't1.r1' },
    {
      goal: 't1.goal2', good: '😮‍💨', bad: ['🏃', '🙈'], ok: (c, d) => c.breathe(d), win: 't1.r2',
      stage: (c) => { c.solo('scared', 'scared', '🎤😰'); [[-2.2, 4.6], [0, 5.2], [2.2, 4.6]].forEach(([x, z], i) => c.spawn(TEENS[i * 2 + 1], x, z, PI)); },
    },
    {
      goal: 't1.goal3', good: '😮‍💨➜💬', bad: ['📢', '💥'], win: 't1.r3',
      stage: (c) => { c.solo('angry', 'angry', '💢'); c.friend = c.spawn(TEENS[3], 2.2, -0.6, PI * 0.6); c.friend.char.setAnim('crossed'); c.friend.char.setExpr('angry'); },
      ok: (c, d) => c.breathe(() => { const f = c.friend; f.face(c.g.player.pos); c.g.player.face(f.pos); f.char.setAnim('listen'); f.char.setExpr('neutral'); c.g.player.char.bubble('💬🙂', 2.2); c.after(1.6, d); }),
    },
  ];
  begin(real) { this.br = null; super.begin(real); }
  // Paced breathing: hold the button while the ring grows (in), let go while it shrinks (out).
  breathe(done) {
    const g = this.g;
    this.br = { t: 0, level: 0, err: 0, good: 0, miss: 0, hold: false, done };
    this.wait = false; g.ui.setButtons([{ id: 'breath', icon: '😮‍💨' }]); g.say('t1.breathe');
    g.player.char.hideBubble(); g.player.char.setAnim('idle');
  }
  action(id, down) {
    if (this.br) { if (id === 'breath') this.br.hold = down; return; }
    super.action(id, down);
  }
  update(dt) {
    super.update(dt);
    const b = this.br; if (!b) return;
    const IN = 4, OUT = 5, g = this.g, pc = g.player.char;
    b.t += dt;
    const target = b.t < IN ? b.t / IN : Math.max(0, 1 - (b.t - IN) / OUT);
    b.level = clamp(b.level + (b.hold ? dt / IN : -dt / OUT), 0, 1);
    b.err += Math.abs(b.level - target) * dt;
    g.ui.breath(target, b.level, b.t < IN, b.good);
    if (b.t < IN + OUT) return;
    const avg = b.err / (IN + OUT); b.t = 0; b.err = 0;
    if (avg < 0.2) {
      b.good++; b.miss = 0; g.sfx.tick(); pc.setExpr(b.good === 1 ? 'sad' : 'neutral');
      if (b.good >= (this.demo ? 1 : 3)) {   // the demonstration shows a single breath
        this.br = null; g.ui.breath(null); g.ui.setButtons([]); g.sfx.good();
        pc.setExpr('happy'); pc.bubble('😌', 2); this.wait = true; this.after(1.4, b.done);
      }
    } else if (++b.miss >= 2) { b.miss = 0; this.oops('t1.follow'); } else g.say('t1.follow');
  }
  finish() { this.br = null; this.g.ui.breath(null); super.finish(); }
}

// ===== 2. Two-way conversation: notice when the listener has had enough =====
class ReadRoom extends Challenge {
  demoSteps() { const p = this.g.player; return [{ until: () => !p.dest }, { wait: 0.8 }, { press: 'talk', until: () => this.state === 'bored' }, { wait: 1.4 }, { press: 'ask' }]; }
  key = 't2'; icons = '💬 ➜ 👀 ➜ ❓';
  ambient() { this.spawn(TEENS[4], 0, -0.8).char.setAnim('lookAround'); }
  setupRound(r) {
    this.clear();
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3.2);
    g.cam.focus = this.P(0, 0.4); g.cam.zoom = 0.62; g.cam.yaw = 0.85;
    const f = this.friend = this.spawn(TEENS[(r * 2 + 4) % 8], 0, -0.8);
    f.char.setAnim('listen'); f.char.setExpr('happy'); f.lookTarget = p.pos;
    this.state = 'engaged'; this.talked = 0; this.limit = rand(3, 4.5); this.boredT = 0; this.talking = false; this.n = 0; this.bt = 0;
    this.mine = ['🚂', '🎮', '🦖'][r]; this.theirs = ['🎸', '🐕', '🏀'][r];
    g.ui.setButtons([{ id: 'talk', icon: '💬' }, { id: 'ask', icon: '❓' }]);
  }
  update(dt) {
    if (this.busy) return;
    const f = this.friend, pc = this.g.player.char;
    if (this.talking) {
      this.talked += dt; pc.setAnim('talk');
      if ((this.bt -= dt) <= 0) { this.bt = 1; this.n = Math.min(4, this.n + 1); pc.bubble(this.mine.repeat(this.n), 1.4); }
    } else if (pc.anim === 'talk') pc.setAnim('idle');
    if (this.state === 'engaged' && this.talked >= this.limit) {
      // interest fades; the cues get subtler each round
      this.state = 'bored'; f.lookTarget = null; f.char.setExpr('neutral');
      if (this.round === 0) { f.char.setAnim('lookAround'); f.char.bubble('🥱', 2); }
      else if (this.round === 1) { f.char.setProp('phone'); f.char.setAnim('eat'); }
      else f.char.setAnim('lookAround');
    }
    if (this.state === 'bored' && this.talking && (this.boredT += dt) > 2.2) {
      this.boredT = 0; this.oops('t2.bored'); f.char.bubble('😶', 1.2);
      if (this.rm >= 2) this.g.ui.pulse('ask', true);
    }
  }
  action(id, down) {
    if (this.busy) return;
    if (id === 'talk') { this.talking = down; if (down) this.bt = 0; return; }
    if (!down) return;
    const f = this.friend, p = this.g.player;
    if (this.state !== 'bored') { this.g.say('t2.share'); f.char.bubble(this.theirs, 1.2); return; }
    this.talking = false; f.char.setProp(null); f.char.setAnim('talk'); f.char.setExpr('joy'); f.lookTarget = p.pos;
    f.char.bubble(this.theirs + this.theirs + '😄', 2.4); p.char.bubble('❓', 1.2); p.char.setAnim('listen');
    this.win('t2.ask');
  }
  finish() { this.g.player.char.setAnim('idle'); super.finish(); }
}

// ===== 3. Teamwork: share roles, combine ideas, fix mistakes together =====
class Team extends Scenario {
  demoSteps() {
    const role = () => { const r = this.wants.indexOf(this.tasks[this.ti]); return r >= 0 ? 'm' + r : 'me'; };
    const one = [{ wait: 1.5 }, { press: role }];
    return [{ until: () => !this.wait }, ...one, ...one, ...one, ...one];
  }
  key = 't3'; icons = '🧩 ➜ 👥 ➜ 🤝';
  ambient() { this.spawn(TEENS[0], -2.4, -2.2, PI / 2).char.setAnim('lookAround'); this.spawn(TEENS[2], 2.4, -2.2, -PI / 2).char.setAnim('lookAround'); }
  team() {
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.walkTo(this.P(0, 0.3), () => { p.th = PI; }, 3.2);
    g.cam.focus = this.P(0, -1.7); g.cam.zoom = 0.8; g.cam.yaw = 0.45;
    this.mates = [this.spawn(TEENS[0], -2.4, -2.2, PI / 2), this.spawn(TEENS[1], 0, -4.3, 0), this.spawn(TEENS[2], 2.4, -2.2, -PI / 2)];
    const table = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#b98a55', roughness: 0.7 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.2), m); top.position.y = 0.8; top.castShadow = true; table.add(top);
    for (const [x, z] of [[-1, -0.5], [1, -0.5], [-1, 0.5], [1, 0.5]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), m); l.position.set(x, 0.4, z); table.add(l); }
    const paper = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.8), new THREE.MeshStandardMaterial({ color: '#fbfaf5' })); paper.position.y = 0.86; table.add(paper);
    table.position.set(this.c.x, 0, this.c.z - 2.3); this.addObj(table);
  }
  scenes = [
    { stage: () => {}, good: '', bad: ['', ''], ok: () => {}, win: 't3.roles' },   // round 1 is the role-sharing game below
    {
      goal: 't3.goal2', good: '🚀➕🌊', bad: ['👉🦖', '🚶'], win: 't3.combine',
      stage: (c) => { c.team(); c.after(1, () => { const [a, , b] = c.mates; a.char.setAnim('talk'); a.char.bubble('🚀', 120); a.char.setExpr('uneasy'); b.char.setAnim('talk'); b.char.bubble('🌊', 120); b.char.setExpr('uneasy'); }); },
      ok: (c, d) => { for (const m of c.mates) { m.char.setAnim('idle'); m.char.setExpr('joy'); m.char.hideBubble(); } c.mates[1].char.bubble('👍', 2); c.g.player.char.bubble('🚀➕🌊', 2.4); c.after(1.9, d); },
      fail: (c) => c.mates[1].char.bubble('😕', 1.5),
    },
    {
      goal: 't3.goal3', good: '🤝🧽', bad: ['👉😠', '😂'], win: 't3.help',
      stage: (c) => {
        c.team();
        const spill = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.02, 24), new THREE.MeshStandardMaterial({ color: '#e5484d', roughness: 0.2 }));
        spill.position.set(c.c.x + 1.3, 0.03, c.c.z - 1.0); c.spill = c.addObj(spill);
        c.after(1, () => { c.mates[2].char.setExpr('sad'); c.mates[2].char.bubble('😳', 120); });
      },
      ok: (c, d) => {
        const p = c.g.player;
        p.walkTo(c.P(1.2, -0.3), () => { p.th = PI; p.char.setAnim('tend'); });
        c.after(2.2, () => { c.spill.visible = false; p.char.setAnim('idle'); c.mates[2].char.setExpr('joy'); c.mates[2].char.bubble('🙏😊', 2.2); c.after(1.2, d); });
      },
      fail: (c) => c.mates[2].char.bubble('😢', 1.5),
    },
  ];
  setupRound(r) {
    if (r > 0) return super.setupRound(r);
    this.clear(); this.sc = null; this.team();
    this.tasks = shuffle(['🎨', '✍️', '🔍', '✂️']); this.wants = ['🎨', '✍️', '🔍']; this.ti = 0; this.wait = true;
    this.g.ui.setButtons([]);
    this.after(1.6, () => {
      this.wait = false;
      this.g.ui.setButtons([...this.mates.map((m, i) => ({ id: 'm' + i, img: faceIcon(m.look) })), { id: 'me', img: faceIcon(this.g.player.look) }]);
      this.nextTask();
    });
  }
  nextTask() {
    const t = this.tasks[this.ti];
    this.g.ui.icons('❓ ➜ ' + t);
    this.mates.forEach((m, i) => { if (this.wants[i]) m.char.bubble(this.wants[i], 120); });   // each says what they would like to do
  }
  action(id, down) {
    if (this.sc) return super.action(id, down);
    if (!down || this.busy || this.wait) return;
    const t = this.tasks[this.ti], right = this.wants.indexOf(t), pick = id === 'me' ? -1 : +id[1];
    if (pick !== right) {
      this.oops(pick === -1 ? 't3.share' : 't3.listen');
      if (right >= 0) this.mates[right].char.gesture('raise', 1.2);
      if (this.rm >= 2) this.g.ui.pulse(right >= 0 ? 'm' + right : 'me', true);
      return;
    }
    this.g.sfx.tick(); this.g.ui.pulse(id, false);
    if (right >= 0) { const m = this.mates[right].char; this.wants[right] = null; m.bubble(t + '👍', 2); m.setExpr('joy'); }
    else this.g.player.char.bubble(t + '👍', 2);
    if (++this.ti >= 4) this.win('t3.roles'); else this.nextTask();
  }
}

// ===== 4. Compromise: fair to both sides, in both directions =====
class Compromise extends Scenario {
  key = 't4'; icons = '🙋 ≠ 🙋 ➜ ⚖️';
  ambient() { this.spawn(TEENS[1], 0, -0.8).char.setAnim('lookAround'); }
  want(look, theirs, mine, prop) {
    const f = this.duo(look); if (prop) f.char.setProp(prop);
    this.after(1.1, () => { f.char.setAnim('talk'); f.char.bubble(theirs, 120); this.g.player.char.bubble(mine, 120); });
  }
  scenes = [
    { stage: (c) => c.want(TEENS[1], '⚽', '🎮'), good: '⚽➜🎮', bad: ['🎮🎮', '😤'], ok: (c, d) => end(c, d, '⚽➜🎮', '👍'), win: 't4.turns' },
    { goal: 't4.goal2', stage: (c) => c.want(TEENS[6], '🎂🍕', '🍔', 'balloon'), good: '🎁🍕', bad: ['🍔🍔', '😤'], ok: (c, d) => end(c, d, '🎁🍕', '😊'), win: 't4.give' },
    { goal: 't4.goal3', stage: (c) => { c.want(TEENS[1], '🎢', '🎡'); c.g.player.char.setExpr('sad'); }, good: '🙋🎡➜🎢', bad: ['😶🎢', '😡'], ok: (c, d) => end(c, d, '🎡➜🎢', '👌'), win: 't4.speak', fail: (c, ic) => (ic === '😡' ? upset(c, ic) : c.g.player.char.bubble('😞', 1.5)) },
  ];
}

// ===== 5. Respectful debate: listen, answer the point (not the person), agree to disagree =====
class Debate extends Scenario {
  key = 't5'; icons = '👂 ➜ 🤔 ➜ 🤝';
  ambient() { this.spawn(TEENS[7], 0, -0.8).char.setAnim('lookAround'); }
  stageDebate() {
    this.duo(TEENS[7]);
    [[-3.2, -5], [0, -5.8], [3.2, -5]].forEach(([x, z], i) => { const a = this.spawn(TEENS[i * 2], x, z); a.char.sit = true; a.char.setAnim('listen'); });
  }
  scenes = [
    { delay: 0.9, tell: ['🐶', '>', '🐱'], stage: (c) => c.stageDebate(), good: '🤔💬🐱', bad: ['👉🤪', '📢😡'], ok: (c, d) => { c.g.player.char.gesture('talk', 1.6); c.g.player.char.bubble('🐱 ❤️ 💬', 2.4); c.friend.char.bubble('🤔', 2); c.after(2, d); }, win: 't5.calm' },
    { delay: 0.9, goal: 't5.goal2', tell: ['🐶', '🦮', '❤️'], stage: (c) => c.stageDebate(), good: '👍➕💬', bad: ['🙉', '🙄'], ok: (c, d) => end(c, d, '👍 ➕ 🐱', '🙂'), win: 't5.point' },
    { delay: 0.9, goal: 't5.goal3', tell: ['🐶', '≠', '🐱', '🤷'], stage: (c) => c.stageDebate(), good: '🤝🙂', bad: ['🏆😤', '🚶😠'], ok: (c, d) => { c.g.player.char.gesture('fiveHit', 0.8); c.friend.char.gesture('fiveHit', 0.8); c.g.sfx.clap(); end(c, d, '🤝', '🤝'); }, win: 't5.agree' },
  ];
}

// ===== 6. Apology and forgiveness =====
class Forgive extends Scenario {
  key = 't6'; icons = '💔 ➜ 🙏 ➜ 🕊️';
  ambient() { this.spawn(TEENS[2], 0, -0.8).char.setAnim('lookAround'); }
  hurt(look, anim, bub, mine, heading = 0) {
    const f = this.duo(look, heading); f.char.setExpr('sad');
    this.after(1.1, () => { f.char.setAnim(anim); f.char.bubble(bub, 120); this.g.player.char.setExpr(mine); });
  }
  scenes = [
    { stage: (c) => c.hurt(TEENS[2], 'listen', '🎧💔 🙏', 'angry'), good: '💬🤝', bad: ['💥', '🧊'], ok: (c, d) => end(c, d, '😔 ➜ 🤝', '😊'), win: 't6.accept', fail: (c, ic) => { c.friend.char.bubble('😢', 1.5); if (ic === '💥') c.g.player.char.gesture('angry', 1.2); } },
    { goal: 't6.goal2', stage: (c) => c.hurt(TEENS[4], 'crossed', '⏰ 😞', 'uneasy'), good: '🙏🔧', bad: ['🤷🙄', '🙈'], ok: (c, d) => end(c, d, '🙏 ⏰ ➜ 🍦', '🙂'), win: 't6.sorry', fail: (c) => c.friend.char.bubble('😒', 1.5) },
    {
      goal: 't6.goal3', stage: (c) => c.hurt(TEENS[4], 'crossed', '⏳', 'sad', PI * 0.7), good: '⏳🙂', bad: ['📣🙏', '😡'], win: 't6.time',
      ok: (c, d) => {
        const p = c.g.player; p.walkTo(c.P(0, 3.7), () => { p.th = PI; p.char.bubble('⏳', 2); }, 2);
        c.after(3, () => { c.friend.th = 0; c.friend.char.gesture('waveSmall', 1.4); end(c, d, null, '🙂', 1.6); });
      },
      fail: (c) => c.friend.char.bubble('😣', 1.5),
    },
  ];
}

// ===== 7. Peer pressure: a clear no, an alternative, and walking away =====
class Pressure extends Scenario {
  key = 't7'; icons = '👥❗ ➜ ✋ ➜ 🚶';
  ambient() { this.spawn(TEENS[7], 0, -1).char.setAnim('lookAround'); this.spawn(TEENS[3], -1.5, -1.6, 0.3).char.setAnim('lookAround'); }
  gang(bub, laugh) {
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.char.setExpr('uneasy'); p.walkTo(this.P(0, 1.7), () => { p.th = PI; }, 3.2);
    g.cam.focus = this.P(0, 0.2); g.cam.zoom = 0.72; g.cam.yaw = 0.6;
    this.crew = [this.spawn(TEENS[7], 0, -1), this.spawn(TEENS[3], -1.5, -1.5, 0.35), this.spawn(TEENS[5], 1.5, -1.5, -0.35)];
    this.friend = this.crew[0];
    this.pal = this.spawn(TEENS[6], 6.3, 4.6, -PI / 2); this.pal.char.setAnim('lookAround'); this.pal.char.setExpr('happy');
    this.after(1.1, () => {
      this.friend.char.gesture('point', 1.4); this.friend.char.bubble(bub, 120);
      if (laugh) for (const m of this.crew) { m.char.setAnim('laugh'); m.char.setExpr('laugh'); if (m !== this.friend) m.char.bubble('🐔', 120); }
    });
  }
  giveIn(c, ic) { if (ic === '😰👍') c.g.player.char.bubble('😰', 1.5); else upset(c, ic); c.friend.char.bubble('😏', 1.5); }
  scenes = [
    { stage: (c) => c.gang('🚧🏃❗'), good: '✋🙂', bad: ['😰👍', '😡'], fail: (c, ic) => c.giveIn(c, ic), win: 't7.no', ok: (c, d) => { const p = c.g.player.char; p.setExpr('neutral'); p.gesture('five', 1.5); p.bubble('✋', 2); c.friend.char.setExpr('puzzled'); c.after(1.8, d); } },
    { goal: 't7.goal2', stage: (c) => c.gang('😏👉', true), good: '✋🏀', bad: ['😰👍', '😭'], fail: (c, ic) => c.giveIn(c, ic), win: 't7.alt', ok: (c, d) => { const p = c.g.player.char; p.setExpr('neutral'); p.bubble('✋ ➜ 🏀', 2.4); for (const m of c.crew) { m.char.setAnim('idle'); m.char.setExpr('neutral'); m.char.hideBubble(); } c.after(2, d); } },
    {
      goal: 't7.goal3', stage: (c) => c.gang('👉😏', true), good: '🚶👫', bad: ['😰👍', '🤜'], fail: (c, ic) => c.giveIn(c, ic), win: 't7.leave',
      ok: (c, d) => {
        const p = c.g.player; c.g.cam.focus = c.P(3, 2.5); c.g.cam.zoom = 0.9;
        p.walkTo(c.P(5.2, 4.6), () => { p.face(c.pal.pos); p.char.setExpr('happy'); c.pal.face(p.pos); c.pal.char.setAnim('wave'); c.pal.char.setExpr('joy'); c.pal.char.bubble('😊', 2); c.after(1.6, d); }, 2.6);
      },
    },
  ];
}

// ===== 8. Friends on screen: group chats, angry messages, unclear tone =====
class Digital extends Scenario {
  key = 't8'; icons = '📱 ➜ 🤔 ➜ 💬';
  ambient() { const a = this.spawn(TEENS[5], 2.5, -7.2); a.char.setProp('phone'); a.char.setAnim('eat'); }
  chat(expr, msgs) {
    const g = this.g, p = g.player;
    g.lock(true); p.char.hideBubble(); p.walkTo(this.P(0, -6.9), () => { p.th = 0; p.char.setProp('phone'); p.char.setAnim('eat'); p.char.setExpr(expr); }, 3.2);
    g.cam.focus = this.P(1.6, -6.6); g.cam.zoom = 0.6; g.cam.yaw = 0.35;
    this.msgs = msgs; this.after(1.3, () => g.ui.phone(this.msgs));
  }
  reply(d, extra) { this.msgs = this.msgs.filter((m) => !m.draft).concat(extra); this.g.ui.phone(this.msgs); this.g.player.char.setExpr('happy'); this.after(2.4, d); }
  scenes = [
    { stage: (c) => c.chat('uneasy', [{ who: TEENS[3], txt: '📸 🧑‍🦱💦 🤣' }, { who: TEENS[7], txt: '😂😂😂' }, { who: TEENS[5], txt: '📤 ❓' }]), good: '🙅📤➜❤️', bad: ['📤😂', '👎🤡'], ok: (c, d) => c.reply(d, [{ me: true, txt: '🙅 📤' }, { me: true, txt: '❤️ ➜ 🧑‍🦱' }]), win: 't8.stop', fail: () => {} },
    { goal: 't8.goal2', stage: (c) => c.chat('angry', [{ who: TEENS[1], txt: '👎 💡 🙄' }, { me: true, draft: true, txt: '🤬🤬 ✍️…' }]), good: '⏳➜💬', bad: ['📤🤬', '🚫👤'], ok: (c, d) => c.reply(d, [{ me: true, txt: '⏳ ➜ 💬 🤝' }]), win: 't8.wait', fail: () => {} },
    { goal: 't8.goal3', stage: (c) => c.chat('puzzled', [{ me: true, txt: '🎬 ❓ 🙂' }, { who: TEENS[4], txt: '👍.' }]), good: '❓🙂', bad: ['😡💬', '😭'], ok: (c, d) => c.reply(d, [{ me: true, txt: '❓ 🙂' }, { who: TEENS[4], txt: '😊 🎬 👍👍' }]), win: 't8.ask', fail: () => {} },
  ];
}

class TeenParty extends Party { cast = TEENS; }

export const TEEN_ICONS = ['😮‍💨', '👂', '🧩', '⚖️', '🗣️', '🕊️', '✋', '📱'];
export function makeTeenChallenges(g) {
  return [Calm, ReadRoom, Team, Compromise, Debate, Forgive, Pressure, Digital, TeenParty].map((C, i) => new C(g, i));
}
