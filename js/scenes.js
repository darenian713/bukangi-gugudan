/* 명소 배경·엔딩 배경·임시 부캉이(아기 상어)를 SVG로 그림 (인터넷 사진 사용 안 함) */
const Scenes = (() => {
  let uidN = 0;
  const uid = () => 'sc' + (++uidN);

  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function wrap(inner, defs = '') {
    return `<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>${defs}</defs>${inner}</svg>`;
  }
  function grad(id, stops) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  }
  function cloud(x, y, s = 1, fill = '#fff') {
    return `<g fill="${fill}" opacity=".92" transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="20" ry="9"/><ellipse cx="13" cy="-6" rx="13" ry="10"/><ellipse cx="-11" cy="-3" rx="10" ry="7"/></g>`;
  }
  function wavy(y, amp, len, color, width, opacity = 1) {
    let d = `M-10 ${y}`;
    for (let x = -10; x < 410; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
  }
  function gull(x, y, s = 1) {
    return `<path d="M${x} ${y} q${4 * s} ${-4 * s} ${8 * s} 0 q${4 * s} ${-4 * s} ${8 * s} 0" fill="none" stroke="#37474F" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  /* 1. 감천문화마을 */
  function gamcheon() {
    const id = uid(), r = rng(11);
    let s = `<rect width="400" height="220" fill="url(#${id})"/>`;
    s += cloud(70, 26, 1) + cloud(310, 20, 0.8) + cloud(215, 40, 0.6);
    s += `<rect y="66" width="400" height="26" fill="#4FC3F7"/>`;
    s += wavy(76, 1.5, 24, '#B3E5FC', 1.2, 0.8);
    s += `<path d="M0 220 V86 Q90 62 200 72 T400 80 V220Z" fill="#8BC34A"/>`;
    const colors = ['#FF8A80', '#FFD54F', '#81D4FA', '#CE93D8', '#A5D6A7', '#FFAB91', '#80CBC4', '#F48FB1', '#FFF59D', '#9FA8DA'];
    for (let row = 0; row < 7; row++) {
      const base = 90 + row * 20;
      for (let x = -12 + (row % 2) * 13; x < 412; x += 27) {
        if (x > 156 && x < 222) continue;
        const w = 20 + Math.floor(r() * 6), h = 14 + Math.floor(r() * 8);
        const c = colors[Math.floor(r() * colors.length)];
        const y = base - h;
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h + 10}" fill="${c}"/>`;
        s += `<rect x="${x - 1}" y="${y - 2}" width="${w + 2}" height="3" fill="#fff" opacity=".75"/>`;
        s += `<rect x="${x + 4}" y="${y + 4}" width="5" height="5" fill="#fff" opacity=".85"/>`;
        if (w > 22) s += `<rect x="${x + w - 9}" y="${y + 4}" width="5" height="5" fill="#fff" opacity=".85"/>`;
      }
    }
    for (let i = 0; i < 14; i++) {
      const y = 80 + i * 10, x = 186 - i * 1.4, w = 28 + i * 2.8;
      s += `<rect x="${x}" y="${y}" width="${w}" height="6" fill="#ECEFF1"/><rect x="${x}" y="${y + 6}" width="${w}" height="4" fill="#B0BEC5"/>`;
    }
    return wrap(s, grad(id, [[0, '#4FC3F7'], [1, '#E1F5FE']]));
  }

  /* 2. 자갈치시장 */
  function jagalchi() {
    const id = uid();
    let s = `<rect width="400" height="220" fill="url(#${id})"/>`;
    s += cloud(60, 22, 0.9) + cloud(180, 30, 0.7);
    s += `<rect y="58" width="400" height="56" fill="#29B6F6"/>` + wavy(80, 2, 26, '#E1F5FE', 1.4, 0.7) + wavy(96, 2, 30, '#E1F5FE', 1.4, 0.5);
    s += `<g transform="translate(40 70)"><path d="M0 8 H46 L40 18 H6Z" fill="#E53935"/><rect x="14" y="-4" width="16" height="12" fill="#fff"/><rect x="20" y="-12" width="3" height="8" fill="#455A64"/></g>`;
    s += gull(120, 40) + gull(140, 30, 0.8) + gull(100, 52, 0.7);
    s += `<rect x="205" y="72" width="190" height="42" fill="#B3E5FC" stroke="#90A4AE"/>`;
    for (let x = 212; x < 392; x += 14) s += `<rect x="${x}" y="80" width="8" height="26" fill="#81D4FA"/>`;
    s += `<path d="M196 78 Q232 36 268 72 Q304 36 340 72 Q372 44 404 70 V80 H196Z" fill="#fff" stroke="#B0BEC5" stroke-width="1.5"/>`;
    s += `<text x="300" y="100" font-size="13" text-anchor="middle" fill="#0D47A1" font-weight="bold" font-family="sans-serif">자갈치시장</text>`;
    s += `<rect y="112" width="400" height="108" fill="#B0BEC5"/><path d="M150 220 L185 112 H215 L250 220Z" fill="#CFD8DC"/>`;
    const awn = ['#E53935', '#1E88E5', '#FB8C00', '#43A047'];
    const fishC = ['#90A4AE', '#4FC3F7', '#FF8A65', '#B0BEC5'];
    [-6, 96, 236, 330].forEach((x, i) => {
      const c = awn[i];
      s += `<rect x="${x + 4}" y="134" width="4" height="46" fill="#5D4037"/><rect x="${x + 80}" y="134" width="4" height="46" fill="#5D4037"/>`;
      for (let j = 0; j < 8; j++) s += `<rect x="${x + j * 11}" y="118" width="11" height="18" fill="${j % 2 ? '#fff' : c}"/>`;
      for (let j = 0; j < 8; j++) s += `<circle cx="${x + 5.5 + j * 11}" cy="136" r="5.5" fill="${j % 2 ? '#fff' : c}"/>`;
      s += `<rect x="${x}" y="164" width="88" height="12" rx="2" fill="#8D6E63"/>`;
      for (let k = 0; k < 4; k++) {
        const fc = fishC[(i + k) % fishC.length];
        s += `<g transform="translate(${x + 14 + k * 20} 160)"><ellipse rx="9" ry="4" fill="${fc}"/><path d="M8 0 L14 -4 L14 4Z" fill="${fc}"/><circle cx="-5" cy="-1" r="1.2" fill="#263238"/></g>`;
      }
      s += `<ellipse cx="${x + 44}" cy="196" rx="20" ry="7" fill="#E53935"/><ellipse cx="${x + 44}" cy="194" rx="16" ry="4" fill="#4FC3F7"/>`;
    });
    return wrap(s, grad(id, [[0, '#64B5F6'], [1, '#E3F2FD']]));
  }

  /* 3. 용두산공원·부산타워 */
  function tower() {
    const id = uid(), r = rng(5);
    let s = `<rect width="400" height="220" fill="url(#${id})"/>`;
    s += cloud(80, 30, 1) + cloud(200, 18, 0.7);
    s += `<path d="M0 104 Q60 80 120 98 Q180 78 240 100 V110 H0Z" fill="#90A4AE"/>`;
    s += `<rect y="104" width="400" height="50" fill="#1E88E5"/>` + wavy(120, 1.5, 22, '#BBDEFB', 1, 0.7);
    s += `<g transform="translate(60 114)"><rect width="40" height="8" fill="#FF7043"/><rect x="8" y="-8" width="20" height="8" fill="#ECEFF1"/></g>`;
    s += `<g transform="translate(150 126)"><rect width="28" height="6" fill="#26A69A"/><rect x="6" y="-6" width="12" height="6" fill="#fff"/></g>`;
    for (let x = -4; x < 404; x += 16) {
      const h = 14 + Math.floor(r() * 26);
      s += `<rect x="${x}" y="${152 - h}" width="14" height="${h + 6}" fill="${['#ECEFF1', '#CFD8DC', '#FFE0B2', '#B0BEC5'][Math.floor(r() * 4)]}"/>`;
    }
    s += `<path d="M0 220 V170 Q120 140 260 150 Q340 156 400 170 V220Z" fill="#66BB6A"/>`;
    const trees = [[30, 170, '#43A047'], [70, 160, '#F8BBD0'], [120, 156, '#2E7D32'], [330, 162, '#F48FB1'], [372, 172, '#43A047']];
    trees.forEach(([x, y, c]) => { s += `<rect x="${x - 2}" y="${y}" width="4" height="12" fill="#6D4C41"/><circle cx="${x}" cy="${y - 4}" r="12" fill="${c}"/>`; });
    s += `<path d="M252 158 Q270 140 288 158Z" fill="#ECEFF1"/>`;
    s += `<rect x="266" y="44" width="9" height="114" fill="#FAFAFA" stroke="#CFD8DC"/>`;
    s += `<rect x="252" y="34" width="37" height="14" rx="5" fill="#ECEFF1" stroke="#B0BEC5"/><rect x="254" y="39" width="33" height="4" fill="#4FC3F7"/>`;
    s += `<rect x="261" y="24" width="19" height="11" rx="3" fill="#FAFAFA" stroke="#B0BEC5"/><rect x="269.5" y="6" width="2" height="18" fill="#90A4AE"/><circle cx="270.5" cy="6" r="2" fill="#E53935"/>`;
    return wrap(s, grad(id, [[0, '#4FC3F7'], [1, '#E3F2FD']]));
  }

  /* 4. 광안리·광안대교(밤) */
  function gwangan() {
    const id = uid(), r = rng(23);
    let s = `<rect width="400" height="220" fill="url(#${id})"/>`;
    for (let i = 0; i < 45; i++) s += `<circle cx="${(r() * 400).toFixed(1)}" cy="${(r() * 70).toFixed(1)}" r="${(0.5 + r() * 1.1).toFixed(2)}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
    s += `<circle cx="345" cy="34" r="20" fill="#FFF59D" opacity=".18"/><circle cx="345" cy="34" r="12" fill="#FFF9C4"/>`;
    for (let x = -4; x < 404; x += 14) {
      const h = 14 + Math.floor(r() * 34);
      s += `<rect x="${x}" y="${118 - h}" width="12" height="${h}" fill="#1E2550"/>`;
      for (let wy = 118 - h + 4; wy < 114; wy += 6) if (r() > 0.55) s += `<rect x="${x + 3}" y="${wy}" width="2" height="2" fill="#FFE082"/>`;
    }
    s += `<rect y="116" width="400" height="104" fill="#0D1B4A"/>`;
    const colors = ['#FF5252', '#FFD740', '#69F0AE', '#40C4FF', '#E040FB'];
    const curves = [[[0, 106], [90, 100], [138, 62]], [[138, 62], [200, 158], [262, 62]], [[262, 62], [310, 100], [400, 106]]];
    let lights = '', hangers = '', refl = '';
    curves.forEach(([p0, p1, p2], ci) => {
      s += `<path d="M${p0[0]} ${p0[1]} Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}" fill="none" stroke="#CFD8DC" stroke-width="1.4"/>`;
      const n = 18;
      for (let i = 1; i < n; i++) {
        const t = i / n, u = 1 - t;
        const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
        const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
        const c = colors[(i + ci * 3) % colors.length];
        hangers += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="110" stroke="#90A4AE" stroke-width=".5" opacity=".6"/>`;
        lights += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="${c}" opacity=".3"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${c}"/>`;
        if (i % 3 === 0) refl += `<rect x="${(x - 1).toFixed(1)}" y="${124 + (i % 4) * 3}" width="2" height="${30 + (i % 5) * 8}" fill="${c}" opacity=".22"/>`;
      }
    });
    s += refl + hangers;
    s += `<rect x="135" y="60" width="6" height="78" fill="#ECEFF1"/><rect x="259" y="60" width="6" height="78" fill="#ECEFF1"/>`;
    s += `<rect y="108" width="400" height="5" fill="#CFD8DC"/><rect y="113" width="400" height="3" fill="#78909C"/>`;
    for (let x = 4; x < 400; x += 10) s += `<circle cx="${x}" cy="110.5" r="1" fill="#FFF59D"/>`;
    s += lights;
    s += wavy(150, 1.5, 28, '#3F51B5', 1.2, 0.8) + wavy(168, 1.5, 34, '#3F51B5', 1.2, 0.6);
    s += `<path d="M0 220 V190 Q200 178 400 192 V220Z" fill="#4A3F6B"/>`;
    return wrap(s, grad(id, [[0, '#0B1437'], [0.6, '#1A237E'], [1, '#3949AB']]));
  }

  /* 5. 해운대 해수욕장 (sunset: 엔딩용 노을) */
  function haeundae(opts = {}) {
    const sunset = !!opts.sunset;
    const id = uid(), sid = uid(), r = rng(3);
    const defs = grad(id, sunset ? [[0, '#7E57C2'], [0.45, '#FF8A65'], [1, '#FFD180']] : [[0, '#29B6F6'], [1, '#E1F5FE']])
      + grad(sid, sunset ? [[0, '#FF8A65'], [1, '#5C6BC0']] : [[0, '#0288D1'], [1, '#4FC3F7']]);
    let s = `<rect width="400" height="220" fill="url(#${id})"/>`;
    if (sunset) s += `<circle cx="260" cy="100" r="40" fill="#FFE082" opacity=".35"/><circle cx="260" cy="100" r="24" fill="#FFCA28"/>`;
    else s += `<circle cx="335" cy="36" r="26" fill="#FFF59D" opacity=".45"/><circle cx="335" cy="36" r="16" fill="#FFEB3B"/>`;
    const cf = sunset ? '#FFCCBC' : '#fff';
    s += cloud(70, 30, 1, cf) + cloud(190, 20, 0.7, cf);
    for (let x = 0; x < 120; x += 15) {
      const h = 30 + Math.floor(r() * 40);
      s += `<rect x="${x}" y="${102 - h}" width="12" height="${h}" fill="${sunset ? '#8D6E9E' : '#90A4AE'}"/>`;
      for (let wy = 102 - h + 5; wy < 98; wy += 7) s += `<rect x="${x + 3}" y="${wy}" width="6" height="2" fill="${sunset ? '#FFE082' : '#E3F2FD'}" opacity=".8"/>`;
    }
    s += `<path d="M320 102 Q360 76 410 96 V104 H320Z" fill="${sunset ? '#6D4C41' : '#558B2F'}"/>`;
    s += `<rect y="100" width="400" height="64" fill="url(#${sid})"/>`;
    if (sunset) for (let i = 0; i < 6; i++) s += `<rect x="${248 - i * 3}" y="${106 + i * 8}" width="${24 + i * 6}" height="2" rx="1" fill="#FFE082" opacity=".45"/>`;
    s += wavy(118, 2, 30, '#fff', 1.6, 0.55) + wavy(134, 2.5, 36, '#fff', 1.8, 0.7) + wavy(150, 3, 42, '#fff', 2.2, 0.85);
    s += `<path d="M0 164 Q25 156 50 162 T100 162 T150 162 T200 162 T250 162 T300 162 T350 162 T400 162 V220 H0Z" fill="${sunset ? '#FFCC80' : '#FFE0B2'}"/>`;
    s += `<path d="M0 162 Q25 154 50 160 T100 160 T150 160 T200 160 T250 160 T300 160 T350 160 T400 160" fill="none" stroke="#fff" stroke-width="3" opacity=".9"/>`;
    const parasols = sunset ? [[50, 186, '#E53935'], [360, 194, '#1E88E5']] : [[40, 184, '#E53935'], [118, 200, '#FDD835'], [318, 190, '#1E88E5'], [384, 206, '#43A047']];
    parasols.forEach(([x, y, c]) => {
      s += `<rect x="${x - 1}" y="${y}" width="2" height="26" fill="#6D4C41"/>`;
      s += `<path d="M${x - 20} ${y + 2} A20 13 0 0 1 ${x + 20} ${y + 2} Z" fill="${c}"/><path d="M${x - 7} ${y + 2} A7 13 0 0 1 ${x + 7} ${y + 2} Z" fill="#fff" opacity=".7"/>`;
    });
    if (!sunset) s += `<circle cx="260" cy="205" r="7" fill="#fff"/><path d="M253 205 A7 7 0 0 1 260 198 V205Z" fill="#E53935"/><path d="M260 212 A7 7 0 0 0 267 205 H260Z" fill="#1E88E5"/>`;
    s += `<path d="M90 210 l3 -7 l3 7 l-7 -4 h8z" fill="#FF7043"/>`;
    return wrap(s, defs);
  }

  function generic() {
    const id = uid();
    return wrap(`<rect width="400" height="220" fill="url(#${id})"/>${cloud(80, 30)}${cloud(300, 40, 0.8)}<path d="M0 220 V150 Q200 120 400 150 V220Z" fill="#9CCC65"/>`, grad(id, [[0, '#4FC3F7'], [1, '#E1F5FE']]));
  }

  const SCENES = { gamcheon, jagalchi, tower, gwangan, haeundae };

  /* 임시 부캉이(아기 상어). assets/bukangi.png를 넣으면 자동으로 그 이미지로 바뀜
   *  colors: (선택) 실시간 대결에서 학생마다 몸 색을 다르게 할 때 { body, dark, mid, light }
   *          비우면 원래 파란 부캉이 그대로 */
  function character(colors = {}) {
    const body = colors.body || '#4FA8EC', dark = colors.dark || '#2F7FC9';
    const mid = colors.mid || '#3B93DC', light = colors.light || '#6CBBF3';
    return `<svg viewBox="0 0 100 112" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="부캉이">
<ellipse cx="50" cy="107" rx="28" ry="4.5" fill="#000" opacity=".15"/>
<path d="M70 92 Q90 92 97 74 Q95 92 99 106 Q84 98 68 100Z" fill="${dark}"/>
<path d="M40 24 Q50 -2 66 20 Q56 18 52 26Z" fill="${dark}"/>
<ellipse cx="50" cy="62" rx="37" ry="42" fill="${body}"/>
<ellipse cx="50" cy="50" rx="30" ry="22" fill="${light}" opacity=".55"/>
<ellipse cx="13" cy="76" rx="8" ry="15" fill="${mid}" transform="rotate(35 13 76)"/>
<ellipse cx="87" cy="76" rx="8" ry="15" fill="${mid}" transform="rotate(-35 87 76)"/>
<path d="M22 70 Q50 58 78 70 Q78 100 50 102 Q22 100 22 70Z" fill="#EAF6FF"/>
<path d="M19 52 q-3 4 0 8 M23 50 q-3 5 0 10 M81 52 q3 4 0 8 M77 50 q3 5 0 10" fill="none" stroke="${dark}" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="37" cy="49" r="7.2" fill="#1B2A3A"/><circle cx="63" cy="49" r="7.2" fill="#1B2A3A"/>
<circle cx="39.4" cy="46.2" r="2.7" fill="#fff"/><circle cx="65.4" cy="46.2" r="2.7" fill="#fff"/>
<circle cx="35" cy="51.6" r="1.2" fill="#fff" opacity=".8"/><circle cx="61" cy="51.6" r="1.2" fill="#fff" opacity=".8"/>
<ellipse cx="25" cy="62" rx="6" ry="3.5" fill="#FF8FA3" opacity=".75"/><ellipse cx="75" cy="62" rx="6" ry="3.5" fill="#FF8FA3" opacity=".75"/>
<path d="M38 62 Q50 64 62 62 Q60 76 50 77 Q40 76 38 62Z" fill="#E8596E"/>
<path d="M45 75 Q50 71 55 75 Q50 77.5 45 75Z" fill="#FF9AAA"/>
<path d="M39 62.2 l2.6 4 l2.6 -3.6 l2.6 4 l2.6 -3.8 l2.6 3.8 l2.6 -4 l2.6 3.6 l2.6 -4 Z" fill="#fff"/>
<ellipse cx="50" cy="88" rx="9" ry="4" fill="#fff" opacity=".6"/>
</svg>`;
  }

  return {
    render(key, opts) { return (SCENES[key] || generic)(opts); },
    character,
  };
})();
