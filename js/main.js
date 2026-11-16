/* 화면 전환, 게임 상태 관리 */
(() => {
  'use strict';
  const C = window.GAME_CONFIG;
  const S = C.scoring;
  const T = C.timing;
  const $ = (id) => document.getElementById(id);
  const stops = () => [...C.places, C.ending];

  /* ── 게임 상태(한 객체) ─────────────────────── */
  const state = {
    playerName: '',
    level: null,
    stageIndex: 0,       // 지금 있는 장소 번호(= 통과한 명소 수)
    correctAtPlace: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    timeLeft: 0,
    wrongList: [],
    totalAnswered: 0,
    totalCorrect: 0,
    current: null,       // 현재 문제 {a, b, answer}
    phase: 'idle',       // countdown | answering | reveal | moving | ended
    reachedEnd: false,
    timeBonus: 0,
    comboBonusTotal: 0,
  };
  window.__bukangi = { state }; // 점검용

  let generator = null;
  let currentScreen = 'start';
  let lastSec = null;

  /* setTimeout 묶음 관리(판이 끝나면 한 번에 취소) */
  let pending = [];
  let paused = false;
  let heldWhilePaused = [];  // 멈춤 중에 실행될 차례가 된 일은 '계속하기' 때 실행
  function later(fn, ms) {
    const t = setTimeout(() => {
      pending = pending.filter((x) => x !== t);
      if (paused) heldWhilePaused.push(fn); else fn();
    }, ms);
    pending.push(t);
    return t;
  }
  function clearPending() { pending.forEach(clearTimeout); pending = []; heldWhilePaused = []; }
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  /* ── 이미지(부캉이·장소 사진) 있으면 사용 ──────── */
  let hasCharImg = false;
  const photoOk = {};
  function charHTML() {
    return hasCharImg ? `<img src="${C.characterImage}" alt="${C.characterName}" draggable="false">` : Scenes.character();
  }
  function refreshCharacters() { document.querySelectorAll('[data-char]').forEach((el) => { el.innerHTML = charHTML(); }); }
  function preloadAssets() {
    const img = new Image();
    img.onload = () => { hasCharImg = true; refreshCharacters(); };
    img.src = C.characterImage;
    C.places.forEach((p, i) => {
      if (!p.photo) return;
      const im = new Image();
      im.onload = () => { photoOk[i] = true; if (currentScreen === 'game' && state.stageIndex === i) setSceneBg(i); };
      im.src = p.photo;
    });
  }

  /* ── 화면 전환 ─────────────────────────────── */
  function showScreen(name) {
    currentScreen = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    if (name === 'level') renderLevels();
    window.scrollTo(0, 0);
  }

  /* ── 시작 화면 ─────────────────────────────── */
  function initBranding() {
    const mark = `${C.schoolName} · ${C.programName}`;
    document.querySelectorAll('[data-school]').forEach((el) => { el.textContent = mark; });
    document.querySelectorAll('[data-title]').forEach((el) => { el.textContent = C.gameTitle; });
    document.title = `${C.gameTitle} – 구구단 | ${mark}`;
    $('startBg').innerHTML = Scenes.render('haeundae');
    refreshCharacters();
  }
  function goLevelSelect() {
    state.playerName = $('playerName').value.trim();
    Sound.music('menu');
    $('playerName').blur();
    showScreen('level');
  }

  /* ── 단계 선택 ─────────────────────────────── */
  const LV_COLORS = [['#66BB6A', '#388E3C'], ['#29B6F6', '#0277BD'], ['#7E57C2', '#4527A0'], ['#FFA726', '#E65100'], ['#EF5350', '#B71C1C']];
  function rangeText(lv) { return lv.rangeLabel || `${lv.minDan}~${lv.maxDan}단`; }
  function renderLevels() {
    $('helloText').textContent = state.playerName ? `${state.playerName}, 반가워요! 어느 단계로 떠나 볼까요?` : '어느 단계로 떠나 볼까요?';
    $('levelGrid').innerHTML = C.levels.map((lv, i) => {
      const best = Records.getBest(lv.id);
      const [c, d] = LV_COLORS[i % LV_COLORS.length];
      return `<button type="button" class="level-card" data-idx="${i}" style="--lv:${c};--lv-dark:${d}"
          aria-label="${i + 1}단계 ${lv.name}, ${rangeText(lv)}, ${lv.time}초">
        <span class="lv-icon">${lv.icon || '⭐'}</span>
        <span class="lv-step">${i + 1}단계</span>
        <span class="lv-name">${lv.name}</span>
        <span class="lv-range">${rangeText(lv)} · ${lv.time}초</span>
        <span class="lv-sub">명소마다 ${lv.perPlace}문제 · 모두 ${lv.perPlace * C.places.length}문제</span>
        <span class="lv-best">${best ? `🏅 최고 ${best.score}점` : ''}</span>
      </button>`;
    }).join('');
  }

  /* ── 지도 진행바 ───────────────────────────── */
  function renderMap(el, idx) {
    const pts = stops();
    const n = pts.length - 1;
    el.innerHTML = `<div class="map-track">
      <div class="map-line"><div class="map-line-fill"></div></div>
      ${pts.map((p, i) => `<div class="map-node" style="left:${(i / n) * 100}%"><span class="map-dot">${p.icon}</span><span class="map-name">${p.short}</span></div>`).join('')}
      <div class="map-owl" data-char>${charHTML()}</div>
    </div>`;
    updateMap(el, idx);
  }
  function updateMap(el, idx) {
    const n = stops().length - 1;
    el.querySelectorAll('.map-node').forEach((node, i) => {
      node.classList.toggle('done', i < idx);
      node.classList.toggle('current', i === idx);
    });
    el.querySelector('.map-line-fill').style.width = `${(idx / n) * 100}%`;
    el.querySelector('.map-owl').style.left = `${(idx / n) * 100}%`;
    const p = stops()[Math.min(idx, n)];
    el.setAttribute('aria-label', `여행 지도: 지금 ${p.name}`);
  }

  /* ── 게임 화면 요소 갱신 ────────────────────── */
  function setSceneBg(i) {
    const bg = $('sceneBg');
    if (photoOk[i]) {
      bg.innerHTML = '';
      bg.style.backgroundImage = `url("${C.places[i].photo}")`;
    } else {
      bg.style.backgroundImage = '';
      bg.innerHTML = Scenes.render(C.places[i].scene);
    }
  }
  function updatePlaceLabel() { $('placeLabel').textContent = `📍 ${C.places[state.stageIndex].name}`; }
  function updateProgressDots() {
    const need = state.level.perPlace;
    let html = '';
    for (let i = 0; i < need; i++) html += `<span class="pdot ${i < state.correctAtPlace ? 'on' : ''}"></span>`;
    const el = $('placeProgress');
    el.innerHTML = html;
    el.setAttribute('aria-label', `이 장소 정답 ${state.correctAtPlace}/${need}`);
  }
  function updateScore() { $('scoreText').textContent = state.score; }
  function updateTimer(left, total) {
    $('timerBar').style.width = `${(left / total) * 100}%`;
    const sec = Math.ceil(left);
    $('timerText').textContent = `${sec}초`;
    const t = $('timer');
    t.classList.toggle('warn', sec <= T.warnSeconds);
    t.classList.toggle('danger', sec <= T.dangerSeconds);
  }
  function renderAnswer(v) {
    const box = $('answerBox');
    box.textContent = v;
    box.classList.remove('ok', 'bad');
    box.classList.toggle('empty', !v);
  }
  function showFeedback(kind, text) {
    const f = $('feedback');
    f.className = 'feedback ' + kind;
    f.textContent = text;
  }
  function hideFeedback() { $('feedback').className = 'feedback'; }
  function charReact(kind) {
    const el = $('gameChar');
    el.classList.remove('happy', 'sad');
    void el.offsetWidth;
    el.classList.add(kind);
    setTimeout(() => el.classList.remove(kind), 520);
  }

  /* ── 한 판 시작 ────────────────────────────── */
  function startLevel(level) {
    paused = false;
    $('pauseMenu').hidden = true;
    clearPending();
    GameTimer.stop();
    Object.assign(state, {
      level, stageIndex: 0, correctAtPlace: 0, score: 0, combo: 0, maxCombo: 0,
      timeLeft: level.time, wrongList: [], totalAnswered: 0, totalCorrect: 0,
      current: null, phase: 'countdown', reachedEnd: false, timeBonus: 0, comboBonusTotal: 0,
    });
    generator = Questions.createGenerator(level);
    lastSec = null;
    Sound.oceanStop(0.2);
    Sound.music('p0');

    showScreen('game');
    renderMap($('mapBar'), 0);
    setSceneBg(0);
    $('charWrap').className = 'char-wrap';
    $('charWrap').style.setProperty('--half', `${Math.round(T.moveDurationMs / 2)}ms`);
    updatePlaceLabel();
    updateProgressDots();
    updateScore();
    updateTimer(level.time, level.time);
    $('qA').textContent = '?';
    $('qB').textContent = '?';
    Keypad.setEnabled(false);
    Keypad.clear();
    hideFeedback();

    runCountdown(() => {
      GameTimer.start(level.time, onTick, onTimeUp);
      nextQuestion();
    });
  }

  function runCountdown(done) {
    const box = $('countdown');
    const num = $('countdownNum');
    box.hidden = false;
    let n = T.countdownFrom;
    const step = () => {
      if (n > 0) {
        num.textContent = n;
        restartAnim(num, 'pop');
        Sound.play('count');
        n--;
        later(step, 800);
      } else {
        num.textContent = '출발!';
        restartAnim(num, 'pop');
        Sound.play('go');
        later(() => { box.hidden = true; done(); }, 500);
      }
    };
    step();
  }

  function onTick(left, total) {
    state.timeLeft = left;
    updateTimer(left, total);
    const sec = Math.ceil(left);
    if (sec !== lastSec) {
      if (sec <= T.warnSeconds && sec > 0 && lastSec !== null) Sound.play('tick');
      Sound.musicSpeed(sec <= T.warnSeconds ? C.music.fastTempo : 1);
      lastSec = sec;
    }
  }
  function onTimeUp() {
    state.timeLeft = 0;
    finish(false);
  }

  /* ── 문제 진행 ─────────────────────────────── */
  function nextQuestion() {
    if (state.phase === 'ended') return;
    state.current = generator.next();
    $('qA').textContent = state.current.a;
    $('qB').textContent = state.current.b;
    $('questionBox').setAttribute('aria-label', `${state.current.a} 곱하기 ${state.current.b}는?`);
    hideFeedback();
    state.phase = 'answering';
    Keypad.setEnabled(true);
    Keypad.clear();
  }

  function submitAnswer(value) {
    if (state.phase !== 'answering' || !value) return;
    Keypad.setEnabled(false);
    state.totalAnswered++;
    if (Questions.check(state.current, value)) onCorrect();
    else onWrong(value);
  }

  function onCorrect() {
    state.phase = 'reveal';
    state.totalCorrect++;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.score += S.correct;
    if (state.combo % S.comboEvery === 0) {
      state.score += S.comboBonus;
      state.comboBonusTotal += S.comboBonus;
      const c = $('comboText');
      c.textContent = `🔥 ${state.combo}연속 정답! +${S.comboBonus}`;
      restartAnim(c, 'show');
      Sound.play('combo');
    }
    state.correctAtPlace++;
    $('answerBox').classList.add('ok');
    showFeedback('ok', '⭕ 정답!');
    Sound.play('correct');
    charReact('happy');
    updateScore();
    updateProgressDots();

    if (state.correctAtPlace >= state.level.perPlace) {
      GameTimer.pause(); // 장소 통과가 확정되는 순간 시간 멈춤
      later(placeCleared, T.correctDelayMs);
    } else {
      later(nextQuestion, T.correctDelayMs);
    }
  }

  function onWrong(value) {
    state.phase = 'reveal';
    const q = state.current;
    state.combo = 0;
    state.wrongList.push({ a: q.a, b: q.b, answer: q.answer, given: Number(value) });
    const box = $('answerBox');
    box.textContent = q.answer;
    box.classList.remove('empty', 'ok');
    restartAnim(box, 'bad');
    showFeedback('bad', `❌ 정답은 ${q.answer}`);
    Sound.play('wrong');
    charReact('sad');
    later(nextQuestion, T.wrongRevealMs);
  }

  /* ── 장소 통과 → 이동 연출(타이머 멈춤) ─────────── */
  function placeCleared() {
    state.stageIndex++;
    state.correctAtPlace = 0;
    if (state.stageIndex >= C.places.length) { finish(true); return; }

    state.phase = 'moving';
    GameTimer.pause();
    Sound.play('pass');
    hideFeedback();
    const half = Math.round(T.moveDurationMs / 2);
    const wrapEl = $('charWrap');
    wrapEl.className = 'char-wrap exit';
    updateMap($('mapBar'), state.stageIndex);

    later(() => {
      const p = C.places[state.stageIndex];
      Sound.music('p' + state.stageIndex);
      if (lastSec !== null && lastSec <= T.warnSeconds) Sound.musicSpeed(C.music.fastTempo);
      setSceneBg(state.stageIndex);
      updatePlaceLabel();
      updateProgressDots();
      const a = $('arriveText');
      a.textContent = `${p.icon} ${p.short} 도착!`;
      restartAnim(a, 'show');
      wrapEl.className = 'char-wrap enter-start';
      void wrapEl.offsetWidth;
      wrapEl.className = 'char-wrap enter';
    }, half);

    later(() => {
      wrapEl.className = 'char-wrap';
      GameTimer.resume();
      nextQuestion();
    }, T.moveDurationMs);
  }

  /* ── 멈춤 메뉴 ─────────────────────────────── */
  let timerWasRunning = false;
  function openPause() {
    if (currentScreen !== 'game' || paused || state.phase === 'ended') return;
    paused = true;
    timerWasRunning = GameTimer.isRunning();
    GameTimer.pause();
    Sound.musicPause();
    $('pauseMenu').hidden = false;
    $('btnResume').focus();
  }
  function resumeGame() {
    if (!paused) return;
    paused = false;
    $('pauseMenu').hidden = true;
    Sound.musicResume();
    if (timerWasRunning) GameTimer.resume();
    const fns = heldWhilePaused;
    heldWhilePaused = [];
    fns.forEach((fn) => fn());
  }
  function quitGame(to) {
    paused = false;
    $('pauseMenu').hidden = true;
    $('countdown').hidden = true;
    state.phase = 'ended';
    GameTimer.stop();
    clearPending();
    Keypad.setEnabled(false);
    Sound.music('menu');
    showScreen(to);
  }

  /* ── 판 끝 ─────────────────────────────────── */
  function finish(reachedEnd) {
    if (state.phase === 'ended') return;
    state.phase = 'ended';
    GameTimer.stop();
    clearPending();
    Keypad.setEnabled(false);
    Sound.music(null);
    if (reachedEnd) {
      state.reachedEnd = true;
      state.timeLeft = GameTimer.getLeft();
      state.timeBonus = Math.floor(state.timeLeft) * S.timeBonusPerSec;
      state.score += state.timeBonus + S.endingBonus;
      updateScore();
      playEnding();
    } else {
      Sound.play('timeup');
      showFeedback('bad', '⏰ 시간 끝!');
      later(showResult, 1200);
    }
  }

  /* ── 엔딩 ─────────────────────────────────── */
  let endingCanSkip = false;
  let fanfareDone = false;
  function playEnding() {
    showScreen('ending');
    endingCanSkip = false;
    fanfareDone = false;
    $('endingBg').innerHTML = Scenes.render('haeundae', { sunset: true });
    $('skyIcons').innerHTML = C.places
      .map((p, i) => `<span class="sky-icon" style="animation-delay:${(0.3 + i * 0.35).toFixed(2)}s" title="${p.name}" aria-label="${p.name}">${p.icon}</span>`)
      .join('');
    const mover = $('endingCharMove');
    mover.style.animation = 'none';
    mover.innerHTML = `<div class="ending-char" data-char>${charHTML()}</div>`;
    void mover.offsetWidth;
    mover.style.animation = '';
    const msg = $('endingMsg');
    msg.innerHTML = `🌊 ${C.characterName}가 무사히<br>바다로 돌아갔어요!`;
    msg.style.animation = 'none';
    void msg.offsetWidth;
    msg.style.animation = '';

    Sound.ocean(C.music.oceanSeconds);
    later(() => { endingCanSkip = true; }, 400);
    later(() => { fanfare(); }, 3200);
    later(endEnding, T.endingDurationMs);
  }
  function fanfare() {
    if (fanfareDone) return;
    fanfareDone = true;
    Sound.play('ending');
    confetti();
  }
  function endEnding() {
    if (currentScreen !== 'ending') return;
    clearPending();
    Sound.oceanStop(2);
    showResult();
    if (!fanfareDone) fanfare(); // 건너뛰었으면 결과 화면에서 축하
  }
  function skipEnding() { if (currentScreen === 'ending' && endingCanSkip) endEnding(); }

  function confetti() {
    const colors = ['#FF5252', '#FFD740', '#69F0AE', '#40C4FF', '#E040FB', '#FF8A65', '#1E88E5'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 90; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.left = `${Math.random() * 100}vw`;
      d.style.background = colors[i % colors.length];
      d.style.animationDuration = `${2.4 + Math.random() * 2}s`;
      d.style.animationDelay = `${Math.random() * 0.6}s`;
      d.style.transform = `rotate(${Math.random() * 360}deg)`;
      frag.appendChild(d);
      setTimeout(() => d.remove(), 5500);
    }
    document.body.appendChild(frag);
  }

  /* ── 결과 화면 ─────────────────────────────── */
  function starsFor(passed) {
    const rule = C.stars.find((r) => passed >= r.places);
    return rule ? rule.stars : 0;
  }
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function showResult() {
    const L = state.level;
    const n = C.places.length;
    const passed = Math.min(state.stageIndex, n);
    const acc = state.totalAnswered ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
    const stop = state.reachedEnd ? C.ending : C.places[state.stageIndex];
    const date = todayStr();

    showScreen('result');
    Sound.music('menu');
    $('screen-result').classList.toggle('win', state.reachedEnd);
    $('screen-result').scrollTop = 0;

    if (state.reachedEnd) {
      $('resultTitle').textContent = `🎉 ${C.characterName}가 무사히 바다로 돌아갔어요!`;
      $('resultMsg').textContent = `${L.name} 단계 완주! 정말 대단해요.`;
    } else {
      $('resultTitle').textContent = `${C.characterName}가 ${stop.short}에서 쉬고 있어요.`;
      $('resultMsg').textContent = '다시 도와줄래? 💪';
    }
    $('reachText').textContent = state.reachedEnd ? '🌊 바다까지 왔어요!' : `📍 ${stop.short}까지 왔어요!`;
    renderMap($('resultMap'), state.reachedEnd ? n : state.stageIndex);

    const st = starsFor(passed);
    const maxStars = C.stars.reduce((m, r) => Math.max(m, r.stars), 0);
    $('resultStars').innerHTML = '★'.repeat(st) + `<span class="off">${'★'.repeat(Math.max(0, maxStars - st))}</span>`
      + `<span class="stars-label">별 ${st}개</span>`;
    $('resultStars').setAttribute('aria-label', `별 ${st}개`);

    $('statScore').textContent = state.score;
    $('statCorrect').textContent = `${state.totalCorrect}개`;
    $('statAcc').textContent = `${acc}%`;
    $('statPassed').textContent = `${passed}/${n}`;

    const parts = [`정답 ${state.totalCorrect}×${S.correct}점`];
    if (state.comboBonusTotal) parts.push(`콤보 +${state.comboBonusTotal}점`);
    if (state.reachedEnd) parts.push(`남은 시간 ${Math.floor(state.timeLeft)}초 +${state.timeBonus}점`, `완주 +${S.endingBonus}점`);
    $('scoreDetail').textContent = parts.join(' · ');

    const rec = { score: state.score, accuracy: acc, correct: state.totalCorrect, passed, date, name: state.playerName };
    const saved = Records.saveBest(L.id, rec);
    const badge = $('newRecord');
    badge.hidden = !saved.isNew;
    badge.textContent = saved.isFirst ? '첫 기록!' : '신기록!';
    const best = Records.getBest(L.id);
    $('bestText').textContent = saved.isNew && !saved.isFirst
      ? `🏅 ${L.name} 신기록! (이전 최고 ${saved.prev.score}점)`
      : `🏅 ${L.name} 최고 기록: ${best.score}점 (${best.date})`;

    // 다시 볼 문제(같은 문제는 한 번만, 최대 maxReview개)
    const seen = new Set();
    const review = state.wrongList.filter((w) => {
      const k = `${w.a}x${w.b}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, C.maxReview);
    $('reviewList').innerHTML = review.length
      ? review.map((w) => `<li>${w.a} × ${w.b} = <span class="ans">${w.answer}</span><small>내 답: ${w.given}</small></li>`).join('')
      : `<li class="none">${state.totalAnswered ? '틀린 문제가 없어요! 👏' : '푼 문제가 없어요.'}</li>`;

    const who = state.playerName || '(이름 없음)';
    $('gripLine').textContent = `[GRIP] ${who} · ${L.name} · 정답률 ${acc}% (${state.totalCorrect}/${state.totalAnswered}) · 도달: ${stop.name} (명소 ${passed}/${n}) · ${state.score}점 · ${date}`;
    $('btnCopy').textContent = '📋 복사하기';
  }

  function copyGrip() {
    const text = $('gripLine').textContent;
    const ok = () => { $('btnCopy').textContent = '✅ 복사했어요'; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else fallback();
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* 무시 */ }
      ta.remove();
    }
  }

  /* ── 소리 버튼 ─────────────────────────────── */
  const SOUND_MODES = {
    all: { icon: '🎵', label: '음악과 효과음 켜짐 (누르면 음악 끄기)', toast: '🎵 음악 + 효과음' },
    sfx: { icon: '🔊', label: '효과음만 켜짐 (누르면 모두 끄기)', toast: '🔊 효과음만' },
    off: { icon: '🔇', label: '소리 꺼짐 (누르면 모두 켜기)', toast: '🔇 소리 끔' },
  };
  function updateSoundBtn(showToast) {
    const mode = Sound.mode();
    const info = SOUND_MODES[mode];
    const b = $('soundBtn');
    b.textContent = info.icon;
    b.classList.toggle('off', mode === 'off');
    b.setAttribute('aria-label', info.label);
    if (showToast) {
      const t = $('soundToast');
      t.textContent = info.toast;
      restartAnim(t, 'show');
    }
  }

  /* ── 이벤트 연결 ───────────────────────────── */
  function bind() {
    $('btnStart').addEventListener('click', goLevelSelect);
    $('playerName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); goLevelSelect(); } });
    $('btnLevelBack').addEventListener('click', () => showScreen('start'));
    $('levelGrid').addEventListener('click', (e) => {
      const card = e.target.closest('.level-card');
      if (card) startLevel(C.levels[Number(card.dataset.idx)]);
    });
    $('btnRetry').addEventListener('click', () => startLevel(state.level));
    $('btnChangeLevel').addEventListener('click', () => showScreen('level'));
    $('btnHome').addEventListener('click', () => showScreen('start'));
    $('btnCopy').addEventListener('click', copyGrip);
    $('btnPause').addEventListener('click', openPause);
    $('btnResume').addEventListener('click', resumeGame);
    $('btnPauseLevel').addEventListener('click', () => quitGame('level'));
    $('btnPauseHome').addEventListener('click', () => quitGame('start'));
    $('screen-ending').addEventListener('pointerdown', skipEnding);
    $('soundBtn').addEventListener('click', (e) => { e.stopPropagation(); Sound.cycle(); updateSoundBtn(true); });
    $('soundBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
    document.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });
    document.addEventListener('keydown', (e) => {
      if (currentScreen === 'ending' && ['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); skipEnding(); }
      else if (currentScreen === 'game' && paused && e.key === 'Escape') { e.preventDefault(); resumeGame(); }
    });
    // 두 손가락 확대·더블탭 확대 방지(iOS)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch < 350 && e.target.closest('.keypad, .scene, .question')) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  /* ── 시작 ─────────────────────────────────── */
  Keypad.init($('keypad'), {
    maxDigits: C.maxDigits,
    onChange: renderAnswer,
    onSubmit: submitAnswer,
    isActive: () => currentScreen === 'game' && !paused,
  });
  initBranding();
  preloadAssets();
  updateSoundBtn();
  bind();
})();
