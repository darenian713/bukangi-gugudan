// 심판(TV) 순수 로직 — Firebase와 무관하게 테스트할 수 있도록 분리했습니다.

/** 0 이상 n 미만 정수 */
function randInt(n, rng = Math.random) {
  return Math.floor(rng() * n);
}

/** 배열을 섞은 새 배열 (Fisher–Yates) */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 다음 문제 만들기. dans: 출제 단 목록(예: [6,7,8]), recent: 최근 문제 ["7x8", ...]
 * 최근 3문제는 피합니다(후보가 모자라면 바로 직전 문제만 피함).
 */
export function makeQuestion(dans, recent = [], rng = Math.random, minMul = 1, maxMul = 9) {
  const ds = dans && dans.length ? dans : [2, 3, 4, 5, 6, 7, 8, 9];
  const all = [];
  for (const a of ds) for (let b = minMul; b <= maxMul; b++) all.push([a, b]);
  const last3 = recent.slice(-3);
  let pool = all.filter(([a, b]) => !last3.includes(`${a}x${b}`));
  if (!pool.length) pool = all.filter(([a, b]) => recent.slice(-1)[0] !== `${a}x${b}`);
  if (!pool.length) pool = all;
  const [a, b] = pool[randInt(pool.length, rng)];
  return { a, b, tag: `${a}x${b}` };
}

/** 플레이어에게 새 문제를 낼 때 필요한 필드(patch) */
export function nextQuestionPatch(player, settings, rng = Math.random) {
  const qn = (player.qn || 0) + 1;
  const recent = (player.recent || []).slice(-3);
  const q = makeQuestion(settings.dans, recent, rng, settings.minMul ?? 1, settings.maxMul ?? 9);
  return {
    qn,
    recent: [...recent, q.tag].slice(-3),
    currentQ: { qid: `q${qn}`, a: q.a, b: q.b },
  };
}

/**
 * 답 판정. 반환: { ok, patch } — patch는 players/{key} 아래에 덮어쓸 필드.
 * now: 서버 기준 현재 시각(ms). finishedSoFar: 지금까지 도착한 학생 수.
 */
export function judge(player, answer, settings, now, finishedSoFar, rng = Math.random) {
  const q = player.currentQ;
  const ok = Number(answer.value) === q.a * q.b;
  const goal = settings.goal;
  let position = player.position || 0;
  const patch = {};
  if (ok) {
    position = Math.min(goal, position + 1);
    patch.correct = (player.correct || 0) + 1;
    patch.restUntil = 0;
  } else {
    if (settings.wrongRule === 'back') position = Math.max(0, position - 1);
    patch.wrong = (player.wrong || 0) + 1;
    patch.restUntil = settings.restSec > 0 ? now + settings.restSec * 1000 : 0;
  }
  patch.position = position;
  patch.lastResult = { qid: q.qid, ok, answer: q.a * q.b, value: Number(answer.value), moved: position - (player.position || 0) };
  if (position >= goal && !player.finishedRank) {
    patch.finishedRank = finishedSoFar + 1;
    patch.finishedAt = now;
    patch.currentQ = null;
  } else {
    Object.assign(patch, nextQuestionPatch(player, settings, rng));
  }
  return { ok, patch };
}

/** 랜덤 팀 배정: 인원 차이 1명 이내. 반환 { key: teamId } */
export function assignTeams(keys, teamIds, rng = Math.random) {
  const out = {};
  // 팀 순서도 섞어서 '남는 1명'이 늘 첫 팀으로 가지 않게 함
  const order = shuffle(teamIds, rng);
  shuffle(keys, rng).forEach((k, i) => { out[k] = order[i % order.length]; });
  return out;
}

/** 인원이 가장 적은 팀(동률이면 앞 팀) */
export function smallestTeam(players, teamIds) {
  const count = Object.fromEntries(teamIds.map((t) => [t, 0]));
  for (const p of Object.values(players || {})) if (p && p.team in count) count[p.team]++;
  let best = teamIds[0];
  for (const t of teamIds) if (count[t] < count[best]) best = t;
  return best;
}

/** 팀별 평균 위치(반올림하지 않음). 팀원이 없으면 0 */
export function teamAverages(players, teamIds) {
  const sum = {}, n = {};
  for (const t of teamIds) { sum[t] = 0; n[t] = 0; }
  for (const p of Object.values(players || {})) {
    if (!p || !(p.team in sum)) continue;
    sum[p.team] += p.position || 0;
    n[p.team]++;
  }
  const avg = {};
  for (const t of teamIds) avg[t] = n[t] ? sum[t] / n[t] : 0;
  return { avg, count: n };
}

export function accuracy(p) {
  const total = (p.correct || 0) + (p.wrong || 0);
  return total ? (p.correct || 0) / total : 0;
}

/** 개인 순위: 도착 순서 → 이동 칸 → 정답 수 → 정답률 → 이름 */
export function rankPlayers(players) {
  return Object.entries(players || {})
    .filter(([, p]) => p && p.name)
    .map(([key, p]) => ({ key, ...p }))
    .sort((x, y) => {
      const fx = x.finishedRank || Infinity, fy = y.finishedRank || Infinity;
      if (fx !== fy) return fx - fy;
      if ((y.position || 0) !== (x.position || 0)) return (y.position || 0) - (x.position || 0);
      if ((y.correct || 0) !== (x.correct || 0)) return (y.correct || 0) - (x.correct || 0);
      if (accuracy(y) !== accuracy(x)) return accuracy(y) - accuracy(x);
      return String(x.name).localeCompare(String(y.name), 'ko');
    });
}

/** 팀 순위: 도착 순서 → 평균 위치 → 팀 정답 합 */
export function rankTeams(teams, players, teamIds) {
  const { avg, count } = teamAverages(players, teamIds);
  const correct = Object.fromEntries(teamIds.map((t) => [t, 0]));
  for (const p of Object.values(players || {})) if (p && p.team in correct) correct[p.team] += p.correct || 0;
  return teamIds
    .map((id) => ({ id, ...(teams?.[id] || {}), avgPosition: avg[id], members: count[id], correctSum: correct[id] }))
    .sort((x, y) => {
      const fx = x.finishedRank || Infinity, fy = y.finishedRank || Infinity;
      if (fx !== fy) return fx - fy;
      if (y.avgPosition !== x.avgPosition) return y.avgPosition - x.avgPosition;
      return y.correctSum - x.correctSum;
    });
}

/** 팀 MVP: 가장 많이 맞힌 학생(동률이면 정답률) */
export function teamMvp(players, teamId) {
  let best = null;
  for (const [key, p] of Object.entries(players || {})) {
    if (!p || p.team !== teamId) continue;
    if (!best || (p.correct || 0) > (best.correct || 0) ||
        ((p.correct || 0) === (best.correct || 0) && accuracy(p) > accuracy(best))) best = { key, ...p };
  }
  return best;
}

/**
 * 게임이 끝났는지 판단.
 *  - 'all'(모두 도착): 접속해 있는 친구가 모두 바다에 도착하면 종료(개인전·팀전 같음).
 *     와이파이가 끊겨 회색인 친구는 기다리지 않음(한 명 때문에 끝나지 않는 일 방지)
 *  - 개인전: endRule 'first' → 1명 도착 / 'top3' → min(3, 인원)명 도착
 *  - 팀전:   'first' → 1팀 도착 / 'top3' → min(3, 팀수-1)팀 도착 (남은 팀 순위는 자동 결정)
 *  - 제한 시간이 지나면 종료
 */
export function isGameOver(room, now) {
  const s = room.settings || {};
  if (room.endsAt && now >= room.endsAt) return 'time';
  const players = Object.values(room.players || {}).filter((p) => p && p.name);
  if (!players.length) return null;
  if (s.endRule === 'all') {
    const { arrived, waiting } = arrivalStatus(room);
    return arrived > 0 && waiting.length === 0 ? 'all' : null;
  }
  if (s.mode === 'team') {
    const teamIds = Object.keys(room.teams || {});
    const done = teamIds.filter((t) => room.teams[t].finishedRank).length;
    const need = s.endRule === 'first' ? 1 : Math.max(1, Math.min(3, teamIds.length - 1));
    return done >= need ? 'arrived' : null;
  }
  const done = players.filter((p) => p.finishedRank).length;
  const need = s.endRule === 'first' ? 1 : Math.min(3, players.length);
  return done >= need ? 'arrived' : null;
}

/**
 * 모두 도착 진행 상황: arrived(도착한 수), active(기다리는 대상 = 접속 중이거나 이미 도착), waiting(아직 가는 중인 접속자 key 목록)
 * presence가 false(끊김)인 친구는 기다리지 않음
 */
export function arrivalStatus(room) {
  const presence = room.presence || {};
  let arrived = 0, active = 0;
  const waiting = [];
  for (const [k, p] of Object.entries(room.players || {})) {
    if (!p || !p.name) continue;
    if (p.finishedRank) { arrived++; active++; continue; }
    if (presence[k] === false) continue;
    active++;
    waiting.push(k);
  }
  return { arrived, active, waiting };
}
