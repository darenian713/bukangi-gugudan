// TV 부산 지도 경로 (화면 좌표: 가로 1600 × 세로 900)
// 명소 이름·순서·아이콘·그림은 혼자 하기와 똑같이 js/config.js 의 places → ending 을 씁니다.
// 명소 수가 바뀌어도 자동으로 지그재그로 배치합니다. 첫 명소 = 출발점, 마지막 = 바다(도착).
import { PLACES, ENDING } from './game-config.js';

const W = 1600, H = 900;

function layout() {
  const n = PLACES.length + 1;           // 명소들 + 바다
  const left = 150, right = 1470;
  const step = n > 1 ? (right - left) / (n - 1) : 0;
  const pts = PLACES.map((p, i) => {
    const high = i % 2 === 1;            // 홀수 번째는 위쪽, 짝수 번째는 아래쪽
    return {
      name: p.name, short: p.short || p.name, icon: p.icon || '📍', scene: p.scene, photo: p.photo || '',
      x: left + step * i, y: high ? 360 : 600,
      card: high ? 'above' : 'below',
    };
  });
  pts.push({ name: ENDING.name || '바다', short: ENDING.short || '바다', icon: ENDING.icon || '🌊', x: right, y: 800, card: 'none', end: true });
  return pts;
}

export const MAP = { width: W, height: H, waypoints: layout() };
