// 공통 도우미: 이름 키, 비밀번호 해시, 부캉이 그림, 효과음
import { CHARACTER_NAME } from './game-config.js';

/** 이름 정리: NFC 정규화, 앞뒤 공백 제거, 연속 공백 1칸, 제어문자 제거 */
export function normalizeName(name) {
  return String(name || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 글자 수(한글·이모지도 1글자로) */
export function charLength(s) { return Array.from(s).length; }

/** Firebase 키 금지 문자(. # $ [ ] /)와 %를 %XX로 인코딩 → 되돌릴 수 있음 */
export function toNameKey(name) {
  return normalizeName(name).replace(/[%.#$\[\]\/]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
}
export function fromNameKey(key) {
  try { return decodeURIComponent(key); } catch { return key; }
}

/** SHA-256(문자열) → 16진수 64자. https가 아닌 주소에서도 동작하도록 직접 구현 버전을 함께 둠 */
export async function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(bytes);
}

export function sha256Fallback(bytes) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const l = bytes.length, withPad = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(withPad); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(withPad - 4, (l * 8) >>> 0); dv.setUint32(withPad - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64);
  const r = (x, n) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < withPad; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, '0')).join('');
}

/** 비밀번호 해시: SHA-256(방번호 + 이름 + 비밀번호) — 원문은 저장하지 않음 */
export function pinHash(roomCode, name, pin) {
  return sha256Hex(`${roomCode}${normalizeName(name)}${pin}`);
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return '#' + [ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 부캉이(아기 상어) SVG 조각 — 혼자 하기와 같은 그림(js/scenes.js)을 몸 색만 바꿔 씀.
 * 중심 (0,0), 대략 폭 size.  color: 몸 색, scarf: 팀 색(뒤에 동그라미로 표시), image: 그림 주소(팀 대표용)
 */
export function charSvg({ color = '#4FA8EC', scarf = null, size = 48, image = null } = {}) {
  const w = size, h = size * 1.12, x = -w / 2, y = -h * 0.55;
  const ring = scarf ? `<circle cx="0" cy="${(size * 0.05).toFixed(1)}" r="${(size * 0.56).toFixed(1)}" fill="${scarf}" stroke="#fff" stroke-width="${Math.max(2, size / 22).toFixed(1)}" opacity=".9"/>` : '';
  if (image) return `${ring}<image href="${escapeHtml(image)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
  const colors = { body: color, dark: shade(color, -0.3), mid: shade(color, -0.15), light: shade(color, 0.3) };
  const art = typeof Scenes !== 'undefined' ? Scenes.character(colors) : '<svg viewBox="0 0 100 112"><ellipse cx="50" cy="62" rx="37" ry="42" fill="' + color + '"/></svg>';
  return ring + art.replace('<svg ', `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" `)
    .replace('aria-label="부캉이"', `aria-label="${escapeHtml(CHARACTER_NAME)}"`);
}

/** 독립 SVG로 감싼 부캉이(HTML 안에 넣을 때) */
export function charBadge(opts = {}, px = 64) {
  return `<svg viewBox="-30 -33 60 66" width="${px}" height="${(px * 66 / 60).toFixed(0)}" aria-hidden="true">${charSvg({ ...opts, size: 50 })}</svg>`;
}

// ───────── 효과음(WebAudio, 파일 없이 동작) ─────────
let actx = null;
function ctx() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
export let soundOn = true;
export function setSound(on) { soundOn = on; }

function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  const c = ctx(); if (!c || !soundOn) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  unlock() { ctx(); },
  correct() { tone(880, 0, 0.12, 'triangle'); tone(1320, 0.09, 0.18, 'triangle'); },
  wrong() { tone(220, 0, 0.22, 'square', 0.08); tone(180, 0.15, 0.25, 'square', 0.07); },
  tick() { tone(660, 0, 0.12, 'sine', 0.15); },
  go() { tone(990, 0, 0.35, 'triangle', 0.22); },
  key() { tone(520, 0, 0.04, 'sine', 0.06); },
  /** 여럿이 치는 박수(잡음을 짧게 끊어 여러 번) — 약 seconds초 */
  clap(seconds = 4) {
    const c = ctx(); if (!c || !soundOn) return;
    const len = Math.floor(c.sampleRate * 0.06);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const n = Math.floor(seconds * 22);
    for (let i = 0; i < n; i++) {
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1000 + Math.random() * 1600; f.Q.value = 0.8;
      const g = c.createGain(); g.gain.value = 0.25 + Math.random() * 0.25;
      src.connect(f).connect(g).connect(c.destination);
      src.start(c.currentTime + (i / n) * seconds + Math.random() * 0.04);
    }
  },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.2)); tone(1047, 0.5, 0.6, 'triangle', 0.2); },
  join() { tone(700, 0, 0.08); tone(1050, 0.07, 0.1); },
  landmark() { tone(784, 0, 0.12, 'sine', 0.12); tone(988, 0.1, 0.16, 'sine', 0.12); },
};
export function vibrate(pattern) { try { navigator.vibrate?.(pattern); } catch { /* 지원 안 함 */ } }

/** 그림 파일이 실제로 있는지 확인(없으면 기본 그림을 씀) */
export function imageExists(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = url;
  });
}

export const $ = (sel, root = document) => root.querySelector(sel);
export function show(id) {
  document.querySelectorAll('[data-screen]').forEach((el) => { el.hidden = el.dataset.screen !== id; });
}

/** 같은 화면에서 반복되는 setInterval을 간단히 관리 */
export function every(ms, fn) { fn(); return setInterval(fn, ms); }
