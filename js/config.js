/* =========================================================
 *  게임 설정 파일 (선생님이 수정하는 곳)
 *  - 숫자와 글자만 바꾸면 됩니다. 따옴표(' ')와 쉼표(,)는 지워지지 않게 주의하세요.
 *  - 바꾼 뒤 브라우저를 새로고침하면 바로 적용됩니다.
 * ========================================================= */
window.GAME_CONFIG = {
  /* ── 학교·프로그램 표시 ───────────────────────────── */
  schoolName: '금곡초등학교',
  programName: 'GRIP',
  gameTitle: '부캉이의 부산 여행',
  characterName: '부캉이',
  // 캐릭터 이미지(배경 투명 PNG). 파일이 없으면 그림으로 그린 임시 부캉이가 나옵니다.
  characterImage: 'assets/bukangi.png',
  // 기록 저장 이름(부산교육 한마당용과 기록이 섞이지 않게 따로 저장)
  storageKey: 'bukangi-gugudan-school',

  /* ── 학습자 3단계(학교용: 초등 저·중·고학년) ────────────────────────────────────
   *  minDan~maxDan : 출제할 단 범위 (예: 2~9단)
   *  minMul~maxMul : 곱하는 수 범위 (× 1은 저학년만)
   *  perPlace      : 한 장소에서 맞혀야 하는 정답 수
   *  time          : 한 판 전체 시간(초)
   *  rangeLabel    : (선택) 카드에 보이는 범위 문구
   */
  levels: [
    { id: 'lv1', name: '초등 저학년', icon: '🐣', minDan: 2,  maxDan: 9,  minMul: 1, maxMul: 9, perPlace: 3, time: 75 },
    { id: 'lv2', name: '초등 중학년', icon: '🐥', minDan: 2,  maxDan: 9,  minMul: 2, maxMul: 9, perPlace: 4, time: 60 },
    { id: 'lv3', name: '초등 고학년', icon: '🦉', minDan: 2,  maxDan: 15, minMul: 2, maxMul: 9, perPlace: 4, time: 60 },
  ],

  /* ── 명소 5곳(순서대로 이동) ──────────────────────────
   *  name  : 전체 이름        short : 지도·문구에 쓰는 짧은 이름
   *  icon  : 지도 아이콘       scene : 그림 종류(gamcheon, jagalchi, tower, gwangan, haeundae)
   *  photo : (선택) 선생님이 찍은 사진 경로. 파일이 있으면 그림 대신 사진이 배경이 됩니다.
   */
  places: [
    { name: '감천문화마을',      short: '감천마을', icon: '🏘️', scene: 'gamcheon', photo: 'assets/stages/stage1.jpg' },
    { name: '자갈치시장',        short: '자갈치',   icon: '🐟', scene: 'jagalchi', photo: 'assets/stages/stage2.jpg' },
    { name: '용두산공원·부산타워', short: '부산타워', icon: '🗼', scene: 'tower',    photo: 'assets/stages/stage3.jpg' },
    { name: '광안리·광안대교',    short: '광안대교', icon: '🌉', scene: 'gwangan',  photo: 'assets/stages/stage4.jpg' },
    { name: '해운대 해수욕장',    short: '해운대',   icon: '🏖️', scene: 'haeundae', photo: 'assets/stages/stage5.jpg' },
  ],
  ending: { name: '바다', short: '바다', icon: '🌊' },

  /* ── 점수 ─────────────────────────────────────────── */
  scoring: {
    correct: 10,          // 정답 1개
    comboEvery: 5,        // 연속 정답 몇 개마다
    comboBonus: 5,        //   → 보너스 점수
    timeBonusPerSec: 3,   // 엔딩 도착 시 남은 1초당
    endingBonus: 100,     // 5곳 모두 통과
  },

  /* ── 별 등급(통과한 명소 수 기준, 큰 것부터) ─────────── */
  stars: [
    { places: 5, stars: 3 },
    { places: 3, stars: 2 },
    { places: 1, stars: 1 },
  ],

  /* ── 연출 시간(밀리초: 1000 = 1초) ─────────────────── */
  timing: {
    countdownFrom: 3,        // 3·2·1 카운트다운
    correctDelayMs: 200,     // 정답 표시 후 다음 문제까지
    wrongRevealMs: 700,      // 오답일 때 정답 보여 주는 시간
    moveDurationMs: 900,     // 장소 이동 연출(이 동안 타이머 멈춤)
    endingDurationMs: 5800,  // 엔딩 애니메이션 길이
    warnSeconds: 10,         // 남은 시간 이하부터 주황색 + 째깍 소리
    dangerSeconds: 5,        // 남은 시간 이하부터 빨간색
  },

  /* ── 배경음악·파도 소리 ─────────────────────────── */
  music: {
    volume: 0.32,          // 배경음악 크기(0~1, 효과음보다 작게)
    fastTempo: 1.15,       // 남은 시간이 warnSeconds 이하일 때 빨라지는 정도
    oceanSeconds: 8,       // 엔딩 파도 소리 길이(초)
  },

  maxDigits: 3,   // 입력 최대 자릿수(19×9=171)
  maxReview: 10,  // 결과 화면 '다시 볼 문제' 최대 개수

  /* ── 실시간 대결(battle 폴더) ─────────────────────────
   *  교실 TV + 학생 태블릿으로 함께 하는 모드. Firebase 연결 값은 js/firebase-config.js 에 넣습니다.
   *  지도 경로는 위 places(명소 5곳) → ending(바다) 순서를 그대로 씁니다.
   *  아래 defaults는 TV 대기 화면에서 시작 전에 바꿀 수도 있습니다.
   */
  battle: {
    defaults: {
      mode: 'solo',          // 'solo' 개인전 | 'team' 팀전
      teamCount: 2,          // 2 | 3 | 4
      dans: [2, 3, 4, 5, 6, 7, 8, 9],  // 처음에 체크돼 있는 단
      goal: 20,              // 도착까지 칸 수: 10 | 15 | 20 | 30
      wrongRule: 'back',     // 틀리면 'back' 한 칸 뒤로 | 'stay' 제자리
      restSec: 2,            // 틀린 뒤 쉬는 시간(초). 0이면 쉬지 않음
      timeLimitSec: 0,       // 제한 시간(초): 0 없음 | 180 | 300
      endRule: 'all',        // 'all' 모두 도착하면 다 같이 박수 엔딩 | 'top3' 3등까지 도착하면 끝 | 'first' 1등 도착하면 바로 끝
      lateJoin: true,        // 게임 중에 들어온 학생도 출발점에서 참여
    },
    danChoices: [2, 3, 4, 5, 6, 7, 8, 9],   // TV에서 고를 수 있는 단(19단까지 넣을 수 있음)
    minMul: 1, maxMul: 9,                   // 곱하는 수 범위
    goalChoices: [10, 15, 20, 30],
    timeChoices: [0, 180, 300],
    // 팀 이름·색·대표 그림. 2팀이면 앞의 2개를 씁니다.
    // image를 비우면 팀 색 부캉이가 대표로 나옵니다. (예: image: 'assets/ondal.png')
    teams: [
      { id: 't1', name: '부캉이팀', color: '#1E88E5', image: '' },
      { id: 't2', name: '온달이팀', color: '#FB8C00', image: '' },
      { id: 't3', name: '동백팀',   color: '#E53935', image: '' },
      { id: 't4', name: '갈매기팀', color: '#43A047', image: '' },
    ],
    // 학생 부캉이 몸 색(입장 순서대로)
    playerColors: [
      '#4FA8EC', '#F06292', '#FFB300', '#66BB6A', '#AB47BC', '#FF7043', '#26C6DA', '#8D6E63',
      '#5C6BC0', '#EC407A', '#C0CA33', '#29B6F6', '#7E57C2', '#FFA726', '#26A69A', '#EF5350',
      '#9CCC65', '#42A5F5', '#D4E157', '#BA68C8', '#FF8A65', '#4DB6AC', '#A1887F', '#78909C',
    ],
    nameMax: 6,          // 별명 최대 글자 수
    pinFailLimit: 5,     // 비밀번호 연속 실패 허용 횟수
    pinLockSec: 30,      //   → 넘으면 기다리는 시간(초)
  },
};
