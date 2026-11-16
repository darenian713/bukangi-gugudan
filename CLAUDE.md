# 부캉이의 부산 여행 – 구구단 게임 개발 규칙 (학교용)

- 학교용 버전: 학습자 단계는 초등 저학년·중학년·고학년 3단계만 둔다.

- 기획서: `PLAN.md` (게임 흐름·단계·점수 규칙의 기준 문서)
- **한국어 UI**: 화면에 보이는 모든 문구는 한국어로 쓴다.
- **프레임워크 없음**: 순수 HTML·CSS·JavaScript(ES6). 빌드 도구·npm 패키지 없이 `index.html`만 열어도 동작해야 한다.
  - `<script type="module">`을 쓰지 않는다(파일로 직접 열 때 막힘). 일반 `<script>` 태그 순서로 불러온다.
- **설정값은 `js/config.js`에만**: 학교 이름, 학습자 단계(범위·시간·정답 개수), 장소, 점수, 연출 시간 같은 숫자·문구는 모두 `config.js`에 두고 다른 파일에 하드코딩하지 않는다.
- 서버·DB 없음. 저장은 최고 기록·소리 설정만 `localStorage`에(`js/storage.js`).
- 터치 입력은 `pointerdown`, 키보드(숫자·Backspace·Enter)도 같은 동작.
- 버튼에 `aria-label`, 정답·오답은 색만이 아니라 아이콘·문구로도 구분한다.
- 인터넷 사진은 쓰지 않는다. 배경은 `js/scenes.js`의 SVG 그림, 교사가 넣은 사진(`assets/stages/`)만 사용한다.

## 실시간 대결 모드(`battle/`) — 위 규칙의 예외와 추가 규칙

- 기획서: `PLAN-battle.md`. 교실 TV(`battle/host.html`) + 학생 태블릿(`battle/join.html`) + Firebase Realtime Database.
- **예외 1 — 서버·DB**: `battle/`만 Firebase(Realtime Database + 익명 로그인)를 쓴다. 혼자 하기(`index.html`, `js/`)는 계속 서버·DB 없이 동작해야 한다.
- **예외 2 — `<script type="module">`**: Firebase SDK(v10 모듈) 때문에 `battle/js/*.js`만 모듈을 쓴다. 대결은 인터넷 주소에서만 동작하므로 파일로 여는 제약과 상관없다. `file://`로 열면 `battle/js/file-guard.js`(일반 script)가 안내를 띄운다. 혼자 하기 파일에는 모듈을 쓰지 않는다.
- **설정값은 여전히 `js/config.js`**: 대결 설정은 `GAME_CONFIG.battle`에, 학교 이름·명소·캐릭터는 혼자 하기와 같은 값을 그대로 읽는다(`battle/js/game-config.js`는 읽기만 하는 어댑터). Firebase 연결 값만 `js/firebase-config.js`에 둔다.
- **그림 재사용**: 부캉이·명소 그림은 `js/scenes.js`(`Scenes.character(colors)`, `Scenes.render(scene)`)와 `assets/`를 쓴다. `Scenes.character()`를 인자 없이 부르면 원래 그림과 똑같아야 한다.
- **TV가 심판**: 판정·이동·순위는 TV 브라우저가 한다. 학생은 `answers/{key}`만 쓴다. 보안 규칙은 `battle/database.rules.json`(24시간 정리 기준 86400000은 `game-config.js`의 `ROOM_TTL_MS`와 맞춘다).
- 개발·테스트 도구는 `dev/`에만 둔다(npm 사용 가능, 배포에는 필요 없음).
