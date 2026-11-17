// 학생 화면: 방 번호 → 이름·비밀번호 → 문제 풀기. 학생은 답만 보내고 판정은 TV가 합니다.
import { initFirebase, ensureAuth, serverNow, isConfigured } from './fb.js';
import { ref, get, set, onValue, onDisconnect, serverTimestamp } from './fb-sdk.js';
import { NAME_MAX, PIN_FAIL_LIMIT, PIN_LOCK_SEC, PLAYER_COLORS, TEAM_PRESETS, MAX_DIGITS, SCHOOL_MARK } from './game-config.js';
import { rankPlayers, rankTeams, accuracy, arrivalStatus } from './referee.js';
import {
  $, show, normalizeName, charLength, toNameKey, fromNameKey, pinHash, escapeHtml, charBadge, sfx, vibrate,
} from './common.js';

const SS_SESSION = 'bukangi.battle.session';
const { db } = initFirebase('student');
$('#nameMax').textContent = NAME_MAX;
document.querySelectorAll('[data-school]').forEach((el) => { el.textContent = SCHOOL_MARK; });
$('#heroChar').innerHTML = charBadge({}, 110);

let uid = null;
let code = null;
let key = null;
let me = null;          // players/{key}
let meSeen = false;     // 한 번이라도 내 기록을 받았는지(내보내기 감지용)
const R = {};           // 방 상태 조각: status, settings, startAt, hostOnline, hostUid
const unsubs = [];
let typed = '';
let shownQid = null;
let waitingQid = null;
let waitTimer = null;
let handledResult = null;

// ───────── 시작 ─────────
(async function boot() {
  if (!isConfigured()) { notice('선생님이 아직 Firebase 설정을 하지 않았어요.'); return; }
  const qRoom = new URLSearchParams(location.search).get('room');
  if (qRoom) $('#inRoom').value = qRoom.replace(/\D/g, '').slice(0, 4);
  try { uid = await ensureAuth(); } catch (e) { $('#roomMsg').textContent = '연결에 실패했어요: ' + e.message; return; }
  const saved = JSON.parse(sessionStorage.getItem(SS_SESSION) || 'null');
  if (saved && (!qRoom || qRoom === saved.room) && await tryResume(saved)) return;
  if (qRoom && /^\d{4}$/.test($('#inRoom').value)) return goRoom();
  show('room');
  $('#inRoom').focus();
})();

/** 같은 탭에서 새로고침한 경우: 같은 익명 계정이라 비밀번호 없이 이어서 */
async function tryResume({ room, key: k }) {
  try {
    const [p, owner] = await Promise.all([get(ref(db, `rooms/${room}/players/${k}`)), get(ref(db, `rooms/${room}/hostUid`))]);
    if (!p.exists() || !owner.exists()) throw new Error('없음');
    code = room;
    await set(ref(db, `rooms/${room}/presence/${k}`), true); // 내 자리가 아니면 여기서 거절됨
    enter(k);
    return true;
  } catch {
    sessionStorage.removeItem(SS_SESSION);
    code = null;
    return false;
  }
}

// ───────── 1. 방 번호 ─────────
$('#btnRoom').onclick = goRoom;
$('#inRoom').addEventListener('keydown', (e) => { if (e.key === 'Enter') goRoom(); });
$('#inRoom').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
async function goRoom() {
  sfx.unlock();
  const c = $('#inRoom').value.trim();
  const m = $('#roomMsg');
  if (!/^\d{4}$/.test(c)) { m.textContent = '방 번호 숫자 4자리를 넣어 주세요.'; show('room'); return; }
  m.textContent = '확인 중…';
  try {
    const h = await get(ref(db, `rooms/${c}/hostUid`));
    if (!h.exists()) { m.textContent = '그런 방이 없어요. 번호를 다시 확인해요.'; show('room'); return; }
    const st = (await get(ref(db, `rooms/${c}/status`))).val();
    if (st === 'finished') { m.textContent = '이미 끝난 방이에요. 선생님께 새 게임을 부탁해요.'; show('room'); return; }
    code = c;
    m.textContent = '';
    $('#roomShow').textContent = c;
    show('name');
    $('#inName').focus();
  } catch (e) { m.textContent = '연결에 실패했어요: ' + e.message; show('room'); }
}
$('#btnChangeRoom').onclick = () => { code = null; show('room'); };

// ───────── 2. 이름 + 비밀번호 ─────────
$('#inPin').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
$('#inPin').addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
$('#btnJoin').onclick = doJoin;

function lockKey() { return `bukangi.battle.lock.${code}`; }
function getLock() { try { return JSON.parse(localStorage.getItem(lockKey())) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } }
function setLock(v) { localStorage.setItem(lockKey(), JSON.stringify(v)); }

let joining = false;
async function doJoin() {
  if (joining) return;
  const m = $('#nameMsg');
  const name = normalizeName($('#inName').value);
  const pin = $('#inPin').value;
  if (!name) { m.textContent = '이름이나 별명을 써 주세요.'; return; }
  if (charLength(name) > NAME_MAX) { m.textContent = `이름은 ${NAME_MAX}글자까지 쓸 수 있어요.`; return; }
  if (!/^\d{4}$/.test(pin)) { m.textContent = '비밀번호는 숫자 4자리예요.'; return; }
  const lock = getLock();
  if (lock.until > Date.now()) { m.textContent = `잠깐! ${Math.ceil((lock.until - Date.now()) / 1000)}초 뒤에 다시 해 보세요.`; return; }

  joining = true; $('#btnJoin').disabled = true;
  m.textContent = '들어가는 중…';
  try {
    let k = toNameKey(name);
    let hashName = name;
    // 선생님이 이름을 바꿔 준 경우: 새 이름 → 원래 자리
    const alias = (await get(ref(db, `rooms/${code}/aliases/${k}`))).val();
    if (alias) { k = alias; hashName = fromNameKey(alias); }
    const [pSnap, stSnap, ljSnap] = await Promise.all([
      get(ref(db, `rooms/${code}/players/${k}`)),
      get(ref(db, `rooms/${code}/status`)),
      get(ref(db, `rooms/${code}/settings/lateJoin`)),
    ]);
    if (!pSnap.exists() && stSnap.val() !== 'lobby' && ljSnap.val() !== true) {
      m.textContent = '지금은 게임 중이라 새로 들어올 수 없어요. 다음 판을 기다려요!';
      return;
    }
    const hash = await pinHash(code, hashName, pin);
    try {
      await set(ref(db, `rooms/${code}/secrets/${k}`), { pinHash: hash, uid });
    } catch (e) {
      const f = getLock();
      f.fails = (f.fails || 0) + 1;
      if (f.fails >= PIN_FAIL_LIMIT) { f.until = Date.now() + PIN_LOCK_SEC * 1000; f.fails = 0; }
      setLock(f);
      m.textContent = f.until > Date.now()
        ? `${PIN_FAIL_LIMIT}번 틀렸어요. ${PIN_LOCK_SEC}초 쉬었다가 다시 해 보세요.`
        : '이미 다른 친구가 쓰는 이름이거나 비밀번호가 달라요.';
      sfx.wrong(); vibrate(200);
      return;
    }
    setLock({ fails: 0, until: 0 });
    sessionStorage.setItem(SS_SESSION, JSON.stringify({ room: code, key: k }));
    m.textContent = '';
    enter(k);
  } catch (e) {
    m.textContent = '연결에 실패했어요: ' + e.message;
  } finally { joining = false; $('#btnJoin').disabled = false; }
}

// ───────── 3. 입장 후: 실시간 구독 ─────────
function enter(k) {
  key = k;
  meSeen = false;
  show('wait');
  $('#waitName').textContent = fromNameKey(k);
  $('#waitText').textContent = 'TV가 확인하는 중이에요…';
  const sub = (path, fn) => unsubs.push(onValue(ref(db, `rooms/${code}/${path}`), (s) => fn(s.val()), () => {}));

  // 접속 상태: 끊기면 TV에서 회색, 다시 연결되면 원래대로
  unsubs.push(onValue(ref(db, '.info/connected'), (s) => {
    if (s.val() !== true) return;
    const pr = ref(db, `rooms/${code}/presence/${key}`);
    onDisconnect(pr).set(false).then(() => set(pr, true)).catch(() => {});
  }));
  sub(`players/${k}`, (v) => {
    if (!v && meSeen) { kickedOrClosed(); return; }
    if (v) meSeen = true;
    me = v; update();
  });
  sub('status', (v) => { R.status = v; update(); });
  sub('settings', (v) => { R.settings = v || {}; update(); });
  sub('startAt', (v) => { R.startAt = v; update(); });
  sub('hostOnline', (v) => { R.hostOnline = v; banner(); });
  sub('hostUid', (v) => { R.hostUid = v; if (!v) closed(); });
  sub('teams', (v) => { R.teams = v; update(); });
}

async function kickedOrClosed() {
  const h = await get(ref(db, `rooms/${code}/hostUid`)).catch(() => null);
  if (!h?.exists()) return closed();
  cleanup();
  notice('선생님이 내보냈어요. 다른 이름으로 다시 들어올 수 있어요.');
}
function closed() { cleanup(); notice('선생님이 방을 닫았어요. 고마워요! 🦈'); }
function cleanup() {
  unsubs.splice(0).forEach((u) => u());
  sessionStorage.removeItem(SS_SESSION);
  me = null; key = null; meSeen = false; watchingAll = false;
}
function notice(t) { $('#noticeText').textContent = t; show('notice'); $('#countdown').hidden = true; }
$('#btnRestart').onclick = () => { location.href = location.pathname + (location.search.includes('emu=1') ? '?emu=1' : ''); };

function banner() {
  const el = $('#banner');
  const off = R.hostOnline === false && R.status !== 'finished';
  el.hidden = !off;
  el.textContent = 'TV 화면 연결을 기다리는 중이에요…';
}

const myColor = () => PLAYER_COLORS[me?.color] || '#a78bfa';
const myTeam = () => (R.settings?.mode === 'team' ? TEAM_PRESETS.find((t) => t.id === me?.team) : null);
const goal = () => R.settings?.goal || 20;

function update() {
  if (!key) return;
  if (!me) { show('wait'); return; }
  const team = myTeam();
  $('#waitOwl').innerHTML = charBadge({ color: myColor(), scarf: team?.color }, 130);
  $('#waitName').textContent = me.name;
  const tp = $('#waitTeam');
  tp.hidden = !team;
  if (team) { tp.textContent = team.name; tp.style.background = team.color; }

  if (R.status === 'lobby' || R.status === 'countdown' || R.status == null) {
    // 새 판 준비: 문제 번호가 q1부터 다시 시작하므로 화면 상태 초기화
    shownQid = null; waitingQid = null; handledResult = null; clearTimeout(waitTimer);
  }
  if (R.status === 'lobby' || R.status == null) {
    $('#waitText').textContent = '들어왔어요! 선생님이 시작할 때까지 기다려요.';
    show('wait');
  } else if (R.status === 'countdown') {
    show('wait');
  } else if (R.status === 'playing') {
    if (me.finishedRank) showArrived();
    else renderQuestion();
  } else if (R.status === 'finished') {
    showDone();
  }
}

// ───────── 4. 문제 풀기 ─────────
function renderQuestion() {
  show('play');
  const team = myTeam();
  $('#stName').innerHTML = `${charBadge({ color: myColor(), scarf: team?.color }, 34)} ${escapeHtml(me.name)}`;
  const pos = me.position || 0;
  $('#stBar').style.width = `${(pos / goal()) * 100}%`;
  $('#stPos').textContent = `${pos} / ${goal()}칸`;

  // 판정 결과
  const lr = me.lastResult;
  if (lr && lr.qid === waitingQid && handledResult !== lr.qid) {
    handledResult = lr.qid;
    waitingQid = null; clearTimeout(waitTimer);
    const fb = $('#feedback');
    if (lr.ok) {
      fb.textContent = '⭕ 정답! 한 칸 앞으로'; fb.className = 'feedback good';
      sfx.correct(); vibrate(40);
    } else {
      fb.textContent = `❌ 아쉬워요! 정답은 ${lr.answer}${lr.moved < 0 ? ' · 한 칸 뒤로' : ''}`; fb.className = 'feedback bad';
      sfx.wrong(); vibrate([80, 60, 80]);
      $('#qCard').classList.remove('shake'); void $('#qCard').offsetWidth; $('#qCard').classList.add('shake');
    }
  }

  const q = me.currentQ;
  if (q && q.qid !== shownQid) {
    shownQid = q.qid;
    typed = '';
    $('#qText').textContent = `${q.a} × ${q.b} = ?`;
    renderTyped();
    setTimeout(() => { if (shownQid === q.qid && !waitingQid) { $('#feedback').textContent = ''; } }, 1300);
  }
  restTick();
}

function renderTyped() {
  $('#ansText').textContent = typed || ' ';
  $('#keypad').classList.toggle('locked', !!waitingQid || isResting());
}
const isResting = () => (me?.restUntil || 0) > serverNow();

function restTick() {
  const r = $('#rest');
  const left = (me?.restUntil || 0) - serverNow();
  if (R.status === 'playing' && left > 0 && !me?.finishedRank) {
    r.hidden = false;
    $('#restNum').textContent = Math.ceil(left / 1000);
  } else r.hidden = true;
  $('#keypad').classList.toggle('locked', !!waitingQid || left > 0);
}

// 터치는 pointerdown(혼자 하기와 같은 방식: 누르는 즉시 입력)
$('#keypad').addEventListener('pointerdown', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  e.preventDefault();
  press(b.dataset.k || b.textContent);
});
document.addEventListener('keydown', (e) => {
  if ($('[data-screen="play"]').hidden) return;
  if (/^\d$/.test(e.key)) press(e.key);
  else if (e.key === 'Backspace') press('del');
  else if (e.key === 'Enter') press('ok');
});

function press(k) {
  if (!me?.currentQ || waitingQid || isResting()) return;
  if (k === 'del') { typed = typed.slice(0, -1); sfx.key(); }
  else if (k === 'ok') { submit(); return; }
  else if (/^\d$/.test(k) && typed.length < MAX_DIGITS) { typed = (typed === '0' ? '' : typed) + k; sfx.key(); }
  renderTyped();
}

async function submit() {
  if (!typed) return;
  const q = me.currentQ;
  waitingQid = q.qid;
  renderTyped();
  try {
    await set(ref(db, `rooms/${code}/answers/${key}`), { qid: q.qid, value: Number(typed), at: serverTimestamp() });
  } catch (e) {
    waitingQid = null; renderTyped();
    $('#feedback').textContent = '보내지 못했어요. 다시 눌러 주세요.'; $('#feedback').className = 'feedback bad';
    return;
  }
  clearTimeout(waitTimer);
  waitTimer = setTimeout(() => {
    if (waitingQid !== q.qid) return;
    waitingQid = null; renderTyped();
    $('#feedback').textContent = 'TV 연결을 확인하고 있어요. 다시 [확인]을 눌러 봐요.'; $('#feedback').className = 'feedback';
  }, 6000);
}

// ───────── 5~6. 도착 / 결과 ─────────
// '모두 도착' 방식에서 먼저 온 친구에게 "아직 오는 친구 N명"을 보여 주려고, 도착한 뒤에만 전체 목록을 구독
let watchingAll = false;
function watchClass() {
  if (watchingAll) return;
  watchingAll = true;
  unsubs.push(onValue(ref(db, `rooms/${code}/players`), (snap) => { R.players = snap.val() || {}; if (me?.finishedRank) showArrived(); }));
  unsubs.push(onValue(ref(db, `rooms/${code}/presence`), (snap) => { R.presence = snap.val() || {}; if (me?.finishedRank) showArrived(); }));
}

function showArrived() {
  if (R.status !== 'playing') return;
  show('arrived');
  $('#arrOwl').innerHTML = charBadge({ color: myColor(), scarf: myTeam()?.color }, 160);
  if (R.settings?.endRule === 'all') {
    watchClass();
    const left = R.players ? arrivalStatus({ players: R.players, presence: R.presence }).waiting.length : null;
    $('#arrTitle').textContent = `🌊 ${me.finishedRank}번째로 바다에 왔어요!`;
    $('#arrText').textContent = left ? `아직 오고 있는 친구 ${left}명! 다 같이 응원해요 📣` : '친구들을 응원해요 📣 모두 오면 다 같이 박수!';
  } else {
    $('#arrTitle').textContent = `🌊 ${me.finishedRank}등으로 도착!`;
    $('#arrText').textContent = R.settings?.mode === 'team'
      ? '멋져요! 우리 팀 친구들을 응원해요 📣'
      : `정답 ${me.correct || 0}개! 다른 친구들을 응원해요.`;
  }
  if (handledResult !== 'arrived') { handledResult = 'arrived'; sfx.fanfare(); vibrate([100, 50, 100, 50, 200]); }
}

let doneShown = false;
async function showDone() {
  show('done');
  $('#doneOwl').innerHTML = charBadge({ color: myColor(), scarf: myTeam()?.color }, 130);
  const stats = `<div>정답 <b>${me.correct || 0}</b>개</div><div>정답률 <b>${Math.round(accuracy(me) * 100)}</b>%</div><div>이동 <b>${me.position || 0}</b>칸</div>`;
  $('#doneStats').innerHTML = stats;
  if (doneShown) return;
  doneShown = true;
  try {
    const all = (await get(ref(db, `rooms/${code}/players`))).val() || {};
    if (R.settings?.endRule === 'all') {
      const presence = (await get(ref(db, `rooms/${code}/presence`))).val() || {};
      const st = arrivalStatus({ players: all, presence });
      if (st.arrived > 0 && st.waiting.length === 0) {
        $('#doneTitle').textContent = '🎉 우리 반 모두 바다에 도착! 👏';
        sfx.fanfare(); setTimeout(() => sfx.clap(3), 600); vibrate([60, 60, 60, 60, 60]);
        return;
      }
    }
    const ranked = rankPlayers(all);
    const myRank = ranked.findIndex((p) => p.key === key) + 1;
    let title = `${myRank}등! 수고했어요`;
    if (R.settings?.mode === 'team' && R.teams) {
      const ids = TEAM_PRESETS.slice(0, R.settings.teamCount).map((t) => t.id);
      const rt = rankTeams(R.teams, all, ids);
      const tr = rt.findIndex((t) => t.id === me.team) + 1;
      title = `우리 팀 ${tr}등! ${tr === 1 ? '🏆' : '수고했어요'}`;
    }
    $('#doneTitle').textContent = myRank === 1 && R.settings?.mode !== 'team' ? '🏆 1등! 최고예요!' : title;
  } catch { /* 순위를 못 받아도 통계는 보여 줌 */ }
}

// ───────── 카운트다운·쉬기 타이머 ─────────
let lastCount = null;
setInterval(() => {
  const el = $('#countdown');
  if (R.status === 'countdown' && R.startAt && key && me) {
    const left = Math.ceil((R.startAt - serverNow()) / 1000);
    const t = left > 0 ? String(left) : '시작!';
    el.hidden = false;
    if (t !== lastCount) {
      lastCount = t; $('#countNum').textContent = t;
      $('#countNum').classList.remove('pop'); void el.offsetWidth; $('#countNum').classList.add('pop');
      left > 0 ? sfx.tick() : sfx.go();
    }
  } else { el.hidden = true; lastCount = null; }
  if (R.status !== 'finished') doneShown = false;
  if (R.status === 'playing' && me && !me.finishedRank && !$('[data-screen="play"]').hidden) restTick();
}, 150);

window.__student = { get me() { return me; }, get key() { return key; }, get code() { return code; } };
