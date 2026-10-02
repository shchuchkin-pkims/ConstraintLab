/* Модуль 1. Тактовые сигналы: основы (Vivado XDC) */
XT.bank.module({
  id: 'clocks', order: 10, title: '1. Тактовые сигналы: основы',
  about: 'create_clock, форма сигнала, дифференциальные входы, асинхронные тактовые сигналы, автоматически выводимые тактовые сигналы MMCM',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'clocks.primary', module: 'clocks', order: 1, level: 1, tool: 'vivado',
  lang: 'both', langNote: '`create_clock` одинаково записывается в Vivado и в САПР ASIC (Design Compiler, PrimeTime, Genus, Innovus, OpenSTA).',
  title: 'Первичный тактовый сигнал 100 МГц',
  tags: ['create_clock'],
  text: `
    На плате установлен кварцевый генератор **100 МГц**. Его выход подключён к выводу \`sys_clk\` ПЛИС (Artix-7). Внутри ПЛИС сигнал проходит через входной буфер \`IBUF\` и глобальный тактовый буфер \`BUFG\` и тактирует восьмиразрядный счётчик.

    Пока тактовый сигнал не описан, Vivado не знает его частоту: пути между регистрами счётчика не анализируются, а \`check_timing\` выдаёт предупреждение *no_clock*.

    **Задание.** Опишите первичный тактовый сигнал с именем \`sys_clk\`.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: 0, y: 58, label: '100 МГц', ext: true },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС (Artix-7)' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 90, y: 67 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 196, y: 64, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 268, y: 64, noName: true },
      { id: 'r', t: 'ff', name: 'cnt_reg', w: 8, x: 390, y: 40 },
      { id: 'inc', t: 'logic', name: 'cnt_inc', w: 8, label: '+1', x: 500, y: 112 },
    ],
    wires: [
      { from: 'osc.out', to: 'p.pad' },
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk', label: 'sys_clk' },
      { from: 'r.Q', to: 'inc.I' },
      { from: 'inc.O', to: 'r.D', my: 16 },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Тактовый сигнал генератора на выводе ПЛИС', t: [-1, 26],
      signals: [{ name: 'sys_clk', clock: { period: 10 }, arrows: 'rise' }],
      spans: [{ row: 0, t0: 0, t1: 10, label: 'T = 10 нс', cls: 'clk' }, { row: 0, t0: 10, t1: 15, label: 'высокий уровень 5 нс', cls: 'data' }],
    },
  ],
  solution: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  check: { clockNames: true },
  hints: [
    'Период в наносекундах: T = 1000 / f[МГц].',
    'Первичный тактовый сигнал задают там, где он входит в ПЛИС, – на порту: `[get_ports sys_clk]`.',
    'Синтаксис: `create_clock -name <имя> -period <нс> [get_ports <порт>]`. Форма {0 5} получится по умолчанию.',
  ],
  explain: `
    \`\`\`
    create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
    \`\`\`
    - **-period** задаётся в наносекундах (единица времени XDC). 100 МГц → 10 нс.
    - **-waveform** по умолчанию {0 T/2}: фронт в момент 0, спад в середине периода. Для генератора с симметричным выходом этого достаточно.
    - **Почему порт.** Точка определения тактового сигнала – это начало отсчёта задержки тактового дерева. При определении на порту Vivado учитывает задержку IBUF, BUFG и трассировки до каждого регистра и поэтому правильно рассчитывает и межрегистровые пути, и пути ввода/вывода. Тактовый сигнал, определённый на выходе BUFG, не учитывал бы задержку входного буфера, и входные интерфейсы анализировались бы неверно.
    - Имя можно не указывать (тогда оно совпадёт с именем порта), но явное имя делает отчёты и остальные ограничения нагляднее.

    Проверка в Vivado: \`report_clocks\`, затем \`check_timing\` – предупреждение *no_clock* должно исчезнуть.
  `,
  tests: [
    { code: 'create_clock -period 100 [get_ports sys_clk]', pass: false, note: 'частота вместо периода', expect: 'период' },
    { code: 'create_clock -name sys_clk -period 10 [get_pins sys_clk_IBUF_BUFG_inst/O]', pass: false, note: 'тактовый сигнал на выходе BUFG', expect: 'не в той точке' },
    { code: 'create_clock -name sys_clk -period 10 sys_clk', pass: true, note: 'неявный поиск порта' },
    { code: 'create_clock -name clk -period 10 [get_ports sys_clk]', pass: false, note: 'другое имя', expect: 'называться' },
    { code: 'set p 10.0\ncreate_clock -name sys_clk -period $p -waveform [list 0 [expr {$p/2}]] [get_ports sys_clk]', pass: true, note: 'через переменные' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'clocks.diff', module: 'clocks', order: 2, level: 1, tool: 'vivado',
  lang: 'both', langNote: 'Команда та же. В ASIC приёмник LVDS – аналоговый блок: если в его модели нет временно́й дуги от площадки к выходу, тактовый сигнал задают на выходе приёмника.',
  title: 'Дифференциальный тактовый сигнал LVDS 200 МГц',
  tags: ['create_clock', 'IBUFDS'],
  text: `
    Опорный генератор **200 МГц** с выходом LVDS подключён к паре выводов \`clk200_p\` и \`clk200_n\`. В ПЛИС пара поступает на дифференциальный входной буфер \`IBUFDS\`, затем на \`BUFG\`.

    **Задание.** Опишите тактовый сигнал с именем \`clk200\`.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'chip', name: 'Генератор LVDS 200 МГц', x: 0, y: 30, bw: 150, bh: 70, ext: true, pins: [{ n: 'OUT+', side: 'r', y: 32 }, { n: 'OUT−', side: 'r', y: 52 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pp', t: 'in', name: 'clk200_p', x: 200, y: 51 },
      { id: 'pn', t: 'in', name: 'clk200_n', x: 200, y: 91 },
      { id: 'ib', t: 'ibufds', name: 'clk200_ibufds', x: 320, y: 52 },
      { id: 'bg', t: 'bufg', name: 'clk200_bufg', x: 400, y: 57, noName: true },
      { id: 'r', t: 'ff', name: 'sample_reg', w: 16, x: 510, y: 22, nameX: 52 },
      { id: 'lg', t: 'logic', name: 'proc', w: 16, label: 'обработка', x: 630, y: 90 },
    ],
    wires: [
      { from: 'osc.OUT+', to: 'pp.pad' },
      { from: 'osc.OUT−', to: 'pn.pad' },
      { from: 'pp', to: 'ib.I', kind: 'clk' },
      { from: 'pn', to: 'ib.IB', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk', label: 'clk200', lx: 459, ly: 66 },
      { from: 'r.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'r.D', my: -2 },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Дифференциальная пара на выводах ПЛИС', t: [-0.5, 12.5],
      signals: [{ name: 'clk200_p', clock: { period: 5 }, arrows: 'rise' }, { name: 'clk200_n', clock: { period: 5, rise: 2.5, fall: 5 } }],
      spans: [{ row: 1, t0: 0, t1: 5, label: 'T = 5 нс', cls: 'clk' }],
      caption: 'Сигнал на N-выводе – инверсная копия сигнала на P-выводе. Это один и тот же тактовый сигнал, а не второй.',
    },
  ],
  solution: `create_clock -name clk200 -period 5.000 [get_ports clk200_p]`,
  check: { clockNames: true },
  hints: [
    'Для буфера IBUFDS описывают только один вывод пары.',
    'Нужен P-вывод: он подключён ко входу I буфера.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk200 -period 5.000 [get_ports clk200_p]
    \`\`\`
    Дифференциальная пара передаёт **один** тактовый сигнал. Vivado распространяет его от P-вывода через IBUFDS; N-вывод в описании не нуждается.

    Если описать тактовый сигнал ещё и на \`clk200_n\`, в одной цепи окажутся два тактовых сигнала: появятся ложные проверки между ними (с полупериодным соотношением фронтов из-за инверсии), а \`check_timing\` сообщит *multiple_clock*.

    Физические ограничения пары (\`PACKAGE_PIN\` и \`IOSTANDARD LVDS\` или \`LVDS_25\`) тоже задают на P-выводе – N-вывод Vivado назначает автоматически.
  `,
  tests: [
    { code: 'create_clock -name clk200 -period 5 [get_ports {clk200_p clk200_n}]', pass: false, note: 'оба вывода', expect: 'Лишний тактовый сигнал|N-вывод' },
    { code: 'create_clock -name clk200 -period 5 [get_ports clk200_n]', pass: false, note: 'только N', expect: 'не в той точке' },
    { code: 'create_clock -name clk200 -period 5 [get_ports clk200_p]\ncreate_clock -name clk200n -period 5 [get_ports clk200_n]', pass: false, note: 'два create_clock' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'clocks.waveform', module: 'clocks', order: 3, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Опция `-waveform` и анализ путей длиной в полпериода одинаковы в XDC и SDC.',
  title: 'Несимметричный тактовый сигнал и пути длиной в полпериода',
  tags: ['create_clock', '-waveform', 'спад'],
  text: `
    Внешняя микросхема выдаёт тактовый сигнал \`pclk\` частотой **125 МГц** с коэффициентом заполнения **40 %**: по техническому описанию высокий уровень длится 3,2 нс, низкий – 4,8 нс (наихудший случай).

    В проекте есть регистр \`neg_reg\`, тактируемый **спадом** (\`IS_C_INVERTED = 1\`). Путь \`pos_reg → neg_reg\` имеет длину в полпериода: данные запускаются фронтом и захватываются ближайшим спадом.

    **Задание.** Опишите тактовый сигнал \`pclk\` так, чтобы соотношения фронтов соответствовали реальному коэффициенту заполнения.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'pclk', x: 20, y: 137 },
      { id: 'ib', t: 'ibuf', name: 'pclk_ibuf', x: 110, y: 134, noName: true },
      { id: 'bg', t: 'bufg', name: 'pclk_bufg', x: 180, y: 134, noName: true },
      { id: 'a', t: 'ff', name: 'pos_reg', x: 300, y: 30 },
      { id: 'b', t: 'ff', name: 'neg_reg', negedge: true, x: 430, y: 30 },
      { id: 'c', t: 'ff', name: 'out_reg', x: 560, y: 30 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['a.C', 'b.C', 'c.C'], kind: 'clk', label: 'pclk', trunk: 40 },
      { from: 'a.Q', to: 'b.D' },
      { from: 'b.Q', to: 'c.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'pclk: высокий уровень 3,2 нс, низкий 4,8 нс', t: [-1, 17],
      signals: [
        { name: 'pclk', clock: { period: 8, rise: 0, fall: 3.2 }, arrows: 'rise' },
        { name: 'pos_reg → neg_reg', bit: [], init: 0, cls: 'launch' },
        { name: 'neg_reg → out_reg', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск ↑', cls: 'launch' }, { t: 3.2, label: 'захват ↓', cls: 'capture' }, { t: 8, label: 'захват ↑', cls: 'capture' }],
      spans: [{ row: 1, t0: 0, t1: 3.2, label: '3,2 нс', cls: 'setup' }, { row: 2, t0: 3.2, t1: 8, label: '4,8 нс', cls: 'setup' }],
    },
  ],
  solution: `create_clock -name pclk -period 8.000 -waveform {0.000 3.200} [get_ports pclk]`,
  hints: [
    'Коэффициент заполнения задаётся опцией `-waveform {<момент фронта> <момент спада>}` в пределах периода.',
    'Фронт в момент 0, спад через 3,2 нс: `-waveform {0 3.2}`.',
  ],
  explain: `
    \`\`\`
    create_clock -name pclk -period 8.000 -waveform {0.000 3.200} [get_ports pclk]
    \`\`\`
    По умолчанию Vivado считает тактовый сигнал симметричным ({0 4}). Тогда путь «фронт → спад» получил бы 4 нс, хотя в действительности на него отводится лишь 3,2 нс, – анализ был бы **оптимистичным** на 0,8 нс.

    С правильной формой сигнала:
    - \`pos_reg → neg_reg\` (фронт → спад): требование к предустановке 3,2 нс;
    - \`neg_reg → out_reg\` (спад → фронт): требование к предустановке 4,8 нс.

    Оба требования видны на вкладке «Анализ путей». Тактовый сигнал, сдвинутый по фазе, тоже описывают опцией -waveform: сдвиг на 90° при T = 8 нс – \`{2 6}\`.

    Обратите внимание на терминологию: доля длительности высокого уровня в периоде (40 %) – это **коэффициент заполнения** (duty cycle). Скважность – обратная величина: T/τ = 8/3,2 = 2,5.
  `,
  tests: [
    { code: 'create_clock -name pclk -period 8 [get_ports pclk]', pass: false, note: 'нет -waveform', expect: 'форма' },
    { code: 'create_clock -name pclk -period 8 -waveform {0 4.8} [get_ports pclk]', pass: false, note: 'перепутаны уровни' },
    { code: 'create_clock -name pclk -period 8 -waveform {0 3.2} [get_ports pclk]', pass: true },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'clocks.async', module: 'clocks', order: 4, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`set_clock_groups -asynchronous` поддерживают и Vivado, и САПР ASIC; в ASIC передачи между такими доменами дополнительно проверяют средствами структурного анализа CDC.',
  title: 'Два независимых генератора',
  tags: ['create_clock', 'set_clock_groups', 'тактовые домены'],
  text: `
    Системная логика работает от генератора **100 МГц** (\`sys_clk\`). Микросхема физического уровня Ethernet (PHY) выдаёт собственный тактовый сигнал приёма **125 МГц** (\`eth_rxc\`); он формируется её собственным кварцевым резонатором и никак не связан с \`sys_clk\`.

    Однобитный признак из тактового домена \`sys_clk\` передаётся в домен \`eth_rxc\` через классический двухтриггерный синхронизатор.

    **Задание.** Опишите оба тактовых сигнала (\`sys_clk\` и \`eth_rxc\`) и сообщите Vivado, что между ними нет фиксированного фазового соотношения.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pa', t: 'in', name: 'sys_clk', x: 10, y: 120 },
      { id: 'iba', t: 'ibuf', name: 'sys_clk_ibuf', x: 110, y: 117, noName: true },
      { id: 'bga', t: 'bufg', name: 'sys_clk_bufg', x: 175, y: 117, noName: true },
      { id: 'pb', t: 'in', name: 'eth_rxc', x: 10, y: 230 },
      { id: 'ibb', t: 'ibuf', name: 'eth_rxc_ibuf', x: 110, y: 227, noName: true },
      { id: 'bgb', t: 'bufg', name: 'eth_rxc_bufg', x: 175, y: 227, noName: true },
      { id: 'f', t: 'ff', name: 'flag_reg', x: 290, y: 40 },
      { id: 's0', t: 'ff', name: 'flag_sync_reg[0]', x: 430, y: 150 },
      { id: 's1', t: 'ff', name: 'flag_sync_reg[1]', x: 560, y: 150 },
      { id: 'n1', t: 'note', x: 300, y: 258, text: 'домен sys_clk (100 МГц)  →  домен eth_rxc (125 МГц)', box: false },
    ],
    wires: [
      { from: 'pa', to: 'iba.I', kind: 'clk' }, { from: 'iba.O', to: 'bga.I', kind: 'clk' },
      { from: 'bga.O', to: 'f.C', kind: 'clk', label: 'sys_clk' },
      { from: 'pb', to: 'ibb.I', kind: 'clk' }, { from: 'ibb.O', to: 'bgb.I', kind: 'clk' },
      { from: 'bgb.O', to: ['s0.C', 's1.C'], kind: 'clk', label: 'eth_rxc', trunk: 120 },
      { from: 'f.Q', to: 's0.D' },
      { from: 's0.Q', to: 's1.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Без указания асинхронности худшая пара фронтов разнесена на 2 нс', t: [-1, 41],
      signals: [
        { name: 'sys_clk 100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'eth_rxc 125', clock: { period: 8 }, arrows: 'rise' },
      ],
      marks: [{ t: 30, label: 'запуск', cls: 'launch' }, { t: 32, label: 'захват', cls: 'capture' }],
      spans: [{ row: 1, t0: 30, t1: 32, label: '2 нс', cls: 'setup' }],
      caption: 'Если считать тактовые сигналы синхронными, Vivado найдёт пару фронтов, разнесённых всего на 2 нс, и потребует уложить путь в 2 нс. В действительности фазовое соотношение случайно, и надёжность передачи обеспечивает синхронизатор, а не статический временной анализ.',
    },
  ],
  solution: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
create_clock -name eth_rxc -period 8.000 [get_ports eth_rxc]
set_clock_groups -asynchronous -group [get_clocks sys_clk] -group [get_clocks eth_rxc]`,
  hints: [
    'Сначала две команды create_clock – по одной на каждый входной тактовый порт.',
    'Несвязанные тактовые сигналы объявляют командой `set_clock_groups -asynchronous` с двумя группами.',
  ],
  explain: `
    \`\`\`
    create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
    create_clock -name eth_rxc -period 8.000 [get_ports eth_rxc]
    set_clock_groups -asynchronous -group [get_clocks sys_clk] -group [get_clocks eth_rxc]
    \`\`\`
    Без \`set_clock_groups\` Vivado считает любые два тактовых сигнала **связанными**: развёртывает их на общий период (40 нс) и ищет худшую пару фронтов. Для 100 и 125 МГц это 2 нс, и путь \`flag_reg → flag_sync_reg[0]\` окажется «нарушенным», хотя никакого фиксированного соотношения между сигналами нет. Отчёт \`report_clock_interaction\` покажет эту пару как **Timed (unsafe)** – анализируется небезопасно.

    Команда \`set_clock_groups -asynchronous\` исключает все пути между группами в обоих направлениях. Корректность передачи обеспечивает синхронизатор (вместе со свойством \`ASYNC_REG\` на его регистрах – см. модуль о передаче между тактовыми доменами).

    Для этого проекта равноценная запись – \`set_false_path\` в обоих направлениях между тактовыми сигналами. Но если в проекте есть шины в коде Грея или макросы XPM_CDC с \`set_max_delay -datapath_only\`, глобальное исключение их перекроет; тогда пути ограничивают адресно.

    Удобная форма для проектов с MMCM: \`-group [get_clocks -include_generated_clocks sys_clk]\` – в группу попадут и производные тактовые сигналы.
  `,
  tests: [
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_clock -name eth_rxc -period 8 [get_ports eth_rxc]', pass: false, note: 'без групп', expect: 'не должны анализироваться' },
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_clock -name eth_rxc -period 8 [get_ports eth_rxc]\nset_clock_groups -asynchronous -group sys_clk', pass: true, note: 'одна группа' },
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_clock -name eth_rxc -period 8 [get_ports eth_rxc]\nset_false_path -from [get_clocks sys_clk] -to [get_clocks eth_rxc]\nset_false_path -from [get_clocks eth_rxc] -to [get_clocks sys_clk]', pass: true, note: 'ложный путь в обоих направлениях' },
    { code: 'set_clock_groups -asynchronous -group sys_clk -group eth_rxc\ncreate_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_clock -name eth_rxc -period 8 [get_ports eth_rxc]', pass: false, note: 'неверный порядок команд', expect: 'не найден' },
  ],
});

// ---------------------------------------------------------------------------
const MMCM_DESIGN = {
  elements: [
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    { id: 'p', t: 'in', name: 'sys_clk', x: 10, y: 79 },
    { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 110, y: 76, noName: true },
    {
      id: 'm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 190, y: 40, mult: 10, divclk: 1,
      outs: [{ pin: 'CLKOUT0', div: 5, clk: 'clk_out1_clk_wiz_0', label: 'CLKOUT0: 200 МГц' }, { pin: 'CLKOUT1', div: 20, clk: 'clk_out2_clk_wiz_0', label: 'CLKOUT1: 50 МГц' }],
    },
    { id: 'b0', t: 'bufg', name: 'u_clk/clkout1_buf', x: 380, y: 60, noName: true },
    { id: 'b1', t: 'bufg', name: 'u_clk/clkout2_buf', x: 380, y: 140, noName: true },
    { id: 'r1', t: 'ff', name: 'dsp_out_reg', w: 16, x: 500, y: 0 },
    { id: 'r2', t: 'ff', name: 'ctrl_in_reg', w: 16, x: 640, y: 80 },
  ],
  wires: [
    { from: 'p', to: 'ib.I', kind: 'clk' },
    { from: 'ib.O', to: 'm.CLKIN1', kind: 'clk' },
    { from: 'm.CLKOUT0', to: 'b0.I', kind: 'clk' },
    { from: 'm.CLKOUT1', to: 'b1.I', kind: 'clk' },
    { from: 'b0.O', to: 'r1.C', kind: 'clk', label: '200 МГц' },
    { from: 'b1.O', to: 'r2.C', kind: 'clk', label: '50 МГц', mx: 600 },
    { from: 'r1.Q', to: 'r2.D' },
  ],
};
XT.bank.add({
  id: 'clocks.mmcm', module: 'clocks', order: 5, level: 2, tool: 'vivado',
  lang: 'xdc', langNote: 'Тактовые сигналы на выходах MMCM Vivado выводит сам, а `create_generated_clock` без `-source` лишь переименовывает выведенный сигнал. В САПР ASIC выход PLL описывают вручную полной командой `create_generated_clock` (см. [[q:asic.pll_div|задачу о PLL и делителе]]).',
  title: 'MMCM: автоматически выводимые тактовые сигналы и их переименование',
  tags: ['MMCM', 'create_generated_clock'],
  text: `
    IP-блок Clocking Wizard (\`u_clk\`) формирует из сигнала **100 МГц** на входе \`sys_clk\` тактовые сигналы **200 МГц** (CLKOUT0) и **50 МГц** (CLKOUT1). Из домена 200 МГц в домен 50 МГц передаётся 16-разрядная шина (тактовые сигналы связаны, передача синхронная).

    Тактовые сигналы на выходах MMCM Vivado выводит **автоматически**; их имена совпадают с именами цепей: \`clk_out1_clk_wiz_0\`, \`clk_out2_clk_wiz_0\`.

    **Задание.**
    1. Опишите то, что действительно необходимо для анализа.
    2. Тактовый сигнал 50 МГц в отчётах проекта должен называться \`clk_ctrl\`. Переименуйте его, **не меняя** параметры и связь с входным тактовым сигналом.
  `,
  design: MMCM_DESIGN,
  figures: [
    {
      kind: 'timing', title: 'Тактовые сигналы MMCM привязаны к входному', t: [-1, 42],
      signals: [
        { name: 'sys_clk 100', clock: { period: 10 }, arrows: 'rise' },
        { name: 'CLKOUT0 200', clock: { period: 5 }, arrows: 'rise', cls: 'launch' },
        { name: 'CLKOUT1 50', clock: { period: 20 }, arrows: 'rise' },
      ],
      marks: [{ t: 15, label: 'запуск', cls: 'launch' }, { t: 20, label: 'захват', cls: 'capture' }],
      spans: [{ row: 2, t0: 15, t1: 20, label: 'предустановка 5 нс', cls: 'setup' }],
    },
  ],
  solution: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
create_generated_clock -name clk_ctrl [get_pins u_clk/mmcm_inst/CLKOUT1]`,
  check: { clockNames: ['clk_ctrl'] },
  hints: [
    'В Vivado для выходов MMCM команда create_clock не нужна: достаточно описать входной тактовый сигнал.',
    'Переименование автоматически выведенного тактового сигнала: `create_generated_clock -name <новое_имя> [get_pins <MMCM>/CLKOUT1]` без -source и без делителей.',
  ],
  explain: `
    \`\`\`
    create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
    create_generated_clock -name clk_ctrl [get_pins u_clk/mmcm_inst/CLKOUT1]
    \`\`\`
    - По параметрам MMCM (CLKFBOUT_MULT, DIVCLK_DIVIDE, CLKOUTn_DIVIDE, фаза) Vivado сам строит производные тактовые сигналы с точной формой и **связью с входным тактовым сигналом**. Поэтому передача 200 → 50 МГц анализируется как синхронная: требование к предустановке 5 нс (последний фронт сигнала 200 МГц перед фронтом сигнала 50 МГц), к удержанию – 0.
    - Команда \`create_generated_clock\` **без -source и без делителей** на выходе MMCM лишь переименовывает автоматически выведенный тактовый сигнал; параметры берутся из настроек MMCM.
    - Можно описать тактовый сигнал полностью (\`-source [get_pins …/CLKIN1] -divide_by 2\`) – это тоже будет засчитано, если параметры совпадут с настройкой MMCM. Однако при изменении настроек MMCM такое ограничение придётся исправлять вручную.
    - **Нельзя** применять \`create_clock\` к выходу CLKOUT: появится новый *первичный* тактовый сигнал без связи с \`sys_clk\` и без учёта задержки входной части тактового дерева.

    Надёжный способ сослаться на автоматически выведенный тактовый сигнал, не зная его имени: \`[get_clocks -of_objects [get_pins u_clk/mmcm_inst/CLKOUT1]]\`.
  `,
  tests: [
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]', pass: false, note: 'без переименования', expect: 'clk_ctrl' },
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_clock -name clk_ctrl -period 20 [get_pins u_clk/mmcm_inst/CLKOUT1]', pass: false, note: 'create_clock на выходе MMCM', expect: 'производным' },
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_generated_clock -name clk_ctrl -source [get_pins u_clk/mmcm_inst/CLKIN1] -divide_by 2 [get_pins u_clk/mmcm_inst/CLKOUT1]', pass: true, note: 'полное описание' },
    { code: 'create_clock -name sys_clk -period 10 [get_ports sys_clk]\ncreate_generated_clock -name clk_ctrl -source [get_pins u_clk/mmcm_inst/CLKIN1] -divide_by 4 [get_pins u_clk/mmcm_inst/CLKOUT1]', pass: false, note: 'неверный коэффициент деления', expect: 'период' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'clocks.mmcm_q', module: 'clocks', order: 6, level: 1, tool: 'vivado', type: 'choice',
  lang: 'xdc', langNote: 'Вопрос о Vivado: в САПР ASIC выходы PLL сами не описываются, для каждого нужен `create_generated_clock` (см. [[q:asic.pll_div|задачу о PLL и делителе]]).',
  title: 'Какие ограничения нужны для выходов MMCM?',
  tags: ['MMCM', 'понимание'],
  text: `
    Тот же проект: MMCM формирует из сигнала 100 МГц тактовые сигналы 200 и 50 МГц, между доменами 200 → 50 МГц передаётся синхронная шина.

    Какой набор ограничений для тактовых сигналов **правилен и достаточен** в Vivado?
  `,
  design: MMCM_DESIGN,
  options: [
    { text: '`create_clock` на входном порту `sys_clk` – и ничего больше.', ok: true, why: 'Верно. Тактовые сигналы на выходах MMCM Vivado выводит сам, вместе с фазой и связью с входным сигналом.' },
    { text: '`create_clock` на входном порту и на каждом выходе MMCM (CLKOUT0, CLKOUT1).', why: 'Команда create_clock на выходах создаёт независимые первичные тактовые сигналы: теряется связь с входным сигналом и задержка входной части тактового дерева. Междоменные пути станут анализироваться небезопасно (unsafe).' },
    { text: '`create_clock` на входе и `set_clock_groups -asynchronous` между CLKOUT0 и CLKOUT1.', why: 'Тактовые сигналы одного MMCM синхронны: их фазы жёстко связаны. Объявив их асинхронными, вы отключите анализ реальных путей 200 → 50 МГц и скроете нарушения.' },
    { text: 'Обязательно `create_generated_clock` для каждого выхода MMCM.', why: 'Не обязательно: Vivado создаёт их автоматически. Команду create_generated_clock на выходе MMCM применяют только для переименования (и в маршруте проектирования ASIC).' },
  ],
  explain: `
    В Vivado входной тактовый сигнал MMCM/PLL – единственное, что требуется описать. То же относится к буферам BUFR и BUFGCE_DIV с делением и к приёмопередатчикам GT (сигналы TXOUTCLK и RXOUTCLK описывают ограничения самого IP-блока).

    Проверить это можно в консоли: \`report_clocks\` покажет тактовые сигналы типа «автоматический».
  `,
});
