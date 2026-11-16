/* Web Audio API 효과음 + 배경음악 + 파도 소리 (소리 파일 없이 코드로 만듦)
 *  소리 버튼을 누를 때마다: 음악+효과음 → 효과음만 → 모두 끄기 순서로 바뀜 */
const Sound = (() => {
  let ctx = null;
  let sfxOn = Records.getSoundOn();
  let musicOn = Records.getMusicOn();

  function getCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const MUSIC_VOL = () => (window.GAME_CONFIG && window.GAME_CONFIG.music && window.GAME_CONFIG.music.volume) || 0.32;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ── 효과음 ─────────────────────────────── */
  function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slideTo = null, dest = null } = {}) {
    const c = getCtx();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function seq(notes, step, opts) {
    notes.forEach((f, i) => tone(f, step * 1.4, { ...opts, delay: i * step }));
  }

  const sounds = {
    click:   () => tone(700, 0.05, { type: 'square', vol: 0.04 }),
    correct: () => { tone(880, 0.09, { type: 'triangle', vol: 0.16 }); tone(1320, 0.14, { type: 'triangle', vol: 0.16, delay: 0.08 }); },
    wrong:   () => { tone(240, 0.16, { type: 'sawtooth', vol: 0.07 }); tone(180, 0.22, { type: 'sawtooth', vol: 0.07, delay: 0.14 }); },
    pass:    () => seq([523, 659, 784, 1047], 0.08, { type: 'triangle', vol: 0.14 }),
    tick:    () => tone(1200, 0.03, { type: 'square', vol: 0.035 }),
    count:   () => tone(620, 0.14, { type: 'sine', vol: 0.18 }),
    go:      () => tone(990, 0.3, { type: 'sine', vol: 0.2 }),
    timeup:  () => tone(520, 0.5, { type: 'triangle', vol: 0.15, slideTo: 200 }),
    combo:   () => seq([988, 1319], 0.06, { type: 'square', vol: 0.05 }),
    ending:  () => {
      seq([523, 659, 784, 1047, 784, 1047, 1319], 0.13, { type: 'triangle', vol: 0.15 });
      seq([262, 330, 392, 523], 0.22, { type: 'sine', vol: 0.08 });
    },
  };

  /* ── 배경음악 ───────────────────────────────
   *  곡마다: 빠르기(bpm), 멜로디 16칸(8분음표, 0은 쉼), 베이스 근음 4개(반 마디마다)
   *  모두 이 게임을 위해 새로 만든 짧은 멜로디 */
  const TRACKS = {
    menu: { bpm: 108, lead: 'triangle', bass: [48, 45, 41, 43],
      melody: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 74, 0, 67, 0] },
    p0: { bpm: 120, lead: 'triangle', bass: [48, 53, 55, 48],   // 감천문화마을: 통통 튀는 계단
      melody: [72, 76, 79, 76, 74, 77, 81, 77, 76, 79, 84, 79, 77, 74, 72, 0] },
    p1: { bpm: 126, lead: 'square', bass: [41, 46, 48, 41],     // 자갈치시장: 북적북적 시장
      melody: [65, 69, 72, 69, 70, 74, 72, 69, 67, 70, 74, 70, 72, 69, 65, 0] },
    p2: { bpm: 114, lead: 'triangle', bass: [43, 48, 50, 43],   // 부산타워: 높이 올라가는 느낌
      melody: [79, 0, 74, 76, 79, 83, 81, 79, 76, 0, 74, 72, 74, 76, 79, 0] },
    p3: { bpm: 102, lead: 'sine', bass: [45, 41, 43, 45],       // 광안대교: 반짝이는 밤바다
      melody: [69, 72, 76, 79, 77, 76, 72, 74, 71, 74, 77, 81, 79, 77, 74, 72] },
    p4: { bpm: 132, lead: 'triangle', bass: [38, 43, 45, 38],   // 해운대: 신나는 해변
      melody: [74, 78, 81, 78, 83, 81, 78, 76, 74, 78, 81, 86, 85, 83, 81, 0] },
  };

  const bgm = { held: false, want: null, playing: null, timer: null, step: 0, nextTime: 0, gain: null, speed: 1 };
  let noiseBuf = null;
  function getNoise(c) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {           // 부드러운(brown) 잡음
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return noiseBuf;
  }
  let hatBuf = null;
  function getHat(c) {
    if (hatBuf) return hatBuf;
    hatBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = hatBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    return hatBuf;
  }

  function playStep(c, tr, step, t, eighth) {
    const i = step % 16;
    const loopB = step >= 16;                    // 두 번째 바퀴에는 반짝이 음을 더해 살짝 변화
    const m = tr.melody[i];
    if (m) tone(hz(m), eighth * 0.95, { type: tr.lead, vol: tr.lead === 'square' ? 0.12 : 0.3, delay: t - c.currentTime, dest: bgm.gain });
    if (loopB && m && i % 2 === 0) tone(hz(m + 12), eighth * 1.8, { type: 'sine', vol: 0.12, delay: t - c.currentTime, dest: bgm.gain });
    const root = tr.bass[Math.floor(i / 4)];
    if (i % 4 === 0) tone(hz(root), eighth * 1.8, { type: 'sine', vol: 0.45, delay: t - c.currentTime, dest: bgm.gain });
    if (i % 4 === 2) tone(hz(root + 7), eighth * 1.4, { type: 'sine', vol: 0.3, delay: t - c.currentTime, dest: bgm.gain });
    const h = c.createBufferSource();
    h.buffer = getHat(c);
    const hf = c.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 6000;
    const hg = c.createGain();
    hg.gain.value = i % 2 ? 0.18 : 0.07;
    h.connect(hf).connect(hg).connect(bgm.gain);
    h.start(t);
  }

  function scheduler() {
    const c = ctx;
    if (!c || !bgm.playing) return;
    const tr = TRACKS[bgm.playing];
    const eighth = 60 / (tr.bpm * bgm.speed) / 2;
    if (bgm.nextTime < c.currentTime) bgm.nextTime = c.currentTime + 0.05;
    while (bgm.nextTime < c.currentTime + 0.15) {
      playStep(c, tr, bgm.step, bgm.nextTime, eighth);
      bgm.nextTime += eighth;
      bgm.step = (bgm.step + 1) % 32;
    }
  }

  function startBgm() {
    const c = getCtx();
    if (!c || !bgm.want || !TRACKS[bgm.want]) return;
    if (!bgm.gain) {
      bgm.gain = c.createGain();
      bgm.gain.connect(c.destination);
    }
    if (bgm.playing !== bgm.want) { bgm.step = 0; bgm.nextTime = c.currentTime + 0.05; }
    const g = bgm.gain.gain;
    if (!bgm.playing) {
      g.cancelScheduledValues(c.currentTime);
      g.setValueAtTime(0.0001, c.currentTime);
      g.exponentialRampToValueAtTime(MUSIC_VOL(), c.currentTime + 0.8);
    }
    bgm.playing = bgm.want;
    if (!bgm.timer) bgm.timer = setInterval(scheduler, 30);
    scheduler();
  }
  function stopBgm(fade = 0.4) {
    if (bgm.timer) { clearInterval(bgm.timer); bgm.timer = null; }
    if (bgm.gain && ctx) {
      const old = bgm.gain;
      const g = old.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(Math.max(g.value, 0.0001), ctx.currentTime);
      g.exponentialRampToValueAtTime(0.0001, ctx.currentTime + fade);
      setTimeout(() => old.disconnect(), fade * 1000 + 100);
      bgm.gain = null;
    }
    bgm.playing = null;
  }
  const canPlayMusic = () => sfxOn && musicOn;

  /* ── 파도 소리(엔딩) ─────────────────────── */
  let ocean = null;
  function startOcean(seconds = 8) {
    stopOcean(0.05);
    if (!sfxOn) return;
    const c = getCtx();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    const g = c.createGain();
    src.connect(lp).connect(g).connect(c.destination);
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    lp.frequency.setValueAtTime(500, t0);
    const wave = 2.4;                              // 파도 한 번 약 2.4초
    for (let k = 0; k * wave < seconds; k++) {
      const t = t0 + k * wave;
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.42, t + wave * 0.45);   // 밀려오고
      g.gain.exponentialRampToValueAtTime(0.06, t + wave);          // 쓸려 나감
      lp.frequency.linearRampToValueAtTime(500, t + 0.05);
      lp.frequency.linearRampToValueAtTime(1500, t + wave * 0.45);
      lp.frequency.linearRampToValueAtTime(600, t + wave);
    }
    src.start(t0);
    // 갈매기 두어 번
    [1.2, 4.6].forEach((d) => {
      tone(1400, 0.22, { type: 'sine', vol: 0.03, delay: d, slideTo: 1000 });
      tone(1500, 0.25, { type: 'sine', vol: 0.025, delay: d + 0.3, slideTo: 1050 });
    });
    ocean = { src, g };
  }
  function stopOcean(fade = 1.5) {
    if (!ocean || !ctx) { ocean = null; return; }
    const { src, g } = ocean;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    try { src.stop(now + fade + 0.05); } catch (e) { /* 이미 멈춤 */ }
    ocean = null;
  }

  return {
    play(name) {
      if (!sfxOn || !sounds[name]) return;
      try { sounds[name](); } catch (e) { /* 무시 */ }
    },
    /** 첫 터치 때 오디오를 깨움(브라우저 정책) */
    unlock() {
      if (!sfxOn) return;
      getCtx();
      if (canPlayMusic() && bgm.want && !bgm.playing && !bgm.held) startBgm();
    },
    /** 배경음악 곡 바꾸기: 'menu', 'p0'~'p4'. null이면 멈춤 */
    music(name) {
      bgm.want = name;
      bgm.held = false;
      if (!name) { stopBgm(); return; }
      bgm.speed = 1;
      if (canPlayMusic()) { try { startBgm(); } catch (e) { /* 무시 */ } }
    },
    musicSpeed(x) { bgm.speed = x; },
    musicPause() { bgm.held = true; stopBgm(0.2); },
    musicResume() { bgm.held = false; if (canPlayMusic() && bgm.want) startBgm(); },
    ocean: (s) => { try { startOcean(s); } catch (e) { /* 무시 */ } },
    oceanStop: (f) => stopOcean(f),
    /** 'all'(음악+효과음) | 'sfx'(효과음만) | 'off' */
    mode() { return !sfxOn ? 'off' : (musicOn ? 'all' : 'sfx'); },
    cycle() {
      const m = this.mode();
      if (m === 'all') { musicOn = false; }
      else if (m === 'sfx') { sfxOn = false; }
      else { sfxOn = true; musicOn = true; }
      Records.setSoundOn(sfxOn);
      Records.setMusicOn(musicOn);
      if (canPlayMusic() && !bgm.held) startBgm(); else stopBgm(0.2);
      if (!sfxOn) stopOcean(0.2);
      if (sfxOn) sounds.click();
      return this.mode();
    },
    isOn() { return sfxOn; },
  };
})();
