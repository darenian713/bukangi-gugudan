/* 최고 기록·소리 설정 저장 (이 기기 브라우저의 localStorage) */
const Records = (() => {
  const PREFIX = ((window.GAME_CONFIG && window.GAME_CONFIG.storageKey) || 'bukangi-gugudan') + ':';

  function get(key, fallback) {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* 저장 불가 환경 */ }
  }

  return {
    getBest(levelId) { return get('best:' + levelId, null); },
    /** 점수가 더 높으면 저장. { isNew, isFirst, prev } 반환 */
    saveBest(levelId, record) {
      const prev = this.getBest(levelId);
      if (!prev || record.score > prev.score) {
        set('best:' + levelId, record);
        return { isNew: true, isFirst: !prev, prev };
      }
      return { isNew: false, isFirst: false, prev };
    },
    getSoundOn() { return get('sound', true); },
    setSoundOn(on) { set('sound', !!on); },
    getMusicOn() { return get('music', true); },
    setMusicOn(on) { set('music', !!on); },
  };
})();
