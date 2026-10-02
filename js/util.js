/* ConstraintLab – общие утилиты: точные дроби, списки Tcl, glob, форматирование */
(function (XT) {
  'use strict';
  // Язык интерфейса: 'ru' или 'en'. В браузере задаётся до загрузки сценариев (window.XT_LANG),
  // в Node.js – заранее присвоенным globalThis.XT = { lang: 'en' }; по умолчанию русский.
  XT.lang = (typeof window !== 'undefined' && (window.XT_LANG === 'en' || window.XT_LANG === 'ru')) ? window.XT_LANG : (XT.lang === 'en' ? 'en' : 'ru');
  // XT.L('русский', 'English') – строка на текущем языке (если английской нет – русская)
  XT.L = (ru, en) => (XT.lang === 'en' && en !== undefined && en !== null ? en : ru);

  // ---------------------------------------------------------------------------
  // Точные рациональные числа на BigInt (время в нс)
  // ---------------------------------------------------------------------------
  function absB(a) { return a < 0n ? -a : a; }
  function gcdB(a, b) { a = absB(a); b = absB(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  function lcmB(a, b) { if (a === 0n || b === 0n) return 0n; return absB((a / gcdB(a, b)) * b); }

  class Frac {
    constructor(n, d) {
      if (d === undefined) d = 1n;
      if (typeof n !== 'bigint') n = BigInt(n);
      if (typeof d !== 'bigint') d = BigInt(d);
      if (d === 0n) throw new Error(XT.L('деление на ноль', 'division by zero'));
      if (d < 0n) { n = -n; d = -d; }
      const g = gcdB(n, d);
      if (g > 1n) { n /= g; d /= g; }
      this.n = n; this.d = d;
    }
    static of(x) {
      if (x instanceof Frac) return x;
      if (typeof x === 'bigint') return new Frac(x, 1n);
      if (typeof x === 'number') return Frac.fromNumber(x);
      if (typeof x === 'string') {
        const f = Frac.parse(x);
        if (!f) throw new Error(XT.L('не число: ', 'not a number: ') + x);
        return f;
      }
      throw new Error(XT.L('Frac.of: неподдерживаемое значение', 'Frac.of: unsupported value'));
    }
    // Точный разбор десятичной строки; при избыточной точности – приближение цепной дробью
    static parse(s) {
      s = String(s).trim();
      const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);
      if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
        if (/^[+-]?0x[0-9a-f]+$/i.test(s)) return new Frac(BigInt(parseInt(s, 16)), 1n);
        return null;
      }
      const sign = m[1] === '-' ? -1n : 1n;
      const ip = m[2] || '0', fp = m[3] || '';
      const exp = m[4] ? parseInt(m[4], 10) : 0;
      if (fp.length > 9 || Math.abs(exp) > 12) return Frac.fromNumber(Number(s));
      let n = BigInt(ip + fp) * sign;
      let d = 10n ** BigInt(fp.length);
      if (exp > 0) n *= 10n ** BigInt(exp); else if (exp < 0) d *= 10n ** BigInt(-exp);
      return new Frac(n, d);
    }
    static fromNumber(x) {
      if (!isFinite(x)) throw new Error(XT.L('не конечное число', 'not a finite number'));
      if (Number.isInteger(x)) return new Frac(BigInt(x), 1n);
      const sign = x < 0 ? -1 : 1;
      const v = Math.abs(x);
      let h0 = 0, h1 = 1, k0 = 1, k1 = 0, r = v;
      for (let i = 0; i < 64; i++) {
        const a = Math.floor(r);
        const h2 = a * h1 + h0, k2 = a * k1 + k0;
        if (k2 > 1e9 || h2 > 9e15) break;
        h0 = h1; h1 = h2; k0 = k1; k1 = k2;
        if (Math.abs(v - h1 / k1) <= 1e-12 * Math.max(1, v)) break;
        const fr = r - a;
        if (fr < 1e-15) break;
        r = 1 / fr;
      }
      return new Frac(BigInt(sign * h1), BigInt(k1));
    }
    static lcm(a, b) { a = Frac.of(a); b = Frac.of(b); return new Frac(lcmB(a.n, b.n), gcdB(a.d, b.d)); }
    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) { o = Frac.of(o); if (o.n === 0n) throw new Error(XT.L('деление на ноль', 'division by zero')); return new Frac(this.n * o.d, this.d * o.n); }
    neg() { return new Frac(-this.n, this.d); }
    abs() { return this.n < 0n ? this.neg() : this; }
    cmp(o) { o = Frac.of(o); const a = this.n * o.d, b = o.n * this.d; return a < b ? -1 : a > b ? 1 : 0; }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    le(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    ge(o) { return this.cmp(o) >= 0; }
    sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
    isZero() { return this.n === 0n; }
    isInt() { return this.d === 1n; }
    floor() { let q = this.n / this.d; if (this.n % this.d !== 0n && this.n < 0n) q -= 1n; return q; }
    ceil() { let q = this.n / this.d; if (this.n % this.d !== 0n && this.n > 0n) q += 1n; return q; }
    // остаток по модулю m (результат в [0, m))
    mod(m) { m = Frac.of(m); const q = this.div(m).floor(); return this.sub(m.mul(q)); }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return fmt(this.toNumber()); }
  }
  Frac.ZERO = new Frac(0n, 1n);

  // ---------------------------------------------------------------------------
  // Форматирование
  // ---------------------------------------------------------------------------
  function num(x) { return x instanceof Frac ? x.toNumber() : Number(x); }
  function fmt(x, digits) {
    if (x === null || x === undefined) return '–';
    const v = num(x);
    if (!isFinite(v)) return String(v);
    const s = v.toFixed(digits === undefined ? 3 : digits);
    return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
  }
  // компактная запись: 2.5, 10, 3.333
  function fmtShort(x) {
    const v = num(x);
    const s = v.toFixed(3).replace(/\.?0+$/, '');
    return s === '-0' ? '0' : s;
  }
  function approxEq(a, b, tol) {
    if (a === null || a === undefined || b === null || b === undefined) return a === b;
    return Math.abs(num(a) - num(b)) <= (tol === undefined ? 0.0005 : tol);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Русские формы множественного числа: plural(5, 'путь', 'пути', 'путей')
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function levenshtein(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  function suggest(word, candidates, maxDist) {
    let best = null, bd = Infinity;
    for (const c of candidates) {
      const d = levenshtein(word, c);
      if (d < bd) { bd = d; best = c; }
    }
    const lim = maxDist === undefined ? Math.max(2, Math.floor(word.length / 3)) : maxDist;
    return bd <= lim ? best : null;
  }

  // ---------------------------------------------------------------------------
  // Списки Tcl
  // ---------------------------------------------------------------------------
  function parseList(s) {
    s = String(s);
    const out = [];
    let i = 0;
    const n = s.length;
    const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';
    while (i < n) {
      while (i < n && isWs(s[i])) i++;
      if (i >= n) break;
      if (s[i] === '{') {
        let depth = 1, j = i + 1, buf = '';
        while (j < n) {
          const c = s[j];
          if (c === '\\' && j + 1 < n) { buf += c + s[j + 1]; j += 2; continue; }
          if (c === '{') depth++;
          else if (c === '}') { depth--; if (depth === 0) break; }
          buf += c; j++;
        }
        if (depth !== 0) throw new Error(XT.L('несбалансированные фигурные скобки в списке', 'unbalanced braces in list'));
        out.push(buf);
        i = j + 1;
        if (i < n && !isWs(s[i])) throw new Error(XT.L('лишние символы после «}» в элементе списка', "extra characters after '}' in list element"));
      } else if (s[i] === '"') {
        let j = i + 1, buf = '';
        while (j < n && s[j] !== '"') {
          if (s[j] === '\\' && j + 1 < n) { buf += unescapeChar(s[j + 1]); j += 2; continue; }
          buf += s[j]; j++;
        }
        if (j >= n) throw new Error(XT.L('нет закрывающей кавычки в списке', 'missing closing quote in list'));
        out.push(buf);
        i = j + 1;
      } else {
        let buf = '';
        while (i < n && !isWs(s[i])) {
          if (s[i] === '\\' && i + 1 < n) { buf += unescapeChar(s[i + 1]); i += 2; continue; }
          buf += s[i]; i++;
        }
        out.push(buf);
      }
    }
    return out;
  }
  function unescapeChar(c) {
    return ({ n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', a: '\x07', b: '\b' })[c] || c;
  }
  function bracesBalanced(s) {
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\') { i++; continue; }
      if (c === '{') d++;
      else if (c === '}') { d--; if (d < 0) return false; }
    }
    return d === 0;
  }
  function formatElem(e) {
    e = String(e);
    if (e === '') return '{}';
    if (!/[\s{}\[\]$"\\;#]/.test(e)) return e;
    if (bracesBalanced(e) && !/\\$/.test(e)) return '{' + e + '}';
    return e.replace(/([\s{}\[\]$"\\;])/g, '\\$1');
  }
  function formatList(arr) { return arr.map(formatElem).join(' '); }

  // ---------------------------------------------------------------------------
  // Коллекции объектов (как в Vivado/PrimeTime)
  // ---------------------------------------------------------------------------
  class Coll {
    constructor(type, items) {
      this.isColl = true;
      this.type = type;
      this.items = items || [];
    }
    toString() { return formatList(this.items.map((o) => o.name)); }
    get length() { return this.items.length; }
  }
  function collOf(items) {
    const types = new Set(items.map((o) => o.kind));
    return new Coll(types.size === 1 ? [...types][0] : (types.size ? 'mixed' : 'empty'), items);
  }

  // ---------------------------------------------------------------------------
  // Glob → RegExp (скобки [] – литералы, как в именах шин Vivado)
  // ---------------------------------------------------------------------------
  const reCache = new Map();
  function globToRe(pat, opts) {
    opts = opts || {};
    const key = pat + '\u0001' + (opts.slash ? 1 : 0) + (opts.nocase ? 1 : 0);
    if (reCache.has(key)) return reCache.get(key);
    let re = '';
    for (let i = 0; i < pat.length; i++) {
      const ch = pat[i];
      if (ch === '\\' && i + 1 < pat.length) { re += pat[i + 1].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); i++; continue; }
      if (ch === '*') re += opts.slash ? '.*' : '[^/]*';
      else if (ch === '?') re += opts.slash ? '.' : '[^/]';
      else re += ch.replace(/[.+^${}()|[\]\\\/]/g, '\\$&');
    }
    const r = new RegExp('^' + re + '$', opts.nocase ? 'i' : '');
    reCache.set(key, r);
    return r;
  }
  function hasWild(s) { return /[*?]/.test(s); }

  // ---------------------------------------------------------------------------
  // Сжатие имён шин: a[0]/D … a[7]/D → a[0..7]/D
  // ---------------------------------------------------------------------------
  function compressNames(names, maxShow) {
    const groups = new Map();
    const singles = [];
    for (const nm of names) {
      const re = /\[(\d+)\]/g;
      let m, last = null;
      while ((m = re.exec(nm))) last = m;
      if (!last) { singles.push(nm); continue; }
      const pre = nm.slice(0, last.index), post = nm.slice(last.index + last[0].length);
      const k = pre + '\u0000' + post;
      if (!groups.has(k)) groups.set(k, { pre, post, idx: [] });
      groups.get(k).idx.push(parseInt(last[1], 10));
    }
    const out = [...singles];
    for (const g of groups.values()) {
      const idx = [...new Set(g.idx)].sort((a, b) => a - b);
      if (idx.length === 1) { out.push(`${g.pre}[${idx[0]}]${g.post}`); continue; }
      const runs = [];
      let s = idx[0], p = idx[0];
      for (let i = 1; i <= idx.length; i++) {
        if (i < idx.length && idx[i] === p + 1) { p = idx[i]; continue; }
        runs.push(s === p ? `${s}` : `${s}..${p}`);
        if (i < idx.length) { s = p = idx[i]; }
      }
      out.push(`${g.pre}[${runs.join(',')}]${g.post}`);
    }
    out.sort();
    const lim = maxShow || 6;
    if (out.length > lim) return out.slice(0, lim).join(', ') + ` … (+${out.length - lim})`;
    return out.join(', ');
  }

  function uniq(arr) { return [...new Set(arr)]; }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  XT.util = {
    Frac, gcdB, lcmB, num, fmt, fmtShort, approxEq, escapeHtml, plural, levenshtein, suggest,
    parseList, formatList, formatElem, Coll, collOf, globToRe, hasWild, compressNames, uniq, deepClone,
  };
  XT.Frac = Frac;
  XT.Coll = Coll;
})(typeof globalThis !== 'undefined' ? (globalThis.XT = globalThis.XT || {}) : (window.XT = window.XT || {}));
