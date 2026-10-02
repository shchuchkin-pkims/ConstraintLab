/* ConstraintLab – мини-интерпретатор Tcl (подмножество Tcl 8.6, достаточное для XDC/SDC) */
(function (XT) {
  'use strict';
  const U = XT.util;
  const L = XT.L;

  class TclError extends Error {
    constructor(msg, line) { super(msg); this.tclLine = line; this.isTclError = true; }
  }
  class BreakSig { }
  class ContinueSig { }
  class ReturnSig { constructor(v) { this.value = v; } }

  // Список смешанных значений (строки + коллекции объектов)
  class TList {
    constructor(items) { this.items = items; this.isTList = true; }
    toString() { return U.formatList(this.items.map(toStr)); }
  }

  function fmtDouble(v) {
    if (Number.isNaN(v)) return 'NaN';
    if (!isFinite(v)) return v > 0 ? 'Inf' : '-Inf';
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toFixed(1);
    let s = (v !== 0 && (Math.abs(v) < 1e-4 || Math.abs(v) >= 1e17)) ? v.toExponential() : String(v);
    if (/e/.test(s)) s = s.replace(/e\+?(-?)(\d)$/, (m, sg, d) => 'e' + (sg || '+') + '0' + d).replace(/e\+?(-?)(\d\d+)$/, (m, sg, d) => 'e' + (sg || '+') + d);
    return s;
  }
  function toStr(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : fmtDouble(v);
    if (typeof v === 'boolean') return v ? '1' : '0';
    return v.toString();
  }
  // элементы списка (для foreach, lindex и т.п.)
  function listItems(v) {
    if (v && v.isColl) return v.items.map((o) => new U.Coll(o.kind, [o]));
    if (v && v.isTList) return v.items;
    return U.parseList(toStr(v));
  }

  function isWS(c) { return c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v'; }

  // ---------------------------------------------------------------------------
  // Парсер
  // ---------------------------------------------------------------------------
  class Parser {
    constructor(src, line0) { this.s = src; this.i = 0; this.line = line0 || 1; }
    err(msg, line) { throw new TclError(msg, line || this.line); }
    eof() { return this.i >= this.s.length; }

    parseScript(term) {
      const cmds = [];
      for (;;) {
        for (;;) {
          if (this.eof()) break;
          const c = this.s[this.i];
          if (isWS(c) || c === ';') { this.i++; continue; }
          if (c === '\n') { this.i++; this.line++; continue; }
          if (c === '\\' && this.s[this.i + 1] === '\n') { this.i += 2; this.line++; continue; }
          break;
        }
        if (this.eof()) {
          if (term) this.err(L('нет закрывающей квадратной скобки «]»', "missing close-bracket ']'"));
          return cmds;
        }
        const c = this.s[this.i];
        if (term && c === term) { this.i++; return cmds; }
        if (c === '#') { this.skipComment(); continue; }
        const cmd = { line: this.line, words: [], start: this.i };
        for (;;) {
          for (;;) {
            if (this.eof()) break;
            const ch = this.s[this.i];
            if (isWS(ch)) { this.i++; continue; }
            if (ch === '\\' && this.s[this.i + 1] === '\n') { this.i += 2; this.line++; continue; }
            break;
          }
          if (this.eof()) break;
          const ch = this.s[this.i];
          if (ch === '\n' || ch === ';') break;
          if (term && ch === term) break;
          cmd.words.push(this.parseWord(term));
        }
        cmd.end = this.i;
        cmd.text = this.s.slice(cmd.start, cmd.end).trim();
        cmd.endLine = this.line;
        if (cmd.words.length) cmds.push(cmd);
      }
    }
    skipComment() {
      while (!this.eof()) {
        const c = this.s[this.i];
        if (c === '\\') { if (this.s[this.i + 1] === '\n') this.line++; this.i += 2; continue; }
        if (c === '\n') return;
        this.i++;
      }
    }
    parseWord(term) {
      let expand = false;
      if (this.s.startsWith('{*}', this.i)) {
        const nx = this.s[this.i + 3];
        if (nx !== undefined && !isWS(nx) && nx !== '\n' && nx !== ';') { expand = true; this.i += 3; }
      }
      const c = this.s[this.i];
      let w;
      if (c === '{') w = this.parseBraced(term);
      else if (c === '"') w = this.parseQuoted(term);
      else w = this.parseBare(term);
      w.expand = expand;
      return w;
    }
    parseBraced(term) {
      const startLine = this.line;
      let depth = 1;
      this.i++;
      let out = '';
      for (;;) {
        if (this.eof()) throw new TclError(L('нет закрывающей фигурной скобки «}»', "missing close-brace '}'"), startLine);
        const c = this.s[this.i];
        if (c === '\\') {
          const n = this.s[this.i + 1];
          if (n === '\n') {
            this.i += 2; this.line++;
            while (!this.eof() && isWS(this.s[this.i])) this.i++;
            out += ' ';
            continue;
          }
          out += c + (n === undefined ? '' : n);
          this.i += 2;
          continue;
        }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { this.i++; break; } }
        if (c === '\n') this.line++;
        out += c;
        this.i++;
      }
      this.checkWordEnd(term, '}');
      return { kind: 'brace', text: out, line: startLine };
    }
    checkWordEnd(term, what) {
      if (this.eof()) return;
      const c = this.s[this.i];
      if (isWS(c) || c === '\n' || c === ';' || (term && c === term)) return;
      if (c === '\\' && this.s[this.i + 1] === '\n') return;
      this.err(what === '}' ? L('лишние символы сразу после закрывающей «}» (нужен пробел)', "extra characters after close-brace '}' (a space is required)") : L('лишние символы сразу после закрывающей кавычки (нужен пробел)', 'extra characters after close-quote (a space is required)'));
    }
    parseQuoted(term) {
      const startLine = this.line;
      this.i++;
      const parts = this.parseParts((c) => c === '"', true);
      if (this.eof() || this.s[this.i] !== '"') throw new TclError(L('нет закрывающей кавычки «"»', `missing close-quote '"'`), startLine);
      this.i++;
      this.checkWordEnd(term, '"');
      return { kind: 'parts', parts, line: startLine };
    }
    parseBare(term) {
      const line = this.line;
      const parts = this.parseParts((c) => isWS(c) || c === '\n' || c === ';' || (term && c === term), false);
      return { kind: 'parts', parts, line };
    }
    parseParts(stop, quoted) {
      const parts = [];
      let text = '';
      const flush = () => { if (text) { parts.push({ kind: 'text', text }); text = ''; } };
      while (!this.eof()) {
        const c = this.s[this.i];
        if (stop(c)) break;
        if (!quoted && c === '\\' && this.s[this.i + 1] === '\n') break;
        if (c === '\\') { text += this.parseBackslash(); continue; }
        if (c === '$') {
          const v = this.parseVar();
          if (v) { flush(); parts.push(v); } else { text += '$'; this.i++; }
          continue;
        }
        if (c === '[') {
          flush();
          const line = this.line;
          this.i++;
          const cmds = this.parseScript(']');
          parts.push({ kind: 'cmd', cmds, line });
          continue;
        }
        if (c === '\n') this.line++;
        text += c;
        this.i++;
      }
      flush();
      return parts;
    }
    parseBackslash() {
      const n = this.s[this.i + 1];
      if (n === undefined) { this.i++; return '\\'; }
      const map = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
      if (Object.prototype.hasOwnProperty.call(map, n)) { this.i += 2; return map[n]; }
      if (n === '\n') {
        this.i += 2; this.line++;
        while (!this.eof() && isWS(this.s[this.i])) this.i++;
        return ' ';
      }
      if (n === 'x') {
        const m = /^[0-9a-fA-F]{1,2}/.exec(this.s.slice(this.i + 2));
        if (m) { this.i += 2 + m[0].length; return String.fromCharCode(parseInt(m[0], 16)); }
      }
      if (n === 'u') {
        const m = /^[0-9a-fA-F]{1,4}/.exec(this.s.slice(this.i + 2));
        if (m) { this.i += 2 + m[0].length; return String.fromCharCode(parseInt(m[0], 16)); }
      }
      if (/[0-7]/.test(n)) {
        const m = /^[0-7]{1,3}/.exec(this.s.slice(this.i + 1));
        this.i += 1 + m[0].length;
        return String.fromCharCode(parseInt(m[0], 8) & 0xff);
      }
      this.i += 2;
      return n;
    }
    parseVar() {
      const s = this.s;
      let j = this.i + 1;
      if (s[j] === '{') {
        const k = s.indexOf('}', j + 1);
        if (k < 0) this.err(L('нет закрывающей «}» в имени переменной', "missing close-brace '}' in variable name"));
        const name = s.slice(j + 1, k);
        this.i = k + 1;
        return { kind: 'var', name };
      }
      let name = '';
      while (j < s.length) {
        const c = s[j];
        if (/[A-Za-z0-9_]/.test(c)) { name += c; j++; continue; }
        if (c === ':' && s[j + 1] === ':') { name += '::'; j += 2; continue; }
        break;
      }
      if (!name) return null;
      this.i = j;
      if (s[this.i] === '(') {
        this.i++;
        const parts = this.parseParts((c) => c === ')', true);
        if (s[this.i] !== ')') this.err(L('нет закрывающей «)» в индексе массива', "missing ')' in array index"));
        this.i++;
        return { kind: 'var', name, index: parts };
      }
      return { kind: 'var', name };
    }
  }

  // ---------------------------------------------------------------------------
  // Выражения expr
  // ---------------------------------------------------------------------------
  function numVal(v) {
    // v: {t:'i'|'d'|'s', v}
    if (v.t !== 's') return v;
    const s = v.v.trim();
    if (/^[+-]?\d+$/.test(s)) return { t: 'i', v: parseInt(s, 10) };
    if (/^[+-]?0[xX][0-9a-fA-F]+$/.test(s)) return { t: 'i', v: parseInt(s, 16) };
    if (/^[+-]?0[bB][01]+$/.test(s)) return { t: 'i', v: parseInt(s.replace(/0[bB]/, ''), 2) * (s[0] === '-' ? -1 : 1) };
    if (/^[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(s)) return { t: 'd', v: parseFloat(s) };
    if (/^[+-]?(Inf|inf)$/.test(s)) return { t: 'd', v: s[0] === '-' ? -Infinity : Infinity };
    return null;
  }
  function strToVal(s) {
    const n = numVal({ t: 's', v: s });
    return n || { t: 's', v: s };
  }
  function boolOf(v, expr) {
    if (v.t === 'i' || v.t === 'd') return v.v !== 0;
    const s = v.v.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 't', 'y'].includes(s)) return true;
    if (['0', 'false', 'no', 'off', 'f', 'n'].includes(s)) return false;
    const n = numVal(v);
    if (n) return n.v !== 0;
    throw new TclError(L(`ожидалось логическое значение, получено «${v.v}» (в выражении «${expr}»)`, `expected boolean value but got '${v.v}' (in expression '${expr}')`));
  }
  function valToStr(v) {
    if (v.t === 'i') return String(v.v);
    if (v.t === 'd') return fmtDouble(v.v);
    return v.v;
  }

  class ExprParser {
    constructor(interp, s) { this.I = interp; this.s = s; this.i = 0; }
    err(msg) { throw new TclError(msg || L(`синтаксическая ошибка в выражении «${this.s}»`, `syntax error in expression '${this.s}'`)); }
    ws() { while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++; }
    peek(str) { this.ws(); return this.s.startsWith(str, this.i); }
    eat(str) { if (this.peek(str)) { this.i += str.length; return true; } return false; }
    parse() {
      const v = this.ternary();
      this.ws();
      if (this.i < this.s.length) this.err();
      return v;
    }
    ternary() {
      const c = this.lor();
      if (this.eat('?')) {
        const a = this.ternary();
        if (!this.eat(':')) this.err(L('ожидалось «:» в тернарном операторе', "expected ':' in the ternary operator"));
        const b = this.ternary();
        return boolOf(c, this.s) ? a : b;
      }
      return c;
    }
    lor() {
      let a = this.land();
      while (this.peek('||')) { this.i += 2; const b = this.land(); a = { t: 'i', v: (boolOf(a, this.s) || boolOf(b, this.s)) ? 1 : 0 }; }
      return a;
    }
    land() {
      let a = this.bor();
      while (this.peek('&&')) { this.i += 2; const b = this.bor(); a = { t: 'i', v: (boolOf(a, this.s) && boolOf(b, this.s)) ? 1 : 0 }; }
      return a;
    }
    bor() {
      let a = this.bxor();
      while (this.peek('|') && !this.peek('||')) { this.i += 1; const b = this.bxor(); a = this.intOp(a, b, (x, y) => x | y, '|'); }
      return a;
    }
    bxor() {
      let a = this.band();
      while (this.peek('^')) { this.i += 1; const b = this.band(); a = this.intOp(a, b, (x, y) => x ^ y, '^'); }
      return a;
    }
    band() {
      let a = this.inni();
      while (this.peek('&') && !this.peek('&&')) { this.i += 1; const b = this.inni(); a = this.intOp(a, b, (x, y) => x & y, '&'); }
      return a;
    }
    inni() {
      let a = this.eqne();
      for (;;) {
        this.ws();
        const m = /^(in|ni)\b/.exec(this.s.slice(this.i));
        if (!m) break;
        this.i += 2;
        const b = this.eqne();
        const items = U.parseList(valToStr(b));
        const has = items.includes(valToStr(a));
        a = { t: 'i', v: (m[1] === 'in' ? has : !has) ? 1 : 0 };
      }
      return a;
    }
    eqne() {
      let a = this.equality();
      for (;;) {
        this.ws();
        const m = /^(eq|ne)\b/.exec(this.s.slice(this.i));
        if (!m) break;
        this.i += 2;
        const b = this.equality();
        const r = valToStr(a) === valToStr(b);
        a = { t: 'i', v: (m[1] === 'eq' ? r : !r) ? 1 : 0 };
      }
      return a;
    }
    equality() {
      let a = this.relational();
      for (;;) {
        let op = null;
        if (this.peek('==')) op = '==';
        else if (this.peek('!=')) op = '!=';
        if (!op) break;
        this.i += 2;
        const b = this.relational();
        const c = this.compare(a, b);
        a = { t: 'i', v: (op === '==' ? c === 0 : c !== 0) ? 1 : 0 };
      }
      return a;
    }
    relational() {
      let a = this.shift();
      for (;;) {
        let op = null;
        for (const o of ['<=', '>=', '<', '>']) { if (this.peek(o) && !this.peek('<<') && !this.peek('>>')) { op = o; break; } }
        if (!op) break;
        this.i += op.length;
        const b = this.shift();
        const c = this.compare(a, b);
        const r = op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0;
        a = { t: 'i', v: r ? 1 : 0 };
      }
      return a;
    }
    compare(a, b) {
      const x = numVal(a), y = numVal(b);
      if (x && y) return x.v < y.v ? -1 : x.v > y.v ? 1 : 0;
      const s1 = valToStr(a), s2 = valToStr(b);
      return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
    }
    shift() {
      let a = this.additive();
      for (;;) {
        let op = null;
        if (this.peek('<<')) op = '<<'; else if (this.peek('>>')) op = '>>';
        if (!op) break;
        this.i += 2;
        const b = this.additive();
        a = this.intOp(a, b, op === '<<' ? (x, y) => x * Math.pow(2, y) : (x, y) => Math.floor(x / Math.pow(2, y)), op);
      }
      return a;
    }
    additive() {
      let a = this.mult();
      for (;;) {
        this.ws();
        const c = this.s[this.i];
        if (c !== '+' && c !== '-') break;
        this.i++;
        const b = this.mult();
        a = this.arith(a, b, c);
      }
      return a;
    }
    mult() {
      let a = this.power();
      for (;;) {
        this.ws();
        const c = this.s[this.i];
        if (c === '*' && this.s[this.i + 1] === '*') break;
        if (c !== '*' && c !== '/' && c !== '%') break;
        this.i++;
        const b = this.power();
        a = this.arith(a, b, c);
      }
      return a;
    }
    power() {
      const a = this.unary();
      if (this.peek('**')) {
        this.i += 2;
        const b = this.power();
        return this.arith(a, b, '**');
      }
      return a;
    }
    unary() {
      this.ws();
      const c = this.s[this.i];
      if (c === '-' || c === '+') {
        this.i++;
        const v = this.num(this.unary(), c);
        return c === '-' ? { t: v.t, v: -v.v } : v;
      }
      if (c === '!') { this.i++; const v = this.unary(); return { t: 'i', v: boolOf(v, this.s) ? 0 : 1 }; }
      if (c === '~') { this.i++; const v = this.num(this.unary(), '~'); if (v.t !== 'i') this.err(L('оператор ~ применим только к целым', 'operator ~ applies only to integers')); return { t: 'i', v: ~v.v }; }
      return this.primary();
    }
    num(v, op) {
      const n = numVal(v);
      if (!n) throw new TclError(L(`нечисловой операнд «${valToStr(v)}» для оператора «${op}» (выражение «${this.s}»)`, `non-numeric operand '${valToStr(v)}' for operator '${op}' (expression '${this.s}')`));
      return n;
    }
    intOp(a, b, f, op) {
      const x = this.num(a, op), y = this.num(b, op);
      if (x.t !== 'i' || y.t !== 'i') throw new TclError(L(`оператор «${op}» применим только к целым числам`, `operator '${op}' applies only to integers`));
      return { t: 'i', v: f(x.v, y.v) };
    }
    arith(a, b, op) {
      const x = this.num(a, op), y = this.num(b, op);
      const isInt = x.t === 'i' && y.t === 'i';
      switch (op) {
        case '+': return { t: isInt ? 'i' : 'd', v: x.v + y.v };
        case '-': return { t: isInt ? 'i' : 'd', v: x.v - y.v };
        case '*': return { t: isInt ? 'i' : 'd', v: x.v * y.v };
        case '/':
          if (y.v === 0) { if (isInt) throw new TclError(L('деление на ноль', 'divide by zero')); return { t: 'd', v: x.v / y.v }; }
          if (isInt) {
            this.I.noteIntDiv(x.v, y.v);
            return { t: 'i', v: Math.floor(x.v / y.v) };
          }
          return { t: 'd', v: x.v / y.v };
        case '%':
          if (!isInt) throw new TclError(L('оператор % применим только к целым', 'operator % applies only to integers'));
          if (y.v === 0) throw new TclError(L('деление на ноль', 'divide by zero'));
          { let r = x.v % y.v; if (r !== 0 && (r < 0) !== (y.v < 0)) r += y.v; return { t: 'i', v: r }; }
        case '**': {
          if (isInt && y.v >= 0) return { t: 'i', v: Math.pow(x.v, y.v) };
          return { t: 'd', v: Math.pow(x.v, y.v) };
        }
      }
      this.err();
    }
    primary() {
      this.ws();
      const s = this.s;
      const c = s[this.i];
      if (c === undefined) this.err(L('неожиданный конец выражения «' + s + '»', `unexpected end of expression '${s}'`));
      if (c === '(') {
        this.i++;
        const v = this.ternary();
        if (!this.eat(')')) this.err(L('нет закрывающей «)» в выражении', "missing ')' in expression"));
        return v;
      }
      const numM = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/.exec(s.slice(this.i));
      if (numM) {
        this.i += numM[0].length;
        return numVal({ t: 's', v: numM[0] });
      }
      if (c === '$') {
        const p = new Parser(s, this.I.curLine);
        p.i = this.i;
        const v = p.parseVar();
        if (!v) this.err(L('некорректное имя переменной в выражении', 'invalid variable name in expression'));
        this.i = p.i;
        const val = this.I.evalPart(v);
        if (val && (val.isColl || val.isTList)) throw new TclError(L('коллекция объектов не может участвовать в арифметике expr', 'an object collection cannot be used in expr arithmetic'));
        return strToVal(toStr(val));
      }
      if (c === '[') {
        const p = new Parser(s, this.I.curLine);
        p.i = this.i + 1;
        const cmds = p.parseScript(']');
        this.i = p.i;
        const val = this.I.evalCmds(cmds, true);
        if (val && val.isColl) return { t: 's', v: toStr(val) };
        return strToVal(toStr(val));
      }
      if (c === '"') {
        const p = new Parser(s, this.I.curLine);
        p.i = this.i + 1;
        const parts = p.parseParts((ch) => ch === '"', true);
        if (s[p.i] !== '"') this.err(L('нет закрывающей кавычки в выражении', 'missing close-quote in expression'));
        this.i = p.i + 1;
        return strToVal(toStr(this.I.evalParts(parts)));
      }
      if (c === '{') {
        let depth = 1, j = this.i + 1;
        while (j < s.length && depth) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
        if (depth) this.err(L('нет закрывающей «}» в выражении', "missing close-brace '}' in expression"));
        const str = s.slice(this.i + 1, j - 1);
        this.i = j;
        return strToVal(str);
      }
      const idM = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(this.i));
      if (idM) {
        const id = idM[0];
        this.i += id.length;
        if (this.peek('(')) {
          this.i++;
          const args = [];
          if (!this.peek(')')) {
            for (;;) { args.push(this.ternary()); if (this.eat(',')) continue; break; }
          }
          if (!this.eat(')')) this.err(L('нет закрывающей «)» при вызове функции ' + id, `missing ')' in call to function ${id}`));
          return this.callFunc(id, args);
        }
        const low = id.toLowerCase();
        if (['true', 'yes', 'on'].includes(low)) return { t: 'i', v: 1 };
        if (['false', 'no', 'off'].includes(low)) return { t: 'i', v: 0 };
        if (low === 'inf') return { t: 'd', v: Infinity };
        if (low === 'nan') return { t: 'd', v: NaN };
        throw new TclError(L(`в выражении «${s}» встретилось слово «${id}» без $ – вероятно, забыли знак $ перед именем переменной или фигурные скобки`, `invalid bareword '${id}' in expression '${s}' – probably a missing $ before a variable name, or missing braces`));
      }
      this.err();
    }
    callFunc(id, args) {
      const d = (k) => this.num(args[k], id);
      const need = (n) => { if (args.length !== n) throw new TclError(L(`функция ${id}() ожидает ${n} аргумент(а)`, `function ${id}() expects ${n} argument${n > 1 ? 's' : ''}`)); };
      switch (id) {
        case 'abs': need(1); { const v = d(0); return { t: v.t, v: Math.abs(v.v) }; }
        case 'int': case 'wide': case 'entier': need(1); return { t: 'i', v: Math.trunc(d(0).v) };
        case 'double': need(1); return { t: 'd', v: d(0).v };
        case 'round': need(1); { const v = d(0).v; return { t: 'i', v: v < 0 ? -Math.round(-v) : Math.round(v) }; }
        case 'floor': need(1); return { t: 'd', v: Math.floor(d(0).v) };
        case 'ceil': need(1); return { t: 'd', v: Math.ceil(d(0).v) };
        case 'sqrt': need(1); return { t: 'd', v: Math.sqrt(d(0).v) };
        case 'exp': need(1); return { t: 'd', v: Math.exp(d(0).v) };
        case 'log': need(1); return { t: 'd', v: Math.log(d(0).v) };
        case 'log10': need(1); return { t: 'd', v: Math.log10(d(0).v) };
        case 'sin': need(1); return { t: 'd', v: Math.sin(d(0).v) };
        case 'cos': need(1); return { t: 'd', v: Math.cos(d(0).v) };
        case 'tan': need(1); return { t: 'd', v: Math.tan(d(0).v) };
        case 'atan': need(1); return { t: 'd', v: Math.atan(d(0).v) };
        case 'pow': need(2); return { t: 'd', v: Math.pow(d(0).v, d(1).v) };
        case 'fmod': need(2); return { t: 'd', v: d(0).v % d(1).v };
        case 'hypot': need(2); return { t: 'd', v: Math.hypot(d(0).v, d(1).v) };
        case 'atan2': need(2); return { t: 'd', v: Math.atan2(d(0).v, d(1).v) };
        case 'min': case 'max': {
          if (!args.length) throw new TclError(L(`функция ${id}() требует аргументов`, `function ${id}() requires arguments`));
          let best = d(0);
          for (let k = 1; k < args.length; k++) {
            const v = d(k);
            if (id === 'min' ? v.v < best.v : v.v > best.v) best = v;
          }
          const anyD = args.some((_, k) => d(k).t === 'd');
          return { t: anyD ? 'd' : best.t, v: best.v };
        }
        case 'bool': need(1); return { t: 'i', v: boolOf(args[0], this.s) ? 1 : 0 };
      }
      throw new TclError(L(`неизвестная математическая функция «${id}»`, `unknown math function '${id}'`));
    }
  }

  // ---------------------------------------------------------------------------
  // Интерпретатор
  // ---------------------------------------------------------------------------
  class Interp {
    constructor(opts) {
      opts = opts || {};
      this.globals = new Map();
      this.frames = [this.globals];
      this.cmds = new Map();
      this.procs = new Map();
      this.out = [];
      this.messages = [];
      this.steps = 0;
      this.maxSteps = opts.maxSteps || 200000;
      this.curLine = 0;
      this.curCmd = null;
      this.depth = 0;
      this.xdcMode = !!opts.xdcMode;   // предупреждать о Tcl-командах, не поддерживаемых в XDC
      this.src = '';                    // метка источника (user/given/after/ref)
      this.notes = new Set();
      registerBuiltins(this);
    }
    get vars() { return this.frames[this.frames.length - 1]; }
    register(name, fn, meta) { this.cmds.set(name, { fn, meta: meta || {} }); }
    msg(sev, text, line, extra) {
      const m = Object.assign({ sev, text, line: line === undefined ? this.curLine : line, src: this.src }, extra || {});
      this.messages.push(m);
      return m;
    }
    noteOnce(key, sev, text, line) {
      if (this.notes.has(key)) return;
      this.notes.add(key);
      this.msg(sev, text, line);
    }
    noteIntDiv(a, b) {
      if (a % b !== 0) {
        this.noteOnce('intdiv:' + this.curLine, 'warn', L(
          `Целочисленное деление в expr: ${a}/${b} = ${Math.floor(a / b)} (дробная часть отброшена). ` +
          'В Tcl деление двух целых – целое; пишите 10.0 вместо 10 или double().',
          `Integer division in expr: ${a}/${b} = ${Math.floor(a / b)} (the fractional part is discarded). ` +
          'In Tcl, dividing two integers gives an integer; write 10.0 instead of 10, or use double().'), this.curLine);
      }
    }
    resolveName(name) {
      // имя массива: a(idx)
      const m = /^([^(]+)\((.*)\)$/.exec(name);
      if (m) return { name: m[1], index: m[2] };
      return { name, index: undefined };
    }
    frameFor(name) {
      if (name.startsWith('::')) return { frame: this.globals, name: name.slice(2) };
      let frame = this.vars;
      const e = frame.get(name);
      if (e && e.__link) return { frame: e.frame, name: e.name };
      return { frame, name };
    }
    getVar(name, index) {
      const r = this.frameFor(name);
      const e = r.frame.get(r.name);
      if (e === undefined) {
        const cands = [...this.vars.keys(), ...this.globals.keys()];
        const sg = U.suggest(name, cands);
        throw new TclError(L(`переменная «${name}» не определена`, `variable '${name}' is not defined`) + (sg ? L(` (может быть, «${sg}»?)`, ` (did you mean '${sg}'?)`) : ''));
      }
      if (index !== undefined) {
        if (!(e instanceof Map)) throw new TclError(L(`переменная «${name}» не является массивом`, `variable '${name}' is not an array`));
        if (!e.has(index)) throw new TclError(L(`в массиве «${name}» нет элемента «${index}»`, `array '${name}' has no element '${index}'`));
        return e.get(index);
      }
      if (e instanceof Map) throw new TclError(L(`«${name}» – массив, укажите индекс: $${name}(…)`, `'${name}' is an array; specify an index: $${name}(…)`));
      return e;
    }
    setVar(name, value, index) {
      const r = this.frameFor(name);
      if (index !== undefined) {
        let e = r.frame.get(r.name);
        if (e === undefined) { e = new Map(); r.frame.set(r.name, e); }
        if (!(e instanceof Map)) throw new TclError(L(`переменная «${name}» не является массивом`, `variable '${name}' is not an array`));
        e.set(index, value);
        return value;
      }
      const e = r.frame.get(r.name);
      if (e instanceof Map) throw new TclError(L(`«${name}» – массив, нельзя присвоить скалярное значение`, `'${name}' is an array; a scalar value cannot be assigned`));
      r.frame.set(r.name, value);
      return value;
    }
    hasVar(name) {
      const rn = this.resolveName(name);
      const r = this.frameFor(rn.name);
      const e = r.frame.get(r.name);
      if (e === undefined) return false;
      if (rn.index !== undefined) return e instanceof Map && e.has(rn.index);
      return true;
    }
    unsetVar(name) {
      const rn = this.resolveName(name);
      const r = this.frameFor(rn.name);
      if (rn.index !== undefined) { const e = r.frame.get(r.name); if (e instanceof Map) e.delete(rn.index); return; }
      r.frame.delete(r.name);
    }

    // разбор (с кешем)
    parse(src, line0) {
      const p = new Parser(src, line0 || 1);
      return p.parseScript(null);
    }
    evalParts(parts) {
      if (parts.length === 1 && parts[0].kind !== 'text') return this.evalPart(parts[0]);
      let s = '';
      for (const part of parts) s += toStr(this.evalPart(part));
      return s;
    }
    evalPart(part) {
      if (part.kind === 'text') return part.text;
      if (part.kind === 'var') {
        const idx = part.index ? toStr(this.evalParts(part.index)) : undefined;
        return this.getVar(part.name, idx);
      }
      if (part.kind === 'cmd') return this.evalCmds(part.cmds, true);
      throw new TclError(L('внутренняя ошибка разбора', 'internal parse error'));
    }
    evalWord(w) {
      if (w.kind === 'brace') return w.text;
      return this.evalParts(w.parts);
    }
    evalCmds(cmds, inSubst) {
      let res = '';
      for (const c of cmds) res = this.evalCommand(c, inSubst);
      return res;
    }
    evalCommand(cmd, inSubst) {
      if (++this.steps > this.maxSteps) throw new TclError(L('превышен лимит шагов интерпретатора (бесконечный цикл?)', 'interpreter step limit exceeded (infinite loop?)'), cmd.line);
      const saveLine = this.curLine, saveCmd = this.curCmd;
      this.curLine = cmd.line;
      this.curCmd = cmd;
      try {
        const args = [];
        for (const w of cmd.words) {
          const v = this.evalWord(w);
          if (w.expand) { for (const x of listItems(v)) args.push(x); } else args.push(v);
        }
        if (!args.length) return '';
        const name = toStr(args[0]);
        const c = this.cmds.get(name) || (name.startsWith('::') ? this.cmds.get(name.slice(2)) : undefined);
        if (c) {
          if (this.xdcMode && c.meta.notInXdc && this.depth === 0) {
            this.noteOnce('xdc:' + name, 'warn', L(
              `Команда «${name}» не поддерживается в управляемом XDC-файле Vivado (там допустимы только set, list, expr и команды ограничений). ` +
              'Такой код размещают в Tcl-скрипте (read_xdc -unmanaged или source). ConstraintLab её выполнит.',
              `Command '${name}' is not supported in a managed Vivado XDC file (only set, list, expr and constraint commands are allowed there). ` +
              'Such code belongs in a Tcl script (read_xdc -unmanaged or source). ConstraintLab will still execute it.'), cmd.line);
          }
          return c.fn(this, args.slice(1), cmd, name);
        }
        const p = this.procs.get(name);
        if (p) return this.callProc(p, args.slice(1), name);
        if (inSubst && args.length === 1 && /^(\*|\d+|\d+:\d+)$/.test(name)) {
          this.noteOnce('brk:' + cmd.line + ':' + name, 'info', L(
            `Квадратные скобки в имени ([${name}]) Tcl воспринимает как подстановку команды; Vivado это прощает, ` +
            `но надёжнее заключать имя в фигурные скобки: {data[${name}]}.`,
            `Tcl treats square brackets in a name ([${name}]) as command substitution; Vivado tolerates this, ` +
            `but it is safer to enclose the name in braces: {data[${name}]}.`), cmd.line);
          return '[' + name + ']';
        }
        throw new TclError(unknownCmdMsg(name, this), cmd.line);
      } finally {
        this.curLine = saveLine;
        this.curCmd = saveCmd;
      }
    }
    evalBody(body) {
      // тело управляющей конструкции (строка или результат)
      const src = toStr(body);
      const cmds = this.parse(src, this.curLine);
      this.depth++;
      try { return this.evalCmds(cmds, false); } finally { this.depth--; }
    }
    evalExpr(s) {
      const ep = new ExprParser(this, s);
      return ep.parse();
    }
    exprStr(s) { return valToStr(this.evalExpr(s)); }
    callProc(p, args, name) {
      if (this.frames.length > 200) throw new TclError(L('слишком глубокая рекурсия', 'recursion too deep'));
      const frame = new Map();
      const params = p.params;
      let ai = 0;
      for (let k = 0; k < params.length; k++) {
        const prm = params[k];
        if (prm.name === 'args' && k === params.length - 1) {
          frame.set('args', new TList(args.slice(ai)));
          ai = args.length;
          continue;
        }
        if (ai < args.length) frame.set(prm.name, args[ai++]);
        else if (prm.def !== undefined) frame.set(prm.name, prm.def);
        else throw new TclError(L(`недостаточно аргументов для процедуры «${name}»`, `not enough arguments for procedure '${name}'`));
      }
      if (ai < args.length) throw new TclError(L(`слишком много аргументов для процедуры «${name}»`, `too many arguments for procedure '${name}'`));
      this.frames.push(frame);
      this.depth++;
      try {
        return this.evalCmds(p.body, false);
      } catch (e) {
        if (e instanceof ReturnSig) return e.value;
        throw e;
      } finally {
        this.frames.pop();
        this.depth--;
      }
    }

    // Выполнение скрипта верхнего уровня: ошибки не останавливают выполнение (как при чтении XDC в Vivado)
    runScript(src, label) {
      this.src = label || 'user';
      let cmds;
      try {
        cmds = this.parse(src, 1);
      } catch (e) {
        if (e.isTclError) { this.msg('error', L('Ошибка синтаксиса Tcl: ', 'Tcl syntax error: ') + e.message, e.tclLine); return { ok: false }; }
        throw e;
      }
      let ok = true;
      for (const c of cmds) {
        this.steps = 0;
        try {
          this.evalCommand(c, false);
        } catch (e) {
          ok = false;
          if (e && e.isTclError) this.msg('error', e.message, e.tclLine || c.line, { cmdText: c.text });
          else if (e instanceof BreakSig || e instanceof ContinueSig) this.msg('error', L('break/continue вне цикла', 'break/continue outside a loop'), c.line);
          else if (e instanceof ReturnSig) { /* return на верхнем уровне – завершить */ break; }
          else { this.msg('error', L('Внутренняя ошибка: ', 'Internal error: ') + (e && e.message), c.line); if (typeof console !== 'undefined') console.error(e); }
        }
      }
      return { ok, cmds };
    }
    // Выполнение одной строки консоли: возвращает результат или бросает ошибку
    evalConsole(src) {
      this.src = 'console';
      const save = this.xdcMode;
      this.xdcMode = false;
      try {
        const cmds = this.parse(src, 1);
        this.steps = 0;
        return this.evalCmds(cmds, false);
      } finally { this.xdcMode = save; }
    }
  }

  function unknownCmdMsg(name, I) {
    const all = [...I.cmds.keys(), ...I.procs.keys()];
    const sg = U.suggest(name, all);
    if (name === '#' || name.startsWith('#')) {
      return L('комментарий «#» в середине команды: в Tcl «#» начинает комментарий только в начале команды, используйте «;#»', "'#' comment in the middle of a command: in Tcl, '#' starts a comment only at the beginning of a command; use ';#'");
    }
    if (/^-?\d/.test(name)) return L(`«${name}» – число на месте имени команды (возможно, перенос строки внутри команды без «\\»?)`, `'${name}' is a number where a command name is expected (a line break inside a command without '\\'?)`);
    return L(`неизвестная команда «${name}»`, `unknown command '${name}'`) + (sg ? L(` – может быть, «${sg}»?`, ` – did you mean '${sg}'?`) : '');
  }

  // ---------------------------------------------------------------------------
  // Встроенные команды Tcl
  // ---------------------------------------------------------------------------
  function argErr(usage) { return new TclError(L('неверное число аргументов, должно быть: ', 'wrong number of arguments, should be: ') + usage); }

  function registerBuiltins(I) {
    const R = (n, f, meta) => I.register(n, f, Object.assign({ builtin: true }, meta || {}));
    const NX = { notInXdc: true };

    R('set', (I, a) => {
      if (a.length === 1) { const r = I.resolveName(toStr(a[0])); return I.getVar(r.name, r.index); }
      if (a.length === 2) { const r = I.resolveName(toStr(a[0])); return I.setVar(r.name, a[1], r.index); }
      throw argErr('set varName ?newValue?');
    });
    R('unset', (I, a) => { for (const x of a) { const s = toStr(x); if (s === '-nocomplain') continue; I.unsetVar(s); } return ''; }, NX);
    R('incr', (I, a) => {
      if (a.length < 1 || a.length > 2) throw argErr('incr varName ?increment?');
      const r = I.resolveName(toStr(a[0]));
      let cur = 0;
      if (I.hasVar(toStr(a[0]))) {
        const v = numVal({ t: 's', v: toStr(I.getVar(r.name, r.index)) });
        if (!v || v.t !== 'i') throw new TclError(L('incr: значение переменной не целое', 'incr: variable value is not an integer'));
        cur = v.v;
      }
      const inc = a.length === 2 ? numVal({ t: 's', v: toStr(a[1]) }) : { t: 'i', v: 1 };
      if (!inc || inc.t !== 'i') throw new TclError(L('incr: приращение должно быть целым', 'incr: increment must be an integer'));
      return I.setVar(r.name, String(cur + inc.v), r.index);
    }, NX);
    R('append', (I, a) => {
      if (a.length < 1) throw argErr('append varName ?value ...?');
      const r = I.resolveName(toStr(a[0]));
      let cur = I.hasVar(toStr(a[0])) ? toStr(I.getVar(r.name, r.index)) : '';
      for (const x of a.slice(1)) cur += toStr(x);
      return I.setVar(r.name, cur, r.index);
    }, NX);
    R('lappend', (I, a) => {
      if (a.length < 1) throw argErr('lappend varName ?value ...?');
      const r = I.resolveName(toStr(a[0]));
      let cur = I.hasVar(toStr(a[0])) ? I.getVar(r.name, r.index) : '';
      const add = a.slice(1);
      if ((cur && (cur.isTList || cur.isColl)) || add.some((x) => x && (x.isColl || x.isTList))) {
        const items = cur === '' ? [] : listItems(cur);
        return I.setVar(r.name, new TList(items.concat(add)), r.index);
      }
      const items = cur === '' ? [] : U.parseList(toStr(cur));
      for (const x of add) items.push(toStr(x));
      return I.setVar(r.name, U.formatList(items), r.index);
    }, NX);
    R('list', (I, a) => {
      if (a.some((x) => x && (x.isColl || x.isTList))) return new TList(a.slice());
      return U.formatList(a.map(toStr));
    });
    R('llength', (I, a) => { if (a.length !== 1) throw argErr('llength list'); return String(listItems(a[0]).length); });
    R('lindex', (I, a) => {
      if (a.length < 1) throw argErr('lindex list ?index ...?');
      let v = a[0];
      for (const ix of a.slice(1)) {
        const items = listItems(v);
        const k = listIndex(toStr(ix), items.length);
        v = (k < 0 || k >= items.length) ? '' : items[k];
      }
      return v;
    });
    R('lrange', (I, a) => {
      if (a.length !== 3) throw argErr('lrange list first last');
      const items = listItems(a[0]);
      const f = Math.max(0, listIndex(toStr(a[1]), items.length));
      const l = Math.min(items.length - 1, listIndex(toStr(a[2]), items.length));
      const sub = items.slice(f, l + 1);
      if (sub.some((x) => x && (x.isColl || x.isTList))) return new TList(sub);
      return U.formatList(sub.map(toStr));
    });
    R('lreverse', (I, a) => { if (a.length !== 1) throw argErr('lreverse list'); return U.formatList(listItems(a[0]).map(toStr).reverse()); });
    R('lsearch', (I, a) => {
      let mode = 'glob', all = false, inline = false, nocase = false;
      const rest = [];
      for (const x of a) {
        const s = toStr(x);
        if (s === '-exact') mode = 'exact'; else if (s === '-glob') mode = 'glob'; else if (s === '-regexp') mode = 'regexp';
        else if (s === '-all') all = true; else if (s === '-inline') inline = true; else if (s === '-nocase') nocase = true;
        else rest.push(x);
      }
      if (rest.length !== 2) throw argErr('lsearch ?options? list pattern');
      const items = listItems(rest[0]).map(toStr);
      const pat = toStr(rest[1]);
      const test = (s) => mode === 'exact' ? (nocase ? s.toLowerCase() === pat.toLowerCase() : s === pat)
        : mode === 'regexp' ? new RegExp(pat, nocase ? 'i' : '').test(s)
          : U.globToRe(pat, { slash: true, nocase }).test(s);
      const idx = [];
      items.forEach((s, k) => { if (test(s)) idx.push(k); });
      if (all) return inline ? U.formatList(idx.map((k) => items[k])) : idx.join(' ');
      if (!idx.length) return inline ? '' : '-1';
      return inline ? items[idx[0]] : String(idx[0]);
    }, NX);
    R('lsort', (I, a) => {
      let mode = 'ascii', dec = false, unique = false;
      const rest = [];
      for (const x of a) {
        const s = toStr(x);
        if (s === '-integer' || s === '-real') mode = 'num'; else if (s === '-dictionary') mode = 'dict'; else if (s === '-ascii') mode = 'ascii';
        else if (s === '-decreasing') dec = true; else if (s === '-increasing') dec = false; else if (s === '-unique') unique = true;
        else rest.push(x);
      }
      if (rest.length !== 1) throw argErr('lsort ?options? list');
      let items = listItems(rest[0]).map(toStr);
      if (unique) items = [...new Set(items)];
      items.sort((x, y) => mode === 'num' ? parseFloat(x) - parseFloat(y)
        : mode === 'dict' ? x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }) : (x < y ? -1 : x > y ? 1 : 0));
      if (dec) items.reverse();
      return U.formatList(items);
    }, NX);
    R('lassign', (I, a) => {
      if (a.length < 1) throw argErr('lassign list ?varName ...?');
      const items = listItems(a[0]);
      a.slice(1).forEach((v, k) => I.setVar(toStr(v), k < items.length ? items[k] : ''));
      const rest = items.slice(a.length - 1);
      return U.formatList(rest.map(toStr));
    }, NX);
    R('concat', (I, a) => {
      if (a.some((x) => x && x.isColl) && a.every((x) => (x && (x.isColl || x.isTList)) || toStr(x).trim() === '')) {
        const items = [];
        for (const x of a) {
          if (x && x.isColl) items.push(...x.items);
          else if (x && x.isTList) for (const y of x.items) { if (y && y.isColl) items.push(...y.items); }
        }
        return U.collOf([...new Set(items)]);
      }
      return a.map((x) => toStr(x).trim()).filter((s) => s !== '').join(' ');
    });
    R('join', (I, a) => {
      if (a.length < 1 || a.length > 2) throw argErr('join list ?joinString?');
      return listItems(a[0]).map(toStr).join(a.length === 2 ? toStr(a[1]) : ' ');
    }, NX);
    R('split', (I, a) => {
      if (a.length < 1 || a.length > 2) throw argErr('split string ?splitChars?');
      const s = toStr(a[0]);
      const ch = a.length === 2 ? toStr(a[1]) : ' \t\n\r';
      if (ch === '') return U.formatList([...s]);
      const out = [];
      let cur = '';
      for (const c of s) { if (ch.includes(c)) { out.push(cur); cur = ''; } else cur += c; }
      out.push(cur);
      return U.formatList(out);
    }, NX);
    R('string', (I, a) => stringCmd(I, a), NX);
    R('format', (I, a) => { if (!a.length) throw argErr('format formatString ?arg ...?'); return tclFormat(toStr(a[0]), a.slice(1).map(toStr)); }, NX);
    R('puts', (I, a) => {
      let args = a.map(toStr);
      let nl = true;
      if (args[0] === '-nonewline') { nl = false; args = args.slice(1); }
      if (args.length === 2) args = args.slice(1);
      if (args.length !== 1) throw argErr('puts ?-nonewline? ?channelId? string');
      I.out.push(args[0] + (nl ? '\n' : ''));
      return '';
    }, NX);
    R('expr', (I, a) => {
      if (!a.length) throw argErr('expr arg ?arg ...?');
      if (a.some((x) => x && x.isColl)) throw new TclError(L('expr: коллекция объектов не может быть операндом', 'expr: an object collection cannot be an operand'));
      return I.exprStr(a.map(toStr).join(' '));
    });
    R('if', (I, a) => {
      let k = 0;
      for (;;) {
        if (k >= a.length) throw argErr('if expr1 ?then? body1 elseif expr2 ?then? body2 ... ?else? ?bodyN?');
        const cond = boolOf(I.evalExpr(toStr(a[k++])), toStr(a[k - 1]));
        if (toStr(a[k]) === 'then') k++;
        if (k >= a.length) throw new TclError(L('if: нет тела после условия', 'if: no body after the condition'));
        const body = a[k++];
        if (cond) return I.evalBody(body);
        if (k >= a.length) return '';
        const kw = toStr(a[k]);
        if (kw === 'elseif') { k++; continue; }
        if (kw === 'else') { k++; if (k >= a.length) throw new TclError(L('if: нет тела после else', 'if: no body after else')); return I.evalBody(a[k]); }
        return I.evalBody(a[k]);
      }
    }, NX);
    R('for', (I, a) => {
      if (a.length !== 4) throw argErr('for start test next command');
      I.evalBody(a[0]);
      let guard = 0;
      while (boolOf(I.evalExpr(toStr(a[1])), toStr(a[1]))) {
        if (++guard > 100000) throw new TclError(L('for: слишком много итераций', 'for: too many iterations'));
        try { I.evalBody(a[3]); } catch (e) {
          if (e instanceof BreakSig) break;
          if (!(e instanceof ContinueSig)) throw e;
        }
        I.evalBody(a[2]);
      }
      return '';
    }, NX);
    R('while', (I, a) => {
      if (a.length !== 2) throw argErr('while test command');
      let guard = 0;
      while (boolOf(I.evalExpr(toStr(a[0])), toStr(a[0]))) {
        if (++guard > 100000) throw new TclError(L('while: слишком много итераций', 'while: too many iterations'));
        try { I.evalBody(a[1]); } catch (e) {
          if (e instanceof BreakSig) break;
          if (!(e instanceof ContinueSig)) throw e;
        }
      }
      return '';
    }, NX);
    R('foreach', (I, a) => {
      if (a.length < 3 || a.length % 2 === 0) throw argErr('foreach varList list ?varList list ...? command');
      const body = a[a.length - 1];
      const specs = [];
      for (let k = 0; k < a.length - 1; k += 2) {
        specs.push({ vars: U.parseList(toStr(a[k])), items: listItems(a[k + 1]) });
      }
      let n = 0;
      for (const s of specs) n = Math.max(n, Math.ceil(s.items.length / s.vars.length));
      for (let it = 0; it < n; it++) {
        for (const s of specs) {
          s.vars.forEach((v, j) => {
            const idx = it * s.vars.length + j;
            I.setVar(v, idx < s.items.length ? s.items[idx] : '');
          });
        }
        try { I.evalBody(body); } catch (e) {
          if (e instanceof BreakSig) break;
          if (!(e instanceof ContinueSig)) throw e;
        }
      }
      return '';
    }, NX);
    R('break', () => { throw new BreakSig(); }, NX);
    R('continue', () => { throw new ContinueSig(); }, NX);
    R('return', (I, a) => { throw new ReturnSig(a.length ? a[a.length - 1] : ''); }, NX);
    R('proc', (I, a) => {
      if (a.length !== 3) throw argErr('proc name args body');
      const params = U.parseList(toStr(a[1])).map((p) => {
        const l = U.parseList(p);
        return { name: l[0], def: l.length > 1 ? l[1] : undefined };
      });
      const body = I.parse(toStr(a[2]), I.curLine);
      I.procs.set(toStr(a[0]), { params, body });
      return '';
    }, NX);
    R('global', (I, a) => {
      if (I.frames.length === 1) return '';
      for (const x of a) { const n = toStr(x); I.vars.set(n, { __link: true, frame: I.globals, name: n }); }
      return '';
    }, NX);
    R('info', (I, a) => {
      const sub = toStr(a[0] || '');
      if (sub === 'exists') return I.hasVar(toStr(a[1])) ? '1' : '0';
      if (sub === 'commands') return U.formatList([...I.cmds.keys()].filter((n) => !a[1] || U.globToRe(toStr(a[1]), { slash: true }).test(n)).sort());
      if (sub === 'procs') return U.formatList([...I.procs.keys()]);
      if (sub === 'vars' || sub === 'globals') return U.formatList([...I.vars.keys()]);
      throw new TclError(L('info: поддерживаются exists, commands, procs, vars', 'info: supported subcommands are exists, commands, procs, vars'));
    }, NX);
    R('catch', (I, a) => {
      if (a.length < 1 || a.length > 2) throw argErr('catch script ?resultVarName?');
      try {
        const r = I.evalBody(a[0]);
        if (a.length === 2) I.setVar(toStr(a[1]), r);
        return '0';
      } catch (e) {
        if (e instanceof BreakSig || e instanceof ContinueSig || e instanceof ReturnSig) throw e;
        if (a.length === 2) I.setVar(toStr(a[1]), e.message || String(e));
        return '1';
      }
    }, NX);
    R('error', (I, a) => { throw new TclError(toStr(a[0] || 'error')); }, NX);
    R('eval', (I, a) => I.evalBody(a.map(toStr).join(' ')), NX);
    R('regexp', (I, a) => {
      let nocase = false, k = 0;
      while (k < a.length && toStr(a[k]).startsWith('-')) { const o = toStr(a[k]); if (o === '-nocase') nocase = true; else if (o === '--') { k++; break; } k++; }
      if (a.length - k < 2) throw argErr('regexp ?switches? exp string ?matchVar? ?subMatchVar ...?');
      const re = new RegExp(toStr(a[k]), nocase ? 'i' : '');
      const m = re.exec(toStr(a[k + 1]));
      const vars = a.slice(k + 2).map(toStr);
      vars.forEach((v, j) => I.setVar(v, m ? (m[j] === undefined ? '' : m[j]) : ''));
      return m ? '1' : '0';
    }, NX);
    R('regsub', (I, a) => {
      let all = false, nocase = false, k = 0;
      while (k < a.length && toStr(a[k]).startsWith('-')) { const o = toStr(a[k]); if (o === '-all') all = true; else if (o === '-nocase') nocase = true; else if (o === '--') { k++; break; } k++; }
      if (a.length - k < 3) throw argErr('regsub ?switches? exp string subSpec ?varName?');
      const re = new RegExp(toStr(a[k]), (all ? 'g' : '') + (nocase ? 'i' : ''));
      const sub = toStr(a[k + 2]).replace(/\\(\d)/g, '$$$1').replace(/&/g, '$$&');
      const r = toStr(a[k + 1]).replace(re, sub);
      if (a.length - k === 4) { I.setVar(toStr(a[k + 3]), r); return '1'; }
      return r;
    }, NX);
  }

  function listIndex(s, len) {
    s = s.trim();
    if (s === 'end') return len - 1;
    let m = /^end-(\d+)$/.exec(s);
    if (m) return len - 1 - parseInt(m[1], 10);
    m = /^end\+(\d+)$/.exec(s);
    if (m) return len - 1 + parseInt(m[1], 10);
    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    throw new TclError(L(`некорректный индекс «${s}»`, `invalid index '${s}'`));
  }

  function stringCmd(I, a) {
    const sub = toStr(a[0] || '');
    const args = a.slice(1).map(toStr);
    const opt = (o) => { const k = args.indexOf(o); if (k >= 0) { args.splice(k, 1); return true; } return false; };
    switch (sub) {
      case 'length': return String(args[0].length);
      case 'tolower': return args[0].toLowerCase();
      case 'toupper': return args[0].toUpperCase();
      case 'trim': return args.length > 1 ? trimChars(args[0], args[1], true, true) : args[0].trim();
      case 'trimleft': return args.length > 1 ? trimChars(args[0], args[1], true, false) : args[0].replace(/^\s+/, '');
      case 'trimright': return args.length > 1 ? trimChars(args[0], args[1], false, true) : args[0].replace(/\s+$/, '');
      case 'equal': { const nc = opt('-nocase'); return (nc ? args[0].toLowerCase() === args[1].toLowerCase() : args[0] === args[1]) ? '1' : '0'; }
      case 'compare': { const nc = opt('-nocase'); let x = args[0], y = args[1]; if (nc) { x = x.toLowerCase(); y = y.toLowerCase(); } return String(x < y ? -1 : x > y ? 1 : 0); }
      case 'match': { const nc = opt('-nocase'); return U.globToRe(args[0], { slash: true, nocase: nc }).test(args[1]) ? '1' : '0'; }
      case 'first': return String(args[1].indexOf(args[0]));
      case 'last': return String(args[1].lastIndexOf(args[0]));
      case 'index': { const k = listIndex(args[1], args[0].length); return args[0][k] || ''; }
      case 'range': { const f = Math.max(0, listIndex(args[1], args[0].length)); const l = listIndex(args[2], args[0].length); return args[0].slice(f, l + 1); }
      case 'repeat': return args[0].repeat(parseInt(args[1], 10));
      case 'map': {
        const nc = opt('-nocase');
        const pairs = U.parseList(args[0]);
        let s = args[1], out = '';
        outer: for (let i = 0; i < s.length;) {
          for (let k = 0; k + 1 < pairs.length; k += 2) {
            const from = pairs[k];
            if (!from) continue;
            const seg = s.substr(i, from.length);
            if (nc ? seg.toLowerCase() === from.toLowerCase() : seg === from) { out += pairs[k + 1]; i += from.length; continue outer; }
          }
          out += s[i]; i++;
        }
        return out;
      }
      case 'is': {
        const cls = args[0];
        const v = args[args.length - 1];
        if (cls === 'integer') return /^\s*[+-]?\d+\s*$/.test(v) ? '1' : '0';
        if (cls === 'double') return numVal({ t: 's', v }) ? '1' : '0';
        if (cls === 'boolean') return /^(0|1|true|false|yes|no|on|off)$/i.test(v.trim()) ? '1' : '0';
        return '0';
      }
    }
    throw new TclError(L(`string: подкоманда «${sub}» не поддерживается`, `string: subcommand '${sub}' is not supported`));
  }
  function trimChars(s, chars, left, right) {
    let a = 0, b = s.length;
    if (left) while (a < b && chars.includes(s[a])) a++;
    if (right) while (b > a && chars.includes(s[b - 1])) b--;
    return s.slice(a, b);
  }

  function tclFormat(fmtStr, args) {
    let k = 0;
    return fmtStr.replace(/%([-+ 0#]*)(\d+|\*)?(?:\.(\d+))?([diouxXeEfgGsc%])/g, (m, flags, width, prec, conv) => {
      if (conv === '%') return '%';
      if (width === '*') width = args[k++];
      const a = args[k++];
      if (a === undefined) throw new TclError(L('format: недостаточно аргументов', 'format: not enough arguments'));
      let s;
      switch (conv) {
        case 'd': case 'i': case 'u': { const v = numVal({ t: 's', v: a }); if (!v) throw new TclError(L(`format: «${a}» не число`, `format: '${a}' is not a number`)); s = String(Math.trunc(v.v)); if (flags.includes('+') && v.v >= 0) s = '+' + s; break; }
        case 'o': s = Math.trunc(parseFloat(a)).toString(8); break;
        case 'x': s = Math.trunc(parseFloat(a)).toString(16); break;
        case 'X': s = Math.trunc(parseFloat(a)).toString(16).toUpperCase(); break;
        case 'f': { const v = parseFloat(a); if (isNaN(v)) throw new TclError(L(`format: «${a}» не число`, `format: '${a}' is not a number`)); s = v.toFixed(prec === undefined ? 6 : parseInt(prec, 10)); if (flags.includes('+') && v >= 0) s = '+' + s; break; }
        case 'e': case 'E': { const v = parseFloat(a); s = v.toExponential(prec === undefined ? 6 : parseInt(prec, 10)).replace(/e([+-])(\d)$/, 'e$10$2'); if (conv === 'E') s = s.toUpperCase(); break; }
        case 'g': case 'G': { const v = parseFloat(a); s = String(Number(v.toPrecision(prec === undefined ? 6 : Math.max(1, parseInt(prec, 10))))); break; }
        case 's': s = prec !== undefined ? a.slice(0, parseInt(prec, 10)) : a; break;
        case 'c': s = String.fromCharCode(parseInt(a, 10)); break;
      }
      const w = width ? parseInt(width, 10) : 0;
      if (s.length < w) {
        if (flags.includes('-')) s = s.padEnd(w);
        else if (flags.includes('0') && conv !== 's') { const neg = s[0] === '-' || s[0] === '+'; s = neg ? s[0] + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0'); }
        else s = s.padStart(w);
      }
      return s;
    });
  }

  XT.tcl = { Interp, Parser, TclError, TList, toStr, listItems, numVal, fmtDouble, BreakSig, ContinueSig, ReturnSig };
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
