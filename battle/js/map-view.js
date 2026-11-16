// TV 부산 지도 + 부캉이 이동 표시 (SVG)
import { MAP } from './map-data.js';
import { charSvg, escapeHtml } from './common.js';

const NS = 'http://www.w3.org/2000/svg';

/** Catmull-Rom 곡선으로 명소를 부드럽게 잇고, 촘촘한 점 목록으로 만든다 */
function sampleRoute(pts, perSeg = 40) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), wp: k === 0 ? i : -1 });
    }
  }
  const last = pts[pts.length - 1];
  out.push({ x: last.x, y: last.y, wp: pts.length - 1 });
  let L = 0;
  out.forEach((p, i) => { if (i) L += Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y); p.len = L; });
  return { pts: out, total: L };
}

const BG = `
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FC3F7"/><stop offset="1" stop-color="#1565C0"/></linearGradient>
    <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C5E1A5"/><stop offset=".75" stop-color="#E6EE9C"/><stop offset="1" stop-color="#FFE0B2"/></linearGradient>
    <pattern id="waves" width="80" height="40" patternUnits="userSpaceOnUse">
      <path d="M0 20 q10 -8 20 0 t20 0 t20 0 t20 0" stroke="rgba(255,255,255,.35)" stroke-width="3" fill="none"/>
    </pattern>
  </defs>
  <rect width="1600" height="900" fill="url(#sea)"/>
  <rect width="1600" height="900" fill="url(#waves)"/>
  <path d="M0 0 H1600 V520 C1520 560 1470 640 1400 690 C1320 740 1200 740 1100 745 C900 755 700 735 500 750
           C300 765 150 740 0 760 Z" fill="url(#land)" stroke="#FFF8E1" stroke-width="12"/>
  <ellipse cx="640" cy="850" rx="95" ry="34" fill="url(#land)" stroke="#FFF8E1" stroke-width="8"/>
  <text x="640" y="859" font-size="22" text-anchor="middle" fill="#5D4037" font-weight="700" opacity=".7">영도</text>
  <g fill="#AED581" stroke="#9CCC65" stroke-width="3" opacity=".8">
    <path d="M560 300 l50 -85 l50 85 Z"/><path d="M620 310 l40 -66 l40 66 Z"/>
    <path d="M1080 300 l45 -78 l45 78 Z"/><path d="M250 330 l38 -64 l38 64 Z"/>
  </g>`;

export class BusanMap {
  constructor(svg) {
    this.svg = svg;
    svg.setAttribute('viewBox', `0 0 ${MAP.width} ${MAP.height}`);
    svg.innerHTML = '';
    const bg = document.createElementNS(NS, 'g');
    bg.innerHTML = BG;
    svg.appendChild(bg);
    this.routeLayer = this.layer('route');
    this.landmarkLayer = this.layer('landmarks');
    this.teamLayer = this.layer('teams');
    this.tokenLayer = this.layer('tokens');
    this.route = sampleRoute(MAP.waypoints);
    this.tokens = new Map();
    this.teamTokens = new Map();
    this.goal = 0;
    this.photoOk = new Set();
  }

  /** 선생님이 넣은 장소 사진 중 실제로 있는 것(주소 목록) → 지도 그림 카드를 사진으로 */
  setPhotos(okSet) { this.photoOk = okSet; const g = this.goal; this.goal = 0; if (g) this.setGoal(g); }

  layer(cls) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', cls);
    this.svg.appendChild(g);
    return g;
  }

  /** 경로 위 비율(0~1)의 좌표 */
  pointAtFraction(f) {
    const { pts, total } = this.route;
    const target = Math.max(0, Math.min(1, f)) * total;
    let lo = 0, hi = pts.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid].len < target) lo = mid + 1; else hi = mid; }
    const b = pts[lo], a = pts[Math.max(0, lo - 1)];
    const seg = b.len - a.len || 1, t = (target - a.len) / seg;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** 칸 번호(소수 가능) → 좌표 */
  cellPoint(pos) { return this.pointAtFraction(this.goal ? pos / this.goal : 0); }

  /** 칸 수가 바뀌면 경로·칸·명소를 다시 그림 */
  setGoal(goal) {
    if (goal === this.goal) return;
    this.goal = goal;
    const { pts, total } = this.route;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    let html = `<path d="${d}" stroke="#fff" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
                <path d="${d}" stroke="#1E88E5" stroke-width="6" fill="none" stroke-dasharray="2 16" stroke-linecap="round"/>`;
    for (let c = 0; c <= goal; c++) {
      const p = this.cellPoint(c);
      const major = c === 0 || c === goal || c % 5 === 0;
      html += `<circle cx="${p.x}" cy="${p.y}" r="${major ? 13 : 8}" fill="${major ? '#1E88E5' : '#fff'}" stroke="#1565C0" stroke-width="3"/>`;
      if (major && c !== 0 && c !== goal) html += `<text x="${p.x}" y="${p.y + 6}" font-size="15" font-weight="800" fill="#fff" text-anchor="middle">${c}</text>`;
    }
    this.routeLayer.innerHTML = html;

    // 명소 → 가장 가까운 칸, 명소마다 혼자 하기와 같은 장소 그림(또는 선생님 사진) 카드
    this.landmarkAtCell = new Map();
    let lm = '';
    const CW = 240, CH = 132;
    const wpLens = pts.filter((p) => p.wp >= 0).map((p) => ({ i: p.wp, len: p.len }));
    for (const { i, len } of wpLens) {
      const w = MAP.waypoints[i];
      const cell = Math.round((len / total) * goal);
      if (i > 0 && !this.landmarkAtCell.has(cell)) this.landmarkAtCell.set(cell, w.name);
      if (w.end) {
        lm += `<g transform="translate(${w.x} ${w.y})"><text y="-34" font-size="64" text-anchor="middle">${w.icon}</text>
          <text y="70" font-size="34" font-weight="900" text-anchor="middle" class="map-label sea">${escapeHtml(w.name)} 도착!</text></g>`;
        continue;
      }
      const cy = w.card === 'above' ? w.y - 70 - CH : w.y + 62;
      const cx = Math.max(10, Math.min(MAP.width - CW - 10, w.x - CW / 2));
      const pic = w.photo && this.photoOk.has(w.photo)
        ? `<image href="${escapeHtml(w.photo)}" x="${cx}" y="${cy}" width="${CW}" height="${CH}" preserveAspectRatio="xMidYMid slice"/>`
        : (typeof Scenes !== 'undefined' ? Scenes.render(w.scene) : '').replace('<svg ', `<svg x="${cx}" y="${cy}" width="${CW}" height="${CH}" `);
      lm += `<g class="lm-card">
        <clipPath id="clip${i}"><rect x="${cx}" y="${cy}" width="${CW}" height="${CH}" rx="16"/></clipPath>
        <rect x="${cx - 5}" y="${cy - 5}" width="${CW + 10}" height="${CH + 10}" rx="20" fill="#fff" filter="drop-shadow(0 4px 6px rgba(13,71,161,.25))"/>
        <g clip-path="url(#clip${i})">${pic}</g>
        <rect x="${cx}" y="${cy + CH - 38}" width="${CW}" height="38" fill="rgba(255,255,255,.88)" clip-path="url(#clip${i})"/>
        <text x="${cx + CW / 2}" y="${cy + CH - 11}" font-size="24" font-weight="900" text-anchor="middle" fill="#12324A">${w.icon} ${escapeHtml(w.short)}</text>
        <line x1="${w.x}" y1="${w.card === 'above' ? cy + CH + 5 : cy - 5}" x2="${w.x}" y2="${w.y + (w.card === 'above' ? -16 : 16)}" stroke="#fff" stroke-width="5" stroke-dasharray="2 8" stroke-linecap="round"/>
      </g>`;
      if (i === 0) lm += `<text x="${w.x}" y="${w.y + 48}" font-size="24" font-weight="900" text-anchor="middle" class="map-label">출발</text>`;
    }
    this.landmarkLayer.innerHTML = lm;
  }

  /**
   * 학생 부캉이 표시.
   * players: { key: {name, color(hex), scarf, position, online, finishedRank} }
   * 같은 칸에 여럿이면 부채꼴(많으면 겹 원)로 펼침.
   */
  renderPlayers(players) {
    const groups = new Map();
    for (const [key, p] of Object.entries(players)) {
      const c = Math.round(p.position || 0);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(key);
    }
    const seen = new Set();
    for (const [cell, keys] of groups) {
      keys.sort();
      const base = this.cellPoint(cell);
      const offs = keys.map((_, idx) => fanOffset(idx, keys.length));
      // 무리가 지도 밖으로 나가지 않게 중심을 안쪽으로
      const minX = Math.min(...offs.map((o) => o.x)), maxX = Math.max(...offs.map((o) => o.x));
      const minY = Math.min(...offs.map((o) => o.y)), maxY = Math.max(...offs.map((o) => o.y));
      const cx = Math.max(40 - minX, Math.min(MAP.width - 40 - maxX, base.x));
      const cy = Math.max(70 - minY, Math.min(MAP.height - 60 - maxY, base.y));
      keys.forEach((key, idx) => {
        this.placeToken(key, players[key], cx + offs[idx].x, cy + offs[idx].y, offs[idx].labelBelow);
        seen.add(key);
      });
    }
    for (const [key, el] of this.tokens) if (!seen.has(key)) { el.remove(); this.tokens.delete(key); }
  }

  placeToken(key, p, x, y, labelBelow = false) {
    let el = this.tokens.get(key);
    const sig = `${p.color}|${p.scarf}|${p.name}|${labelBelow}`;
    if (!el) {
      el = document.createElementNS(NS, 'g');
      el.setAttribute('class', 'token');
      el.innerHTML = '<g class="tk-inner"></g>';
      el.style.transform = `translate(${x}px, ${y}px)`;
      this.tokenLayer.appendChild(el);
      this.tokens.set(key, el);
    }
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.firstChild.innerHTML = charSvg({ color: p.color, scarf: p.scarf, size: 46 }) +
        `<text y="${labelBelow ? 46 : -36}" font-size="${labelBelow ? 19 : 20}" font-weight="900" text-anchor="middle" class="token-name">${escapeHtml(p.name)}</text>`;
    }
    el.classList.toggle('offline', p.online === false);
    el.classList.toggle('finished', !!p.finishedRank);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    // 위에 그려지도록(앞서간 학생이 맨 위)
    el.dataset.pos = p.position || 0;
  }

  /** 움직임 효과: dir > 0 깡충, dir < 0 살짝 튕겨 나감 */
  pulse(key, dir) {
    const el = this.tokens.get(key);
    if (!el) return;
    const inner = el.firstChild;
    const cls = dir > 0 ? 'hop' : 'bump';
    inner.classList.remove('hop', 'bump');
    void inner.getBBox?.();
    requestAnimationFrame(() => inner.classList.add(cls));
    setTimeout(() => inner.classList.remove(cls), 700);
  }

  /** 팀 대표 캐릭터(평균 위치, 칸 사이도 표시) */
  renderTeams(teams) {
    const ids = Object.keys(teams);
    ids.forEach((id, i) => {
      const t = teams[id];
      const p = this.cellPoint(t.avgPosition || 0);
      const tx = Math.max(80, Math.min(MAP.width - 80, p.x + (i - (ids.length - 1) / 2) * 155));
      // 명소 카드가 위에 있는 곳(높은 지점)에서는 아래로, 아니면 위로
      const ty = Math.max(130, Math.min(MAP.height - 70, p.y < 480 ? p.y + 120 : p.y - 120));
      const dx = tx - p.x, dy = ty - p.y;
      let el = this.teamTokens.get(id);
      if (!el) {
        el = document.createElementNS(NS, 'g');
        el.setAttribute('class', 'team-token');
        this.teamLayer.appendChild(el);
        this.teamTokens.set(id, el);
      }
      const art = t.image
        ? `<image href="${escapeHtml(t.image)}" x="-50" y="-60" width="100" height="110"/>`
        : charSvg({ color: t.color, scarf: '#fff', size: 92 });
      el.innerHTML = `
        <line x1="0" y1="40" x2="${-dx}" y2="${-dy}" stroke="${t.color}" stroke-width="4" stroke-dasharray="6 6"/>
        <circle cx="${-dx}" cy="${-dy}" r="10" fill="${t.color}" stroke="#fff" stroke-width="3"/>
        ${art}
        <rect x="-70" y="-100" width="140" height="36" rx="18" fill="${t.color}" stroke="#fff" stroke-width="3"/>
        <text y="-74" font-size="22" font-weight="900" fill="#fff" text-anchor="middle">${escapeHtml(t.name)}</text>`;
      el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    });
    for (const [id, el] of this.teamTokens) if (!(id in teams)) { el.remove(); this.teamTokens.delete(id); }
  }
}

/**
 * idx번째(총 n명) 부캉이의 펼침 위치.
 *  - 2~6명: 부채꼴, 이름은 위/아래 번갈아(이웃과 안 겹치게)
 *  - 7명 이상: 바둑판처럼 줄 맞춰 놓고 이름은 아래
 */
function fanOffset(idx, n) {
  if (n === 1) return { x: 0, y: 0, labelBelow: false };
  if (n <= 6) {
    const x = (idx - (n - 1) / 2) * 56;
    return { x, y: Math.abs(x) * 0.35 - 6, labelBelow: idx % 2 === 1 };
  }
  const cols = Math.ceil(Math.sqrt(n * 1.8));
  const rows = Math.ceil(n / cols);
  const r = Math.floor(idx / cols), c = idx % cols;
  const inRow = r === rows - 1 ? n - r * cols : cols;
  return { x: (c - (inRow - 1) / 2) * 76, y: (r - (rows - 1) / 2) * 92, labelBelow: true };
}
