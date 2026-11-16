// Firebase 초기화 + 익명 로그인 + 서버 시간
// 연결 값은 ../js/firebase-config.js(window.FIREBASE_CONFIG)에서 읽습니다.
const firebaseConfig = window.FIREBASE_CONFIG || {};
import {
  initializeApp, initializeAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator,
  browserSessionPersistence, browserLocalPersistence, indexedDBLocalPersistence,
  getDatabase, connectDatabaseEmulator, ref, onValue,
} from './fb-sdk.js';

// 주소에 ?emu=1 을 붙이면 내 컴퓨터의 Firebase 에뮬레이터로 접속합니다(테스트용).
const params = new URLSearchParams(location.search);
export const USING_EMULATOR = params.get('emu') === '1';

const config = USING_EMULATOR
  ? { apiKey: 'demo-key', projectId: 'demo-bukangi', databaseURL: 'https://demo-bukangi.firebaseio.com', appId: 'demo' }
  : firebaseConfig;

export function isConfigured() {
  return USING_EMULATOR || (!!firebaseConfig.apiKey && !/여기에|내프로젝트/.test(JSON.stringify(firebaseConfig)));
}

let app, auth, db;

/**
 * role: 'host' → 브라우저를 닫아도 로그인 유지(TV를 새로고침해도 같은 방의 심판으로 복귀)
 *       'student' → 탭마다 따로 로그인(한 PC에서 학생 탭 여러 개로 테스트 가능)
 */
export function initFirebase(role) {
  if (app) return { app, auth, db };
  app = initializeApp(config);
  auth = initializeAuth(app, {
    persistence: role === 'host'
      ? [indexedDBLocalPersistence, browserLocalPersistence]
      : [browserSessionPersistence],
  });
  db = getDatabase(app);
  if (USING_EMULATOR) {
    const host = params.get('emuHost') || location.hostname || '127.0.0.1';
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, host, 9000);
  }
  onValue(ref(db, '.info/serverTimeOffset'), (s) => { serverOffset = s.val() || 0; });
  return { app, auth, db };
}

let serverOffset = 0;
/** 서버 기준 현재 시각(ms) */
export function serverNow() { return Date.now() + serverOffset; }

/** 익명 로그인(이미 로그인돼 있으면 그대로) → uid */
export function ensureAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      try {
        if (user) return resolve(user.uid);
        const cred = await signInAnonymously(auth);
        resolve(cred.user.uid);
      } catch (e) { reject(e); }
    }, reject);
  });
}

export function getDb() { return db; }
