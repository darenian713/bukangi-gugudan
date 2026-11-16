/* 화면 키패드(3×4) + 키보드 입력 */
const Keypad = (() => {
  const LONG_PRESS_MS = 550;
  let value = '';
  let enabled = false;
  let root = null;
  let okBtn = null;
  let opts = {};

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'ok'];

  function keyHTML(k) {
    if (k === 'back') return '<button type="button" tabindex="-1" class="key back" data-key="back" aria-label="한 글자 지우기 (길게 누르면 모두 지우기)">←</button>';
    if (k === 'ok') return '<button type="button" tabindex="-1" class="key ok" data-key="ok" aria-label="확인">확인</button>';
    return `<button type="button" tabindex="-1" class="key" data-key="${k}" aria-label="${k}">${k}</button>`;
  }

  function init(container, options) {
    opts = Object.assign({ maxDigits: 3, onChange() {}, onSubmit() {}, isActive: () => true }, options);
    root = container;
    root.innerHTML = KEYS.map(keyHTML).join('');
    okBtn = root.querySelector('[data-key="ok"]');

    root.querySelectorAll('.key').forEach((btn) => {
      let longTimer = null;
      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        btn.classList.add('pressed');
        const k = btn.dataset.key;
        if (k === 'back') {
          press('back');
          longTimer = setTimeout(() => { press('clear'); longTimer = null; }, LONG_PRESS_MS);
        } else {
          press(k);
        }
      });
      const release = () => {
        btn.classList.remove('pressed');
        if (longTimer) { clearTimeout(longTimer); longTimer = null; }
      };
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, release));
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    document.addEventListener('keydown', onKeyDown);
    update();
  }

  function onKeyDown(e) {
    if (!opts.isActive()) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    let k = null;
    if (/^[0-9]$/.test(e.key)) k = e.key;
    else if (e.key === 'Backspace' || e.key === 'Delete') k = 'back';
    else if (e.key === 'Enter' || e.key === 'NumpadEnter') k = 'ok';
    else if (e.key === 'Escape') k = 'clear';
    if (!k) return;
    e.preventDefault();
    if (e.repeat && k === 'ok') return;
    flash(k === 'clear' ? 'back' : k);
    press(k);
  }

  function flash(k) {
    const btn = root.querySelector(`[data-key="${k}"]`);
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 110);
  }

  function press(k) {
    if (!enabled) return;
    if (/^\d$/.test(k)) {
      if (value.length >= opts.maxDigits) return;
      value = value === '0' ? k : value + k;
    } else if (k === 'back' || k === 'clear') {
      if (!value) return;
      value = k === 'back' ? value.slice(0, -1) : '';
    } else if (k === 'ok') {
      if (!value) return;
      opts.onSubmit(value);
      return;
    }
    Sound.play('click');
    update();
    opts.onChange(value);
  }

  function update() {
    if (!okBtn) return;
    const off = !value || !enabled;
    okBtn.classList.toggle('disabled', off);
    okBtn.setAttribute('aria-disabled', off ? 'true' : 'false');
    root.classList.toggle('locked', !enabled);
  }

  return {
    init,
    setEnabled(v) { enabled = !!v; update(); },
    clear() { value = ''; update(); opts.onChange(value); },
    getValue: () => value,
  };
})();
