/* 한 판 전체 타이머 (장소 이동 연출 중에는 pause) */
const GameTimer = (() => {
  let total = 0;
  let left = 0;
  let running = false;
  let lastTs = 0;
  let raf = 0;
  let onTick = () => {};
  let onEnd = () => {};

  function step(ts) {
    if (!running) return;
    // 탭이 숨겨졌다 돌아오면 한 번에 시간이 크게 빠지지 않도록 한 프레임 최대 0.25초
    const dt = Math.min(0.25, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    left = Math.max(0, left - dt);
    onTick(left, total);
    if (left <= 0) {
      running = false;
      onEnd();
      return;
    }
    raf = requestAnimationFrame(step);
  }

  return {
    start(seconds, tick, end) {
      cancelAnimationFrame(raf);
      total = seconds;
      left = seconds;
      onTick = tick || (() => {});
      onEnd = end || (() => {});
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(step);
    },
    pause() {
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running || left <= 0) return;
      running = true;
      lastTs = performance.now();
      raf = requestAnimationFrame(step);
    },
    stop() { this.pause(); },
    getLeft: () => left,
    isRunning: () => running,
  };
})();
