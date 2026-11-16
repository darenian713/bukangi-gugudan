// 진행 화면(TV) = 심판. 방 만들기·입장 관리·문제 출제·판정·순위·연출을 모두 여기서 합니다.
import { initFirebase, ensureAuth, serverNow, isConfigured, USING_EMULATOR } from './fb.js';
import {
  ref, get, set, update, remove, onValue, onDisconnect, serverTimestamp, query, orderByValue, endAt,
} from './fb-sdk.js';
import {
  GAME_DEFAULTS, TEAM_PRESETS, PLAYER_COLORS, SCHOOL_MARK, ROOM_TTL_MS, NAME_MAX,
  DAN_CHOICES, GOAL_OPTIONS, TIME_OPTIONS, CHARACTER_IMAGE, PLACES,
} from './game-config.js';
import {
  judge, nextQuestionPatch, assignTeams, smallestTeam, teamAverages, rankPlayers, rankTeams, teamMvp,
  isGameOver, accuracy,
} from './referee.js';
import { BusanMap } from './map-view.js';
import {
  $, show, escapeHtml, fromNameKey, toNameKey, normalizeName, charLength, charBadge, sfx, setSound, soundOn, imageExists,
} from './common.js';
import qrcode from '../vendor/qrcode.mjs';

const LS_ROOM = 'bukangi.battle.hostRoom';
const { db } = initFirebase('host');

document.querySelectorAll('[data-school]').forEach((el) => { el.textContent = SCHOOL_MARK; });

// 선생님이 넣은 그림(부캉이·팀 캐릭터·장소 사진)이 실제로 있는지 확인
const okImages = new Set();
Promise.all([CHARACTER_IMAGE, ...TEAM_PRESETS.map((t) => t.image), ...PLACES.map((p) => p.photo)]
  .filter(Boolean).map(async (u) => { if (await imageExists(u)) okImages.add(u); }))
  .then(() => { map?.setPhotos(okImages); if (room) render(); });
/** 팀 대표 그림: 팀 그림 → (부캉이팀이면) 부캉이 그림 → 없으면 팀 색 부캉이 */
function teamImage(t) {
  if (t.image && okImages.has(t.image)) return t.image;
  if (t.id === 't1' && okImages.has(CHARACTER_IMAGE)) return CHARACTER_IMAGE;
  return null;
}

let uid = null;
let code = null;
let room = null;            // 방 전체 상태(최신)
let unsubRoom = null;
let map = null;
const judged = new Map();   // key → 마지막으로 판정한 qid (중복 판정 방지)
const creating = new Set(); // 플레이어 생성 중인 key
let prevPlayers = null;     // 연출용: 직전 위치/도착 상태
let prevTeams = null;
const announcedLandmarks = new Set();
let lastStatus = null;

// ───────────────────────── 시작 ─────────────────────────
boot();
async function boot() {
  show('create');
  if (!isConfigured()) {
    msg('firebase-config.js에 선생님 Firebase 설정값을 먼저 넣어 주세요. (README 참고)');
    $('#btnCreate').disabled = true;
    return;
  }
  try { uid = await ensureAuth(); } catch (e) { msg('로그인에 실패했어요: ' + e.message); return; }
  const want = new URLSearchParams(location.search).get('room') || localStorage.getItem(LS_ROOM);
  if (want) {
    const h = await get(ref(db, `rooms/${want}/hostUid`)).catch(() => null);
    if (h?.val() === uid) {
      if (new URLSearchParams(location.search).get('room')) return attach(want);
      const b = $('#btnResume');
      b.hidden = false;
      b.textContent = `이전 방(${want}) 이어서 하기`;
      b.onclick = () => attach(want);
    } else if (h?.exists()) {
      msg(`${want}번 방은 다른 기기(브라우저)에서 만든 방이에요. 그 기기에서 열어 주세요.`);
    } else {
      localStorage.removeItem(LS_ROOM);
    }
  }
}
function msg(t) { $('#createMsg').textContent = t; }

$('#btnCreate').onclick = async () => {
  sfx.unlock();
  $('#btnCreate').disabled = true;
  msg('방을 만드는 중…');
  try {
    await cleanupStale();
    const c = await createRoom();
    await attach(c);
  } catch (e) {
    console.error(e);
    msg('방을 만들지 못했어요: ' + e.message);
  } finally { $('#btnCreate').disabled = false; }
};

/** 24시간 지난 방 정리 */
async function cleanupStale() {
  try {
    const cutoff = serverNow() - ROOM_TTL_MS - 60_000;
    const snap = await get(query(ref(db, 'roomIndex'), orderByValue(), endAt(cutoff)));
    const codes = Object.keys(snap.val() || {});
    for (const c of codes) {
      await remove(ref(db, `rooms/${c}`)).catch(() => {});
      await remove(ref(db, `roomIndex/${c}`)).catch(() => {});
    }
  } catch (e) { console.warn('정리 실패(무시)', e); }
}

async function createRoom() {
  for (let tries = 0; tries < 40; tries++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    const [idx, h] = await Promise.all([get(ref(db, `roomIndex/${c}`)), get(ref(db, `rooms/${c}/hostUid`))]);
    if (idx.exists() || h.exists()) continue;
    try {
      await set(ref(db, `roomIndex/${c}`), serverTimestamp());
      await set(ref(db, `rooms/${c}`), {
        game: 'gugudan', hostUid: uid, createdAt: serverTimestamp(), status: 'lobby', settings: { ...GAME_DEFAULTS },
      });
      return c;
    } catch (e) { console.warn('방 번호 충돌, 다시 시도', c, e); }
  }
  throw new Error('빈 방 번호를 찾지 못했어요. 잠시 후 다시 해 주세요.');
}

async function attach(c) {
  code = c;
  localStorage.setItem(LS_ROOM, c);
  const u = new URL(location.href); u.searchParams.set('room', c); history.replaceState(null, '', u);
  // TV 접속 상태(학생 화면에 "TV 연결 기다리는 중" 표시용)
  onValue(ref(db, '.info/connected'), (s) => {
    if (s.val() !== true || !code) return;
    const r = ref(db, `rooms/${code}/hostOnline`);
    onDisconnect(r).set(false).then(() => set(r, true)).catch(() => {});
  });
  unsubRoom?.();
  unsubRoom = onValue(ref(db, `rooms/${c}`), (s) => {
    room = s.val();
    if (!room) { roomClosed(); return; }
    scheduleProcess();
    render();
  }, (e) => { console.error(e); msg('방을 읽을 수 없어요: ' + e.message); show('create'); });
}

function roomClosed() {
  unsubRoom?.(); unsubRoom = null;
  localStorage.removeItem(LS_ROOM);
  code = null; room = null; prevPlayers = null; judged.clear();
  const u = new URL(location.href); u.searchParams.delete('room'); history.replaceState(null, '', u);
  $('#btnResume').hidden = true;
  msg('방을 닫았어요. 방 데이터는 모두 지워졌어요.');
  show('create');
}

const rpath = (p) => `rooms/${code}/${p}`;
const roomUpdate = (obj) => update(ref(db, `rooms/${code}`), obj);
const settings = () => ({ ...GAME_DEFAULTS, ...(room?.settings || {}) });
const teamIds = () => TEAM_PRESETS.slice(0, settings().teamCount).map((t) => t.id);
const players = () => room?.players || {};
const isOnline = (k) => room?.presence?.[k] === true;

// ───────────────────────── 심판 처리 ─────────────────────────
let processQueued = false;
function scheduleProcess() {
  if (processQueued) return;
  processQueued = true;
  queueMicrotask(() => { processQueued = false; process(); });
}

function process() {
  if (!room || !code) return;
  const s = settings();
  const ps = { ...players() };
  const ups = {};
  const now = serverNow();

  // 1) 새로 등록한 학생(secrets에는 있는데 players에 없음) → 참가자 만들기
  for (const k of Object.keys(room.secrets || {})) {
    if (ps[k] || creating.has(k)) continue;
    if (room.status === 'finished') continue;
    if (room.status !== 'lobby' && !s.lateJoin) continue;
    creating.add(k);
    const used = new Set(Object.values(ps).map((p) => p.color));
    let color = 0; while (used.has(color) && color < PLAYER_COLORS.length) color++;
    if (color >= PLAYER_COLORS.length) color = Object.keys(ps).length % PLAYER_COLORS.length;
    const p = {
      name: fromNameKey(k), color, team: s.mode === 'team' ? smallestTeam(ps, teamIds()) : null,
      position: 0, correct: 0, wrong: 0, restUntil: 0, finishedRank: null, qn: 0, joinedAt: now,
    };
    if (room.status === 'playing') Object.assign(p, nextQuestionPatch(p, s));
    ps[k] = p;
    ups[`players/${k}`] = p;
    sfx.join();
  }

  // 2) 답 판정
  if (room.status === 'playing') {
    let finishedSoFar = Object.values(ps).filter((p) => p.finishedRank).length;
    const touchedTeams = new Set();
    for (const [k, ans] of Object.entries(room.answers || {})) {
      const p = ps[k];
      if (!p || !p.currentQ || p.finishedRank || !ans || ans.qid !== p.currentQ.qid) continue;
      if (judged.get(k) === ans.qid) continue;
      judged.set(k, ans.qid);
      const { patch } = judge(p, ans, s, now, finishedSoFar);
      if (patch.finishedRank) finishedSoFar++;
      for (const [f, v] of Object.entries(patch)) ups[`players/${k}/${f}`] = v;
      ps[k] = { ...p, ...patch };
      if (p.team) touchedTeams.add(p.team);
    }
    // 3) 팀 평균 위치 / 팀 도착
    if (s.mode === 'team' && touchedTeams.size) {
      const { avg } = teamAverages(ps, teamIds());
      let doneTeams = Object.values(room.teams || {}).filter((t) => t.finishedRank).length;
      for (const t of teamIds()) {
        if (!room.teams?.[t]) continue;
        ups[`teams/${t}/avgPosition`] = avg[t];
        if (avg[t] >= s.goal && !room.teams[t].finishedRank) {
          ups[`teams/${t}/finishedRank`] = ++doneTeams;
          ups[`teams/${t}/finishedAt`] = now;
        }
      }
    }
  }

  if (Object.keys(ups).length) {
    roomUpdate(ups).catch((e) => console.error('쓰기 실패', e)).finally(() => {
      for (const k of Object.keys(ups)) if (k.startsWith('players/') && k.split('/').length === 2) creating.delete(k.split('/')[1]);
    });
  }
}

// 시간 흐름(카운트다운 → 시작, 제한 시간, 종료 판정)
setInterval(tick, 200);
function tick() {
  if (!room || !code) return;
  const now = serverNow();
  if (room.status === 'countdown') {
    const left = Math.ceil((room.startAt - now) / 1000);
    showCountdown(left);
    if (now >= room.startAt) beginPlaying();
  } else {
    showCountdown(null);
  }
  if (room.status === 'playing') {
    const over = isGameOver(room, now);
    if (over) endGame(over);
    renderTimer(now);
  }
}

let lastCount = null;
function showCountdown(left) {
  const el = $('#countdown');
  if (left == null) { el.hidden = true; lastCount = null; return; }
  el.hidden = false;
  const t = left > 0 ? String(left) : '시작!';
  if (t !== lastCount) {
    lastCount = t;
    $('#countNum').textContent = t;
    $('#countNum').classList.remove('pop'); void el.offsetWidth; $('#countNum').classList.add('pop');
    left > 0 ? sfx.tick() : sfx.go();
  }
}

let beginning = false;
async function beginPlaying() {
  if (beginning) return;
  beginning = true;
  const s = settings();
  const ups = { status: 'playing', startedAt: room.startAt, endsAt: s.timeLimitSec ? room.startAt + s.timeLimitSec * 1000 : null };
  for (const [k, p] of Object.entries(players())) {
    for (const [f, v] of Object.entries(nextQuestionPatch(p, s))) ups[`players/${k}/${f}`] = v;
  }
  try { await roomUpdate(ups); } finally { beginning = false; }
}

let ending = false;
async function endGame(reason) {
  if (ending || room.status !== 'playing') return;
  ending = true;
  const ups = { status: 'finished', finishedAt: serverNow(), endReason: reason };
  for (const k of Object.keys(players())) ups[`players/${k}/currentQ`] = null;
  try { await roomUpdate(ups); } finally { ending = false; }
}

/** 시작 전 초기화(위치·점수 0) */
function resetPlayersUpdates() {
  const ups = { answers: null, startedAt: null, endsAt: null, finishedAt: null, endReason: null };
  for (const k of Object.keys(players())) {
    Object.assign(ups, {
      [`players/${k}/position`]: 0, [`players/${k}/correct`]: 0, [`players/${k}/wrong`]: 0,
      [`players/${k}/restUntil`]: 0, [`players/${k}/finishedRank`]: null, [`players/${k}/finishedAt`]: null,
      [`players/${k}/currentQ`]: null, [`players/${k}/lastResult`]: null, [`players/${k}/qn`]: 0, [`players/${k}/recent`]: null,
    });
  }
  judged.clear();
  announcedLandmarks.clear();
  return ups;
}

function teamsNode() {
  const out = {};
  TEAM_PRESETS.slice(0, settings().teamCount).forEach((t) => {
    out[t.id] = { name: t.name, color: t.color, avgPosition: 0, finishedRank: null };
  });
  return out;
}

$('#btnStart').onclick = async () => {
  sfx.unlock();
  const s = settings();
  if (!Object.keys(players()).length) return;
  const ups = resetPlayersUpdates();
  if (s.mode === 'team') {
    ups.teams = teamsNode();
    const ids = teamIds();
    const unassigned = Object.entries(players()).filter(([, p]) => !ids.includes(p.team)).map(([k]) => k);
    const tmp = { ...players() };
    for (const k of unassigned) { const t = smallestTeam(tmp, ids); tmp[k] = { ...tmp[k], team: t }; ups[`players/${k}/team`] = t; }
  } else {
    ups.teams = null;
  }
  ups.status = 'countdown';
  ups.startAt = serverNow() + 3500;
  await roomUpdate(ups);
};

$('#btnEnd').onclick = () => { if (confirm('게임을 지금 끝낼까요? 지금까지의 위치로 순위를 정해요.')) endGame('teacher'); };

$('#btnAgain').onclick = async () => {
  const ups = resetPlayersUpdates();
  ups.status = 'lobby';
  ups.startAt = null;
  if (settings().mode === 'team') ups.teams = teamsNode();
  await roomUpdate(ups);
};

async function closeRoom() {
  if (!confirm('방을 닫을까요? 이 방의 모든 기록(이름·점수)이 지워져요.')) return;
  const c = code;
  unsubRoom?.(); unsubRoom = null;
  await remove(ref(db, `rooms/${c}`));
  await remove(ref(db, `roomIndex/${c}`)).catch(() => {});
  roomClosed();
}
$('#btnClose').onclick = closeRoom;
$('#btnClose2').onclick = closeRoom;

$('#btnSound').onclick = () => {
  setSound(!soundOn);
  $('#btnSound').textContent = soundOn ? '🔊 소리 켬' : '🔇 소리 끔';
};

// ───────────────────────── 설정 ─────────────────────────
const dansBox = $('#dans');
// 단·칸 수·제한 시간 선택지는 config.js의 battle 값으로 만듦
for (const d of DAN_CHOICES) {
  const b = document.createElement('button');
  b.textContent = `${d}단`; b.dataset.d = d; b.setAttribute('aria-label', `${d}단 출제`);
  b.onclick = () => {
    const cur = new Set(settings().dans);
    cur.has(d) ? cur.delete(d) : cur.add(d);
    if (!cur.size) return;
    roomUpdate({ 'settings/dans': [...cur].sort((a, b) => a - b) });
  };
  dansBox.appendChild(b);
}
$('.seg[data-set="goal"]').innerHTML = GOAL_OPTIONS.map((g) => `<button data-v="${g}">${g}칸</button>`).join('');
$('.seg[data-set="timeLimitSec"]').innerHTML = TIME_OPTIONS.map((t) => `<button data-v="${t}">${t ? `${Math.round(t / 60 * 10) / 10}분` : '없음'}</button>`).join('');
document.querySelectorAll('.seg[data-set]').forEach((seg) => {
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || room?.status !== 'lobby') return;
    const key = seg.dataset.set;
    let v = b.dataset.v;
    if (['teamCount', 'goal', 'restSec', 'timeLimitSec'].includes(key)) v = Number(v);
    if (key === 'lateJoin') v = v === 'true';
    const ups = { [`settings/${key}`]: v };
    const next = { ...settings(), [key]: v };
    if ((key === 'mode' || key === 'teamCount') && next.mode === 'team') {
      // 팀전으로 바꾸거나 팀 수를 바꾸면 바로 랜덤 배정해서 보여 줌
      const ids = TEAM_PRESETS.slice(0, next.teamCount).map((t) => t.id);
      const asg = assignTeams(Object.keys(players()), ids);
      for (const [k, t] of Object.entries(asg)) ups[`players/${k}/team`] = t;
      ups.teams = Object.fromEntries(TEAM_PRESETS.slice(0, next.teamCount).map((t) => [t.id, { name: t.name, color: t.color, avgPosition: 0, finishedRank: null }]));
    }
    if (key === 'mode' && v === 'solo') {
      for (const k of Object.keys(players())) ups[`players/${k}/team`] = null;
      ups.teams = null;
    }
    roomUpdate(ups);
  });
});

$('#btnShuffle').onclick = () => {
  const asg = assignTeams(Object.keys(players()), teamIds());
  const ups = {};
  for (const [k, t] of Object.entries(asg)) ups[`players/${k}/team`] = t;
  roomUpdate(ups);
};

// ───────────────────────── 학생 관리 ─────────────────────────
async function renamePlayer(k) {
  const p = players()[k]; if (!p) return;
  const input = prompt(`'${p.name}'의 새 이름(최대 ${NAME_MAX}글자)`, p.name);
  if (input == null) return;
  const name = normalizeName(input);
  if (!name || charLength(name) > NAME_MAX) return toast(`이름은 1~${NAME_MAX}글자로 해 주세요.`);
  const nk = toNameKey(name);
  if (nk === k) return;
  if (players()[nk] || room.secrets?.[nk] || room.aliases?.[nk]) return toast('이미 있는 이름이에요.');
  // 키는 그대로 두고 보이는 이름만 바꿈 + 새 이름으로도 재접속할 수 있도록 별칭 저장
  await roomUpdate({ [`players/${k}/name`]: name, [`aliases/${nk}`]: k });
  toast(`'${p.name}' → '${name}' (새 이름 + 원래 비밀번호로 다시 들어올 수 있어요)`);
}
async function resetPin(k) {
  const p = players()[k]; if (!p) return;
  if (!confirm(`'${p.name}'의 비밀번호를 지울까요?\n같은 이름으로 새 비밀번호를 정해서 들어오면 위치·점수가 그대로 이어져요.`)) return;
  await remove(ref(db, rpath(`secrets/${k}`)));
  toast(`'${p.name}' 비밀번호를 지웠어요. 이제 새 비밀번호로 들어오면 돼요.`);
}
async function kickPlayer(k) {
  const p = players()[k]; if (!p) return;
  if (!confirm(`'${p.name}'을(를) 내보낼까요?`)) return;
  const ups = { [`players/${k}`]: null, [`secrets/${k}`]: null, [`answers/${k}`]: null, [`presence/${k}`]: null };
  for (const [a, target] of Object.entries(room.aliases || {})) if (target === k) ups[`aliases/${a}`] = null;
  await roomUpdate(ups);
}
function moveTeam(k) {
  const p = players()[k]; if (!p || settings().mode !== 'team') return;
  const ids = teamIds();
  const next = ids[(ids.indexOf(p.team) + 1) % ids.length];
  roomUpdate({ [`players/${k}/team`]: next });
}

function playerRow(k, p, { teamBtn }) {
  const s = settings();
  const team = s.mode === 'team' ? TEAM_PRESETS.find((t) => t.id === p.team) : null;
  return `<div class="p-row ${isOnline(k) ? '' : 'offline'}" data-k="${escapeHtml(k)}">
    ${charBadge({ color: PLAYER_COLORS[p.color] || '#999', scarf: team?.color }, 40)}
    <span class="p-name">${escapeHtml(p.name)}</span>
    ${teamBtn && team ? `<button class="chip" data-act="team" style="background:${team.color}" title="눌러서 팀 옮기기">${escapeHtml(team.name)}</button>` : ''}
    <span class="p-acts">
      <button data-act="rename" title="이름 바꾸기">✏️</button>
      <button data-act="pin" title="비밀번호 초기화">🔑</button>
      <button data-act="kick" title="내보내기">🚪</button>
    </span></div>`;
}
function bindRows(box) {
  box.onclick = (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const k = b.closest('[data-k]').dataset.k;
    ({ rename: renamePlayer, pin: resetPin, kick: kickPlayer, team: moveTeam })[b.dataset.act](k);
  };
}
bindRows($('#lobbyList'));
bindRows($('#manageList'));
$('#btnManage').onclick = () => { renderManage(); $('#manageDlg').showModal(); };
function renderManage() {
  const list = Object.entries(players()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'ko'));
  $('#manageList').innerHTML = list.map(([k, p]) => playerRow(k, p, { teamBtn: false })).join('') || '<p class="hint">아직 아무도 없어요.</p>';
}

// ───────────────────────── 화면 그리기 ─────────────────────────
function render() {
  const s = settings();
  if (room.status !== lastStatus) {
    lastStatus = room.status;
    prevPlayers = null; prevTeams = null;
  }
  if (room.status === 'lobby') { show('lobby'); renderLobby(s); }
  else if (room.status === 'countdown' || room.status === 'playing') { show('play'); renderPlay(s); }
  else if (room.status === 'finished') { show('result'); renderResult(s); }
  if ($('#manageDlg').open) renderManage();
}

let qrFor = null;
function renderLobby(s) {
  $('#roomCode').textContent = code;
  const url = joinUrl();
  if (qrFor !== url) {
    qrFor = url;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    $('#joinUrl').textContent = url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
  }
  document.querySelectorAll('.seg[data-set]').forEach((seg) => {
    const v = String(s[seg.dataset.set]);
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  });
  dansBox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', s.dans.includes(Number(b.dataset.d))));
  $('#rowTeamCount').hidden = s.mode !== 'team';
  $('#btnShuffle').hidden = s.mode !== 'team';

  const list = Object.entries(players()).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  $('#playerCount').textContent = list.length;
  $('#btnStart').disabled = !list.length;
  $('#lobbyHint').textContent = s.mode === 'team'
    ? '팀은 랜덤으로 나눴어요. 팀 이름표를 누르면 다른 팀으로 옮겨요.'
    : '학생 태블릿에서 주소에 들어가 방 번호를 입력해요. (실명 대신 별명도 괜찮아요)';
  const box = $('#lobbyList');
  if (s.mode === 'team') {
    box.className = 'lobby-list teams';
    box.innerHTML = TEAM_PRESETS.slice(0, s.teamCount).map((t) => {
      const mem = list.filter(([, p]) => p.team === t.id);
      return `<div class="team-col" style="--tc:${t.color}"><h4>${escapeHtml(t.name)} <small>${mem.length}명</small></h4>
        ${mem.map(([k, p]) => playerRow(k, p, { teamBtn: true })).join('')}</div>`;
    }).join('');
  } else {
    box.className = 'lobby-list';
    box.innerHTML = list.map(([k, p]) => playerRow(k, p, { teamBtn: false })).join('') ||
      '<p class="hint big-hint">친구들이 들어오면 여기에 이름이 나타나요 🦉</p>';
  }
}

function joinUrl() {
  const u = new URL('join.html', location.href);
  u.search = '';
  u.searchParams.set('room', code);
  if (USING_EMULATOR) u.searchParams.set('emu', '1');
  return u.toString();
}

function renderPlay(s) {
  if (!map) { map = new BusanMap($('#map')); map.setPhotos(okImages); }
  map.setGoal(s.goal);
  $('#playRoom').textContent = code;
  const ps = players();
  const team = (p) => (s.mode === 'team' ? TEAM_PRESETS.find((t) => t.id === p.team) : null);
  const view = {};
  for (const [k, p] of Object.entries(ps)) {
    view[k] = { name: p.name, color: PLAYER_COLORS[p.color] || '#999', scarf: team(p)?.color || null, position: p.position || 0, online: isOnline(k), finishedRank: p.finishedRank };
  }
  map.renderPlayers(view);

  // 팀 대표
  let teamView = {};
  if (s.mode === 'team') {
    const { avg } = teamAverages(ps, teamIds());
    for (const t of TEAM_PRESETS.slice(0, s.teamCount)) teamView[t.id] = { ...t, image: teamImage(t), avgPosition: avg[t.id], finishedRank: room.teams?.[t.id]?.finishedRank };
  }
  map.renderTeams(teamView);

  // 연출: 움직임 / 명소 / 도착
  if (prevPlayers) {
    for (const [k, p] of Object.entries(ps)) {
      const before = prevPlayers[k];
      if (!before) continue;
      const d = (p.position || 0) - (before.position || 0);
      if (d) map.pulse(k, d);
      if (d > 0) {
        const lm = map.landmarkAtCell?.get(p.position);
        if (lm && p.position < s.goal && !announcedLandmarks.has(lm)) {
          announcedLandmarks.add(lm);
          landmarkToast(`📍 ${p.name} — ${lm}`);
        }
      }
      if (p.finishedRank && !before.finishedRank) celebrate(`${p.name} 도착!`, `${p.finishedRank}등!`, PLAYER_COLORS[p.color], team(p)?.color);
    }
    if (s.mode === 'team' && prevTeams) {
      for (const [id, t] of Object.entries(room.teams || {})) {
        if (t.finishedRank && !prevTeams[id]?.finishedRank) celebrate(`${t.name} 도착!`, `${t.finishedRank}등!`, t.color, '#fff');
      }
    }
  }
  prevPlayers = JSON.parse(JSON.stringify(ps));
  prevTeams = JSON.parse(JSON.stringify(room.teams || {}));

  // 오른쪽 순위
  const ranked = rankPlayers(ps);
  $('#rankList').innerHTML = ranked.slice(0, 5).map((p, i) => `
    <li class="${isOnline(p.key) ? '' : 'offline'}">
      <span class="rk">${p.finishedRank ? '🏁' : i + 1}</span>
      ${charBadge({ color: PLAYER_COLORS[p.color] || '#999', scarf: team(p)?.color }, 34)}
      <span class="nm">${escapeHtml(p.name)}</span>
      <span class="ps">${p.position || 0}<small>/${s.goal}</small></span>
    </li>`).join('');
  if (s.mode === 'team') {
    const rt = rankTeams(room.teams, ps, teamIds());
    $('#teamBoard').innerHTML = rt.map((t) => `
      <div class="tb-row" style="--tc:${t.color}">
        <span class="tb-name">${t.finishedRank ? '🏁 ' : ''}${escapeHtml(t.name)}</span>
        <span class="tb-bar"><i style="width:${Math.min(100, (t.avgPosition / s.goal) * 100)}%"></i></span>
        <span class="tb-val">${t.avgPosition.toFixed(1)}</span>
      </div>`).join('');
  } else {
    $('#teamBoard').innerHTML = '';
  }
  renderTimer(serverNow());
}

function renderTimer(now) {
  const el = $('#timer');
  if (!room) return;
  if (room.endsAt && room.status === 'playing') {
    const left = Math.max(0, Math.ceil((room.endsAt - now) / 1000));
    el.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('hurry', left <= 30);
  } else if (room.startedAt && room.status === 'playing') {
    const t = Math.max(0, Math.floor((now - room.startedAt) / 1000));
    el.textContent = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    el.classList.remove('hurry');
  } else el.textContent = '';
}

let lmTimer = null;
function landmarkToast(text) {
  const el = $('#landmarkToast');
  el.textContent = text; el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  sfx.landmark();
  clearTimeout(lmTimer); lmTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

const celebrateQueue = [];
let celebrating = false;
function celebrate(title, sub, color, scarf) {
  celebrateQueue.push({ title, sub, color, scarf });
  if (!celebrating) nextCelebrate();
}
function nextCelebrate() {
  const c = celebrateQueue.shift();
  const el = $('#celebrate');
  if (!c) { celebrating = false; el.hidden = true; return; }
  celebrating = true;
  el.innerHTML = `<div class="cel-box">${charBadge({ color: c.color, scarf: c.scarf }, 150)}
    <div class="cel-title">${escapeHtml(c.title)}</div><div class="cel-sub">${escapeHtml(c.sub)}</div></div>${confetti()}`;
  el.hidden = false;
  sfx.fanfare();
  setTimeout(nextCelebrate, 2600);
}
function confetti() {
  const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#ec4899', '#8b5cf6'];
  return Array.from({ length: 40 }, (_, i) =>
    `<i class="cf" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random()}s"></i>`).join('');
}

function renderResult(s) {
  const ps = players();
  const ranked = rankPlayers(ps);
  const tm = (p) => TEAM_PRESETS.find((t) => t.id === p.team);
  const reason = { time: '⏰ 시간 끝!', teacher: '게임 끝!', arrived: '🌊 바다 도착!' }[room.endReason] || '게임 끝!';
  $('#resultTitle').textContent = `🏆 ${reason}`;
  const steps = [1, 0, 2]; // 2등, 1등, 3등 순으로 배치
  if (s.mode === 'team') {
    const rt = rankTeams(room.teams, ps, teamIds());
    $('#podium').innerHTML = steps.map((i) => rt[i] ? `
      <div class="pd pd${i + 1}">
        ${teamImage(rt[i]) ? `<img src="${escapeHtml(teamImage(rt[i]))}" alt="${escapeHtml(rt[i].name)}" class="pd-img">` : charBadge({ color: rt[i].color, scarf: '#fff' }, i === 0 ? 130 : 100)}
        <div class="pd-name">${escapeHtml(rt[i].name)}</div>
        <div class="pd-block" style="background:${rt[i].color}">${i + 1}</div>
      </div>` : '').join('');
    $('#teamResult').innerHTML = `<div class="team-result">${rt.map((t, i) => {
      const mvp = teamMvp(ps, t.id);
      return `<div class="tr-card" style="--tc:${t.color}"><b>${i + 1}등 ${escapeHtml(t.name)}</b>
        <span>평균 ${t.avgPosition.toFixed(1)}칸 · ${t.members}명 · 정답 ${t.correctSum}개</span>
        <span>⭐ MVP: ${mvp ? `${escapeHtml(mvp.name)} (${mvp.correct || 0}개)` : '-'}</span></div>`;
    }).join('')}</div>`;
  } else {
    $('#podium').innerHTML = steps.map((i) => ranked[i] ? `
      <div class="pd pd${i + 1}">
        ${charBadge({ color: PLAYER_COLORS[ranked[i].color] }, i === 0 ? 130 : 100)}
        <div class="pd-name">${escapeHtml(ranked[i].name)}</div>
        <div class="pd-block">${i + 1}</div>
      </div>` : '').join('');
    $('#teamResult').innerHTML = '';
  }
  $('#thTeam').hidden = s.mode !== 'team';
  // 기록이 똑같으면 같은 등수
  const sig = (p) => `${p.finishedRank || ''}|${p.position || 0}|${p.correct || 0}|${accuracy(p)}`;
  const shown = [];
  ranked.forEach((p, i) => { shown[i] = i && sig(p) === sig(ranked[i - 1]) ? shown[i - 1] : i + 1; });
  $('#resultBody').innerHTML = ranked.map((p, i) => `<tr>
    <td>${shown[i]}</td><td>${escapeHtml(p.name)}</td>
    ${s.mode === 'team' ? `<td>${escapeHtml(tm(p)?.name || '-')}</td>` : ''}
    <td>${p.finishedRank ? `🏁 ${p.finishedRank}번째 도착` : `${p.position || 0}칸`}</td>
    <td>${p.correct || 0}</td><td>${Math.round(accuracy(p) * 100)}%</td></tr>`).join('');
}

let toastTimer = null;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// 테스트·디버그용
window.__host = { get room() { return room; }, get code() { return code; } };
