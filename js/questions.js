/* 문제 풀 만들기, 섞기, 정답 판정 */
const Questions = (() => {
  /** 단계 범위의 모든 '단 × 수' 조합 */
  function buildPool(level) {
    const pool = [];
    for (let a = level.minDan; a <= level.maxDan; a++) {
      for (let b = level.minMul; b <= level.maxMul; b++) {
        pool.push({ a, b, answer: a * b });
      }
    }
    return pool;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const same = (p, q) => p && q && p.a === q.a && p.b === q.b;

  /** 섞은 주머니에서 하나씩 꺼내고, 다 쓰면 다시 섞음. 직전 문제와 같으면 다시 뽑음 */
  function createGenerator(level) {
    const base = buildPool(level);
    let bag = [];
    let last = null;
    const refill = () => { bag = shuffle(base.slice()); };

    return {
      size: base.length,
      next() {
        if (!bag.length) refill();
        let q = bag.pop();
        if (same(q, last) && base.length > 1) {
          if (!bag.length) refill();
          const other = bag.pop();
          bag.unshift(q); // 나중에 다시 나오도록 맨 아래로
          q = other;
        }
        last = q;
        return { ...q };
      },
    };
  }

  function check(q, value) {
    return Number(value) === q.answer;
  }

  return { buildPool, shuffle, createGenerator, check };
})();
