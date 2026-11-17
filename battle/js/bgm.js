// 교실 TV 배경음악 (수노에서 만든 mp3) — 학생 태블릿에서는 쓰지 않음
// 곡 주소·크기는 js/config.js 의 battle.music 에서 바꿉니다.
//  - 곡이 바뀔 때 부드럽게 줄었다가 커짐(크로스페이드)
//  - 반복할 때 끝부분(페이드아웃)과 처음을 겹쳐서 끊김 없이 이어짐
//  - 아직 없는 곡은 대신 쓸 곡으로: cheer → play → lobby, ending → lobby

const FALLBACK = { cheer: 'play', play: 'lobby', ending: 'lobby', lobby: null };
const FADE_SEC = 1.2;        // 곡 바꿀 때
const LOOP_XFADE_SEC = 3;    // 반복할 때 겹치는 길이
const LS_MODE = 'bukangi.battle.soundMode';

export class Bgm {
  /**
   * tracks: { lobby: url, play: url, cheer: url, ending: url }, volume: 0~1
   */
  constructor(tracks, volume = 0.35, endingBoost = 1.5) {
    this.tracks = tracks;
    this.volume = volume;
    this.endingBoost = endingBoost;
    this.missing = new Set();
    this.wanted = null;      // 바라는 곡 이름(대신 쓸 곡 적용 전)
    this.current = null;     // { name, el }
    this.fading = new Set();
    this.blocked = false;    // 브라우저가 소리를 막아 첫 터치를 기다리는 중
    this.onEnded = null;
    try { this.mode = localStorage.getItem(LS_MODE) || 'all'; } catch { this.mode = 'all'; }
    if (!['all', 'sfx', 'off'].includes(this.mode)) this.mode = 'all';
    // 없는 곡 미리 확인(없으면 대신 쓸 곡으로)
    for (const [name, url] of Object.entries(tracks)) {
      if (!url) { this.missing.add(name); continue; }
      fetch(url, { method: 'HEAD' }).then((r) => { if (!r.ok) this.markMissing(name); }).catch(() => {});
    }
    // 소리가 막혔으면 화면을 처음 누를 때 다시 시도
    const retry = () => { if (this.blocked) { this.blocked = false; this.refresh(true); } };
    document.addEventListener('pointerdown', retry, { passive: true });
    document.addEventListener('keydown', retry);
  }

  /** 이 곡을 실제로 틀 수 있는지(파일이 있고 음악이 켜져 있음) */
  canPlay(name) { return this.musicOn && !this.missing.has(name) && !!this.tracks[name]; }

  /** 음악이 나오는 모드인지 ('all' = 음악+효과음) */
  get musicOn() { return this.mode === 'all'; }

  /** 🎵 음악+효과음 → 🔊 효과음만 → 🔇 끔 */
  cycleMode() {
    this.mode = { all: 'sfx', sfx: 'off', off: 'all' }[this.mode];
    try { localStorage.setItem(LS_MODE, this.mode); } catch { /* 저장 못 해도 괜찮음 */ }
    this.refresh(true);
    return this.mode;
  }

  markMissing(name) {
    if (this.missing.has(name)) return;
    this.missing.add(name);
    if (this.current?.name === name) { this.stopEl(this.current.el, 0.2); this.current = null; }
    this.refresh(true);
  }

  /** 실제로 틀 곡(없는 곡이면 대신 쓸 곡) */
  resolve(name) {
    let n = name;
    while (n && this.missing.has(n)) n = FALLBACK[n];
    return n;
  }

  /**
   * 바라는 곡 정하기. once: 한 번만 틀고 끝나면 onEnded 호출(엔딩 곡)
   */
  want(name, { once = false, onEnded = null } = {}) {
    if (this.wanted === name && this.once === once) return;
    this.wanted = name;
    this.once = once;
    this.onEnded = onEnded;
    this.refresh();
  }

  refresh(force = false) {
    const name = this.musicOn ? this.resolve(this.wanted) : null;
    if (!force && this.current?.name === name) return;
    if (this.current && this.current.name === name && !this.current.el.paused) return;
    if (this.current) { this.stopEl(this.current.el, FADE_SEC); this.current = null; }
    if (!name) return;
    this.current = { name, el: this.startEl(this.tracks[name], name) };
  }

  startEl(url, name) {
    const el = new Audio(url);
    el.preload = 'auto';
    el.volume = 0;
    const loop = !(this.once && this.wanted === name);   // 엔딩 곡만 한 번, 나머지는 반복
    // 진짜로 파일을 못 읽을 때만 '없는 곡'으로(멈출 때 주소를 비우면서 나는 오류는 무시)
    el.addEventListener('error', () => { if (!el._stopped) this.markMissing(name); });
    if (loop) {
      // 끝나기 몇 초 전에 새로 처음부터 틀고, 지금 것은 서서히 줄임
      let crossed = false;
      el.addEventListener('timeupdate', () => {
        if (crossed || !el.duration || this.current?.el !== el) return;
        if (el.duration - el.currentTime <= LOOP_XFADE_SEC) {
          crossed = true;
          const next = this.startEl(url, name);
          this.current = { name, el: next };
          this.stopEl(el, LOOP_XFADE_SEC);
        }
      });
    } else {
      el.addEventListener('ended', () => {
        if (this.current?.el === el) this.current = null;
        const cb = this.onEnded; this.onEnded = null;
        cb?.();
      });
    }
    // 엔딩 곡은 축하 분위기로 조금 더 크게
    const target = Math.min(1, this.volume * (name === 'ending' ? this.endingBoost : 1));
    el.play().then(() => this.fadeTo(el, target, name === 'ending' ? 0.3 : FADE_SEC)).catch(() => {
      // 화면을 아직 한 번도 누르지 않은 TV(새로고침 직후 등): 첫 터치 때 다시
      this.blocked = true;
      if (this.current?.el === el) this.current = null;
    });
    return el;
  }

  stopEl(el, sec) {
    el._stopped = true;
    this.fadeTo(el, 0, sec, () => { el.pause(); el.removeAttribute('src'); el.load(); });
  }

  // 화면이 뒤로 가도 멈추지 않게 setInterval로 서서히 바꿈
  fadeTo(el, target, sec, done) {
    clearInterval(el._fade);
    const start = el.volume, t0 = Date.now();
    el._fade = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / (sec * 1000));
      try { el.volume = Math.max(0, Math.min(1, start + (target - start) * k)); } catch { /* 무시 */ }
      if (k >= 1) { clearInterval(el._fade); done?.(); }
    }, 50);
  }
}
