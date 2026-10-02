/* ConstraintLab – Markdown-lite и подсветка Tcl/XDC/SDC */
(function (XT) {
  'use strict';
  const esc = XT.util.escapeHtml;

  const KNOWN = {
    sdc: new Set(['create_clock', 'create_generated_clock', 'set_clock_groups', 'set_clock_uncertainty', 'set_clock_latency', 'set_clock_transition',
      'set_input_jitter', 'set_system_jitter', 'set_propagated_clock', 'set_input_delay', 'set_output_delay', 'set_false_path', 'set_multicycle_path',
      'set_max_delay', 'set_min_delay', 'set_bus_skew', 'set_case_analysis', 'set_disable_timing', 'set_load', 'set_driving_cell', 'set_drive',
      'set_input_transition', 'set_max_transition', 'set_max_fanout', 'set_max_capacitance', 'set_min_capacitance', 'set_ideal_network',
      'set_dont_touch_network', 'set_clock_gating_check', 'set_property', 'set_units', 'set_operating_conditions', 'set_wire_load_model',
      'group_path', 'set_clock_sense', 'set_sense', 'create_pblock', 'add_cells_to_pblock', 'resize_pblock', 'set_timing_derate', 'set_max_area']),
    query: new Set(['get_ports', 'get_pins', 'get_cells', 'get_nets', 'get_clocks', 'get_generated_clocks', 'all_inputs', 'all_outputs', 'all_clocks',
      'all_registers', 'all_fanout', 'all_fanin', 'remove_from_collection', 'add_to_collection', 'sizeof_collection', 'get_object_name', 'filter',
      'filter_collection', 'foreach_in_collection', 'index_collection', 'get_property', 'list_property', 'report_property', 'current_design',
      'current_instance', 'get_designs', 'get_lib_cells', 'get_libs', 'report_clocks', 'report_timing', 'check_timing', 'report_clock_interaction',
      'report_exceptions', 'report_io_delays', 'help']),
    tcl: new Set(['set', 'unset', 'expr', 'list', 'llength', 'lindex', 'lrange', 'lappend', 'lsort', 'lsearch', 'lreverse', 'lassign', 'concat', 'join',
      'split', 'string', 'format', 'puts', 'if', 'elseif', 'else', 'for', 'foreach', 'while', 'break', 'continue', 'proc', 'return', 'global',
      'info', 'catch', 'error', 'eval', 'incr', 'append', 'regexp', 'regsub']),
  };

  function span(cls, s) { return `<span class="${cls}">${esc(s)}</span>`; }
  function hlLine(line) {
    let out = '';
    let i = 0;
    let cmdPos = true, afterBrace = false;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') { out += c; i++; continue; }
      if (c === '#' && cmdPos) { out += span('hl-com', line.slice(i)); break; }
      if (c === ';') { out += span('hl-brk', ';'); i++; cmdPos = true; afterBrace = false; continue; }
      if (c === '[') { out += span('hl-brk', '['); i++; cmdPos = true; afterBrace = false; continue; }
      if (c === ']' || c === '}') { out += span('hl-brk', c); i++; cmdPos = false; afterBrace = false; continue; }
      if (c === '{') { out += span('hl-brk', '{'); i++; afterBrace = true; continue; }
      if (c === '"') {
        let j = i + 1;
        while (j < n && line[j] !== '"') { if (line[j] === '\\') j++; j++; }
        out += span('hl-str', line.slice(i, Math.min(n, j + 1)));
        i = Math.min(n, j + 1); cmdPos = false; afterBrace = false;
        continue;
      }
      if (c === '$') {
        const m = /^\$(\{[^}]*\}|[A-Za-z0-9_:]+(\([^)]*\))?)/.exec(line.slice(i));
        if (m) { out += span('hl-var', m[0]); i += m[0].length; cmdPos = false; afterBrace = false; continue; }
      }
      let j = i;
      while (j < n && !/[\s;\[\]{}"$]/.test(line[j])) { if (line[j] === '\\') j++; j++; }
      if (j === i) { out += esc(c); i++; continue; }
      const w = line.slice(i, j);
      let cls = '';
      const known = KNOWN.sdc.has(w) ? 'hl-sdc' : KNOWN.query.has(w) ? 'hl-query' : KNOWN.tcl.has(w) ? 'hl-cmd' : '';
      if (cmdPos || (afterBrace && known)) cls = known;
      else if (/^-[A-Za-z_]/.test(w)) cls = 'hl-opt';
      else if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(w)) cls = 'hl-num';
      else if (/^[A-Z][A-Z0-9_]*(\.[A-Z0-9_]+)*$/.test(w) && w.length > 2) cls = 'hl-prop';
      out += cls ? span(cls, w) : esc(w);
      i = j;
      cmdPos = false; afterBrace = false;
    }
    return out;
  }
  function hlTcl(src, lineClass) {
    return String(src).split('\n').map((ln, k) => {
      const cls = lineClass ? lineClass(k + 1) : '';
      const h = hlLine(ln);
      return cls ? `<span class="${cls}">${h || ' '}</span>` : h;
    }).join('\n');
  }

  // ---------------------------------------------------------------------------
  // Markdown-lite
  // ---------------------------------------------------------------------------
  function dedent(s) {
    s = String(s || '').replace(/\r/g, '').replace(/^\n+/, '').replace(/\s+$/, '');
    const lines = s.split('\n');
    let min = Infinity;
    for (const l of lines) { if (!l.trim()) continue; const m = /^ */.exec(l)[0].length; min = Math.min(min, m); }
    if (!isFinite(min) || min === 0) return s;
    return lines.map((l) => l.slice(min)).join('\n');
  }
  // опции вида -max, -add_delay: строка не переносится сразу после дефиса (h – уже экранированный текст)
  function nobr(h) { return h.replace(/(^|[\s(«/*])(-{1,2}[A-Za-z]\w*)/g, '$1<span class="nobr">$2</span>'); }
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = nobr(esc(s));
    s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    s = s.replace(/(^|[\s(«])\*([^*\s][^*]*)\*(?=[\s).,:;!?»]|$)/g, '$1<i>$2</i>');
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\[\[q:([\w.\-]+)\|([^\]]+)\]\]/g, '<a href="#q=$1" class="qlink">$2</a>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, k) => `<code>${nobr(esc(codes[+k]))}</code>`);
    return s;
  }
  function render(src) {
    const lines = dedent(src).split('\n');
    let out = '';
    let i = 0;
    const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      let m;
      if ((m = /^```\s*(\w*)\s*$/.exec(l))) {
        const lang = m[1];
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++;
        const code = buf.join('\n');
        out += `<pre><code>${lang === 'text' || lang === 'txt' ? esc(code) : hlTcl(code)}</code></pre>`;
        continue;
      }
      if ((m = /^(#{2,4})\s+(.*)$/.exec(l))) { const n = m[1].length; out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
      if (/^\s*---+\s*$/.test(l)) { out += '<hr>'; i++; continue; }
      if (/^\s*\|/.test(l) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const row = (x) => x.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        const head = row(l);
        i += 2;
        let t = '<div class="tblwrap"><table><thead><tr>' + head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
        while (i < lines.length && /^\s*\|/.test(lines[i])) { t += '<tr>' + row(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>'; i++; }
        out += t + '</tbody></table></div>';
        continue;
      }
      if (/^\s*>/.test(l)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        let cls = '';
        if (/^\s*\*\*(Внимание|Важно|Ловушка|Осторожно|Warning|Important|Pitfall|Caution|Note|Attention|Trap)/i.test(buf[0] || '')) cls = ' class="warn"';
        out += `<blockquote${cls}>${render(buf.join('\n'))}</blockquote>`;
        continue;
      }
      if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d+[.)]/.test(l);
        let t = ordered ? '<ol>' : '<ul>';
        while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) {
          let item = lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, '');
          i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i])) item += ' ' + lines[i++].trim();
          t += `<li>${inline(item)}</li>`;
        }
        out += t + (ordered ? '</ol>' : '</ul>');
        continue;
      }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) && !/^#{2,4}\s/.test(lines[i]) && !/^\s*>/.test(lines[i]) &&
        !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]) && !(/^\s*\|/.test(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))) buf.push(lines[i++]);
      out += `<p>${inline(buf.join(' '))}</p>`;
    }
    return out;
  }

  XT.md = { render, inline, nobr, hlTcl, hlLine, dedent, KNOWN };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
