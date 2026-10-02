/* ConstraintLab – интерфейс приложения */
(function (XT) {
  'use strict';
  const U = XT.util;
  const esc = U.escapeHtml;
  const L = XT.L;
  // английское множественное число: plEn(n, 'task', 'tasks')
  const plEn = (n, one, many) => (n === 1 ? one : many);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const KEY = 'xdct.progress.v1';
  const PACKS = 'xdct.packs.v1';

  // ---------------------------------------------------------------------------
  // Хранилище прогресса
  // ---------------------------------------------------------------------------
  function loadJSON(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  let P = loadJSON(KEY, null) || { v: 1, q: {}, settings: {} };
  P.q = P.q || {}; P.settings = P.settings || {};
  const save = () => saveJSON(KEY, P);
  let saveTimer = null;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };
  const qs = (id) => (P.q[id] = P.q[id] || {});
  const qstat = (id) => (P.q[id] && P.q[id].status) || '';

  const st = { cur: null, editor: null, lastCheck: null, tab: 'result', con: null, conHist: [], conPos: 0, selCheck: null, analysisRef: false, clkCache: { code: null, names: [] } };

  // ---------------------------------------------------------------------------
  // Утилиты интерфейса
  // ---------------------------------------------------------------------------
  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }
  function download(name, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function pickFile(accept) {
    return new Promise((res) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return res(null);
        const rd = new FileReader();
        rd.onload = () => res({ name: f.name, text: String(rd.result) });
        rd.readAsText(f);
      };
      inp.click();
    });
  }
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const m = $('#modal');
    m.innerHTML = `<div class="modal-card ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h2>${esc(title)}</h2>${opts.head || ''}<button class="btn ghost" data-close>${L('Закрыть ✕', 'Close ✕')}</button></div><div class="modal-b">${bodyHtml}</div></div>`;
    m.hidden = false;
    const close = () => { m.hidden = true; m.innerHTML = ''; document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    m.onclick = (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); };
    return { body: $('.modal-b', m), card: $('.modal-card', m), close };
  }
  function flatList() { return XT.bank.ordered().flatMap((x) => x.qs); }
  function dd(s) { return XT.md.dedent(s || ''); }

  // ---------------------------------------------------------------------------
  // Загрузка банка
  // ---------------------------------------------------------------------------
  function loadScript(src) {
    return new Promise((res) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }
  function evalPack(p) {
    if (p.kind === 'json') {
      const o = JSON.parse(p.text);
      for (const m of o.modules || []) XT.bank.module(m);
      for (const q of (Array.isArray(o) ? o : (o.questions || []))) XT.bank.add(q);
    } else (new Function('XT', p.text))(XT);
  }
  async function loadBank() {
    const failed = [];
    // index.html?bank=50_my.js,51_more.js – подключить дополнительные файлы из bank/ без правки манифеста
    const extra = (new URLSearchParams(location.search).get('bank') || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const f of extra) if (!(XT.BANK_FILES || []).includes(f)) (XT.BANK_FILES = XT.BANK_FILES || []).push(f);
    for (const f of XT.BANK_FILES || []) {
      XT.bank.source = f;
      if (XT.BANK_INLINE && XT.BANK_INLINE[f]) { try { XT.BANK_INLINE[f](XT); } catch (e) { console.error(e); failed.push(f); } continue; }
      const ok = await loadScript('bank/' + f);
      if (!ok) failed.push(f);
    }
    for (const p of loadJSON(PACKS, [])) {
      XT.bank.source = 'pack:' + p.name;
      try { evalPack(p); } catch (e) { console.error(e); failed.push(p.name); }
    }
    // английский интерфейс: переводы задач из bank/en (задачи без перевода остаются на русском)
    if (XT.lang === 'en') {
      for (const f of XT.BANK_FILES_EN || []) {
        if (XT.BANK_INLINE && XT.BANK_INLINE[f]) { try { XT.BANK_INLINE[f](XT); } catch (e) { console.error(e); } continue; }
        if (!(await loadScript('bank/' + f))) console.warn(L('нет перевода: bank/', 'missing translation: bank/') + f);
      }
      XT.bank.applyLang('en');
    }
    XT.bank.source = 'user';
    return failed;
  }

  // ---------------------------------------------------------------------------
  // Тема и раскладка
  // ---------------------------------------------------------------------------
  function applyTheme() {
    const t = P.settings.theme || 'auto';
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    const b = $('#btnTheme');
    if (b) b.title = L('Тема: ', 'Theme: ') + ({ auto: L('как в системе', 'system default'), dark: L('тёмная', 'dark'), light: L('светлая', 'light') })[t];
    if (P.settings.edFont) document.documentElement.style.setProperty('--ed-font', P.settings.edFont + 'px');
  }
  // панель решения справа ('side') или под заданием ('bottom')
  function applyLayout() {
    const bottom = P.settings.layout === 'bottom';
    $('#main').classList.toggle('stack', bottom);
    const b = $('#btnLayout');
    if (b) {
      // значок показывает, куда переместится панель: ⬓ – вниз, ◨ – вправо
      b.textContent = bottom ? '◨' : '⬓';
      b.title = bottom ? L('Переместить панель решения вправо', 'Move the solution panel to the right') : L('Переместить панель решения под задание', 'Move the solution panel below the task');
    }
    $('#splitter').title = bottom ? L('Потяните, чтобы изменить высоту панелей', 'Drag to change the panel height') : L('Потяните, чтобы изменить ширину панелей', 'Drag to change the panel width');
  }
  function initSplit() {
    const main = $('#main'), sp = $('#splitter');
    if (P.settings.split) main.style.setProperty('--split', P.settings.split + '%');
    if (P.settings.vsplit) main.style.setProperty('--vsplit', P.settings.vsplit + '%');
    let drag = false;
    sp.addEventListener('mousedown', (e) => { drag = true; e.preventDefault(); document.body.style.cursor = main.classList.contains('stack') ? 'row-resize' : 'col-resize'; });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const r = main.getBoundingClientRect();
      if (main.classList.contains('stack')) {
        const pct = Math.max(20, Math.min(80, (e.clientY - r.top) / r.height * 100));
        main.style.setProperty('--vsplit', pct.toFixed(1) + '%');
        P.settings.vsplit = +pct.toFixed(1);
        return;
      }
      const pct = Math.max(28, Math.min(72, (e.clientX - r.left) / r.width * 100));
      main.style.setProperty('--split', pct.toFixed(1) + '%');
      P.settings.split = +pct.toFixed(1);
    });
    window.addEventListener('mouseup', () => { if (drag) { drag = false; document.body.style.cursor = ''; saveSoon(); } });
  }

  // ---------------------------------------------------------------------------
  // Боковая панель
  // ---------------------------------------------------------------------------
  function matchQ(q, s) {
    return (q.title + ' ' + (q.tags || []).join(' ') + ' ' + (q.text || '') + ' ' + q.id).toLowerCase().includes(s);
  }
  const LANG_FILTER = { all: () => true, xdc: (l) => l !== 'sdc', sdc: (l) => l !== 'xdc', both: (l) => l === 'both', 'xdc-only': (l) => l === 'xdc', 'sdc-only': (l) => l === 'sdc' };
  const LANG_TITLE = { both: L('Синтаксис общий: XDC (Vivado) и SDC (САПР ASIC)', 'Common syntax: XDC (Vivado) and SDC (ASIC tools)'), xdc: L('Только XDC (Vivado)', 'XDC only (Vivado)'), sdc: L('Только SDC (САПР ASIC)', 'SDC only (ASIC tools)') };
  const LANG_HEAD = { both: L('Синтаксис общий для XDC и SDC.', 'Common syntax for XDC and SDC.'), xdc: L('Только XDC (Vivado).', 'XDC only (Vivado).'), sdc: L('Только SDC (САПР ASIC).', 'SDC only (ASIC tools).') };
  const LANG_DEF = { both: L('Те же команды работают в Vivado и в САПР ASIC.', 'The same commands work in Vivado and in ASIC tools.'), xdc: L('Решение опирается на возможности Vivado.', 'The solution relies on Vivado-specific features.'), sdc: L('Решение опирается на возможности САПР ASIC.', 'The solution relies on ASIC tool features.') };
  function langBadges(q) {
    const l = XT.langOf(q);
    return `<span class="langs" title="${LANG_TITLE[l]}">${l !== 'sdc' ? '<span class="lg x">XDC</span>' : ''}${l !== 'xdc' ? '<span class="lg s">SDC</span>' : ''}</span>`;
  }
  // разбор решения и пояснение о различиях XDC и SDC
  function explainHtml(q) {
    if (!q.explain) return '';
    const l = XT.langOf(q);
    return `<div class="explain md"><h3 class="eh">${L('Разбор', 'Explanation')}</h3>${XT.md.render(q.explain)}` +
      `<p class="lang-line"><b>${LANG_HEAD[l]}</b> ${XT.md.inline(q.langNote || LANG_DEF[l])}</p></div>`;
  }
  function allModsClosed() {
    const closed = new Set(P.settings.closedMods || []);
    const mods = XT.bank.ordered().map((x) => x.m.id);
    return mods.length > 0 && mods.every((id) => closed.has(id));
  }
  function updateFoldBtn() {
    const fb = $('#btnFold');
    if (!fb) return;
    const all = allModsClosed();
    fb.textContent = all ? '⊞' : '⊟';
    fb.title = all ? L('Развернуть все темы', 'Expand all topics') : L('Свернуть все темы', 'Collapse all topics');
    fb.setAttribute('aria-label', fb.title);
  }
  function renderSidebar() {
    const s = ($('#search').value || '').trim().toLowerCase();
    const okLang = LANG_FILTER[$('#filterTool').value] || LANG_FILTER.all;
    const closed = new Set(P.settings.closedMods || []);
    let html = '', total = 0, solved = 0;
    for (const { m, qs: list } of XT.bank.ordered()) {
      total += list.length;
      const done = list.filter((x) => qstat(x.id) === 'solved').length;
      solved += done;
      const items = list.filter((x) => okLang(XT.langOf(x)) && (!s || matchQ(x, s)));
      if (!items.length) continue;
      html += `<div class="mod ${closed.has(m.id) && !s ? 'closed' : ''}" data-mod="${esc(m.id)}"><button class="mod-h" title="${esc(m.about || '')}"><span class="chev">▼</span><span>${esc(m.title)}</span><span class="cnt">${done}/${list.length}</span></button><div class="mod-items">`;
      for (const x of items) {
        const stt = qstat(x.id);
        html += `<button class="q-item ${stt} ${st.cur && st.cur.id === x.id ? 'active' : ''}" data-q="${esc(x.id)}" title="${esc(x.title)}">` +
          `<span class="st">${stt === 'solved' ? '✓' : stt === 'peeked' ? '·' : ''}</span><span class="qt">${esc(x.title)}</span>` +
          (x.type === 'choice' ? `<span class="qtype" title="${L('выбор ответа', 'multiple choice')}">?</span>` : x.type === 'numeric' ? `<span class="qtype" title="${L('расчёт', 'calculation')}">Σ</span>` : '') +
          `${langBadges(x)}<span class="lv">${'★'.repeat(x.level || 1)}</span></button>`;
      }
      html += '</div></div>';
    }
    $('#qlist').innerHTML = html || `<div class="empty">${L('Ничего не найдено', 'Nothing found')}</div>`;
    updateFoldBtn();
    $('#progress .fill').style.width = total ? (solved / total * 100) + '%' : '0';
    $('#progress .ptext').textContent = L(`${solved} из ${total} решено`, `${solved} of ${total} solved`);
  }

  // ---------------------------------------------------------------------------
  // Приветствие
  // ---------------------------------------------------------------------------
  function welcome() {
    st.cur = null;
    const all = flatList();
    const nB = all.filter((q) => XT.langOf(q) === 'both').length, nX = all.filter((q) => XT.langOf(q) === 'xdc').length, nS = all.length - nB - nX;
    const next = all.find((q) => qstat(q.id) !== 'solved') || all[0];
    $('#taskPane').innerHTML = `<div class="welcome md">
      <h1>ConstraintLab</h1>
      <p>${L('Практические задачи по временным и физическим проектным ограничениям: <b>Vivado XDC</b> и <b>SDC для ASIC</b>. Каждая задача – реальный интерфейс или узел системы на кристалле со схемой и временными диаграммами. Вы записываете ограничения, а ConstraintLab проверяет их <b>по смыслу</b>: строит модель тактовых сигналов и путей и сравнивает итоговые требования к предустановке и удержанию с эталоном. Любая эквивалентная запись засчитывается.', 'Hands-on tasks on timing and physical design constraints: <b>Vivado XDC</b> and <b>SDC for ASIC</b>. Every task is a real interface or a block of a system-on-chip with a schematic and timing diagrams. You write the constraints, and ConstraintLab checks them <b>by meaning</b>: it builds a model of clocks and timing paths and compares the resulting setup and hold requirements with the reference solution. Any equivalent form is accepted.')}</p>
      <div class="cards">
        <div class="card"><b>${L(`${all.length} ${U.plural(all.length, 'задача', 'задачи', 'задач')}`, `${all.length} ${plEn(all.length, 'task', 'tasks')}`)}</b><span>${L(`${nB} с общим синтаксисом XDC и SDC, ${nX} только для Vivado, ${nS} только для САПР ASIC: от основ до интерфейсов DDR, передачи между тактовыми доменами и режимов ASIC`, `${nB} with common XDC and SDC syntax, ${nX} for Vivado only, ${nS} for ASIC tools only: from the basics to DDR interfaces, clock domain crossing and ASIC modes`)}</span></div>
        <div class="card"><b>${L('Проверка по смыслу', 'Checking by meaning')}</b><span>${L('упрощённый статический временной анализ: соотношения фронтов, задержки ввода/вывода, исключения и их приоритеты', 'simplified static timing analysis: edge relationships, input/output delays, timing exceptions and their priorities')}</span></div>
        <div class="card"><b>${L('Понимание, а не синтаксис', 'Understanding, not syntax')}</b><span>${L('подсказки, разбор ошибок, диаграммы запуска и захвата для каждого пути', 'hints, explanations of errors, launch and capture diagrams for every path')}</span></div>
        <div class="card"><b>${L('Интерактивная консоль', 'Interactive console')}</b><span>${L('Tcl-консоль с report_clocks, check_timing, report_timing и запросами объектов', 'Tcl console with report_clocks, check_timing, report_timing and object queries')}</span></div>
      </div>
      <h2>${L('Как пользоваться', 'How to use')}</h2>
      <ul>
        <li>${L('Выберите задачу слева, изучите схему и диаграммы, запишите ограничения в редакторе (кнопка ⬓ вверху переносит его под задание, ◨ – обратно вправо).', 'Pick a task on the left, study the schematic and diagrams, and write the constraints in the editor (the ⬓ button at the top moves it below the task, ◨ moves it back to the right).')}</li>
        <li>${L('Кнопка ⟲ в шапке задачи сбрасывает её прогресс: отметку о решении, подсказки и просмотр решения.', 'The ⟲ button in the task header resets its progress: the solved mark, hints and the viewed solution.')}</li>
        <li>${L('Теги <b>XDC</b> и <b>SDC</b> показывают, где применимо решение: только в Vivado, только в САПР ASIC или в обоих (синтаксис общий). Чем отличаются XDC и SDC в конкретной задаче, рассказано в конце разбора.', 'The <b>XDC</b> and <b>SDC</b> tags show where the solution applies: only in Vivado, only in ASIC tools, or in both (common syntax). How XDC and SDC differ in a particular task is described at the end of the explanation.')}</li>
        <li>${L('<kbd>Ctrl</kbd>+<kbd>Enter</kbd> – проверить; <kbd>Ctrl</kbd>+<kbd>Space</kbd> – автодополнение; <kbd>Ctrl</kbd>+<kbd>/</kbd> – закомментировать.', '<kbd>Ctrl</kbd>+<kbd>Enter</kbd> – check; <kbd>Ctrl</kbd>+<kbd>Space</kbd> – autocomplete; <kbd>Ctrl</kbd>+<kbd>/</kbd> – comment out.')}</li>
        <li>${L('Щелчок по элементу схемы вставляет запрос объекта (<code>get_ports</code>, <code>get_cells</code>) в редактор.', 'Clicking a schematic element inserts its object query (<code>get_ports</code>, <code>get_cells</code>) into the editor.')}</li>
        <li>${L('Вкладка «Анализ путей» показывает, какие требования получились из ваших ограничений; вкладка «Консоль» позволяет выполнять запросы и строить отчёты.', 'The "Path analysis" tab shows which requirements result from your constraints; the "Console" tab lets you run queries and generate reports.')}</li>
        <li>${L('Банк вопросов дополняется файлами в папке <code>bank/</code> или через меню ⋮ → «Режим автора».', 'The question bank can be extended with files in the <code>bank/</code> folder or via the ⋮ menu → "Author mode".')}</li>
      </ul>
      <p class="author-line">${XT.L('Автор', 'Author')}: ${esc(XT.L(XT.AUTHOR.ru, XT.AUTHOR.en))} · <a href="${XT.AUTHOR.url}" target="_blank" rel="noopener">${XT.AUTHOR.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> · ${XT.L('лицензия MIT', 'MIT License')} · ${XT.L('версия', 'version')} ${esc(XT.VERSION || '')}</p>
      <p><button class="btn primary" id="startBtn">${qstat(next && next.id) ? L('Продолжить', 'Continue') : L('Начать', 'Start')}: ${esc(next ? next.title : '')} →</button></p>
    </div>`;
    $('#workPane').innerHTML = `<div class="md" style="padding:6px 4px"><h3>${L('Справочник всегда под рукой', 'The reference is always at hand')}</h3><p>${L('Кнопка «Справочник» вверху: команды XDC/SDC с примерами и статьи о соотношениях фронтов, формулах задержек ввода/вывода, многотактных путях, передаче между тактовыми доменами и приоритетах исключений.', 'The "Reference" button at the top: XDC/SDC commands with examples and articles on edge relationships, input/output delay formulas, multicycle paths, clock domain crossing and exception priorities.')}</p></div>`;
    const b = $('#startBtn');
    if (b && next) b.onclick = () => openQ(next.id);
    renderSidebar();
  }

  // ---------------------------------------------------------------------------
  // Открытие задачи
  // ---------------------------------------------------------------------------
  function openQ(id, opts) {
    const q = XT.bank.byId.get(id);
    if (!q) { welcome(); return; }
    st.cur = q; st.lastCheck = null; st.con = null; st.selCheck = null; st.tab = 'result'; st.analysisRef = false; st.clkCache = { code: null, names: [] };
    st.confirm = null;
    P.settings.lastQ = id; saveSoon();
    const h = '#q=' + encodeURIComponent(id);
    if (location.hash !== h) history.replaceState(null, '', h);
    renderTask(q);
    renderWork(q);
    renderSidebar();
    const a = $('.q-item.active');
    if (a) a.scrollIntoView({ block: 'nearest' });
    $('#sidebar').classList.remove('open');
    $('#taskPane').scrollTop = 0;
    $('#workPane').scrollTop = 0;
    if (!(opts && opts.noFocus) && st.editor && window.innerWidth > 900) st.editor.focus();
  }
  function stepQ(d) {
    const all = flatList();
    const k = all.findIndex((x) => st.cur && x.id === st.cur.id);
    const n = all[k + d];
    if (n) openQ(n.id);
  }

  function renderTask(q) {
    const mod = XT.bank.modules.get(q.module) || { title: q.module };
    const all = flatList();
    const idx = all.findIndex((x) => x.id === q.id);
    const lv = Math.max(1, Math.min(3, q.level || 1));
    const typeTag = q.type === 'choice' ? `<span class="tag type">${L('выбор ответа', 'multiple choice')}</span>` : q.type === 'numeric' ? `<span class="tag type">${L('расчёт', 'calculation')}</span>` : '';
    const figs = XT.questionFigures(q);
    let html = `<div class="q-crumb"><span>${esc(mod.title)}</span><span>·</span><span>${L(`задача ${idx + 1} из ${all.length}`, `task ${idx + 1} of ${all.length}`)}</span>
      <div class="q-nav"><button class="icon-btn" id="resetQ" title="${L('Сбросить прогресс этой задачи: отметку о решении, подсказки, просмотр решения', 'Reset the progress of this task: solved mark, hints, viewed solution')}">⟲</button><button class="icon-btn" id="prevQ" title="${L('Предыдущая задача', 'Previous task')}" ${idx <= 0 ? 'disabled' : ''}>←</button><button class="icon-btn" id="nextQ" title="${L('Следующая задача', 'Next task')}" ${idx >= all.length - 1 ? 'disabled' : ''}>→</button></div></div>
      <h1 class="q-title">${esc(q.title)}</h1>
      <div class="q-tags">${XT.langOf(q) !== 'sdc' ? `<span class="tag lang-x" title="${L('Решение применимо в Vivado (XDC)', 'The solution applies to Vivado (XDC)')}">XDC</span>` : ''}${XT.langOf(q) !== 'xdc' ? `<span class="tag lang-s" title="${L('Решение применимо в САПР ASIC (SDC): Design Compiler, PrimeTime, Genus, Innovus, Tempus, OpenSTA', 'The solution applies to ASIC tools (SDC): Design Compiler, PrimeTime, Genus, Innovus, Tempus, OpenSTA')}">SDC</span>` : ''}<span class="tag scen" title="${q.tool === 'vivado' ? L('Схема построена на примитивах ПЛИС AMD (Xilinx) семейства 7', 'The schematic uses AMD (Xilinx) 7 series FPGA primitives') : L('Схема построена на ячейках стандартной библиотеки ASIC', 'The schematic uses ASIC standard library cells')}">${q.tool === 'vivado' ? L('схема: ПЛИС', 'schematic: FPGA') : L('схема: ASIC', 'schematic: ASIC')}</span><span class="tag lv" title="${L('Сложность', 'Difficulty')}">${'★'.repeat(lv)}${'☆'.repeat(3 - lv)}</span>${typeTag}${(q.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="md q-text">${XT.md.render(q.text || '')}</div>`;
    if (figs.length) {
      html += `<div class="figs"><div class="fig-tabs">${figs.map((f, i) => `<button class="fig-tab ${i === 0 ? 'active' : ''}" data-fig="${i}">${esc(f.title || (f.kind === 'schematic' ? L('Схема', 'Schematic') : L('Диаграмма', 'Diagram')))}</button>`).join('')}</div>
        <div class="fig-view" id="figView"></div><div class="fig-cap" id="figCap"></div></div>`;
    }
    if (q.refs) html += `<div class="md"><p style="font-size:13px;color:var(--muted)"><b>${L('Документация:', 'Documentation:')}</b> ${XT.md.inline(q.refs)}</p></div>`;
    $('#taskPane').innerHTML = html;
    if (figs.length) showFig(q, 0);
    $('#prevQ').onclick = () => stepQ(-1);
    $('#nextQ').onclick = () => stepQ(1);
    $('#resetQ').onclick = () => resetTask(q);
    $$('.fig-tab').forEach((b) => (b.onclick = () => { $$('.fig-tab').forEach((x) => x.classList.remove('active')); b.classList.add('active'); showFig(q, +b.dataset.fig); }));
  }
  function figSvg(q, f) {
    if (f.kind === 'schematic') return XT.schematic.render(f.design || q.design, { title: f.title }).svg;
    // заголовок показывается во вкладке, внутри рисунка он не нужен
    return XT.wave.render(Object.assign({}, f, { title: undefined }), {}).svg;
  }
  function showFig(q, i) {
    const f = XT.questionFigures(q)[i];
    const v = $('#figView');
    let svg;
    try { svg = figSvg(q, f); } catch (e) { svg = `<div class="empty">${L('Ошибка отрисовки: ', 'Rendering error: ')}${esc(e.message)}</div>`; }
    v.innerHTML = svg + `<div class="fig-tools"><button title="${L('Открыть крупно', 'Enlarge')}" data-zoom>⤢</button></div>`;
    // широкие схемы не сжимаются сильнее 75 %: дальше – горизонтальная прокрутка
    const sv = v.querySelector('svg');
    if (sv && f.kind === 'schematic') { const w = +sv.getAttribute('width'); if (w) sv.style.minWidth = Math.round(w * 0.75) + 'px'; }
    const outside = q.tool === 'sdc' ? L('вне блока', 'outside the block') : L('вне ПЛИС', 'outside the FPGA');
    $('#figCap').innerHTML = f.caption ? XT.md.inline(dd(f.caption)) : (f.kind === 'schematic' ? L(`Оранжевые линии – тактовые сигналы, синие – данные, пунктир – ${outside}. Щелчок по элементу вставляет его запрос в редактор.`, `Orange lines are clocks, blue lines are data, dashed lines are ${outside}. Click an element to insert its query into the editor.`) : '');
    decorateSchematic(v);
    $('[data-zoom]', v).onclick = () => zoomFig(svg, f.title || L('Рисунок', 'Figure'));
  }
  function objQuery(obj) {
    const k = obj.indexOf(':');
    const kind = obj.slice(0, k), name = obj.slice(k + 1);
    const cmd = { port: 'get_ports', cell: 'get_cells', pin: 'get_pins', net: 'get_nets', clock: 'get_clocks' }[kind] || 'get_cells';
    const needBr = /[\[\]\s$]/.test(name);
    return `[${cmd} ${needBr ? '{' + name + '}' : name}]`;
  }
  function decorateSchematic(root) {
    for (const g of $$('g[data-obj]', root)) {
      const q = objQuery(g.dataset.obj);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      t.textContent = L(`${q}\nщелчок – вставить в редактор`, `${q}\nclick to insert into the editor`);
      g.insertBefore(t, g.firstChild);
      g.addEventListener('click', () => {
        if (st.editor && st.cur && (st.cur.type || 'sdc') === 'sdc') { st.editor.insert(q); toast(L('Вставлено: ', 'Inserted: ') + q, 1600); }
        else toast(q, 1600);
        g.classList.add('flash');
        setTimeout(() => g.classList.remove('flash'), 600);
      });
    }
  }
  function zoomFig(svg, title) {
    const M = modal(title, `<div class="zoom-view" id="zoomView">${svg}</div>`, {
      wide: true, head: `<button class="btn" data-z="-">−</button><button class="btn" data-z="+">+</button><button class="btn" data-z="0">${L('По ширине', 'Fit width')}</button>`,
    });
    const view = $('#zoomView', M.body);
    const s = $('svg', view);
    s.style.maxWidth = 'none';
    const W = +s.getAttribute('width'), H = +s.getAttribute('height');
    let z = Math.max(0.5, Math.min(3, (view.clientWidth - 20) / W));
    const apply = () => { s.setAttribute('width', W * z); s.setAttribute('height', H * z); };
    apply();
    M.card.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => {
      if (b.dataset.z === '+') z *= 1.25; else if (b.dataset.z === '-') z /= 1.25; else z = (view.clientWidth - 20) / W;
      apply();
    }));
    view.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); z *= e.deltaY < 0 ? 1.1 : 1 / 1.1; apply(); }, { passive: false });
    let drag = null;
    view.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, l: view.scrollLeft, t: view.scrollTop }; view.style.cursor = 'grabbing'; });
    window.addEventListener('mouseup', () => { drag = null; view.style.cursor = ''; });
    view.addEventListener('mousemove', (e) => { if (!drag) return; view.scrollLeft = drag.l - (e.clientX - drag.x); view.scrollTop = drag.t - (e.clientY - drag.y); });
  }

  // ---------------------------------------------------------------------------
  // Правая панель
  // ---------------------------------------------------------------------------
  function codeBox(title, code) {
    return `<div class="code-box"><div class="h"><span>${esc(title)}</span></div><pre>${XT.md.hlTcl(dd(code))}</pre></div>`;
  }
  function renderWork(q) {
    const type = q.type || 'sdc';
    const s = qs(q.id);
    let html = '';
    if (q.given) html += codeBox(L('Уже в проекте – выполняется ДО вашего кода', 'Already in the project – runs BEFORE your code'), q.given);
    if (type === 'sdc') {
      html += `<div class="ed-host" id="edHost"></div><div class="sigline" id="sig">${L('Подсказка синтаксиса появится здесь. <kbd>Ctrl</kbd>+<kbd>Space</kbd> – автодополнение.', 'Syntax help appears here. <kbd>Ctrl</kbd>+<kbd>Space</kbd> – autocomplete.')}</div><div class="ed-resize" id="edResize" title="${L('Потяните, чтобы изменить высоту редактора', 'Drag to change the editor height')}"></div>`;
    } else if (type === 'choice') {
      const name = 'opt_' + q.id.replace(/\W/g, '_');
      html += `<div class="choice" id="choice">${q.options.map((o, i) => `<label class="opt" data-i="${i}"><input type="${q.multi ? 'checkbox' : 'radio'}" name="${name}" value="${i}" ${(s.choice || []).includes(i) ? 'checked' : ''}><div>${XT.md.inline(dd(o.text))}<div class="why" hidden></div></div></label>`).join('')}</div>`;
      if (q.multi) html += `<p style="font-size:12.5px;color:var(--muted);margin:6px 2px 0">${L('Верных вариантов может быть несколько.', 'More than one option may be correct.')}</p>`;
    } else if (type === 'numeric') {
      html += `<div class="numfields" id="numf">${q.fields.map((f, i) => `<div class="numf" data-i="${i}"><label for="nf${i}">${XT.md.inline(f.label)}</label><input id="nf${i}" inputmode="decimal" autocomplete="off" value="${esc((s.nums || [])[i] ?? '')}"><span class="u">${esc(f.unit || L('нс', 'ns'))}</span></div>`).join('')}</div>`;
    }
    if (q.after) html += codeBox(L('Выполняется ПОСЛЕ вашего кода (ссылается на ваши объекты)', 'Runs AFTER your code (refers to your objects)'), q.after);
    const nh = (q.hints || []).length;
    html += `<div class="actions">
      <button class="btn primary" id="btnCheck">${type === 'sdc' ? L('Проверить', 'Check') : L('Ответить', 'Answer')} <kbd>Ctrl+Enter</kbd></button>
      <button class="btn" id="btnHint" ${nh ? '' : 'disabled'}>${L('Подсказка', 'Hint')}${nh ? ` <span id="hintCnt">${Math.min(s.hints || 0, nh)}/${nh}</span>` : ''}</button>
      <button class="btn" id="btnSol">${type === 'sdc' ? L('Решение', 'Solution') : L('Разбор', 'Explanation')}</button>
      ${type === 'sdc' ? `<button class="btn ghost" id="btnReset" title="${L('Вернуть исходный текст редактора (прогресс задачи не меняется)', 'Restore the original editor text (task progress is not changed)')}">${L('Сброс кода', 'Reset code')}</button>` : ''}
      <span class="grow"></span></div>
      <div id="confirmBox"></div><div id="hints"></div><div id="solBox"></div>`;
    // правая колонка (в раскладке «под заданием»): вкладки результата
    html = `<div class="work-l">${html}</div><div class="work-r">`;
    if (type === 'sdc') {
      html += `<div class="tabs" role="tablist">
        <button class="tab" data-tab="result">${L('Результат', 'Result')} <span class="badge" id="badgeRes" hidden></span></button>
        <button class="tab" data-tab="analysis">${L('Анализ путей', 'Path analysis')}</button>
        <button class="tab" data-tab="console">${L('Консоль', 'Console')}</button>
        <button class="tab" data-tab="objects">${L('Объекты', 'Objects')}</button></div>
        <div class="tab-body" id="tabBody"></div>`;
    } else html += '<div class="tab-body" id="tabBody"></div>';
    html += '</div>';
    $('#workPane').innerHTML = html;
    if (type === 'sdc') {
      st.editor = new XT.Editor($('#edHost'), {
        onChange: (v) => { qs(q.id).code = v; saveSoon(); },
        onRun: () => doCheck(),
        onSig: (cmd) => showSig(cmd),
        complete: (ctx) => completions(ctx),
      });
      st.editor.value = s.code !== undefined ? s.code : (q.starter ? dd(q.starter) + '\n' : '');
      const edh = P.settings.edh || 260;
      $('#edHost').style.setProperty('--edh', edh + 'px');
      initEdResize();
      $$('.tab').forEach((b) => (b.onclick = () => { st.tab = b.dataset.tab; renderTabs(); }));
      $('#btnReset').onclick = () => confirmInline(L('Вернуть исходный текст редактора? Ваш код будет удалён.', 'Restore the original editor text? Your code will be deleted.'), L('Сбросить', 'Reset'), () => {
        st.editor.value = q.starter ? dd(q.starter) + '\n' : '';
        qs(q.id).code = st.editor.value; save();
      });
    } else {
      st.editor = null;
      if (type === 'numeric') $$('#numf input').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doCheck(); }));
      $$('#choice input').forEach((inp) => inp.addEventListener('change', () => {
        qs(q.id).choice = $$('#choice input').filter((x) => x.checked).map((x) => +x.value); saveSoon();
      }));
    }
    $('#btnCheck').onclick = () => doCheck();
    $('#btnHint').onclick = () => showHint(true);
    $('#btnSol').onclick = () => askSolution();
    showHint(false);
    if (s.solShown) renderSolution(false);
    renderTabs();
  }
  function initEdResize() {
    const h = $('#edResize'), host = $('#edHost');
    let drag = null;
    h.addEventListener('mousedown', (e) => { drag = { y: e.clientY, h: $('.ed', host).offsetHeight }; e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const nh = Math.max(140, Math.min(900, drag.h + e.clientY - drag.y));
      host.style.setProperty('--edh', nh + 'px');
      P.settings.edh = nh;
    });
    window.addEventListener('mouseup', () => { if (drag) { drag = null; saveSoon(); } });
  }
  // сброс прогресса одной задачи: отметка о решении, попытки, подсказки, просмотр решения, ответы; код – по выбору
  function resetTask(q) {
    const s = P.q[q.id];
    const type = q.type || 'sdc';
    if (!s || !Object.keys(s).length) { toast(L('По этой задаче ещё нет прогресса', 'No progress on this task yet'), 1800); return; }
    const starter = q.starter ? dd(q.starter).trim() : '';
    const hasCode = type === 'sdc' && s.code !== undefined && s.code.trim() !== '' && s.code.trim() !== starter;
    const what = [L('отметка о решении и число попыток', 'solved mark and attempt count'), L('счётчик подсказок', 'hint counter'), L('отметка о просмотре решения', 'viewed-solution mark')];
    if (type !== 'sdc') what.push(L('выбранные ответы', 'selected answers'));
    const M = modal(L('Сбросить прогресс задачи?', 'Reset task progress?'), `<p><b>${esc(q.title)}</b></p>` + L(`<p>Будут удалены: ${what.join(', ')}. Задача станет нерешённой, подсказки и разбор снова будут скрыты.</p>`, `<p>To be deleted: ${what.join(', ')}. The task becomes unsolved; hints and the explanation are hidden again.</p>`) +
      `<p><button class="btn primary" id="rqAll">${type === 'sdc' ? L('Сбросить вместе с кодом', 'Reset including code') : L('Сбросить', 'Reset')}</button> ` +
      (hasCode ? `<button class="btn" id="rqKeep">${L('Сбросить, код оставить', 'Reset, keep code')}</button> ` : '') +
      `<button class="btn" data-close>${L('Отмена', 'Cancel')}</button></p>`);
    const done = (keepCode) => {
      const code = keepCode ? s.code : undefined;
      delete P.q[q.id];
      if (code !== undefined) qs(q.id).code = code;
      save(); M.close();
      openQ(q.id, { noFocus: true });
      renderSidebar();
      toast(keepCode ? L('Прогресс задачи сброшен, код сохранён', 'Task progress reset, code kept') : L('Прогресс задачи сброшен', 'Task progress reset'), 1800);
    };
    $('#rqAll', M.body).onclick = () => done(false);
    if (hasCode) $('#rqKeep', M.body).onclick = () => done(true);
  }
  function confirmInline(text, okLabel, onOk) {
    const box = $('#confirmBox');
    box.innerHTML = `<div class="confirm-inline"><span>${esc(text)}</span><button class="btn primary" data-ok>${esc(okLabel)}</button><button class="btn" data-no>${L('Отмена', 'Cancel')}</button></div>`;
    $('[data-ok]', box).onclick = () => { box.innerHTML = ''; onOk(); };
    $('[data-no]', box).onclick = () => { box.innerHTML = ''; };
  }

  // ---------- подсказка синтаксиса и автодополнение ----------
  function showSig(cmd) {
    const el = $('#sig');
    if (!el) return;
    const d = cmd && XT.refdocs.byName.get(cmd);
    if (!d) { el.innerHTML = cmd ? `<b>${esc(cmd)}</b>` : ''; return; }
    el.innerHTML = `<b>${esc(d.name)}</b> ${esc(d.syn.split('\n')[0].replace(d.name, '').trim())} <button class="linkbtn" id="sigRef">${L('справка', 'reference')}</button>`;
    el.title = d.brief;
    $('#sigRef').onclick = () => openRef(d.name);
  }
  const OPTS = new Map();
  function optsFor(cmd) {
    if (OPTS.has(cmd)) return OPTS.get(cmd);
    const d = XT.refdocs.byName.get(cmd);
    const set = new Map();
    if (d) {
      for (const m of (d.syn || '').matchAll(/(-[a-z_]+)/g)) set.set(m[1], '');
      for (const [k, v] of d.opts || []) for (const m of k.matchAll(/(-[a-z_]+)/g)) set.set(m[1], v);
    }
    const extra = {
      get_ports: ['-filter', '-regexp', '-nocase', '-of_objects', '-quiet'], get_cells: ['-hierarchical', '-filter', '-of_objects', '-regexp', '-quiet'],
      get_pins: ['-hierarchical', '-filter', '-of_objects', '-regexp', '-quiet'], get_nets: ['-hierarchical', '-filter', '-of_objects'],
      get_clocks: ['-of_objects', '-include_generated_clocks', '-filter'], set_false_path: ['-rise_from', '-fall_from', '-rise_to', '-fall_to'],
      set_multicycle_path: ['-rise_from', '-fall_from', '-rise_to', '-fall_to', '-through'],
    }[cmd] || [];
    for (const e of extra) if (!set.has(e)) set.set(e, '');
    const arr = [...set].map(([n, d2]) => ({ n, d: d2 }));
    OPTS.set(cmd, arr);
    return arr;
  }
  function designForCompl() {
    if (!st.cur || !st.cur.design) return null;
    if (!st._design || st._designQ !== st.cur.id) { st._design = XT.checker.buildDesign(st.cur); st._designQ = st.cur.id; }
    return st._design;
  }
  function clockNames() {
    const code = st.editor ? st.editor.value : '';
    if (st.clkCache.code === code) return st.clkCache.names;
    let names = [];
    try { const r = XT.checker.runSession(st.cur, code); names = r.S.clocks().list.map((c) => ({ n: c.name, d: L(`${U.fmt(c.period)} нс, ${c.type}`, `${U.fmt(c.period)} ns, ${c.type}`) })); } catch (e) { names = []; }
    st.clkCache = { code, names };
    return names;
  }
  function busGroups(objs) {
    const m = new Map();
    for (const o of objs) {
      const g = o.name.replace(/\[(\d+)\]/g, '[*]');
      if (!m.has(g)) m.set(g, []);
      m.get(g).push(o);
    }
    return m;
  }
  function completions(ctx) {
    const { word, cmd, atCmd, prefixLine } = ctx;
    const out = [];
    if (atCmd) {
      for (const c of XT.refdocs.CMDS) out.push({ n: c.name, d: c.brief });
      for (const n of ['set', 'expr', 'list', 'foreach', 'puts']) out.push({ n, d: 'Tcl' });
      return out;
    }
    if (word.startsWith('-') && cmd) return optsFor(cmd);
    if (/-clock\s+\S*$/.test(prefixLine + word) || /-group\s+\{?\S*$/.test(prefixLine + word) || cmd === 'get_clocks' || /-master_clock\s+\S*$/.test(prefixLine + word)) return clockNames();
    const D = designForCompl();
    const stripBr = (n) => (word.startsWith('{') ? '{' + n : n);
    if (D && cmd === 'get_ports') {
      const dirRu = (d) => ({ in: L('вход', 'input'), out: L('выход', 'output'), inout: L('двунаправленный', 'bidirectional') })[d] || d;
      for (const [g, list] of busGroups([...D.ports.values()])) out.push({ n: stripBr(g), d: `${list.length > 1 ? list.length + L(' разр., ', ' bits, ') : ''}${dirRu(list[0].dir)}`, contains: true });
      if (busGroups([...D.ports.values()]).size < 40) for (const p of D.ports.values()) if (p.bus) out.push({ n: stripBr(p.name), d: dirRu(p.dir), contains: true });
      return out;
    }
    if (D && cmd === 'get_cells') {
      for (const [g, list] of busGroups([...D.cells.values()])) out.push({ n: stripBr(g), d: `${list[0].ref}${list.length > 1 ? ' ×' + list.length : ''}`, contains: true });
      for (const h of D.hier.values()) out.push({ n: stripBr(h.name), d: L('иерархия', 'hierarchy'), contains: true });
      return out;
    }
    if (D && cmd === 'get_pins') {
      const groups = busGroups([...D.pins.values()]);
      for (const [g, list] of groups) out.push({ n: stripBr(g), d: `${({ in: L('вход', 'input'), out: L('выход', 'output'), inout: L('двунапр.', 'bidir.') })[list[0].dir] || list[0].dir}${list[0].spec.clk ? L(', тактовый', ', clock') : ''}`, contains: true });
      return out;
    }
    if (D && cmd === 'get_nets') { for (const [g] of busGroups([...D.nets.values()])) out.push({ n: stripBr(g), d: L('цепь', 'net'), contains: true }); return out; }
    if (cmd === 'set_property') {
      if (/IOSTANDARD\s+\S*$/i.test(prefixLine + word)) return XT.sdc.IOSTANDARDS.map((n) => ({ n, d: 'IOSTANDARD' }));
      if (/^[A-Z.]*$/.test(word)) {
        const props = U.uniq([...XT.sdc.PROPS.port, ...XT.sdc.PROPS.cell, ...XT.sdc.PROPS.design, ...XT.sdc.BITSTREAM]);
        return props.map((n) => ({ n, d: L('свойство', 'property') }));
      }
    }
    if (cmd === 'set_driving_cell') return XT.sdc.LIBCELLS.map((n) => ({ n, d: 'lib cell' }));
    return out;
  }

  // ---------- подсказки и решение ----------
  function showHint(next) {
    const q = st.cur;
    const hs = q.hints || [];
    const s = qs(q.id);
    if (next && (s.hints || 0) < hs.length) { s.hints = (s.hints || 0) + 1; save(); }
    const n = Math.min(s.hints || 0, hs.length);
    $('#hints').innerHTML = hs.slice(0, n).map((h, i) => `<div class="hint-box"><div class="hh">${L(`Подсказка ${i + 1}`, `Hint ${i + 1}`)}</div><div class="md">${XT.md.render(h)}</div></div>`).join('');
    const c = $('#hintCnt');
    if (c) c.textContent = `${n}/${hs.length}`;
    const b = $('#btnHint');
    if (b && n >= hs.length) b.disabled = true;
  }
  function askSolution() {
    const q = st.cur;
    const s = qs(q.id);
    if (s.solShown || s.status === 'solved') { renderSolution(true); return; }
    confirmInline(L('Показать эталон и разбор? Задача будет отмечена как просмотренная с решением (её можно решить позже).', 'Show the reference solution and the explanation? The task will be marked as viewed with the solution (you can still solve it later).'), L('Показать', 'Show'), () => {
      s.solShown = true;
      if (s.status !== 'solved') s.status = 'peeked';
      save();
      renderSolution(true);
      renderSidebar();
    });
  }
  function renderSolution(scroll) {
    const q = st.cur;
    const type = q.type || 'sdc';
    qs(q.id).solShown = true;
    st.analysisRef = true;
    let html = '';
    if (type === 'sdc') {
      const sols = q.solutions || [q.solution];
      sols.forEach((sol, k) => {
        html += `<div class="sol-box"><div class="h"><span>${sols.length > 1 ? L(`Эталон, вариант ${k + 1}`, `Reference solution, variant ${k + 1}`) : L('Эталонное решение', 'Reference solution')}</span><button class="btn" data-ins="${k}">${L('Вставить в редактор', 'Insert into editor')}</button></div><pre>${XT.md.hlTcl(dd(sol))}</pre></div>`;
      });
    } else if (type === 'choice') {
      markChoice(true);
    } else if (type === 'numeric') {
      markNumeric(true);
    }
    html += explainHtml(q);
    $('#solBox').innerHTML = html;
    $$('[data-ins]').forEach((b) => (b.onclick = () => {
      const sol = (q.solutions || [q.solution])[+b.dataset.ins];
      st.editor.value = dd(sol) + '\n';
      qs(q.id).code = st.editor.value; save();
      toast(L('Эталон вставлен в редактор', 'Reference solution inserted into the editor'));
    }));
    if (scroll) $('#solBox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------------------------------------------------------------------
  // Проверка
  // ---------------------------------------------------------------------------
  function markChoice(reveal) {
    const q = st.cur;
    const sel = $$('#choice input').filter((x) => x.checked).map((x) => +x.value);
    let ok = true;
    let missed = 0, wrongSel = 0;
    q.options.forEach((o, i) => {
      const lab = $(`.opt[data-i="${i}"]`);
      const chosen = sel.includes(i);
      if (!!o.ok !== chosen) { ok = false; if (chosen) wrongSel++; else missed++; }
      lab.classList.toggle('right', !!o.ok && (chosen || reveal));
      lab.classList.toggle('wrong', !o.ok && chosen);
      const why = $('.why', lab);
      if (o.why && (chosen || reveal)) { why.hidden = false; why.innerHTML = XT.md.inline(dd(o.why)); }
    });
    return { ok, sel, missed, wrongSel };
  }
  function parseNum(s) { const v = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return isNaN(v) ? null : v; }
  function markNumeric(reveal) {
    const q = st.cur;
    let ok = true;
    const vals = [];
    q.fields.forEach((f, i) => {
      const row = $(`.numf[data-i="${i}"]`);
      const inp = $('input', row);
      const v = parseNum(inp.value);
      vals.push(inp.value);
      const good = v !== null && Math.abs(v - f.answer) <= (f.tol !== undefined ? f.tol : 0.01);
      if (!good) ok = false;
      row.classList.toggle('right', good);
      row.classList.toggle('wrong', !good && inp.value.trim() !== '');
      if (reveal && !good) inp.placeholder = String(f.answer);
    });
    return { ok, vals };
  }
  function doCheck() {
    const q = st.cur;
    if (!q) return;
    const s = qs(q.id);
    const type = q.type || 'sdc';
    s.attempts = (s.attempts || 0) + 1;
    if (type === 'choice' || type === 'numeric') {
      const r = type === 'choice' ? markChoice(false) : markNumeric(false);
      if (type === 'choice') s.choice = r.sel; else s.nums = r.vals;
      if (r.ok) { s.status = 'solved'; s.solvedAt = s.solvedAt || Date.now(); }
      else if (s.status !== 'solved') s.status = s.solShown ? 'peeked' : 'tried';
      save();
      const body = $('#tabBody');
      const badMsg = type !== 'choice' ? L('Есть неверные значения', 'Some values are wrong')
        : r.wrongSel ? L('Есть неверно выбранные варианты – посмотрите пояснения к ним', 'Some selected options are wrong – see the explanations for them')
          : L('Выбраны не все верные варианты', 'Not all correct options are selected');
      body.innerHTML = verdictHtml(r.ok, r.ok ? L('Верно!', 'Correct!') : badMsg, '') +
        (r.ok ? explainHtml(q) : '');
      bindNext();
      renderSidebar();
      return;
    }
    const code = st.editor.value;
    let res;
    try { res = XT.checker.check(q, code); } catch (e) { console.error(e); toast(L('Внутренняя ошибка проверки: ', 'Internal checker error: ') + e.message, 5000); return; }
    st.lastCheck = res;
    st.selCheck = null;
    if (res.pass) { s.status = 'solved'; s.solvedAt = s.solvedAt || Date.now(); st.analysisRef = true; }
    else if (s.status !== 'solved') s.status = s.solShown ? 'peeked' : 'tried';
    save();
    const marks = res.user.S.messages.filter((m) => m.src === 'user').map((m) => ({ line: m.line, sev: m.sev === 'crit' ? 'error' : m.sev, text: m.text }));
    for (const f of res.findings) for (const ln of f.lines || []) if (f.sev === 'error' && f.cat !== 'syntax') marks.push({ line: ln, sev: 'error', text: f.title });
    st.editor.setMarkers(marks);
    st.tab = 'result';
    st.con = null;
    renderTabs();
    renderSidebar();
  }
  function verdictHtml(ok, title, sub) {
    return `<div class="verdict ${ok ? 'ok' : 'bad'}"><div class="vi">${ok ? '✓' : '✗'}</div><div><div class="vt">${esc(title)}</div>${sub ? `<div class="vs">${sub}</div>` : ''}</div>${ok ? `<button class="btn primary" id="btnNext">${L('Следующая задача →', 'Next task →')}</button>` : ''}</div>`;
  }
  function bindNext() { const b = $('#btnNext'); if (b) b.onclick = () => stepQ(1); }

  // ---------------------------------------------------------------------------
  // Вкладки
  // ---------------------------------------------------------------------------
  function renderTabs() {
    const q = st.cur;
    if (!q || (q.type || 'sdc') !== 'sdc') return;
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === st.tab));
    const badge = $('#badgeRes');
    if (st.lastCheck) {
      const ne = st.lastCheck.findings.filter((f) => f.sev === 'error').length;
      badge.hidden = false;
      badge.className = 'badge ' + (st.lastCheck.pass ? 'ok' : 'err');
      badge.textContent = st.lastCheck.pass ? '✓' : String(ne);
    } else badge.hidden = true;
    if (st.tab === 'result') renderResult();
    else if (st.tab === 'analysis') renderAnalysis();
    else if (st.tab === 'console') renderConsole();
    else if (st.tab === 'objects') renderObjects();
  }

  const SEV_ICON = { error: '!', warn: '!', info: 'i', ok: '✓' };
  const CAT_RU = { syntax: L('выполнение', 'execution'), clock: L('тактовые сигналы', 'clocks'), clockprop: L('распространение тактовых сигналов', 'clock propagation'), io: L('ввод/вывод', 'I/O'), path: L('пути', 'paths'), prop: L('свойства', 'properties'), misc: L('параметры', 'parameters'), rule: L('условие задачи', 'task requirements'), exc: L('исключения', 'timing exceptions') };
  function findingHtml(f) {
    const lines = (f.lines || []).filter(Boolean);
    const exp = f.expected ? (P.settings.showExpected
      ? `<span class="spoiler">${L('ожидается: ', 'expected: ')}<code>${esc(f.expected)}</code></span>`
      : `<details class="spoiler"><summary>${L('показать ожидаемое', 'show expected')}</summary><code>${esc(f.expected)}</code></details>`) : '';
    return `<div class="finding ${f.sev}"><div class="fi">${SEV_ICON[f.sev] || '•'}</div><div class="ft">${XT.md.nobr(esc(f.title))}</div>` +
      (f.detail ? `<div class="fd">${XT.md.inline(f.detail)}</div>` : '') +
      `<div class="fm"><span class="cat">${esc(CAT_RU[f.cat] || f.cat)}</span>${lines.map((l) => `<button class="linkbtn" data-line="${l}">${L(`строка ${l}`, `line ${l}`)}</button>`).join('')}${exp}</div></div>`;
  }
  function renderResult() {
    const body = $('#tabBody');
    const q = st.cur;
    const r = st.lastCheck;
    if (!r) {
      body.innerHTML = `<div class="empty">${L('Запишите ограничения и нажмите «Проверить» (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>).<br>ConstraintLab выполнит код как сценарий Tcl, построит модель тактовых сигналов и путей и сравнит итоговые требования с эталоном.', 'Write the constraints and press "Check" (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>).<br>ConstraintLab runs the code as a Tcl script, builds a model of clocks and timing paths and compares the resulting requirements with the reference solution.')}</div>`;
      return;
    }
    const errs = r.findings.filter((f) => f.sev === 'error'), warns = r.findings.filter((f) => f.sev === 'warn'), infos = r.findings.filter((f) => f.sev === 'info');
    let html = '';
    if (r.pass) {
      html += verdictHtml(true, L('Верно! Ограничения эквивалентны эталону', 'Correct! The constraints are equivalent to the reference solution'), warns.length ? L(`Есть ${warns.length} ${U.plural(warns.length, 'замечание', 'замечания', 'замечаний')} – они не влияют на результат, но с ними стоит ознакомиться.`, `${warns.length} ${plEn(warns.length, 'warning', 'warnings')}: no effect on the result, but worth reading.`) : '');
      html += `<ul class="ok-list">${r.ok.map((o) => `<li>${XT.md.nobr(esc(o))}</li>`).join('')}</ul>`;
    } else {
      html += verdictHtml(false, L(`Найдено ${U.plural(errs.length, 'ошибка', 'ошибки', 'ошибок').replace(/^/, errs.length + ' ')}`, `${errs.length} ${plEn(errs.length, 'error', 'errors')} found`), (r.meta && r.meta.suppressed) ? L(`Ещё ${r.meta.suppressed} расхождений в путях скрыто как следствие ошибок выше – исправьте их сначала.`, `${r.meta.suppressed} more path ${plEn(r.meta.suppressed, 'mismatch is', 'mismatches are')} hidden as consequences of the errors above – fix those first.`) : '');
    }
    html += errs.map(findingHtml).join('') + warns.map(findingHtml).join('');
    if (infos.length) html += `<details style="margin-top:6px"><summary style="cursor:pointer;color:var(--muted);font-size:13px">${L(`Ещё ${infos.length} ${U.plural(infos.length, 'информационное замечание', 'информационных замечания', 'информационных замечаний')}`, `${infos.length} more informational ${plEn(infos.length, 'note', 'notes')}`)}</summary>${infos.map(findingHtml).join('')}</details>`;
    if (r.pass && !qs(q.id).solShown) html += explainHtml(q);
    if (r.pass && (q.solutions || [q.solution]).length) html += `<details style="margin-top:10px"><summary style="cursor:pointer;color:var(--link);font-size:13px">${L('Сравнить с эталоном', 'Compare with the reference solution')}</summary>${(q.solutions || [q.solution]).map((s) => `<div class="sol-box" style="margin-top:8px"><pre>${XT.md.hlTcl(dd(s))}</pre></div>`).join('')}</details>`;
    body.innerHTML = html;
    $$('[data-line]', body).forEach((b) => (b.onclick = () => st.editor.gotoLine(+b.dataset.line)));
    bindNext();
  }

  // ---------- анализ путей ----------
  function currentAnalysis() {
    if (st.lastCheck && st.lastCheck.user.A && st._anaCode === undefined) return { A: st.lastCheck.user.A, S: st.lastCheck.user.S };
    const r = XT.checker.runSession(st.cur, st.editor.value);
    return { A: r.A, S: r.S };
  }
  function cellReq(t, async, ref) {
    if (!t.on) return `<td class="off">${esc(({ false: L('ложный путь', 'false path'), async: L('асинхронные', 'asynchronous'), exclusive: L('взаимоисключ.', 'exclusive'), datapath_only: L('отключено (-datapath_only)', 'disabled (-datapath_only)'), no_clock: L('нет тактового сигнала', 'no clock'), no_input_delay: L('нет входной задержки', 'no input delay'), no_output_delay: L('нет выходной задержки', 'no output delay'), partial_in: L('нет -max или -min', 'no -max or -min'), partial_out: L('нет -max или -min', 'no -max or -min'), io_no_clock: L('без -clock', 'no -clock') })[t.why] || t.why || '–')}</td>`;
    const src = ({ default: '', mcp: L(' многотакт.', ' multicycle'), mcp_setup: L(' многотакт.', ' multicycle'), max: ' max_delay', max_dp: ' max_delay dp', min: ' min_delay' })[t.src] || '';
    const bud = t.budget !== undefined && !U.approxEq(t.budget, t.req) ? ` / ${U.fmt(t.budget)}` : '';
    return `<td>${U.fmt(t.req)}${bud}<span class="exp">${esc(src)}</span></td>`;
  }
  function renderAnalysis() {
    const body = $('#tabBody');
    const q = st.cur;
    let A;
    try { A = (st.lastCheck && st.lastCheck.user.A) ? st.lastCheck.user.A : XT.checker.runSession(q, st.editor.value).A; } catch (e) { body.innerHTML = `<div class="empty">${L('Не удалось выполнить анализ: ', 'Analysis failed: ')}${esc(e.message)}</div>`; return; }
    if (!A) { body.innerHTML = `<div class="empty">${L('Анализ недоступен.', 'Analysis is not available.')}</div>`; return; }
    const canRef = st.analysisRef || qstat(q.id) === 'solved' || qs(q.id).solShown;
    const R = canRef && st.lastCheck ? st.lastCheck.ref.A : (canRef ? XT.checker.refRun(q, 0).A : null);
    let refIdx = null, equiv = null;
    if (R) {
      const M = XT.checker.matchClocks(A, R);
      equiv = XT.checker.makeEquiv(A, R, M);
      refIdx = new Map();
      for (const ch of R.checks) { const k = ch.path.key; if (!refIdx.has(k)) refIdx.set(k, []); refIdx.get(k).push(ch); }
    }
    const filt = (st.anaFilter || '').toLowerCase();
    const onlyBad = !!st.anaOnlyBad;
    const rows = [];
    A.checks.forEach((ch, i) => {
      if (filt && !(ch.path.startName + ' ' + ch.path.endName + ' ' + (ch.L.clock || '') + ' ' + (ch.C.clock || '')).toLowerCase().includes(filt)) return;
      let r = null;
      if (refIdx) r = (refIdx.get(ch.path.key) || []).find((x) => x.L.edge === ch.L.edge && x.C.edge === ch.C.edge && equiv(ch.L.clock, x.L.clock) && equiv(ch.C.clock, x.C.clock)) || null;
      const diff = (t) => r ? !(r[t].on === ch[t].on && (!r[t].on || (U.approxEq(r[t].req, ch[t].req, 0.0015) && U.approxEq(r[t].budget, ch[t].budget, 0.0015)))) : false;
      const bad = refIdx && (!r || diff('setup') || diff('hold'));
      if (onlyBad && !bad) return;
      rows.push({ ch, i, r, bad, ds: diff('setup'), dh: diff('hold') });
    });
    const ev = (e) => e.clock ? `${e.clock} ${e.edge === 'fall' ? '↓' : '↑'}` : '–';
    let html = `<div class="a-ctrl"><input id="anaFilter" placeholder="${L('Фильтр путей…', 'Filter paths…')}" value="${esc(st.anaFilter || '')}" style="height:30px;border-radius:7px;border:1px solid var(--border2);background:var(--panel);padding:0 8px;min-width:180px">
      ${R ? `<label><input type="checkbox" id="anaBad" ${onlyBad ? 'checked' : ''}> ${L('только расхождения с эталоном', 'only mismatches with the reference solution')}</label>` : `<span style="color:var(--muted)">${L('Сравнение с эталоном откроется после решения или просмотра решения.', 'Comparison with the reference solution becomes available after you solve the task or view the solution.')}</span>`}
      <span style="margin-left:auto;color:var(--muted)">${L(`${A.checks.length} ${U.plural(A.checks.length, 'проверка', 'проверки', 'проверок')}`, `${A.checks.length} ${plEn(A.checks.length, 'check', 'checks')}`)}${A.truncated ? L(' (список усечён)', ' (list truncated)') : ''}</span></div>`;
    if (!A.checks.length) html += `<div class="empty">${L('В проекте нет путей данных.', 'The design has no data paths.')}</div>`;
    else {
      html += `<div class="atable-wrap"><table class="atable"><thead><tr><th>${L('Путь', 'Path')}</th><th>${L('Запуск', 'Launch')}</th><th>${L('Захват', 'Capture')}</th><th title="${L('Требование к предустановке (setup) или восстановлению (recovery) / бюджет с учётом задержек ввода/вывода, нс', 'Setup (or recovery) requirement / budget including input/output delays, ns')}">${L('Предустановка, нс', 'Setup, ns')}</th><th title="${L('Требование к удержанию (hold) или снятию сброса (removal) / бюджет, нс', 'Hold (or removal) requirement / budget, ns')}">${L('Удержание, нс', 'Hold, ns')}</th></tr></thead><tbody>`;
      for (const x of rows.slice(0, 400)) {
        const ch = x.ch;
        const ref = x.r;
        const cS = cellReq(ch.setup).replace('<td', `<td${x.ds ? ' class="mis"' : ''}`);
        const cH = cellReq(ch.hold).replace('<td', `<td${x.dh ? ' class="mis"' : ''}`);
        const expS = x.ds && ref ? `<div class="exp">${L('эталон: ', 'reference: ')}${ref.setup.on ? U.fmt(ref.setup.req) + (ref.setup.budget !== undefined && !U.approxEq(ref.setup.budget, ref.setup.req) ? ' / ' + U.fmt(ref.setup.budget) : '') : L('не анализируется', 'not analyzed')}</div>` : '';
        const expH = x.dh && ref ? `<div class="exp">${L('эталон: ', 'reference: ')}${ref.hold.on ? U.fmt(ref.hold.req) + (ref.hold.budget !== undefined && !U.approxEq(ref.hold.budget, ref.hold.req) ? ' / ' + U.fmt(ref.hold.budget) : '') : L('не анализируется', 'not analyzed')}</div>` : '';
        html += `<tr data-i="${x.i}" class="${st.selCheck === x.i ? 'sel' : ''}"><td title="${esc(ch.path.key)}">${esc(ch.path.startName)} → ${esc(ch.path.endName)}${ch.async ? ` <span class="exp">${L('(асинхр. вход)', '(async input)')}</span>` : ''}${refIdx && !x.r ? ` <span class="exp" style="color:var(--err)">${L('нет в эталоне', 'not in the reference')}</span>` : ''}</td><td>${esc(ev(ch.L))}</td><td>${esc(ev(ch.C))}</td>${cS.replace('</td>', expS + '</td>')}${cH.replace('</td>', expH + '</td>')}</tr>`;
      }
      html += '</tbody></table></div>';
      if (rows.length > 400) html += `<div class="empty">${L(`Показано 400 из ${rows.length}. Уточните фильтр.`, `Showing 400 of ${rows.length}. Refine the filter.`)}</div>`;
    }
    html += '<div id="anaDiag"></div>';
    const cd = XT.wave.clocksDiagram(A.clocks.list);
    if (cd) html += `<details style="margin-top:10px" ${A.checks.length ? '' : 'open'}><summary style="cursor:pointer;font-size:13px;color:var(--link)">${L(`Формы ваших тактовых сигналов (${A.clocks.list.length})`, `Waveforms of your clocks (${A.clocks.list.length})`)}</summary><div class="a-diag">${cd.svg}</div></details>`;
    body.innerHTML = html;
    const fi = $('#anaFilter');
    fi.oninput = () => { st.anaFilter = fi.value; const p = fi.selectionStart; renderAnalysis(); const f2 = $('#anaFilter'); f2.focus(); f2.setSelectionRange(p, p); };
    const ob = $('#anaBad');
    if (ob) ob.onchange = () => { st.anaOnlyBad = ob.checked; renderAnalysis(); };
    $$('tr[data-i]', body).forEach((tr) => (tr.onclick = () => { st.selCheck = +tr.dataset.i; $$('tr.sel', body).forEach((x) => x.classList.remove('sel')); tr.classList.add('sel'); showCheckDiag(A, A.checks[st.selCheck]); }));
    if (st.selCheck !== null && A.checks[st.selCheck]) showCheckDiag(A, A.checks[st.selCheck]);
  }
  function showCheckDiag(A, ch) {
    const box = $('#anaDiag');
    let html = '<div class="a-diag">';
    const d = XT.wave.relDiagram(ch, A.clocks.clocks, { width: 600 });
    if (d) html += `<div class="cap">${L('Фронты запуска и захвата для выбранной проверки', 'Launch and capture edges for the selected check')}</div>${d.svg}`;
    else html += `<div class="cap">${L('Для неограниченного пути диаграмма не строится: нет тактового сигнала запуска или захвата.', 'No diagram for an unconstrained path: there is no launch or capture clock.')}</div>`;
    html += `<pre style="font-size:12px;margin:10px 0 0;white-space:pre-wrap;background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:8px">${esc(XT.reports.timingBlock(ch, 'setup') + '\n\n' + XT.reports.timingBlock(ch, 'hold'))}</pre></div>`;
    box.innerHTML = html;
  }

  // ---------- консоль ----------
  function conSession(reset) {
    if (st.con && !reset) return st.con;
    const q = st.cur;
    const D = XT.checker.buildDesign(q);
    const S = new XT.sdc.Session(D, { tool: q.tool || 'vivado' });
    const out = [];
    if (q.given) S.run(q.given, 'given');
    S.run(st.editor.value, 'user');
    if (q.after) S.run(q.after, 'after');
    const msgs = S.messages.filter((m) => m.sev !== 'info');
    out.push({ cls: 'c-info', t: L(`# Сессия: ${D.ports.size} ${U.plural(D.ports.size, 'порт', 'порта', 'портов')}, ${D.cells.size} ${U.plural(D.cells.size, 'ячейка', 'ячейки', 'ячеек')}; применены ограничения${q.given ? ' проекта и' : ''} из редактора. Тактовых сигналов: ${S.clocks().list.length}. Наберите help.`, `# Session: ${D.ports.size} ${plEn(D.ports.size, 'port', 'ports')}, ${D.cells.size} ${plEn(D.cells.size, 'cell', 'cells')}; constraints applied from ${q.given ? 'the project and ' : ''}the editor. Clocks: ${S.clocks().list.length}. Type help.`) });
    for (const m of msgs) out.push({ cls: m.sev === 'warn' ? 'c-warn' : 'c-err', t: `# [${m.src}:${m.line}] ${m.text}` });
    st.con = { S, out };
    return st.con;
  }
  function renderConsole() {
    const body = $('#tabBody');
    const c = conSession(false);
    body.innerHTML = `<div class="console"><div class="con-bar"><span>${L('Tcl-консоль: проект задачи и ваши ограничения', 'Tcl console: the task design and your constraints')}</span><button class="btn" id="conReset">${L('Перезапустить с кодом из редактора', 'Restart with the editor code')}</button><button class="btn" id="conClear">${L('Очистить', 'Clear')}</button>
      <span style="margin-left:auto">${L('Примеры: ', 'Examples: ')}<button class="linkbtn" data-ex="report_clocks">report_clocks</button>, <button class="linkbtn" data-ex="check_timing">check_timing</button>, <button class="linkbtn" data-ex="report_clock_interaction">report_clock_interaction</button>, <button class="linkbtn" data-ex="report_timing -delay_type min_max -max_paths 3">report_timing</button></span></div>
      <div class="con-out" id="conOut"></div><div class="con-in"><input id="conIn" placeholder="${L('Команда Tcl (↑/↓ – история)', 'Tcl command (↑/↓ – history)')}" autocomplete="off" spellcheck="false"><button class="btn primary" id="conRun">${L('Выполнить', 'Run')}</button></div></div>`;
    const outEl = $('#conOut');
    const draw = () => { outEl.innerHTML = c.out.map((o) => `<div class="${o.cls}">${esc(o.t)}</div>`).join(''); outEl.scrollTop = outEl.scrollHeight; };
    draw();
    const inp = $('#conIn');
    const run = (cmd) => {
      if (!cmd.trim()) return;
      st.conHist.push(cmd); st.conPos = st.conHist.length;
      c.out.push({ cls: 'c-cmd', t: '> ' + cmd });
      const I = c.S.I;
      I.out = [];
      const before = I.messages.length;
      try {
        const res = I.evalConsole(cmd);
        const txt = I.out.join('');
        if (txt) c.out.push({ cls: 'c-res', t: txt.replace(/\n$/, '') });
        const rs = XT.tcl.toStr(res);
        if (rs) c.out.push({ cls: 'c-res', t: rs });
      } catch (e) {
        const txt = I.out.join('');
        if (txt) c.out.push({ cls: 'c-res', t: txt.replace(/\n$/, '') });
        c.out.push({ cls: 'c-err', t: L('Ошибка: ', 'Error: ') + (e.message || String(e)) });
      }
      for (const m of I.messages.slice(before)) c.out.push({ cls: m.sev === 'info' ? 'c-info' : m.sev === 'warn' ? 'c-warn' : 'c-err', t: '# ' + m.text });
      draw();
    };
    $('#conRun').onclick = () => { run(inp.value); inp.value = ''; inp.focus(); };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { run(inp.value); inp.value = ''; }
      else if (e.key === 'ArrowUp') { if (st.conPos > 0) { st.conPos--; inp.value = st.conHist[st.conPos] || ''; } e.preventDefault(); }
      else if (e.key === 'ArrowDown') { if (st.conPos < st.conHist.length) { st.conPos++; inp.value = st.conHist[st.conPos] || ''; } e.preventDefault(); }
    });
    $('#conReset').onclick = () => { st.con = null; renderConsole(); };
    $('#conClear').onclick = () => { c.out = []; draw(); };
    $$('[data-ex]', body).forEach((b) => (b.onclick = () => run(b.dataset.ex)));
    if (window.innerWidth > 900) inp.focus();
  }

  // ---------- объекты ----------
  function renderObjects() {
    const body = $('#tabBody');
    const q = st.cur;
    const D = designForCompl();
    if (!D) { body.innerHTML = `<div class="empty">${L('В этой задаче нет проекта.', 'This task has no design.')}</div>`; return; }
    let clocks = [];
    try { clocks = XT.checker.runSession(q, st.editor.value).S.clocks().list; } catch (e) { clocks = []; }
    const item = (label, query, meta) => `<li><button data-q="${esc(query)}">${esc(label)}</button><span class="meta">${esc(meta || '')}</span></li>`;
    let html = `<div class="obj-note">${L('Щелчок вставляет запрос в редактор в позицию курсора. Шины свёрнуты в шаблоны [*].', 'Click to insert the query into the editor at the cursor. Buses are collapsed into [*] patterns.')}</div><div class="obj-tree">`;
    const pg = busGroups([...D.ports.values()]);
    html += `<details open><summary>${L(`Порты (${D.ports.size})`, `Ports (${D.ports.size})`)}</summary><ul>`;
    for (const [g, list] of pg) html += item(g, `[get_ports ${/[\[\]]/.test(g) ? '{' + g + '}' : g}]`, `${list[0].dir}${list.length > 1 ? ', ' + list.length + L(' бит', ' bits') : ''}`);
    html += '</ul></details>';
    const cg = busGroups([...D.cells.values()]);
    html += `<details open><summary>${L(`Ячейки (${D.cells.size})`, `Cells (${D.cells.size})`)}</summary><ul>`;
    for (const [g, list] of cg) {
      const pins = [...list[0].pins.values()].map((p) => p.pname).filter((pn) => !/^I\d+$/.test(pn) || pn === 'I0');
      html += item(g, `[get_cells ${/[\[\]]/.test(g) ? '{' + g + '}' : g}]`, `${list[0].ref}${list.length > 1 ? ' ×' + list.length : ''}`);
      html += `<li style="padding-left:14px;flex-wrap:wrap;gap:6px">${pins.slice(0, 12).map((pn) => { const pp = `${g}/${pn}`; return `<button data-q="${esc(`[get_pins ${/[\[\]]/.test(pp) ? '{' + pp + '}' : pp}]`)}" style="font-size:11.5px;color:var(--muted)">/${esc(pn)}</button>`; }).join(' ')}</li>`;
    }
    html += '</ul></details>';
    if (D.hier.size) {
      html += `<details><summary>${L(`Иерархия (${D.hier.size})`, `Hierarchy (${D.hier.size})`)}</summary><ul>`;
      for (const h of D.hier.values()) html += item(h.name, `[get_cells ${h.name}]`, L('иерархическая ячейка', 'hierarchical cell'));
      html += '</ul></details>';
    }
    html += `<details open><summary>${L(`Тактовые сигналы (${clocks.length}) с учётом ваших ограничений`, `Clocks (${clocks.length}) with your constraints applied`)}</summary><ul>`;
    for (const c of clocks) html += item(c.name, `[get_clocks ${c.name}]`, `${U.fmt(c.period)} ${L('нс', 'ns')}, ${({ primary: L('первичный', 'primary'), generated: L('производный', 'generated'), auto: L('выведен автоматически (MMCM/PLL)', 'auto-derived (MMCM/PLL)'), virtual: L('виртуальный', 'virtual') })[c.type]}`);
    if (!clocks.length) html += `<li><span class="meta">${L('тактовых сигналов пока нет', 'no clocks yet')}</span></li>`;
    html += '</ul></details></div>';
    body.innerHTML = html;
    $$('button[data-q]', body).forEach((b) => (b.onclick = () => { st.editor.insert(b.dataset.q); toast(L('Вставлено: ', 'Inserted: ') + b.dataset.q, 1500); }));
  }

  // ---------------------------------------------------------------------------
  // Справочник
  // ---------------------------------------------------------------------------
  function openRef(name) {
    const M = modal(L('Справочник XDC/SDC', 'XDC/SDC Reference'), '<div class="ref-layout"><div class="ref-nav" id="refNav"></div><div class="ref-body" id="refBody"></div></div>', { wide: true });
    M.body.style.padding = '0';
    const nav = $('#refNav'), bodyEl = $('#refBody');
    const draw = (filter) => {
      const f = (filter || '').toLowerCase();
      let h = `<input id="refSearch" placeholder="${L('Поиск команды или темы…', 'Search commands and topics…')}" value="${esc(filter || '')}">`;
      const arts = XT.refdocs.ARTICLES.filter((a) => !f || (a.title + a.body).toLowerCase().includes(f));
      if (arts.length) { h += `<div class="grp">${L('Статьи', 'Articles')}</div>`; for (const a of arts) h += `<button class="art" data-art="${a.id}">${esc(a.title)}</button>`; }
      const groups = new Map();
      for (const c of XT.refdocs.CMDS) {
        if (f && !(c.name + c.brief + c.desc).toLowerCase().includes(f)) continue;
        if (!groups.has(c.group)) groups.set(c.group, []);
        groups.get(c.group).push(c);
      }
      for (const [g, list] of groups) { h += `<div class="grp">${esc(g)}</div>`; for (const c of list) h += `<button data-cmd="${c.name}" title="${esc(c.brief)}">${esc(c.name)}</button>`; }
      nav.innerHTML = h;
      const si = $('#refSearch');
      si.oninput = () => { const p = si.selectionStart; draw(si.value); const s2 = $('#refSearch'); s2.focus(); s2.setSelectionRange(p, p); };
      $$('[data-cmd]', nav).forEach((b) => (b.onclick = () => showCmd(b.dataset.cmd)));
      $$('[data-art]', nav).forEach((b) => (b.onclick = () => showArt(b.dataset.art)));
    };
    const mark = (sel) => { $$('.ref-nav button', M.body).forEach((b) => b.classList.toggle('active', b.matches(sel))); };
    const showCmd = (n) => {
      const c = XT.refdocs.byName.get(n);
      if (!c) return;
      let h = `<div class="md"><h2 style="margin-top:0;font-family:var(--mono)">${esc(c.name)}</h2><p><b>${esc(c.brief)}</b> <span class="tag">${esc(c.tool)}</span></p></div><div class="syn">${esc(c.syn)}</div><div class="md">${XT.md.render(c.desc || '')}`;
      if (c.opts && c.opts.length) h += `<div class="tblwrap"><table class="opts"><thead><tr><th>${L('Опция', 'Option')}</th><th>${L('Смысл', 'Meaning')}</th></tr></thead><tbody>${c.opts.map(([o, d]) => `<tr><td>${esc(o)}</td><td>${XT.md.inline(d)}</td></tr>`).join('')}</tbody></table></div>`;
      if (c.ex) h += `<h3>${L('Примеры', 'Examples')}</h3><pre><code>${XT.md.hlTcl(c.ex)}</code></pre>`;
      if (c.notes) h += `<h3>${L('Важно', 'Important')}</h3>${XT.md.render(c.notes)}`;
      h += '</div>';
      bodyEl.innerHTML = h;
      bodyEl.scrollTop = 0;
      mark(`[data-cmd="${n}"]`);
    };
    const showArt = (id) => {
      const a = XT.refdocs.ARTICLES.find((x) => x.id === id);
      if (!a) return;
      bodyEl.innerHTML = `<div class="md"><h2 style="margin-top:0">${esc(a.title)}</h2>${XT.md.render(a.body)}</div>`;
      bodyEl.scrollTop = 0;
      mark(`[data-art="${id}"]`);
    };
    draw('');
    if (name && XT.refdocs.byName.has(name)) showCmd(name);
    else showArt(XT.refdocs.ARTICLES[0].id);
  }

  // ---------------------------------------------------------------------------
  // Режим автора
  // ---------------------------------------------------------------------------
  const AUTHOR_TEMPLATE = L(`XT.bank.add({
  id: 'my.example',
  module: 'my',
  title: 'Моя задача: тактовый сигнал 50 МГц',
  tool: 'vivado',          // 'vivado' или 'sdc'
  level: 1,                // 1..3
  tags: ['create_clock'],
  text: \`
    На порт \\\`clk50\\\` приходит тактовый сигнал **50 МГц**. Опишите его.
  \`,
  design: {
    elements: [
      { id: 'p',  t: 'in',   name: 'clk50', x: 20,  y: 40 },
      { id: 'ib', t: 'ibuf', name: 'clk50_IBUF_inst', x: 120, y: 37, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk50_BUFG_inst', x: 200, y: 37, noName: true },
      { id: 'r',  t: 'ff',   name: 'cnt_reg', w: 4, x: 300, y: 20 },
      { id: 'f',  t: 'boundary', label: 'ПЛИС' },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
    ],
  },
  figures: [
    { kind: 'timing', title: 'Тактовый сигнал', t: [0, 45], signals: [{ name: 'clk50', clock: { period: 20 }, arrows: 'rise' }] },
  ],
  solution: \`create_clock -name clk50 -period 20.000 [get_ports clk50]\`,
  hints: ['Период = 1000 / f[МГц].'],
  explain: \`Период 20 нс, форма по умолчанию {0 10}.\`,
  tests: [
    { code: 'create_clock -period 50 [get_ports clk50]', pass: false, note: 'частота вместо периода' },
  ],
});`, `XT.bank.add({
  id: 'my.example',
  module: 'my',
  title: 'My task: 50 MHz clock',
  tool: 'vivado',          // 'vivado' or 'sdc'
  level: 1,                // 1..3
  tags: ['create_clock'],
  text: \`
    A **50 MHz** clock arrives at port \\\`clk50\\\`. Define it.
  \`,
  design: {
    elements: [
      { id: 'p',  t: 'in',   name: 'clk50', x: 20,  y: 40 },
      { id: 'ib', t: 'ibuf', name: 'clk50_IBUF_inst', x: 120, y: 37, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk50_BUFG_inst', x: 200, y: 37, noName: true },
      { id: 'r',  t: 'ff',   name: 'cnt_reg', w: 4, x: 300, y: 20 },
      { id: 'f',  t: 'boundary', label: 'FPGA' },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
    ],
  },
  figures: [
    { kind: 'timing', title: 'Clock', t: [0, 45], signals: [{ name: 'clk50', clock: { period: 20 }, arrows: 'rise' }] },
  ],
  solution: \`create_clock -name clk50 -period 20.000 [get_ports clk50]\`,
  hints: ['Period = 1000 / f[MHz].'],
  explain: \`The period is 20 ns; the default waveform is {0 10}.\`,
  tests: [
    { code: 'create_clock -period 50 [get_ports clk50]', pass: false, note: 'frequency instead of period' },
  ],
});`);
  function openAuthor() {
    const draft = P.settings.authorDraft || AUTHOR_TEMPLATE;
    const M = modal(L('Режим автора: новая задача', 'Author mode: new task'), `<div class="author-layout"><textarea id="auSrc" spellcheck="false">${esc(draft)}</textarea><div class="author-out" id="auOut"><div class="md">${XT.md.render(L(`
**Как добавить задачу в банк**

1. Опишите вопрос объектом JS, как в шаблоне (формат – в README.md, раздел «Формат вопроса»).
2. «Проверить» – ConstraintLab построит проект, отрисует рисунки, прогонит эталон и тесты.
3. «Открыть» – посмотреть задачу в интерфейсе.
4. «Сохранить в мой банк» – задача сохранится в браузере. «Скачать .js» – файл можно положить в папку \`bank/\` и добавить в \`bank/index.js\`.`, `
**How to add a task to the bank**

1. Describe the question as a JS object, as in the template (the format is described in README.md, section "Adding tasks").
2. "Check" – ConstraintLab builds the design, renders the figures, runs the reference solution and the tests.
3. "Open" – view the task in the interface.
4. "Save to my bank" – the task is saved in this browser. "Download .js" – put the file into the \`bank/\` folder and add it to \`bank/index.js\`.`))}</div></div></div>`, {
      wide: true, head: `<button class="btn" id="auCheck">${L('Проверить', 'Check')}</button><button class="btn" id="auOpen">${L('Открыть', 'Open')}</button><button class="btn" id="auSave">${L('Сохранить в мой банк', 'Save to my bank')}</button><button class="btn" id="auDl">${L('Скачать .js', 'Download .js')}</button><button class="btn" id="auAll">${L('Проверить весь банк', 'Check the whole bank')}</button><button class="btn ghost" id="auTpl">${L('Шаблон', 'Template')}</button>`,
    });
    const src = $('#auSrc'), out = $('#auOut');
    src.addEventListener('input', () => { P.settings.authorDraft = src.value; saveSoon(); });
    const evalDraft = () => {
      const got = [];
      const fake = { bank: { add: (q) => got.push(...[].concat(q)), module: (m) => XT.bank.module(m) } };
      (new Function('XT', src.value))(Object.assign({}, XT, fake));
      return got;
    };
    const report = (qsList) => {
      let h = '';
      for (const q of qsList) {
        const probs = XT.validateQuestion(q, { quiet: false });
        const e = probs.filter((p) => p.sev === 'error');
        h += `<div class="finding ${e.length ? 'error' : 'ok'}"><div class="fi">${e.length ? '!' : '✓'}</div><div class="ft">${esc(q.id)}: ${e.length ? e.length + ' ' + L(U.plural(e.length, 'ошибка', 'ошибки', 'ошибок'), plEn(e.length, 'error', 'errors')) : L('всё в порядке', 'no problems')}</div><div class="fd">${probs.map((p) => `${p.sev === 'error' ? '✗' : '⚠'} ${esc(p.text)}`).join('<br>')}</div></div>`;
      }
      return h;
    };
    $('#auCheck', M.card).onclick = () => {
      try { const list = evalDraft(); XT.checker.clearCache(); out.innerHTML = report(list.map((q) => Object.assign({ tool: 'vivado', type: 'sdc', level: 1, tags: [], hints: [] }, q))) || `<div class="empty">${L('В коде нет вызова XT.bank.add', 'The code has no XT.bank.add call')}</div>`; }
      catch (e) { out.innerHTML = `<div class="finding error"><div class="fi">!</div><div class="ft">${L('Ошибка в коде задачи', 'Error in the task code')}</div><div class="fd">${esc(e.message)}</div></div>`; }
    };
    $('#auOpen', M.card).onclick = () => {
      try { const list = evalDraft(); XT.checker.clearCache(); list.forEach((q) => XT.bank.add(q)); M.close(); renderSidebar(); if (list[0]) openQ(list[0].id); }
      catch (e) { out.innerHTML = `<div class="finding error"><div class="fi">!</div><div class="ft">${L('Ошибка', 'Error')}</div><div class="fd">${esc(e.message)}</div></div>`; }
    };
    $('#auSave', M.card).onclick = () => {
      try {
        const list = evalDraft();
        const packs = loadJSON(PACKS, []);
        const name = 'author-' + (list[0] ? list[0].id : Date.now());
        const k = packs.findIndex((p) => p.name === name);
        const pack = { name, kind: 'js', text: src.value };
        if (k >= 0) packs[k] = pack; else packs.push(pack);
        if (!saveJSON(PACKS, packs)) throw new Error(L('не удалось сохранить в localStorage', 'could not save to localStorage'));
        list.forEach((q) => XT.bank.add(q));
        renderSidebar();
        toast(L('Сохранено в «мой банк» (в этом браузере)', 'Saved to "my bank" (in this browser)'));
      } catch (e) { out.innerHTML = `<div class="finding error"><div class="fi">!</div><div class="ft">${L('Ошибка', 'Error')}</div><div class="fd">${esc(e.message)}</div></div>`; }
    };
    $('#auDl', M.card).onclick = () => download('my_questions.js', L('/* Задачи для ConstraintLab */\n', '/* Tasks for ConstraintLab */\n') + src.value + '\n', 'text/javascript;charset=utf-8');
    $('#auTpl', M.card).onclick = () => { src.value = AUTHOR_TEMPLATE; P.settings.authorDraft = src.value; saveSoon(); };
    $('#auAll', M.card).onclick = () => {
      out.innerHTML = `<div class="empty">${L('Проверяю весь банк…', 'Checking the whole bank…')}</div>`;
      setTimeout(() => {
        XT.checker.clearCache();
        let bad = 0;
        let h = '';
        for (const q of flatList()) {
          const probs = XT.validateQuestion(q, { quiet: true }).filter((p) => p.sev === 'error');
          if (probs.length) { bad++; h += `<div class="finding error"><div class="fi">!</div><div class="ft">${esc(q.id)}</div><div class="fd">${probs.map((p) => esc(p.text)).join('<br>')}</div></div>`; }
        }
        out.innerHTML = `<div class="verdict ${bad ? 'bad' : 'ok'}"><div class="vi">${bad ? '!' : '✓'}</div><div><div class="vt">${bad ? L(`Проблемы в ${bad} ${U.plural(bad, 'задаче', 'задачах', 'задачах')}`, `Problems in ${bad} ${plEn(bad, 'task', 'tasks')}`) : L('Все задачи банка проходят проверку', 'All tasks in the bank pass the check')}</div><div class="vs">${L(`Проверено: ${flatList().length}`, `Checked: ${flatList().length}`)}</div></div></div>` + h;
      }, 30);
    };
  }

  // ---------------------------------------------------------------------------
  // Меню
  // ---------------------------------------------------------------------------
  function menuAction(a) {
    $('#moreMenu').hidden = true;
    if (a === 'author') openAuthor();
    else if (a === 'export') download(`xdc-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(P, null, 1), 'application/json');
    else if (a === 'import') pickFile('.json').then((f) => {
      if (!f) return;
      try { const o = JSON.parse(f.text); if (!o.q) throw new Error(L('это не файл прогресса', 'this is not a progress file')); P = o; P.settings = P.settings || {}; save(); applyTheme(); renderSidebar(); if (st.cur) openQ(st.cur.id); toast(L('Прогресс загружен', 'Progress loaded')); }
      catch (e) { toast(L('Ошибка импорта: ', 'Import error: ') + e.message, 4000); }
    });
    else if (a === 'pack') pickFile('.js,.json').then((f) => {
      if (!f) return;
      const pack = { name: f.name, kind: /\.json$/i.test(f.name) ? 'json' : 'js', text: f.text };
      try {
        const before = XT.bank.list.length;
        XT.bank.source = 'pack:' + f.name;
        evalPack(pack);
        XT.bank.source = 'user';
        const packs = loadJSON(PACKS, []).filter((p) => p.name !== f.name);
        packs.push(pack);
        saveJSON(PACKS, packs);
        renderSidebar();
        toast(L(`Пакет «${f.name}» загружен: задач стало ${XT.bank.list.length} (+${XT.bank.list.length - before})`, `Pack "${f.name}" loaded: now ${XT.bank.list.length} tasks (+${XT.bank.list.length - before})`), 3500);
      } catch (e) { toast(L('Ошибка в пакете: ', 'Error in the pack: ') + e.message, 5000); }
    });
    else if (a === 'packs') {
      const packs = loadJSON(PACKS, []);
      const M = modal(L('Мои пакеты задач', 'My task packs'), packs.length ? `<div class="obj-tree"><ul>${packs.map((p, i) => `<li><b>${esc(p.name)}</b> <span class="meta">${p.kind}, ${L(`${p.text.length} символов`, `${p.text.length} characters`)}</span> <button data-del="${i}">${L('удалить', 'delete')}</button></li>`).join('')}</ul></div><p class="obj-note">${L('Пакеты хранятся в этом браузере. После удаления перезагрузите страницу.', 'Packs are stored in this browser. Reload the page after deleting.')}</p>` : `<div class="empty">${L('Импортированных пакетов нет.', 'No imported packs.')}</div>`);
      $$('[data-del]', M.body).forEach((b) => (b.onclick = () => { const ps = loadJSON(PACKS, []); ps.splice(+b.dataset.del, 1); saveJSON(PACKS, ps); M.close(); toast(L('Пакет удалён – перезагрузите страницу', 'Pack deleted – reload the page')); }));
    } else if (a === 'expected') {
      P.settings.showExpected = !P.settings.showExpected; save();
      toast(P.settings.showExpected ? L('Ожидаемые значения показываются сразу', 'Expected values are shown right away') : L('Ожидаемые значения скрыты под спойлер', 'Expected values are hidden behind a spoiler'));
      if (st.tab === 'result') renderTabs();
    } else if (a === 'font+' || a === 'font-') {
      const v = Math.max(11, Math.min(20, (P.settings.edFont || 13.5) + (a === 'font+' ? 1 : -1)));
      P.settings.edFont = v; save(); applyTheme();
      if (st.editor) st.editor.refresh();
    } else if (a === 'reset') {
      const M = modal(L('Сбросить прогресс?', 'Reset progress?'), `<p>${L('Будут удалены отметки о решении, ваш код и подсказки по всем задачам (настройки останутся).', 'This deletes the solved marks, your code and the hints for all tasks (settings are kept).')}</p><p><button class="btn primary" id="rsYes">${L('Сбросить', 'Reset')}</button> <button class="btn" data-close>${L('Отмена', 'Cancel')}</button></p>`);
      $('#rsYes', M.body).onclick = () => { P.q = {}; save(); M.close(); renderSidebar(); if (st.cur) openQ(st.cur.id); toast(L('Прогресс сброшен', 'Progress reset')); };
    } else if (a === 'about') {
      const au = XT.AUTHOR || {};
      if (XT.lang === 'en') {
        modal('About', `<div class="md">${XT.md.render(`
**ConstraintLab** is a standalone practice environment for timing and physical design constraints: Vivado XDC and SDC for ASIC tools.

- Runs in any modern browser (Windows, Linux, macOS) with no installation and no Internet connection.
- Inside: a Tcl subset interpreter, a netlist model, a simplified static timing analyzer (clocks and their propagation, launch and capture edge relationships for setup and hold checks, timing exceptions and their priorities), schematic and timing diagram rendering.
- ConstraintLab analyzes **ideal** clocks: it checks the meaning of your constraints (which requirements follow from them), not the delays of a particular implementation. For sign-off use Vivado or PrimeTime: \`report_timing_summary\`, \`check_timing\`, \`report_exceptions\`.
- Progress is stored in this browser (localStorage); you can save it to a file.

**Author:** ${au.en} ([${(au.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}](${au.url})). **License:** MIT.

Version ${XT.VERSION || '1.0'}.`)}</div>`);
        return;
      }
      modal('О программе', `<div class="md">${XT.md.render(`
**ConstraintLab** – автономная программа для отработки временных и физических проектных ограничений: XDC для Vivado и SDC для САПР ASIC.

- Работает в любом современном браузере (Windows, Linux, macOS) без установки и без подключения к интернету.
- Состав: интерпретатор подмножества Tcl, модель списка соединений (нетлиста), упрощённый статический временной анализ (тактовые сигналы, их распространение, соотношения фронтов для проверок предустановки и удержания, исключения и их приоритеты), построение схем и временных диаграмм.
- ConstraintLab анализирует **идеальные** тактовые сигналы: он проверяет смысл ограничений (какие требования из них следуют), а не задержки конкретной трассировки. Для окончательной проверки используйте Vivado или PrimeTime: \`report_timing_summary\`, \`check_timing\`, \`report_exceptions\`.
- Прогресс хранится в этом браузере (localStorage); его можно сохранить в файл.

**Автор:** ${au.ru} ([${(au.url || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}](${au.url})). **Лицензия:** MIT.

Версия ${XT.VERSION || '1.0'}.`)}</div>`);
    }
  }

  // ---------------------------------------------------------------------------
  // Старт
  // ---------------------------------------------------------------------------
  // английские тексты статической разметки index.html (русские остаются в самой разметке)
  const STATIC_EN = [
    ['#btnMenu', 'title', 'Task list'], ['#btnMenu', 'aria-label', 'Task list'],
    ['#btnHome', 'title', 'Home'],
    ['#brandSub', null, 'XDC and SDC constraints practice'],
    ['#btnRef', 'title', 'Command reference and articles'], ['#btnRef .lbl', null, 'Reference'],
    ['#btnLang', 'aria-label', 'Language'],
    ['#btnLayout', 'aria-label', 'Solution panel position'],
    ['#btnTheme', 'aria-label', 'Switch theme'],
    ['#btnMore', 'aria-label', 'Menu'],
    ['#moreMenu [data-a="author"]', null, '✎ Author mode: add a task'],
    ['#moreMenu [data-a="pack"]', null, '⤓ Import a task pack (.js/.json)'],
    ['#moreMenu [data-a="packs"]', null, '☰ My task packs'],
    ['#moreMenu [data-a="export"]', null, '⇩ Save progress to a file'],
    ['#moreMenu [data-a="import"]', null, '⇧ Load progress from a file'],
    ['#moreMenu [data-a="expected"]', null, '◑ Show expected values right away (on/off)'],
    ['#moreMenu [data-a="font+"]', null, 'A+ Larger editor font'],
    ['#moreMenu [data-a="font-"]', null, 'A− Smaller editor font'],
    ['#moreMenu [data-a="reset"]', null, '⟲ Reset progress…'],
    ['#moreMenu [data-a="about"]', null, 'ⓘ About'],
    ['#sidebar', 'aria-label', 'Tasks'],
    ['#search', 'placeholder', 'Search tasks…'], ['#search', 'aria-label', 'Search tasks'],
    ['#filterTool', 'aria-label', 'Filter by syntax'], ['#filterTool', 'title', 'Filter by solution syntax'],
    ['#filterTool option[value="all"]', null, 'All'],
    ['#filterTool option[value="xdc"]', null, 'XDC (Vivado)'],
    ['#filterTool option[value="sdc"]', null, 'SDC (ASIC)'],
    ['#filterTool option[value="both"]', null, 'Common to XDC and SDC'],
    ['#filterTool option[value="xdc-only"]', null, 'XDC only'],
    ['#filterTool option[value="sdc-only"]', null, 'SDC only'],
    ['#btnFold', 'title', 'Collapse all topics'], ['#btnFold', 'aria-label', 'Collapse all topics'],
    ['#taskPane .empty', null, 'Loading…'],
    ['#splitter', 'title', 'Drag to change the panel width'],
    ['meta[name="description"]', 'content', 'ConstraintLab – interactive practice for timing and physical design constraints: XDC (Vivado) and SDC (ASIC tools), checked by meaning'],
  ];
  function applyStaticLang() {
    if (XT.lang !== 'en') return;
    for (const [sel, attr, text] of STATIC_EN) {
      const el = $(sel);
      if (!el) continue;
      if (attr) el.setAttribute(attr, text); else el.textContent = text;
    }
  }
  function route() {
    const m = /#q=([^&]+)/.exec(location.hash);
    if (m) { const id = decodeURIComponent(m[1]); if (XT.bank.byId.has(id)) { openQ(id, { noFocus: true }); return true; } }
    return false;
  }
  async function init() {
    applyStaticLang();
    applyTheme();
    const failed = await loadBank();
    $('#search').addEventListener('input', renderSidebar);
    $('#filterTool').addEventListener('change', renderSidebar);
    $('#btnFold').onclick = () => {
      P.settings.closedMods = allModsClosed() ? [] : XT.bank.ordered().map((x) => x.m.id);
      saveSoon(); renderSidebar();
    };
    // кнопка языка показывает язык, на который переключит; смена языка перезагружает страницу
    const lb = $('#btnLang');
    lb.textContent = XT.lang === 'en' ? 'RU' : 'EN';
    lb.title = XT.lang === 'en' ? 'Переключить на русский язык' : 'Switch to English';
    lb.onclick = () => {
      P.settings.lang = XT.lang === 'en' ? 'ru' : 'en';
      save();
      // язык выбирается до загрузки сценариев, поэтому нужна перезагрузка; переход на тот же адрес
      // с #q=… браузер считает переходом к якорю и страницу не перезагружает
      if (!st.cur) try { sessionStorage.setItem('xdct.home', '1'); } catch (e) {} // остаться на стартовом экране
      const u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); location.replace(u.toString()); } else location.reload();
    };
    $('#btnLayout').onclick = () => {
      P.settings.layout = P.settings.layout === 'bottom' ? 'side' : 'bottom';
      save(); applyLayout();
      toast(P.settings.layout === 'bottom' ? L('Панель решения – под заданием', 'Solution panel: below the task') : L('Панель решения – справа', 'Solution panel: on the right'), 1400);
    };
    $('#qlist').addEventListener('click', (e) => {
      const it = e.target.closest('.q-item');
      if (it) { openQ(it.dataset.q); return; }
      const mh = e.target.closest('.mod-h');
      if (mh) {
        const mod = mh.parentElement;
        mod.classList.toggle('closed');
        const set = new Set(P.settings.closedMods || []);
        if (mod.classList.contains('closed')) set.add(mod.dataset.mod); else set.delete(mod.dataset.mod);
        P.settings.closedMods = [...set]; saveSoon();
        updateFoldBtn();
      }
    });
    $('#btnTheme').onclick = () => {
      const order = ['auto', 'dark', 'light'];
      P.settings.theme = order[(order.indexOf(P.settings.theme || 'auto') + 1) % 3];
      save(); applyTheme();
      toast(L('Тема: ', 'Theme: ') + ({ auto: L('как в системе', 'system default'), dark: L('тёмная', 'dark'), light: L('светлая', 'light') })[P.settings.theme], 1400);
    };
    $('#btnRef').onclick = () => openRef();
    $('#btnMenu').onclick = () => $('#sidebar').classList.toggle('open');
    $('#btnHome').onclick = () => { history.replaceState(null, '', '#'); welcome(); };
    $('#btnMore').onclick = (e) => { e.stopPropagation(); $('#moreMenu').hidden = !$('#moreMenu').hidden; };
    document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) $('#moreMenu').hidden = true; });
    $$('#moreMenu [data-a]').forEach((b) => (b.onclick = () => menuAction(b.dataset.a)));
    window.addEventListener('hashchange', () => { if (!route()) { /* оставить как есть */ } });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && st.cur && (st.cur.type === 'choice' || st.cur.type === 'numeric')) { e.preventDefault(); doCheck(); }
      if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && st.cur && !e.target.closest('textarea,input')) { e.preventDefault(); stepQ(e.key === 'ArrowRight' ? 1 : -1); }
    });
    initSplit();
    applyLayout();
    renderSidebar();
    let home = false;
    try { home = sessionStorage.getItem('xdct.home') === '1'; sessionStorage.removeItem('xdct.home'); } catch (e) {}
    if (!route()) {
      if (!home && P.settings.lastQ && XT.bank.byId.has(P.settings.lastQ)) openQ(P.settings.lastQ, { noFocus: true });
      else welcome();
    }
    if (failed.length) toast(L('Не загрузились файлы банка: ', 'Failed to load bank files: ') + failed.join(', ') + L(' (см. bank/index.js)', ' (see bank/index.js)'), 6000);
    document.body.classList.add('ready');
  }
  XT.app = { openQ, renderSidebar, P: () => P };
  document.addEventListener('DOMContentLoaded', init);
})(window.XT = window.XT || {});
