import * as THREE from 'three';
import { World, N_CH as KID_N, CENTER as KID_CENTER } from './world.js';
import { TeenWorld } from './world_teen.js';
import { makeTeenChallenges, TEEN_AVATARS, TEEN_ICONS } from './challenges_teen.js';
import { Actor, faceIcon } from './character.js';
import { makeChallenges, AVATARS as KID_AVATARS, STATION_ICONS as KID_ICONS } from './challenges.js';
import { sfx, audio, speak } from './audio.js';
import { S, text } from './strings.js';

const $ = (id) => document.getElementById(id);

// Two sections share one engine: ages 6-10 (voxel world) and 10-16 (?mode=teen).
const TEEN = new URLSearchParams(location.search).get('mode') === 'teen';
const AVATARS = TEEN ? TEEN_AVATARS : KID_AVATARS, STATION_ICONS = TEEN ? TEEN_ICONS : KID_ICONS;
document.body.classList.toggle('teen', TEEN);
const glyphs = (s) => [...new Intl.Segmenter().segment(s || '')].length;

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
if (TEEN) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.62; }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 500);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const world = TEEN ? new TeenWorld(scene, renderer) : new World(scene);
const N_CH = TEEN ? world.N : KID_N, CENTER = TEEN ? world.center : KID_CENTER;

// ---------- saved progress ----------
const SAVE_KEY = TEEN ? 'friends-square-teen-v1' : 'friends-square-v1';
let save = { stars: Array(N_CH).fill(0), unlocked: 0, avatar: 0, sound: true, speech: true, captions: true, watch: true };
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch { /* storage unavailable */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };
while (save.stars.length < N_CH) save.stars.push(0);   // older saves had fewer stations
audio.sound = save.sound; audio.speech = save.speech;

// ---------- UI ----------
const ui = {
  setGoal(icons, key) { $('goal-icons').textContent = icons; $('goal').classList.add('show'); g.say(key); },
  setDots(n, i) { $('dots').innerHTML = n > 1 ? Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('') : ''; },
  setButtons(list) {
    const box = $('buttons'); box.innerHTML = '';
    list.forEach((b) => {
      const el = document.createElement('button');
      el.className = 'act'; el.dataset.id = b.id;
      el.innerHTML = (b.img ? `<img src="${b.img}" alt="">` : `<span class="g${Math.min(4, glyphs(b.icon))}">${b.icon}</span>`) + '<div class="ring"></div>';
      const up = () => g.action(b.id, false);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.init(); g.action(b.id, true); });
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
      box.appendChild(el);
    });
  },
  button(id) { return $('buttons').querySelector(`[data-id="${id}"]`); },
  pulse(id, on) { this.button(id)?.classList.toggle('pulse', on); },
  // Progress ring around a hold-button; zone = [from, to] fraction shown in green.
  ring(id, frac, zone) {
    const r = this.button(id)?.querySelector('.ring'); if (!r) return;
    if (!zone) { r.style.display = 'none'; return; }
    r.style.display = 'block';
    r.style.background = `conic-gradient(#33405a 0 ${frac}turn, transparent ${frac}turn), conic-gradient(#ffffffaa 0 ${zone[0]}turn, #49c96a ${zone[0]}turn ${zone[1]}turn, #f0685a ${zone[1]}turn)`;
  },
  flash(ok) {
    const f = $('flash'); f.textContent = ok ? '✔' : '↺'; f.className = ok ? 'ok' : 'retry';
    void f.offsetWidth; f.classList.add('go');
  },
  icons(str) { $('goal-icons').textContent = str; },
  // "watch first" demonstration: banner + frame, and a finger on the button being pressed
  watch(on) { document.body.classList.toggle('demo', on); },
  demoPress(id, on) { const b = this.button(id); b?.classList.toggle('down', on); b?.classList.toggle('finger', on); },
  // phone screen for the online-communication challenge
  phone(msgs) {
    const el = $('phone'); el.classList.toggle('show', !!msgs); if (!msgs) return;
    el.innerHTML = '<div class="notch"></div>' + msgs.map((m) => `<div class="msg ${m.me ? 'me' : ''} ${m.draft ? 'draft' : ''}">${m.me ? '' : `<img src="${faceIcon(m.who)}" alt="">`}<span>${m.txt}</span></div>`).join('');
  },
  // breathing pacer: the outline is the guide, the filled disc is the player's own breath
  breath(target, level, inhale, good) {
    const el = $('breath'); el.classList.toggle('show', target !== null); if (target === null) return;
    $('breath-guide').style.transform = `scale(${0.35 + 0.65 * target})`;
    $('breath-me').style.transform = `scale(${0.35 + 0.65 * level})`;
    $('breath-icon').textContent = inhale ? '⬆️' : '⬇️';
    $('breath-dots').innerHTML = [0, 1, 2].map((k) => `<i class="${k < good ? 'done' : ''}"></i>`).join('');
  },
  stations() {
    $('stations').innerHTML = STATION_ICONS.map((ic, i) => {
      const open = i <= save.unlocked, st = save.stars[i];
      return `<button class="station ${open ? '' : 'locked'} ${current === chs[i] && current.active ? 'now' : ''}" data-i="${i}"><span>${open ? ic : '🔒'}</span><em>${'★'.repeat(st)}<b>${'★'.repeat(3 - st)}</b></em></button>`;
    }).join('');
  },
  stars(n) {
    const el = $('starpop'); el.innerHTML = `<div>${'⭐'.repeat(n)}<s>${'⭐'.repeat(3 - n)}</s></div>`;
    el.className = ''; void el.offsetWidth; el.className = 'go';
  },
};

// ---------- game object shared with the challenges ----------
const g = {
  scene, world, ui, sfx, actors: [], player: null, locked: false, cam: { focus: null, zoom: 1, yaw: 0 },
  say(key) { const t = text(key); $('caption').textContent = t; speak(t); },
  spawn(look, x, z, h) { const a = new Actor(look, x, z, h); scene.add(a.char.root); this.actors.push(a); return a; },
  despawn(a) { scene.remove(a.char.root); const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1); },
  lock(b) { this.locked = b; },
  action(id, down) { if (current?.active && !current.demo) current.action(id, down); },
  // show the demonstration before a station that has not been passed yet (or when asked for with the 👀▶ button)
  wantDemo(i) { if (forceDemo === i) { forceDemo = -1; return true; } return save.watch && save.stars[i] === 0; },
  complete(i, stars) {
    save.stars[i] = Math.max(save.stars[i], stars); done[i] = true;
    this.lock(false); this.cam.focus = null; this.cam.zoom = 1; this.cam.yaw = 0;
    ui.setButtons([]); ui.setDots(0, 0); ui.stars(stars); sfx.star();
    if (i === save.unlocked) {
      save.unlocked++; world.openBridge(i);
      $('goal-icons').textContent = '🌉 ➜ 🚶'; setTimeout(() => this.say('next'), 1800);
    } else $('goal').classList.remove('show');
    persist(); ui.stations();
  },
};

const chs = TEEN ? makeTeenChallenges(g) : makeChallenges(g);
const done = save.stars.map((s) => s > 0);
let current = null, started = false, partyDone = false, forceDemo = -1;
chs.forEach((c) => c.reset());
for (let i = 0; i < save.unlocked; i++) world.openBridge(i, false);

function entry(i) {
  const c = world.plots[i];
  if (i === 0) return { x: c.x - 10.2, z: c.z };
  const d = world.dirs[i - 1];
  return { x: c.x - d.x * 10.5, z: c.z - d.z * 10.5 };
}

function replay(i) {
  if (!started || i > save.unlocked || i >= N_CH) return;
  if (current) current.reset();
  current = null; done[i] = false; chs[i].reset();
  const e = entry(i), p = g.player;
  p.stop(); p.pos.x = e.x; p.pos.z = e.z; p.char.setAnim('idle'); p.char.setProp(null);
  ui.phone(null); ui.breath(null); ui.watch(false); p.char.hideBubble(); p.char.setExpr('happy');
  g.lock(false); g.cam.focus = null; g.cam.zoom = 1; g.cam.yaw = 0; ui.setButtons([]); ui.setDots(0, 0);
  camT.set(e.x, 0, e.z); ui.stations();
}
// watch the demonstration again: restarts the current station with the demo first
function rewatch() {
  if (!current?.active || current.demo) return;
  const i = current.i; replay(i); forceDemo = i; current = chs[i]; current.begin(); ui.stations();
}
const skipDemo = () => { if (current?.active && current.demo && current.dm) current.endDemo(true); };
$('rewatch').onclick = rewatch; $('skip').onclick = skipDemo;
$('stations').addEventListener('click', (e) => { const b = e.target.closest('.station'); if (b) replay(+b.dataset.i); });

// ---------- input ----------
const keys = {}, joy = { x: 0, y: 0 };
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function actKey(code) {
  const btns = [...$('buttons').children];
  if (code === 'Space' || code === 'Enter') return btns[0];
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  return m ? btns[+m[1] - 1] : null;
}
addEventListener('keydown', (e) => {
  if (!started) return;
  if (e.code === 'Escape') { skipDemo(); return; }
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); return; }
  const b = actKey(e.code);
  if (b) { e.preventDefault(); if (!e.repeat) { b.classList.add('down'); g.action(b.dataset.id, true); } }
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
  const b = actKey(e.code);
  if (b) { b.classList.remove('down'); g.action(b.dataset.id, false); }
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// touch joystick
const joyEl = $('joy'), knob = $('knob');
if (matchMedia('(pointer: coarse)').matches) joyEl.classList.add('show');
let joyId = null;
const joyMove = (e) => {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2;
  let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  joy.x = x; joy.y = y; knob.style.transform = `translate(${x * R * 0.6}px, ${y * R * 0.6}px)`;
};
joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(joyId); joyMove(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId === joyId) { joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; } };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

function movePlayer(dt) {
  const p = g.player;
  p.moving = false;
  if (g.locked || p.dest || current?.demo) return;
  let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joy.x, iz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0) + joy.y;
  const m = Math.hypot(ix, iz);
  if (m < 0.15) { if (p.char.anim === 'walk') p.char.setAnim('idle'); return; }
  ix /= m; iz /= m;
  const sp = 4.2 * Math.min(1, m) * dt, old = { x: p.pos.x, z: p.pos.z };
  if (world.walkable(p.pos.x + ix * sp, p.pos.z)) p.pos.x += ix * sp;
  if (world.walkable(p.pos.x, p.pos.z + iz * sp)) p.pos.z += iz * sp;
  world.resolve(p.pos, 0.36);
  for (const a of g.actors) {   // keep a body's width between characters
    const dx = p.pos.x - a.pos.x, dz = p.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.7 && d > 1e-4) { p.pos.x = a.pos.x + dx / d * 0.7; p.pos.z = a.pos.z + dz / d * 0.7; }
  }
  if (!world.walkable(p.pos.x, p.pos.z)) { p.pos.x = old.x; p.pos.z = old.z; }
  p.th = Math.atan2(ix, iz); p.char.phase += sp * 5.2; p.char.setAnim('walk'); p.moving = true;
}

function triggers() {
  if (current?.active) return;
  const p = g.player.pos, inside = (i) => Math.abs(p.x - world.plots[i].x) < 9 && Math.abs(p.z - world.plots[i].z) < 9;
  for (let i = 0; i <= Math.min(save.unlocked, N_CH - 1); i++) {
    if (!done[i] && inside(i)) { current = chs[i]; current.begin(); ui.stations(); return; }
  }
  if (save.unlocked >= N_CH && !partyDone && inside(N_CH)) {
    partyDone = true; chs[N_CH].begin(); g.say('end'); sfx.star();
    $('goal-icons').textContent = '🎉';
    $('final-stars').textContent = `⭐ ${save.stars.reduce((a, b) => a + b, 0)} / ${N_CH * 3}`;
    setTimeout(() => $('final').classList.add('show'), 2500);
  }
}

// ---------- start screen ----------
const avBox = $('avatars');
AVATARS.forEach((look, i) => {
  const b = document.createElement('button');
  b.className = 'avatar' + (i === save.avatar ? ' sel' : '');
  b.innerHTML = `<img src="${faceIcon(look)}" alt="">`;
  b.onclick = () => { save.avatar = i; [...avBox.children].forEach((c, k) => c.classList.toggle('sel', k === i)); };
  avBox.appendChild(b);
});
function toggle(id, prop, apply) {
  const el = $(id);
  const paint = () => el.classList.toggle('off', !save[prop]);
  el.onclick = () => { save[prop] = !save[prop]; apply(); paint(); persist(); };
  apply(); paint();
}
toggle('t-sound', 'sound', () => { audio.sound = save.sound; });
toggle('t-speech', 'speech', () => { audio.speech = save.speech; if (!save.speech) window.speechSynthesis?.cancel(); });
toggle('t-watch', 'watch', () => {});
toggle('t-caption', 'captions', () => { document.body.classList.toggle('nocap', !save.captions); });
audio.onVoice = () => { $('t-speech').classList.toggle('none', !audio.hasVoice); };
audio.onVoice();
$('title').textContent = S.title;

// parents / therapists page: one real-life practice idea per station
function parentsPage() {
  $('parents-title').textContent = S.parents.title; $('parents-note').textContent = S.parents.note;
  $('parents-list').innerHTML = (TEEN ? S.parents.teenTips : S.parents.tips).map((tip, i) => `<li><span>${STATION_ICONS[i]}</span><div><b>${S[chs[i].key].title}</b> <em>${'★'.repeat(save.stars[i])}</em><br>${tip}</div></li>`).join('');
  $('parents').classList.add('show');
}
$('t-parents').onclick = parentsPage;
$('parents-close').onclick = () => $('parents').classList.remove('show');

$('play').onclick = () => {
  sfx.init(); persist();
  const e = entry(Math.min(save.unlocked, N_CH)), start = save.unlocked === 0 ? entry(0) : e;
  const p = g.player = new Actor({ scale: 0.92, ...AVATARS[save.avatar] }, start.x, start.z, Math.PI / 2);
  p.char.setExpr('happy'); scene.add(p.char.root);
  const marker = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  marker.rotation.x = Math.PI; marker.position.y = 2.25; p.char.root.add(marker); p.marker = marker;
  camT.set(start.x, 0, start.z);
  started = true; document.body.classList.add('playing');
  $('goal-icons').textContent = '⬆️ ⬇️ ⬅️ ➡️'; $('goal').classList.add('show'); g.say('move');
  ui.stations();
};
for (const b of $('modes').children) {
  b.classList.toggle('sel', (b.dataset.mode === 'teen') === TEEN);
  b.onclick = () => { if ((b.dataset.mode === 'teen') !== TEEN) location.search = b.dataset.mode === 'teen' ? '?mode=teen' : ''; };
}
$('reset').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); };
$('final-close').onclick = () => $('final').classList.remove('show');

// ---------- main loop ----------
const camT = new THREE.Vector3(CENTER.x, 0, CENTER.z);
let zoom = 1, yaw = 0, last = performance.now(), time = 0;
function step(dt) {
  time += dt;
  if (started) { movePlayer(dt); g.player.update(dt); g.player.marker.position.y = 2.25 + Math.sin(time * 3) * 0.06; triggers(); }
  for (const a of g.actors) a.update(dt);
  for (const c of chs) c.tick(dt);
  $('rewatch').classList.toggle('show', !!current?.active && !current.demo);
  if (started) {
    const t = g.cam.focus || g.player.pos, k = 1 - Math.exp(-dt * 4);
    camT.x += (t.x - camT.x) * k; camT.z += (t.z - camT.z) * k; zoom += (g.cam.zoom - zoom) * k; yaw += (g.cam.yaw - yaw) * k;
    camera.position.set(camT.x + Math.sin(yaw) * 10.5 * zoom, (11 - yaw * 3) * zoom, camT.z + Math.cos(yaw) * 10.5 * zoom);
    camera.lookAt(camT.x, 1, camT.z);
  } else {   // slow fly-over behind the start screen
    const a = time * 0.06;
    camera.position.set(CENTER.x + Math.sin(a) * 95, 60, CENTER.z + Math.cos(a) * 95);
    camera.lookAt(CENTER.x, 0, CENTER.z);
  }
  world.update(dt, started ? camT : CENTER, () => sfx.pop());
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!window.game.manual) step(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// handy for testing from the console: game.manual = true, then game.run(seconds)
window.game = { g, chs, save, world, replay, rewatch, skipDemo, manual: false, run(sec) { for (let t = 0; t < sec; t += 1 / 30) step(1 / 30); }, get current() { return current; } };
requestAnimationFrame(frame);
