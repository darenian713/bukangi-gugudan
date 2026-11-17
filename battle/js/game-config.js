// 실시간 대결 설정 — 모든 값은 ../js/config.js(window.GAME_CONFIG)에서 읽습니다.
// 이 파일에는 선생님이 바꿀 값을 두지 않습니다. config.js의 battle 부분을 고치세요.
const C = globalThis.GAME_CONFIG || {};
const B = C.battle || {};

/** 게임 폴더(루트) 기준 경로 → battle 폴더에서 쓸 수 있는 주소 */
const ROOT = new URL('../', globalThis.location?.href || 'http://localhost/battle/');
export const fromRoot = (p) => (p ? new URL(p, ROOT).href : '');

export const SCHOOL_MARK = `${C.schoolName || '금곡초등학교'} · ${C.programName || 'GRIP'}`;
export const GAME_TITLE = C.gameTitle || '부캉이의 부산 여행';
export const CHARACTER_NAME = C.characterName || '부캉이';
export const CHARACTER_IMAGE = fromRoot(C.characterImage || '');
export const SOLO_URL = '../';

export const GAME_DEFAULTS = {
  mode: 'solo', teamCount: 2, dans: [2, 3, 4, 5, 6, 7, 8, 9], goal: 20, wrongRule: 'back',
  restSec: 2, timeLimitSec: 0, endRule: 'all', lateJoin: true,
  ...(B.defaults || {}),
  minMul: B.minMul ?? 1,
  maxMul: B.maxMul ?? 9,
};
export const DAN_CHOICES = B.danChoices || [2, 3, 4, 5, 6, 7, 8, 9];
export const GOAL_OPTIONS = B.goalChoices || [10, 15, 20, 30];
export const TIME_OPTIONS = B.timeChoices || [0, 180, 300];
export const MAX_DIGITS = C.maxDigits || 3;

export const TEAM_PRESETS = (B.teams && B.teams.length >= 2 ? B.teams : [
  { id: 't1', name: '부캉이팀', color: '#1E88E5' },
  { id: 't2', name: '온달이팀', color: '#FB8C00' },
  { id: 't3', name: '동백팀', color: '#E53935' },
  { id: 't4', name: '갈매기팀', color: '#43A047' },
]).slice(0, 4).map((t, i) => ({ id: t.id || `t${i + 1}`, name: t.name, color: t.color, image: fromRoot(t.image || '') || null }));

export const PLAYER_COLORS = B.playerColors && B.playerColors.length ? B.playerColors : ['#4FA8EC', '#F06292', '#FFB300', '#66BB6A'];

/** 지도 경로: 명소 5곳 → 바다 (혼자 하기와 같은 순서·이름·그림) */
export const PLACES = (C.places || []).map((p) => ({ ...p, photo: fromRoot(p.photo || '') }));
export const ENDING = C.ending || { name: '바다', short: '바다', icon: '🌊' };

const M = B.music || {};
export const MUSIC = {
  volume: typeof M.volume === 'number' ? M.volume : 0.35,
  endingBoost: typeof M.endingBoost === 'number' ? M.endingBoost : 1.5,
  tracks: Object.fromEntries(['lobby', 'play', 'cheer', 'ending'].map((k) => [k, fromRoot(M[k] || '')])),
};

export const NAME_MAX = B.nameMax || 6;
export const PIN_FAIL_LIMIT = B.pinFailLimit || 5;
export const PIN_LOCK_SEC = B.pinLockSec || 30;
// 보안 규칙(database.rules.json)의 86400000(24시간)과 맞춰야 하므로 config에 두지 않음
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
