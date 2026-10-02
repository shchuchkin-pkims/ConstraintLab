/* ConstraintLab – редактор кода: подсветка, номера строк, маркеры ошибок, автодополнение, подсказка синтаксиса */
(function (XT) {
  'use strict';
  const esc = XT.util.escapeHtml;

  class Editor {
    constructor(host, opts) {
      this.opts = opts || {};
      host.innerHTML = '<div class="ed"><div class="ed-gutter" aria-hidden="true"></div><div class="ed-main"><pre class="ed-hl" aria-hidden="true"></pre>' +
        '<textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="' + XT.L('Редактор ограничений', 'Constraint editor') + '"></textarea></div><div class="ed-ac" hidden></div></div>';
      this.root = host.firstChild;
      this.gutter = this.root.querySelector('.ed-gutter');
      this.hl = this.root.querySelector('.ed-hl');
      this.ta = this.root.querySelector('.ed-ta');
      this.ac = this.root.querySelector('.ed-ac');
      this.markers = new Map();
      this.acItems = [];
      this.acSel = 0;
      this.charW = 0;
      this.ta.addEventListener('input', () => { this.markers.clear(); this.refresh(); this.onChange(); this.autoAC(); });
      this.ta.addEventListener('scroll', () => this.syncScroll());
      this.ta.addEventListener('keydown', (e) => this.onKey(e));
      this.ta.addEventListener('keyup', (e) => { if (!['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) this.updateSig(); });
      this.ta.addEventListener('click', () => { this.hideAC(); this.updateSig(); });
      this.ta.addEventListener('blur', () => setTimeout(() => this.hideAC(), 150));
      this.ac.addEventListener('mousedown', (e) => {
        const d = e.target.closest('div[data-i]');
        if (!d) return;
        e.preventDefault();
        this.acSel = +d.dataset.i;
        this.acceptAC();
      });
      this.refresh();
    }
    get value() { return this.ta.value; }
    set value(v) { this.ta.value = v || ''; this.markers.clear(); this.refresh(); this.ta.scrollTop = 0; this.ta.scrollLeft = 0; }
    focus() { this.ta.focus(); }
    onChange() { if (this.opts.onChange) this.opts.onChange(this.ta.value); }
    setMarkers(list) {
      this.markers.clear();
      const rank = { error: 3, warn: 2, info: 1 };
      for (const m of list || []) {
        if (!m.line) continue;
        const prev = this.markers.get(m.line);
        if (!prev || rank[m.sev] > rank[prev.sev]) this.markers.set(m.line, { sev: m.sev, text: m.text });
        else if (prev) prev.text += '\n' + m.text;
      }
      this.refresh();
    }
    refresh() {
      const v = this.ta.value;
      const mk = this.markers;
      this.hl.innerHTML = XT.md.hlTcl(v, (ln) => { const m = mk.get(ln); return m ? (m.sev === 'error' ? 'ln-error' : m.sev === 'warn' ? 'ln-warn' : '') : ''; }) + '\n ';
      const n = v.split('\n').length;
      let g = '';
      for (let i = 1; i <= n; i++) {
        const m = mk.get(i);
        g += m ? `<div class="m-${m.sev}" title="${esc(m.text)}">${i}</div>` : `<div>${i}</div>`;
      }
      this.gutter.innerHTML = g;
      this.syncScroll();
    }
    syncScroll() {
      this.hl.scrollTop = this.ta.scrollTop;
      this.hl.scrollLeft = this.ta.scrollLeft;
      this.gutter.scrollTop = this.ta.scrollTop;
    }
    gotoLine(n) {
      const lines = this.ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(n - 1, lines.length); i++) pos += lines[i].length + 1;
      this.ta.focus();
      this.ta.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
      const lh = parseFloat(getComputedStyle(this.ta).lineHeight) || 20;
      this.ta.scrollTop = Math.max(0, (n - 4) * lh);
      this.syncScroll();
    }
    insert(text) {
      const ta = this.ta;
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(text, s, e, 'end');
      ta.focus();
      this.refresh();
      this.onChange();
    }
    lineInfo() {
      const v = this.ta.value, pos = this.ta.selectionStart;
      const ls = v.lastIndexOf('\n', pos - 1) + 1;
      let le = v.indexOf('\n', pos); if (le < 0) le = v.length;
      return { v, pos, ls, le, line: v.slice(ls, le), col: pos - ls, before: v.slice(ls, pos), lineNo: v.slice(0, ls).split('\n').length };
    }
    onKey(e) {
      const ta = this.ta;
      if (!this.ac.hidden) {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.acSel = (this.acSel + 1) % this.acItems.length; this.drawAC(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); this.acSel = (this.acSel - 1 + this.acItems.length) % this.acItems.length; this.drawAC(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.acceptAC(); return; }
        if (e.key === 'Escape') { e.preventDefault(); this.hideAC(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (this.opts.onRun) this.opts.onRun(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === ' ' || e.code === 'Space')) { e.preventDefault(); this.showAC(true); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash')) { e.preventDefault(); this.toggleComment(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart, en = ta.selectionEnd;
        if (s === en && !e.shiftKey) { ta.setRangeText('    ', s, en, 'end'); }
        else {
          const v = ta.value, ls = v.lastIndexOf('\n', s - 1) + 1;
          const block = v.slice(ls, en);
          const nb = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
          ta.setRangeText(nb, ls, en, 'select');
        }
        this.refresh(); this.onChange();
        return;
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const li = this.lineInfo();
        let ind = /^\s*/.exec(li.line)[0];
        if (/\{\s*$/.test(li.before) || /\\\s*$/.test(li.before)) ind += '    ';
        e.preventDefault();
        ta.setRangeText('\n' + ind, ta.selectionStart, ta.selectionEnd, 'end');
        this.refresh(); this.onChange();
        return;
      }
      if (e.key === 'Escape') this.hideAC();
    }
    toggleComment() {
      const ta = this.ta, v = ta.value;
      const s = ta.selectionStart, en = ta.selectionEnd;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      let le = v.indexOf('\n', en); if (le < 0) le = v.length;
      const block = v.slice(ls, le);
      const all = block.split('\n').every((l) => /^\s*#/.test(l) || !l.trim());
      const nb = all ? block.replace(/^(\s*)# ?/gm, '$1') : block.replace(/^/gm, '# ');
      ta.setRangeText(nb, ls, le, 'select');
      this.refresh(); this.onChange();
    }

    // ---------- подсказка синтаксиса ----------
    currentCommand() {
      const li = this.lineInfo();
      const before = li.before;
      // ищем ближайшую незакрытую [ или начало строки
      let depth = 0, start = 0;
      for (let i = before.length - 1; i >= 0; i--) {
        const c = before[i];
        if (c === ']') depth++;
        else if (c === '[') { if (depth === 0) { start = i + 1; break; } depth--; }
      }
      const seg = before.slice(start).replace(/^\s+/, '');
      const m = /^([A-Za-z_][\w:]*)/.exec(seg);
      let cmd = m ? m[1] : null;
      if (!cmd || !before.slice(start).trim()) {
        // продолжение многострочной команды
        const lines = li.v.slice(0, li.ls).split('\n');
        for (let k = lines.length - 2; k >= 0 && k >= lines.length - 6; k--) {
          if (!/\\\s*$/.test(lines[k])) break;
          const mm = /^\s*([A-Za-z_][\w:]*)/.exec(lines[k]);
          if (mm) cmd = mm[1];
        }
      }
      return { cmd, seg, before, start };
    }
    updateSig() {
      if (!this.opts.onSig) return;
      const { cmd } = this.currentCommand();
      this.opts.onSig(cmd);
    }

    // ---------- автодополнение ----------
    autoAC() {
      const li = this.lineInfo();
      const m = /[\w\-.:\[\]*\/]+$/.exec(li.before);
      const w = m ? m[0] : '';
      if (w.length >= 2 || (w.startsWith('-') && w.length >= 1)) this.showAC(false);
      else this.hideAC();
    }
    showAC(force) {
      const li = this.lineInfo();
      const { cmd, seg } = this.currentCommand();
      const m = /[\w\-.:\[\]*\/]+$/.exec(li.before);
      const word = m ? m[0] : '';
      const wordStart = li.pos - word.length;
      const prefixLine = li.before.slice(0, li.before.length - word.length);
      let items = [];
      const lw = word.toLowerCase();
      const atCmd = /(^\s*$)|(\[\s*$)|(;\s*$)|(\{\s*$)/.test(prefixLine);
      const src = this.opts.complete ? this.opts.complete({ word, cmd, atCmd, seg, prefixLine }) : [];
      for (const it of src) {
        if (!word || it.n.toLowerCase().startsWith(lw) || (it.contains && it.n.toLowerCase().includes(lw))) items.push(it);
      }
      items = items.slice(0, 60);
      if (!items.length || (!force && items.length === 1 && items[0].n === word)) { this.hideAC(); return; }
      this.acItems = items;
      this.acSel = 0;
      this.acWordStart = wordStart;
      this.drawAC();
      this.positionAC(li);
    }
    drawAC() {
      this.ac.innerHTML = this.acItems.map((it, i) => `<div data-i="${i}" class="${i === this.acSel ? 'sel' : ''}"><span class="n">${esc(it.n)}</span><span class="d">${esc(it.d || '')}</span></div>`).join('');
      this.ac.hidden = false;
      const sel = this.ac.querySelector('.sel');
      if (sel) sel.scrollIntoView({ block: 'nearest' });
    }
    positionAC(li) {
      if (!this.charW) {
        const s = document.createElement('span');
        s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:' + getComputedStyle(this.ta).font;
        s.textContent = 'MMMMMMMMMM';
        document.body.appendChild(s);
        this.charW = s.getBoundingClientRect().width / 10;
        s.remove();
      }
      const cs = getComputedStyle(this.ta);
      const lh = parseFloat(cs.lineHeight) || 20;
      const padL = parseFloat(cs.paddingLeft) || 12, padT = parseFloat(cs.paddingTop) || 10;
      const col = this.acWordStart - li.ls;
      const x = this.gutter.offsetWidth + padL + col * this.charW - this.ta.scrollLeft;
      const y = padT + li.lineNo * lh - this.ta.scrollTop + 2;
      const maxX = this.root.clientWidth - 240;
      this.ac.style.left = Math.max(4, Math.min(x, maxX)) + 'px';
      const rootH = this.root.clientHeight;
      if (y + 200 > rootH && y > 210) { this.ac.style.top = ''; this.ac.style.bottom = (rootH - y + lh + 4) + 'px'; }
      else { this.ac.style.bottom = ''; this.ac.style.top = y + 'px'; }
    }
    hideAC() { this.ac.hidden = true; this.acItems = []; }
    acceptAC() {
      const it = this.acItems[this.acSel];
      if (!it) return;
      const ta = this.ta;
      const ins = it.ins || it.n;
      ta.setRangeText(ins, this.acWordStart, ta.selectionStart, 'end');
      if (it.caretBack) { const p = ta.selectionStart - it.caretBack; ta.setSelectionRange(p, p); }
      this.hideAC();
      this.refresh(); this.onChange(); this.updateSig();
      ta.focus();
    }
  }

  XT.Editor = Editor;
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
