// Firebase JS SDK(v10, 모듈 방식)를 한 곳에서만 불러옵니다.
// 버전을 바꾸려면 아래 주소 3개의 숫자만 바꾸면 됩니다.
export { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
export {
  initializeAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator,
  browserSessionPersistence, browserLocalPersistence, indexedDBLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
export {
  getDatabase, connectDatabaseEmulator, ref, child, get, set, update, remove, onValue, off,
  onDisconnect, serverTimestamp, query, orderByValue, endAt,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
