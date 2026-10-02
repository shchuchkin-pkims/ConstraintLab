/* Модуль 11. SDC для ASIC: режимы работы, сканирование, стробирование тактового сигнала */
XT.bank.module({
  id: 'asic_modes', order: 92, title: '11. SDC для ASIC: режимы, сканирование, стробирование',
  about: 'Отдельный SDC-файл режима сдвига при сканировании, программируемый делитель и мультиплексоры тактовых сигналов в объединённом режиме, стробирование тактового сигнала (ICG и элемент И), идеальные цепи сброса и разрешения сканирования при синтезе, набор режимов для финального анализа',
});

// ---------------------------------------------------------------------------
// Блок core_top с цепочкой сканирования (общий для задач о режимах)
const MODES_SCAN_DESIGN = {
  elements: [
    { id: 'blk', t: 'boundary', label: 'Блок core_top' },
    { id: 'psi', t: 'in', name: 'scan_in', x: 41, y: 219 },
    { id: 'pse', t: 'in', name: 'scan_en', x: 41, y: 279 },
    { id: 'pfc', t: 'in', name: 'func_clk', x: 34, y: 337 },
    { id: 'ptck', t: 'in', name: 'tck', x: 54, y: 365 },
    { id: 'ptm', t: 'in', name: 'test_mode', x: 28, y: 409 },
    { id: 'mux', t: 'ckmux2', name: 'u_clk_mux', x: 200, y: 330 },
    { id: 'rc', t: 'sdff', name: 'core_reg', w: 8, x: 330, y: 214, nameX: 46 },
    { id: 'lg', t: 'logic', name: 'u_logic', w: 8, label: 'логика ядра', bw: 94, x: 450, y: 209 },
    { id: 'pso', t: 'out', name: 'scan_out', x: 600, y: 301 },
  ],
  wires: [
    { from: 'psi', to: 'rc[0].SI', mx: 290, label: 'SI[0]', lx: 312, ly: 241 },
    { from: 'pse', to: 'rc.SE', mx: 298 },
    { from: 'pfc', to: 'mux.A', kind: 'clk' },
    { from: 'ptck', to: 'mux.B', kind: 'clk' },
    { from: 'ptm', to: 'mux.S' },
    { from: 'mux.Y', to: 'rc.CK', kind: 'clk', mx: 312, net: 'clk_core' },
    { from: 'rc.Q', to: 'lg.I' },
    { from: 'lg.O', to: 'rc.D', my: 180 },
    // цепочка сканирования: Q[6:0] → SI[7:1], Q[7] → scan_out
    { from: 'rc[0:6].Q', to: 'rc[1:7].SI', via: [[412, 232], [412, 312], [322, 312], [322, 246]], label: 'Q[6:0] → SI[7:1]', lx: 367, ly: 326 },
    { from: 'rc[7].Q', to: 'pso', via: [[412, 232], [412, 312]], label: 'Q[7]', lx: 520, ly: 307 },
  ],
};

XT.bank.add({
  id: 'asic.scan_shift', module: 'asic_modes', order: 1, level: 2, tool: 'sdc',
  lang: 'both', langNote: '`set_case_analysis` и задержки ввода/вывода есть и в XDC, но цепочки сканирования и отдельные SDC-файлы тестовых режимов – практика ASIC: в ПЛИС сканирования нет.',
  title: 'Режим сдвига при сканировании: отдельный SDC-файл',
  tags: ['set_case_analysis', 'сканирование', 'режимы работы', 'set_input_delay'],
  text: `
    Блок \`core_top\` из задачи [[q:asic.test_mux|«Функциональный режим»]] на производстве проверяют сканированием. Тестер подаёт тактовый сигнал сканирования на порт \`tck\` (**25 МГц**, T = 40 нс); при \`test_mode = 1\` мультиплексор \`u_clk_mux\` пропускает его на триггеры ядра.

    В режиме **сдвига** (\`scan_en = 1\`) сканируемые триггеры \`core_reg[7:0]\` образуют цепочку: \`scan_in → core_reg[0]/SI\`, \`core_reg[i]/Q → core_reg[i+1]/SI\`, \`core_reg[7]/Q → scan_out\`. Тестер вдвигает тестовый набор через \`scan_in\` и одновременно выдвигает результат предыдущего набора через \`scan_out\`.

    Временны́е параметры тестера относительно фронта \`tck\` на выводах кристалла:

    | Параметр | Значение |
    |---|---|
    | тестер меняет \`scan_in\` | через 5 нс после фронта (одно значение для -max и -min) |
    | тестер считывает \`scan_out\` | данные нужны за 8 нс до следующего фронта (одно значение для -max и -min) |

    Функциональный тактовый сигнал \`func_clk\` описан в общем файле тактовых сигналов (блок «Уже в проекте»).

    **Задание.** Напишите SDC-файл режима сдвига: опишите тактовый сигнал \`tck\`, зафиксируйте режим константами на портах \`test_mode\` и \`scan_en\` и задайте задержки для \`scan_in\` и \`scan_out\`.
  `,
  design: MODES_SCAN_DESIGN,
  given: 'create_clock -name func_clk -period 4.000 [get_ports func_clk]',
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные и управляющие сигналы. Петля от выхода Q к входу SI – цепочка сканирования: Q[6:0] → SI[7:1], последний разряд Q[7] выходит на scan_out. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Сдвиг: тестер и цепочка за один период tck', t: [-3, 86], width: 600,
      signals: [
        { name: 'tck 25 МГц', clock: { period: 40 }, arrows: 'rise' },
        { name: 'scan_in', bus: [[5, 5.6, 'S1'], [45, 45.6, 'S2']], init: 'S0' },
        { name: 'core_reg[0]/Q', bus: [[0.6, 1.1, 'S0'], [40.6, 41.1, 'S1']], init: 'S−1' },
        { name: 'scan_out', bus: [[2.5, 3.5, 'R0'], [42.5, 43.5, 'R1']], init: 'R−1' },
      ],
      marks: [{ t: 0, label: 'фронт tck', cls: 'launch' }, { t: 40, label: 'следующий фронт', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 5, label: 'вход: 5 нс', cls: 'data' },
        { row: 3, t0: 32, t1: 40, label: 'выход: 8 нс', cls: 'setup' },
      ],
      windows: [{ row: 3, t0: 32, t1: 40, cls: 'setup' }],
      caption: 'Тестер меняет scan_in через 5 нс после фронта tck и считывает scan_out за 8 нс до следующего фронта. Внутри кристалла каждая ступень цепочки передаёт бит следующей за один период. Путь Q → SI очень короткий, поэтому опасна не предустановка, а удержание.',
    },
  ],
  solution: `create_clock -name tck -period 40.000 [get_ports tck]
set_case_analysis 1 [get_ports test_mode]
set_case_analysis 1 [get_ports scan_en]
set_input_delay  -clock tck 5.000 [get_ports scan_in]
set_output_delay -clock tck 8.000 [get_ports scan_out]`,
  check: { clockNames: ['tck'] },
  hints: [
    'Это отдельный файл для другого режима: опишите тактовый сигнал сканирования `tck` на его порту (T = 1000 / 25 = 40 нс).',
    'Режим фиксируют константами: `test_mode = 1` (мультиплексор пропускает `tck`) и `scan_en = 1` (триггеры принимают данные с входа SI).',
    '`set_input_delay -clock tck 5 [get_ports scan_in]` и `set_output_delay -clock tck 8 [get_ports scan_out]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name tck -period 40.000 [get_ports tck]
    set_case_analysis 1 [get_ports test_mode]
    set_case_analysis 1 [get_ports scan_en]
    set_input_delay  -clock tck 5.000 [get_ports scan_in]
    set_output_delay -clock tck 8.000 [get_ports scan_out]
    \`\`\`
    **Почему отдельный файл.** У каждого режима свой путь тактовых сигналов и свои активные проверки. Функциональный SDC-файл (задача [[q:asic.test_mux|о функциональном режиме]]) фиксирует \`test_mode = 0\` и \`scan_en = 0\`, файл режима сдвига – \`test_mode = 1\` и \`scan_en = 1\`. При финальном анализе оба файла проверяют как разные режимы: в САПР Cadence это constraint mode в описании MMMC, в PrimeTime – отдельные сценарии.

    **Что делают константы.**
    - \`test_mode = 1\`: мультиплексор \`u_clk_mux\` пропускает \`tck\`, а \`func_clk\` останавливается на входе A и в этом режиме ни на что не влияет.
    - \`scan_en = 1\`: в библиотеке сканируемого триггера проверки входа SI заданы при условии SE = 1, а входа D – при SE = 0. Константа включает проверки цепочки \`Q → SI\` и отключает функциональные пути через логику ядра: при сдвиге они не важны.

    **Задержки портов.** Тестер – обычная внешняя сторона: 5 нс после фронта до смены \`scan_in\` и 8 нс до фронта для \`scan_out\`. На путь от порта до первой ступени остаётся 40 − 5 = 35 нс, от последней ступени до порта – 40 − 8 = 32 нс. Предустановка при 25 МГц выполняется с огромным запасом.

    **Главная опасность режима сдвига – удержание.** Выход Q соединён с входом SI следующего триггера почти напрямую, задержка такого пути – сотые доли наносекунды. Если фронт тактового сигнала приходит на следующий триггер позже (перекос тактового дерева), новые данные успевают дойти до него раньше, чем закончится окно удержания. Частота здесь ничего не меняет: требование к удержанию от периода не зависит. Поэтому удержание исправляют и для режима сдвига, а между частями цепочки из разных тактовых доменов вставляют запирающие защёлки (lockup latch).

    **Типичные ошибки:**
    - \`scan_en = 0\` – это режим захвата: проверки цепочки отключаются, а функциональные пути анализируются на частоте 25 МГц впустую;
    - нет константы на \`test_mode\`: через мультиплексор на триггеры приходят и \`tck\`, и \`func_clk\`, и анализ строит лишние междоменные проверки;
    - задержки портов относительно \`func_clk\`: в режиме сдвига этот тактовый сигнал на триггеры не приходит, и пути от \`scan_in\` получают бессмысленное требование.

    **Проверка.** В консоли ConstraintLab: \`report_clock_interaction\` – единственная пара \`tck → tck\`; \`report_timing -to [get_pins {core_reg[1]/SI}] -hold\` – проверка удержания на цепочке. В PrimeTime: \`report_case_analysis\` и \`report_timing -delay_type min\` по цепочкам сканирования.
  `,
  tests: [
    { code: 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports {test_mode scan_en}]\nset_input_delay 5 -clock [get_clocks tck] [get_ports scan_in]\nset_output_delay 8 -clock [get_clocks tck] [get_ports scan_out]', pass: true, note: 'одна команда для двух констант' },
    { code: 'create_clock -name tck -period [expr {1000.0 / 25}] [get_ports tck]\nset_case_analysis one [get_ports test_mode]\nset_case_analysis 1 [get_ports scan_en]\nset_input_delay -clock tck -max 5 [get_ports scan_in]\nset_input_delay -clock tck -min 5 [get_ports scan_in]\nset_output_delay -clock tck 8 [get_ports scan_out]', pass: true, note: 'период через expr, -max и -min отдельно, значение one' },
    { code: 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports test_mode]\nset_case_analysis 0 [get_ports scan_en]\nset_input_delay -clock tck 5 [get_ports scan_in]\nset_output_delay -clock tck 8 [get_ports scan_out]', pass: false, note: 'scan_en = 0: это режим захвата', expect: 'set_case_analysis: неверное значение 0' },
    { code: 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports scan_en]\nset_input_delay -clock tck 5 [get_ports scan_in]\nset_output_delay -clock tck 8 [get_ports scan_out]', pass: false, note: 'нет константы на test_mode', expect: 'Не задано: set_case_analysis' },
    { code: 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports test_mode]\nset_case_analysis 1 [get_ports scan_en]\nset_input_delay -clock func_clk 5 [get_ports scan_in]\nset_output_delay -clock func_clk 8 [get_ports scan_out]', pass: false, note: 'задержки относительно func_clk', expect: 'func_clk' },
    { code: 'create_clock -name tck -period 40 [get_ports tck]\nset_case_analysis 1 [get_ports test_mode]\nset_case_analysis 1 [get_ports scan_en]\nset_input_delay -clock tck 5 [get_ports scan_in]', pass: false, note: 'нет задержки для scan_out', expect: 'set_output_delay' },
    { code: 'create_clock -name tck -period 25 [get_ports tck]\nset_case_analysis 1 [get_ports test_mode]\nset_case_analysis 1 [get_ports scan_en]\nset_input_delay -clock tck 5 [get_ports scan_in]\nset_output_delay -clock tck 8 [get_ports scan_out]', pass: false, note: 'частота вместо периода', expect: 'период' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.clk_div_mux', module: 'asic_modes', order: 2, level: 3, tool: 'sdc',
  lang: 'both', langNote: 'Опции `-combinational`, `-add`, `-master_clock` и `-physically_exclusive` поддерживают и PrimeTime, и Vivado. Программируемые делители с мультиплексорами тактовых сигналов и объединённый режим анализа – типичная задача ASIC.',
  title: 'Программируемый делитель: три частоты в одном прогоне',
  tags: ['create_generated_clock', '-combinational', '-add', '-master_clock', '-physically_exclusive', 'CKMUX2'],
  text: `
    Ядро \`cpu_top\` тактируется от программируемого делителя частоты. Тактовый сигнал PLL (**1 ГГц**) приходит на порт \`pll_clk\`. Счётные триггеры \`div2_reg\` и \`div4_reg\` делят его на 2 и на 4 (\`div4_reg\` тактируется выходом \`div2_reg\`). Два мультиплексора тактовых сигналов \`u_mux_a\` и \`u_mux_b\` (ячейки CKMUX2) по битам \`div_sel[1:0]\` выбирают частоту ядра:

    | div_sel[1] | div_sel[0] | Частота ядра |
    |---|---|---|
    | 0 | 0 | 1 ГГц (\`pll_clk\`) |
    | 0 | 1 | 500 МГц (\`div2_reg\`) |
    | 1 | любое | 250 МГц (\`div4_reg\`) |

    Частоту меняет программа, и при финальном анализе ядро нужно проверить на всех трёх частотах **в одном прогоне** (объединённый режим, merged mode), а не тремя SDC-файлами с разными константами на \`div_sel\`.

    **Задание.** Опишите тактовый сигнал \`pll_clk\`, производные сигналы на выходах делителей (\`clk_div2\`, \`clk_div4\`) и три производных сигнала на выходе \`u_mux_b\` – \`core_1g\`, \`core_500\` и \`core_250\`, – которые физически не могут существовать одновременно.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок cpu_top' },
      { id: 'ppll', t: 'in', name: 'pll_clk', x: 20, y: 77 },
      { id: 'psel', t: 'in', name: 'div_sel', w: 2, x: 20, y: 300 },
      {
        id: 'd2', t: 'block', name: 'div2_reg', title: '÷2', x: 170, y: 150, bw: 64, bh: 50,
        pins: [{ n: 'CK', d: 'in', clk: true, y: 25 }, { n: 'Q', d: 'out', y: 25 }], timing: { seq: true, clk: 'CK', launch: { Q: ['rise'] } },
      },
      {
        id: 'd4', t: 'block', name: 'div4_reg', title: '÷2', x: 300, y: 205, bw: 64, bh: 50,
        pins: [{ n: 'CK', d: 'in', clk: true, y: 25 }, { n: 'Q', d: 'out', y: 25 }], timing: { seq: true, clk: 'CK', launch: { Q: ['rise'] } },
      },
      { id: 'ma', t: 'ckmux2', name: 'u_mux_a', x: 430, y: 70 },
      { id: 'mb', t: 'ckmux2', name: 'u_mux_b', x: 530, y: 84 },
      { id: 'rc', t: 'dff', name: 'core_reg', w: 8, x: 650, y: 58 },
      { id: 'lg', t: 'logic', name: 'u_core', w: 8, label: 'логика ядра', bw: 94, x: 750, y: 53 },
    ],
    wires: [
      { from: 'ppll', to: ['ma.A', 'd2.CK'], kind: 'clk', trunk: 40, label: '1 ГГц' },
      { from: 'd2.Q', to: ['ma.B', 'd4.CK'], kind: 'clk', trunk: 30, label: '500 МГц' },
      { from: 'd4.Q', to: 'mb.B', kind: 'clk', mx: 505, label: '250 МГц', lx: 420, ly: 225 },
      { from: 'ma.Y', to: 'mb.A', kind: 'clk' },
      { from: 'mb.Y', to: 'rc.CK', kind: 'clk', label: 'core_clk' },
      { from: 'psel[0]', to: 'ma.S', label: 'div_sel[0]', lx: 380, ly: 295 },
      { from: 'psel[1]', to: 'mb.S', label: 'div_sel[1]', lx: 500, ly: 295 },
      { from: 'rc.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'rc.D', my: 24 },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные и сигналы выбора. Делители ÷2 – счётные триггеры div2_reg и div4_reg; на ядро через два мультиплексора проходит одна из трёх частот. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Тактовые сигналы делителя и ядра', t: [-0.3, 8.6], width: 600,
      signals: [
        { name: 'pll_clk 1 ГГц', clock: { period: 1 }, arrows: 'rise' },
        { name: 'clk_div2 500 МГц', clock: { period: 2 }, arrows: 'rise' },
        { name: 'clk_div4 250 МГц', clock: { period: 4 }, arrows: 'rise' },
        { name: 'core_1g', clock: { period: 1 }, cls: 'launch' },
        { name: 'core_500', clock: { period: 2 }, cls: 'launch' },
        { name: 'core_250', clock: { period: 4 }, cls: 'launch' },
      ],
      spans: [
        { row: 3, t0: 0, t1: 1, label: '1 нс', cls: 'setup' },
        { row: 4, t0: 0, t1: 2, label: '2 нс', cls: 'setup' },
        { row: 5, t0: 0, t1: 4, label: '4 нс', cls: 'setup' },
      ],
      caption: 'Делители отсчитывают свои фронты от фронтов pll_clk. На выходе u_mux_b в каждый момент существует только один из трёх сигналов ядра, поэтому пути core_reg → core_reg проверяют отдельно для каждой частоты (1, 2 и 4 нс), но не между ними.',
    },
  ],
  solution: `create_clock -name pll_clk -period 1.000 [get_ports pll_clk]
create_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]
create_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]
create_generated_clock -name core_1g  -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]
create_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 -add [get_pins u_mux_b/Y]
create_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 -add [get_pins u_mux_b/Y]
set_clock_groups -physically_exclusive -group [get_clocks core_1g] -group [get_clocks core_500] -group [get_clocks core_250]`,
  check: {
    clockNames: ['pll_clk', 'clk_div2', 'clk_div4', 'core_1g', 'core_500', 'core_250'],
    forbid: [{ cmd: 'set_clock_groups', re: '-logically_exclusive', msg: 'Сигналы на выходе мультиплексора – это -physically_exclusive', detail: 'core_1g, core_500 и core_250 существуют на одном проводе и никогда не присутствуют одновременно. Опция -logically_exclusive предназначена для сигналов, которые физически есть в схеме одновременно, но логически не взаимодействуют; для неё анализ перекрёстных помех между сигналами сохраняется.' }],
  },
  hints: [
    'Сначала опишите делители, как в задаче о делителе частоты: исходный сигнал – на входе CK счётного триггера, производный – на его выходе Q, `-divide_by 2` для обоих (div4_reg делит clk_div2).',
    'На выходе `u_mux_b` нужны три производных сигнала с опцией `-combinational` (та же форма, что у исходного, путь только через комбинационную логику). `-source` – вход мультиплексора, на котором есть нужный исходный сигнал; второй и третий – с `-add`, иначе каждый новый заменит предыдущий; укажите и `-master_clock`.',
    'Сигналы на одном проводе не существуют одновременно: `set_clock_groups -physically_exclusive -group [get_clocks core_1g] -group [get_clocks core_500] -group [get_clocks core_250]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name pll_clk -period 1.000 [get_ports pll_clk]
    create_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]
    create_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]
    create_generated_clock -name core_1g  -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]
    create_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 -add [get_pins u_mux_b/Y]
    create_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 -add [get_pins u_mux_b/Y]
    set_clock_groups -physically_exclusive -group [get_clocks core_1g] -group [get_clocks core_500] -group [get_clocks core_250]
    \`\`\`
    **Что будет без сигналов на выходе мультиплексора.** Если мультиплексоры не зафиксированы константами, через них на \`core_reg\` проходят все три сигнала: \`pll_clk\`, \`clk_div2\` и \`clk_div4\`. Пути \`core_reg → core_reg\` анализируются для всех девяти пар, в том числе \`pll_clk → clk_div4\`, хотя в кристалле запуск одной частотой и захват другой невозможны. Требования по худшим парам фронтов ложные, синтез тратит площадь, а отчёты засорены.

    **Два правильных подхода.**
    - *Отдельный режим на каждую частоту:* \`set_case_analysis\` на \`div_sel[0]\` и \`div_sel[1]\` – на ядро проходит один сигнал. Просто, но это три SDC-файла и три прогона.
    - *Объединённый режим (эта задача):* на выходе мультиплексора описывают по сигналу на каждую частоту и объявляют их взаимоисключающими. Все частоты проверяются в одном прогоне.

    **Опции.**
    - \`-combinational\` – производный сигнал повторяет форму исходного и проходит к точке определения только через комбинационную логику (здесь – через мультиплексоры), без делителей.
    - \`-add\` – без неё каждая новая команда для того же вывода заменила бы предыдущий сигнал, и остался бы один \`core_250\`.
    - \`-master_clock\` – указывает исходный сигнал явно: к выводу \`-source\` в общем случае может приходить несколько сигналов, а с \`-add\` PrimeTime и Vivado требуют однозначности.
    - Сигнал, определённый на выводе, останавливает распространение исходных сигналов через этот вывод: за \`u_mux_b/Y\` идут только \`core_1g\`, \`core_500\` и \`core_250\`.

    **-physically_exclusive, а не -logically_exclusive.** Сигналы на одном проводе физически не существуют одновременно, поэтому между ними нет ни путей, ни перекрёстных помех. Логически исключающими объявляют сигналы, которые одновременно есть в схеме, но не взаимодействуют: для них PrimeTime по-прежнему учитывает перекрёстные помехи. Исходные \`pll_clk\`, \`clk_div2\` и \`clk_div4\` остаются связанными: если делители или другая логика обмениваются данными в этих доменах, такие пути анализируются правильно.

    **Типичные ошибки:**
    - \`set_clock_groups\` между исходными сигналами (\`pll_clk\`, \`clk_div2\`, \`clk_div4\`) вместо сигналов на выходе мультиплексора: ядро будет проверено, но исчезнет анализ всех настоящих путей между этими доменами;
    - \`create_clock\` на \`u_mux_b/Y\`: независимый первичный сигнал теряет задержку от PLL и связь с делителями;
    - нет \`-add\` – описан только последний из трёх сигналов.

    **Проверка.** \`report_clocks\` – у трёх сигналов ядра общий вывод \`u_mux_b/Y\` и свои исходные сигналы; \`report_clock_interaction\` – пары \`core_1g → core_1g\` (1 нс), \`core_500 → core_500\` (2 нс), \`core_250 → core_250\` (4 нс) анализируются, а между ними – взаимоисключающие (Exclusive).
  `,
  tests: [
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_ports pll_clk] -divide_by 4 [get_pins div4_reg/Q]\nforeach {n src m} {core_1g u_mux_a/A pll_clk core_500 u_mux_a/B clk_div2 core_250 u_mux_b/B clk_div4} {\n  set add [expr {$n eq "core_1g" ? "" : "-add"}]\n  create_generated_clock -name $n -combinational -source [get_pins $src] -master_clock $m {*}$add [get_pins u_mux_b/Y]\n}\nset_clock_groups -physically_exclusive -group core_1g -group core_500 -group core_250', pass: true, note: 'цикл foreach, clk_div4 от порта с -divide_by 4' },
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]\nset_case_analysis 0 [get_ports {div_sel[0]}]\nset_case_analysis 0 [get_ports {div_sel[1]}]', pass: false, note: 'отдельный режим вместо объединённого', expect: 'core_' },
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]\ncreate_generated_clock -name core_1g -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 -add [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 -add [get_pins u_mux_b/Y]', pass: false, note: 'нет групп', expect: 'не должны анализироваться' },
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]\ncreate_generated_clock -name core_1g -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 -add [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 -add [get_pins u_mux_b/Y]\nset_clock_groups -logically_exclusive -group core_1g -group core_500 -group core_250', pass: false, note: '-logically_exclusive вместо -physically_exclusive', expect: 'physically_exclusive' },
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]\nset_clock_groups -logically_exclusive -group pll_clk -group clk_div2 -group clk_div4', pass: false, note: 'группы между исходными сигналами', expect: 'core_' },
    { code: 'create_clock -name pll_clk -period 1 [get_ports pll_clk]\ncreate_generated_clock -name clk_div2 -source [get_pins div2_reg/CK] -divide_by 2 [get_pins div2_reg/Q]\ncreate_generated_clock -name clk_div4 -source [get_pins div4_reg/CK] -divide_by 2 [get_pins div4_reg/Q]\ncreate_generated_clock -name core_1g -combinational -source [get_pins u_mux_a/A] -master_clock pll_clk [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_500 -combinational -source [get_pins u_mux_a/B] -master_clock clk_div2 [get_pins u_mux_b/Y]\ncreate_generated_clock -name core_250 -combinational -source [get_pins u_mux_b/B] -master_clock clk_div4 [get_pins u_mux_b/Y]\nset_clock_groups -physically_exclusive -group core_1g -group core_500 -group core_250', pass: false, note: 'нет -add', expect: 'core_1g' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.icg', module: 'asic_modes', order: 3, level: 2, tool: 'sdc',
  lang: 'sdc', langNote: 'В ПЛИС тактовый сигнал стробируют буфером BUFGCE, а не логикой; `set_clock_gating_check` – команда САПР ASIC.',
  title: 'Стробирование тактового сигнала: ячейка ICG и элемент И',
  tags: ['clock gating', 'ICG', 'set_clock_gating_check', 'мощность'],
  text: `
    Блок \`dsp_top\` (**500 МГц**, T = 2 нс) экономит мощность стробированием тактового сигнала (clock gating):
    - регистры аккумулятора \`acc_reg[15:0]\` тактируются через библиотечную ячейку стробирования \`u_icg\` (ICG: защёлка разрешения и элемент И в одной ячейке); разрешение формирует триггер \`en_reg\`;
    - унаследованный узел тактирует регистр настройки \`cfg_reg[7:0]\` через обычный элемент И \`u_gate_and\`: \`clk & cfg_en_q\`, где \`cfg_en_q\` – выход триггера \`cfg_en_reg\`.

    Для элемента И САПР сама выводит проверку стробирования (clock gating check): разрешение должно оставаться неизменным, пока тактовый сигнал равен единице. Запасы этой проверки задают явно: **0,10 нс** до фронта \`clk\` (предустановка) и **0,05 нс** после спада (удержание). Задержки входов уже заданы (блок «Выполняется после вашего кода»).

    **Задание.** Опишите тактовый сигнал \`clk\` и задайте запасы проверки стробирования для элемента \`u_gate_and\`. Подумайте, нужны ли отдельные тактовые сигналы на выходах \`u_icg\` и \`u_gate_and\`.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок dsp_top' },
      { id: 'pen', t: 'in', name: 'acc_en', x: 20, y: 49 },
      { id: 'pdin', t: 'in', name: 'din', w: 16, x: 20, y: 169 },
      { id: 'pcen', t: 'in', name: 'cfg_en', x: 20, y: 279 },
      { id: 'pclk', t: 'in', name: 'clk', x: 20, y: 389 },
      { id: 'ren', t: 'dff', name: 'en_reg', x: 150, y: 42 },
      { id: 'icg', t: 'icg', name: 'u_icg', x: 270, y: 50 },
      { id: 'rcfgen', t: 'dff', name: 'cfg_en_reg', x: 150, y: 272 },
      { id: 'and', t: 'and2', name: 'u_gate_and', x: 290, y: 350 },
      { id: 'rcfg', t: 'dff', name: 'cfg_reg', w: 8, x: 420, y: 200 },
      { id: 'add', t: 'logic', name: 'u_add', w: 16, label: 'сумматор', bw: 84, mix: true, x: 540, y: 150 },
      { id: 'racc', t: 'dff', name: 'acc_reg', w: 16, x: 680, y: 60 },
    ],
    wires: [
      { from: 'pen', to: 'ren.D' },
      { from: 'ren.Q', to: 'icg.E' },
      { from: 'pclk', to: ['ren.CK', 'rcfgen.CK', 'and.B'], kind: 'clk', mx: 118, label: 'clk', lx: 136, ly: 140 },
      { from: 'pclk', to: 'icg.CK', kind: 'clk', via: [[118, 400], [118, 134], [256, 134], [256, 94]] },
      { from: 'icg.GCK', to: 'racc.CK', kind: 'clk', label: 'gck_acc', lx: 520, ly: 78 },
      { from: 'pcen', to: 'rcfgen.D' },
      { from: 'rcfgen.Q', to: 'and.A', label: 'cfg_en_q', lx: 246, ly: 284 },
      { from: 'and.Y', to: 'rcfg.CK', kind: 'clk', label: 'gck_cfg', lx: 375, ly: 252 },
      { from: 'pdin[0:7]', to: 'rcfg.D', mx: 400, noSlash: true, label: 'din[7:0]', lx: 360, ly: 213 },
      { from: 'pdin', to: 'add.I' },
      { from: 'rcfg.Q', to: 'add.I' },
      { from: 'racc.Q', to: 'add.I', my: 30 },
      { from: 'add.O', to: 'racc.D' },
    ],
  },
  after: 'set_input_delay -clock clk 0.600 [get_ports {acc_en cfg_en din[*]}]',
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные и разрешения. Ячейка u_icg стробирует тактовый сигнал аккумулятора, элемент u_gate_and – тактовый сигнал регистра настройки. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Элемент И: разрешение можно менять только при clk = 0', t: [-0.3, 6.3], width: 600,
      signals: [
        { name: 'clk', clock: { period: 2 }, arrows: 'rise' },
        { name: 'cfg_en_q (верно)', bit: [[1.45, 1.5, 1], [5.45, 5.5, 0]], init: 0 },
        { name: 'gck_cfg (верно)', bit: [[2, 2.02, 1], [3, 3.02, 0], [4, 4.02, 1], [5, 5.02, 0]], init: 0 },
        { name: 'cfg_en_q (ошибка)', bit: [[2.45, 2.5, 1]], init: 0 },
        { name: 'gck_cfg (ошибка)', bit: [[2.47, 2.5, 1], [3, 3.02, 0], [4, 4.02, 1], [5, 5.02, 0]], init: 0 },
      ],
      marks: [{ t: 2, label: 'фронт', cls: 'capture' }, { t: 3, label: 'спад', cls: 'hold' }],
      windows: [{ row: 1, t0: 1.9, t1: 2, cls: 'setup' }, { row: 1, t0: 3, t1: 3.05, cls: 'hold' }],
      spans: [{ row: 4, t0: 2.5, t1: 3, label: 'укороченный импульс', cls: 'setup', lt: 3.15, anchor: 'start' }],
      caption: 'Разрешение, изменившееся при clk = 0 (до фронта с запасом 0,10 нс), даёт на выходе целые импульсы. Изменение при clk = 1 порождает укороченный импульс – ложный фронт для cfg_reg. Проверка стробирования требует неизменности разрешения от 0,10 нс до фронта до 0,05 нс после спада.',
    },
  ],
  solution: `create_clock -name clk -period 2.000 [get_ports clk]
set_clock_gating_check -setup 0.100 -hold 0.050 [get_cells u_gate_and]`,
  check: { clockNames: ['clk'] },
  hints: [
    'Ячейка ICG и элемент И пропускают тактовый сигнал дальше, как буфер: `clk` сам распространится на `acc_reg` и `cfg_reg`. Достаточно описать его на порту.',
    'Запасы проверки стробирования задаёт команда `set_clock_gating_check` с опциями `-setup` и `-hold`; объект – элемент, к которому они относятся.',
    '`set_clock_gating_check -setup 0.1 -hold 0.05 [get_cells u_gate_and]`. Для ICG ничего добавлять не нужно: проверки входа E заданы в библиотеке.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk -period 2.000 [get_ports clk]
    set_clock_gating_check -setup 0.100 -hold 0.050 [get_cells u_gate_and]
    \`\`\`
    **ICG не требует ограничений.** Тактовый сигнал проходит через ячейку стробирования к выходу GCK, как через буфер: САПР распространяет \`clk\` на \`acc_reg\` автоматически. Отдельный тактовый сигнал на \`u_icg/GCK\` не нужен: \`create_clock\` там был бы ошибкой (новый первичный сигнал без задержки дерева до ICG), а \`create_generated_clock\` лишь добавил бы в отчёты ещё одно имя домена. Путь \`en_reg → u_icg/E\` – обычный путь данных: в библиотеке у входа E есть проверки предустановки и удержания относительно CK, как у триггера.

    **Как устроена ICG.** Внутри – защёлка, прозрачная при CK = 0, и элемент И. Разрешение может меняться в любой момент периода: защёлка «замораживает» его на время единицы CK, и на выходе не бывает укороченных импульсов. Поэтому синтез вставляет именно ячейки ICG (в Design Compiler – \`compile_ultra -gate_clock\`), а не простой элемент И.

    **Элемент И.** Здесь защёлки нет, и разрешение обязано меняться только при clk = 0. Если оно изменится, пока clk = 1, на выходе появится укороченный импульс – ложный фронт для \`cfg_reg\` (см. диаграмму). САПР распознают элемент, на входы которого приходят тактовый сигнал и данные, и выводят проверку стробирования: для элемента И – предустановку относительно фронта и удержание относительно спада тактового сигнала. Команда \`set_clock_gating_check\` задаёт запасы этой проверки, без неё запасы нулевые.

    **Типичные ошибки:**
    - \`create_clock\` на выходе ICG или элемента И: потеряна задержка от порта до ячейки стробирования и связь с \`clk\`;
    - \`set_false_path\` на входе разрешения ICG: отключает настоящую проверку, а позднее разрешение исказит импульс на выходе;
    - \`set_clock_gating_check\` для тактового сигнала (\`[get_clocks clk]\`) вместо элемента: запасы применятся ко всем выводимым проверкам стробирования этого тактового сигнала, а по условию нужен только \`u_gate_and\`.

    **Проверка.** В PrimeTime: \`report_clock_gating_check\` – выводимые проверки стробирования с запасами; \`report_timing -to [get_pins u_gate_and/A]\` – путь разрешения. ConstraintLab сами проверки стробирования не строит, но сравнивает значения \`set_clock_gating_check\` с эталоном и проверяет путь к входу E ячейки ICG.
  `,
  tests: [
    { code: 'create_clock -period 2 -name clk [get_ports clk]\nset_clock_gating_check -setup 0.1 [get_cells u_gate_and]\nset_clock_gating_check -hold 0.05 [get_cells u_gate_and]', pass: true, note: 'запасы отдельными командами' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\ncreate_generated_clock -name gck_acc -combinational -source [get_pins u_icg/CK] [get_pins u_icg/GCK]\nset_clock_gating_check -setup 0.1 -hold 0.05 [get_cells u_gate_and]', pass: false, note: 'лишний тактовый сигнал на выходе ICG', expect: 'gck_acc' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\ncreate_clock -name gck_cfg -period 2 [get_pins u_gate_and/Y]\nset_clock_gating_check -setup 0.1 -hold 0.05 [get_cells u_gate_and]', pass: false, note: 'create_clock на выходе элемента И', expect: 'gck_cfg' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]', pass: false, note: 'нет запасов проверки стробирования', expect: 'Не задано: set_clock_gating_check' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_gating_check -setup 0.1 -hold 0.05 [get_cells u_gate_and]\nset_false_path -to [get_pins u_icg/E]', pass: false, note: 'ложный путь на входе разрешения ICG', expect: 'ошибочно объявлен ложным' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_gating_check -setup 0.1 -hold 0.05 [get_clocks clk]', pass: false, note: 'запасы для тактового сигнала, а не для элемента', expect: 'Не задано: set_clock_gating_check' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.ideal_net', module: 'asic_modes', order: 4, level: 2, tool: 'sdc',
  lang: 'sdc', langNote: 'В ПЛИС сброс и другие сильно разветвлённые цепи разводит сам Vivado (при необходимости – через глобальные буферы); `set_ideal_network` – команда синтеза ASIC.',
  title: 'Синтез: идеальные цепи сброса и разрешения сканирования',
  tags: ['set_ideal_network', 'сброс', 'scan_en', 'синтез', 'recovery/removal'],
  text: `
    Блок \`core_top\` (около 40 тысяч триггеров, **500 МГц**) синтезируют в Design Compiler или Genus. Все триггеры – сканируемые со сбросом (SDFFR):
    - сброс \`rst_sync_n\` приходит с верхнего уровня уже синхронизированным: его снимают по фронту \`clk\`, и на порту блока он меняется через **0,3 нс** после фронта; он идёт на входы RN всех триггеров;
    - разрешение сканирования \`scan_en\` идёт на входы SE всех триггеров; в функциональном режиме \`scan_en = 0\`.

    Каждая из этих цепей нагружена десятками тысяч входов. На этапе синтеза такие цепи не буферизуют: дерево буферов для них строят при топологическом проектировании, когда известно размещение.

    **Задание.** Напишите SDC-файл синтеза функционального режима:
    1. опишите тактовый сигнал \`clk\`;
    2. задайте задержку снятия сброса на порту \`rst_sync_n\` – 0,3 нс относительно \`clk\` (для проверок восстановления и снятия сброса);
    3. зафиксируйте \`scan_en = 0\`;
    4. объявите цепи \`rst_sync_n\` и \`scan_en\` идеальными.

    Задержки данных \`din[7:0]\` уже заданы (блок «Выполняется после вашего кода»).
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок core_top' },
      { id: 'pdin', t: 'in', name: 'din', w: 8, x: 20, y: 37 },
      { id: 'psi', t: 'in', name: 'scan_in', x: 20, y: 117 },
      { id: 'pse', t: 'in', name: 'scan_en', x: 20, y: 147 },
      { id: 'pclk', t: 'in', name: 'clk', x: 20, y: 177 },
      { id: 'prst', t: 'in', name: 'rst_sync_n', x: 20, y: 247 },
      { id: 'lg', t: 'logic', name: 'u_logic', w: 8, label: 'логика', bw: 80, mix: true, x: 150, y: 25 },
      { id: 'rc', t: 'sdffr', name: 'core_reg', w: 8, x: 290, y: 30, nameX: 30 },
      { id: 'note', t: 'note', x: 420, y: 70, text: 'Показаны 8 триггеров\nиз 40 тысяч: цепи RN и SE\nобщие для всех' },
    ],
    wires: [
      { from: 'pdin', to: 'lg.I' },
      { from: 'rc.Q', to: 'lg.I', my: 4 },
      { from: 'lg.O', to: 'rc.D' },
      { from: 'psi', to: 'rc.SI', mx: 250 },
      { from: 'pse', to: 'rc.SE', mx: 262, label: 'scan_en', lx: 200, ly: 152 },
      { from: 'pclk', to: 'rc.CK', kind: 'clk', mx: 274 },
      { from: 'prst', to: 'rc.RN', kind: 'rst', label: 'rst_sync_n', lx: 220, ly: 252 },
    ],
  },
  after: 'set_input_delay -clock clk 0.800 [get_ports {din[*]}]',
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Показаны 8 из 40 тысяч триггеров. Синие линии – данные и scan_en, фиолетовая – сброс, оранжевая – тактовый сигнал. Цепи RN и SE питают все триггеры блока. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Снятие сброса: проверки восстановления и снятия', t: [-0.3, 4.4], width: 560,
      signals: [
        { name: 'clk', clock: { period: 2 }, arrows: 'rise' },
        { name: 'rst_sync_n на порту', bit: [[0.3, 0.35, 1]], init: 0 },
      ],
      marks: [{ t: 0, label: 'снятие сброса', cls: 'launch' }, { t: 2, label: 'первый рабочий фронт', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 0.3, label: '0,3 нс', cls: 'data' },
        { row: 1, t0: 0.3, t1: 2, label: 'бюджет восстановления: 1,7 нс', cls: 'setup' },
      ],
      caption: 'Сброс снимается по фронту clk на верхнем уровне и доходит до порта через 0,3 нс. До входов RN всех триггеров он должен дойти раньше следующего фронта с запасом на время восстановления (recovery), но позже окна снятия сброса (removal) относительно своего фронта. При синтезе цепь идеальна, после размещения проверки выполняются с реальным деревом буферов.',
    },
  ],
  solution: `create_clock -name clk -period 2.000 [get_ports clk]
set_input_delay -clock clk 0.300 [get_ports rst_sync_n]
set_case_analysis 0 [get_ports scan_en]
set_ideal_network [get_ports {rst_sync_n scan_en}]`,
  check: { clockNames: ['clk'] },
  hints: [
    'Сброс снимается синхронно, поэтому для него нужна обычная задержка ввода относительно `clk` – из неё САПР строит проверки восстановления и снятия сброса на входах RN.',
    'Функциональный режим фиксируют константой: `set_case_analysis 0 [get_ports scan_en]`.',
    'Идеальные цепи задаёт `set_ideal_network`: `set_ideal_network [get_ports {rst_sync_n scan_en}]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk -period 2.000 [get_ports clk]
    set_input_delay -clock clk 0.300 [get_ports rst_sync_n]
    set_case_analysis 0 [get_ports scan_en]
    set_ideal_network [get_ports {rst_sync_n scan_en}]
    \`\`\`
    **Что делает set_ideal_network.** Цепь и всё, что она питает через буферы и инверторы, считается идеальной: нулевая задержка и нулевая длительность фронта, а правила проектирования (длительность фронта, ёмкость, коэффициент разветвления) на ней не исправляются. Синтез не строит для неё дерево буферов. Опция \`-no_propagate\` ограничивает идеальность самой цепью.

    **Зачем это сбросу и разрешению сканирования.** На этапе синтеза нет размещения: длины проводов оцениваются статистически, и дерево буферов, построенное по такой оценке, будет неверным. Его всё равно перестроят после размещения: Innovus и IC Compiler II строят деревья для цепей с большим коэффициентом разветвления (high fanout net synthesis) с учётом положения триггеров. Без идеальности синтез вставит сотни буферов, будет исправлять «нарушения» длительности фронта, а проверки восстановления и снятия сброса покажут задержку огромной нагрузки.

    **Зачем задержка ввода сбросу.** Сброс снимается синхронно, по фронту \`clk\` на верхнем уровне. Проверки восстановления и снятия сброса на входах RN должны выполняться: при синтезе – с идеальной цепью, после размещения – с реальным деревом буферов. Ложный путь от этого порта отключил бы их навсегда.

    **Тактовые сигналы.** Для тактовых цепей идеальность до синтеза тактового дерева действует автоматически, отдельная команда не нужна. Команда \`set_dont_touch_network\` запрещает изменять цепь, но не делает её идеальной: для цепи сброса задержки и длительности фронтов считались бы по огромной нагрузке.

    **После размещения** в SDC-файле для топологического проектирования \`set_ideal_network\` убирают: цепи получают реальные буферы и задержки, и проверки восстановления и снятия сброса выполняются с ними.

    **Типичные ошибки:**
    - нет \`set_ideal_network\` – огромные деревья буферов и ложные нарушения уже при синтезе;
    - \`set_false_path -from [get_ports rst_sync_n]\` вместо задержки ввода – проверки восстановления и снятия сброса пропадают;
    - \`set_dont_touch_network\` вместо \`set_ideal_network\` – буферы не вставляются, но анализ видит задержку огромной нагрузки.

    **Проверка.** В Design Compiler: \`report_ideal_network\` – идеальные цепи и их источники; \`report_timing -to [get_pins {core_reg[0]/RN}]\` – проверка восстановления. В консоли ConstraintLab: \`report_timing -from [get_ports rst_sync_n]\` – требования восстановления 2 нс и снятия сброса 0 нс.
  `,
  tests: [
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_input_delay 0.3 -clock [get_clocks clk] [get_ports rst_sync_n]\nset_case_analysis zero [get_ports scan_en]\nset_ideal_network [get_ports rst_sync_n]\nset_ideal_network -no_propagate [get_ports scan_en]', pass: true, note: 'отдельные команды, -no_propagate' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_input_delay -clock clk 0.3 [get_ports rst_sync_n]\nset_case_analysis 0 [get_ports scan_en]', pass: false, note: 'нет идеальных цепей', expect: 'Не задано: set_ideal_network' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_input_delay -clock clk 0.3 [get_ports rst_sync_n]\nset_case_analysis 0 [get_ports scan_en]\nset_dont_touch_network [get_ports {rst_sync_n scan_en}]', pass: false, note: 'set_dont_touch_network вместо set_ideal_network', expect: 'Не задано: set_ideal_network' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_false_path -from [get_ports rst_sync_n]\nset_case_analysis 0 [get_ports scan_en]\nset_ideal_network [get_ports {rst_sync_n scan_en}]', pass: false, note: 'ложный путь вместо задержки снятия сброса', expect: 'исключён командой set_false_path' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_input_delay -clock clk 0.3 [get_ports rst_sync_n]\nset_case_analysis 1 [get_ports scan_en]\nset_ideal_network [get_ports {rst_sync_n scan_en}]', pass: false, note: 'scan_en = 1 – режим сдвига', expect: 'set_case_analysis: неверное значение 1' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.modes_q', module: 'asic_modes', order: 5, level: 2, tool: 'sdc', type: 'choice', multi: true,
  lang: 'sdc', langNote: 'Режимы и углы финального анализа – практика ASIC. В Vivado анализ по углам (медленный и быстрый) выполняется автоматически, а тестовых режимов сканирования у ПЛИС нет.',
  title: 'Режимы и углы: что отличается в SDC-файлах?',
  tags: ['режимы работы', 'MMMC', 'сканирование', 'понимание'],
  text: `
    Блок \`core_top\` с мультиплексором тестового тактового сигнала и цепочкой сканирования (задачи [[q:asic.test_mux|о функциональном режиме]] и [[q:asic.scan_shift|о режиме сдвига]]) готовят к финальному анализу в трёх режимах:
    - функциональный: \`func_clk\` 250 МГц;
    - сдвиг при сканировании: \`tck\` 25 МГц;
    - захват при сканировании: \`tck\` 25 МГц, \`scan_en = 0\`.

    Анализ выполняется в двух углах: медленном (ss, 0,72 В, 125 °C) и быстром (ff, 0,88 В, −40 °C).

    **Задание.** Отметьте все верные утверждения.
  `,
  design: MODES_SCAN_DESIGN,
  figures: [{ kind: 'schematic', title: 'Схема', caption: 'Блок core_top: мультиплексор тактовых сигналов u_clk_mux выбирает func_clk или tck, сканируемые триггеры core_reg образуют цепочку scan_in → … → scan_out.' }],
  options: [
    { text: 'Режимы различаются константами `set_case_analysis`: функциональный – `test_mode = 0`, `scan_en = 0`; сдвиг – 1 и 1; захват – 1 и 0.', ok: true, why: 'Верно. Константы задают путь тактового сигнала через мультиплексор и активные проверки сканируемых триггеров (вход D или вход SI).' },
    { text: 'В режимах сканирования порты `scan_in` и `scan_out` ограничивают относительно `tck`, а в функциональном режиме функциональные порты – относительно `func_clk`.', ok: true, why: 'Верно. В каждом режиме задержки ввода/вывода описывают ту внешнюю сторону, которая в этом режиме работает: тестер или соседние блоки.' },
    { text: 'Для угла ff не нужен отдельный SDC-файл: угол меняет библиотеки и параметры межсоединений, а ограничения режима остаются прежними.', ok: true, why: 'Верно. Частоты, задержки портов и константы – свойства режима. Угол – это условия PVT и экстракция RC. В САПР Cadence это constraint mode и delay corner, объединённые в analysis view.' },
    { text: 'В режиме сдвига частота всего 25 МГц, поэтому проверки удержания в нём можно не выполнять.', why: 'Неверно. Требование к удержанию не зависит от периода, а в режиме сдвига оно часто самое трудное: выход Q соединён с входом SI следующего триггера почти напрямую, и перекос тактового дерева легко превышает задержку такого пути.' },
    { text: 'Достаточно одного SDC-файла с `set_clock_groups -logically_exclusive` между `func_clk` и `tck`: режимы тогда не нужны.', why: 'Неверно. Группы убирают только пути между тактовыми сигналами. Без констант на test_mode и scan_en одновременно анализируются проверки входов D и SI и пути через тестовую логику: в одном анализе смешаны условия, которые в кристалле не встречаются вместе.' },
    { text: 'Для быстрого угла ff пишут SDC-файл с уменьшенными периодами тактовых сигналов: в этом угле схема работает быстрее.', why: 'Неверно. Период – требование системы, а не свойство угла. В быстром угле с теми же ограничениями проверяют в основном удержание.' },
    { text: 'Предустановку и удержание проверяют в каждом угле: обычно худший случай для удержания – быстрый угол, для предустановки – медленный, но при обратной температурной зависимости задержек в современных технологиях это не всегда так.', ok: true, why: 'Верно. При низком напряжении питания задержка ячеек может расти при понижении температуры (обратная температурная зависимость), поэтому худший угол заранее не очевиден, и обе проверки выполняют во всех углах.' },
  ],
  hints: [
    'Разделите сведения на два вида: что задаёт работа схемы (частоты, константы, внешние задержки) и что задают условия изготовления и эксплуатации (напряжение, температура, разброс технологии).',
    'Требование к удержанию сравнивает моменты одного и того же фронта – от периода оно не зависит.',
  ],
  explain: `
    **Режим** (mode) описывает, *как работает* схема: какие тактовые сигналы и с какими частотами, какие константы на управляющих входах, какие внешние задержки. Для каждого режима пишут свой SDC-файл или набор файлов: функциональный, сдвиг, захват (а для захвата на полной скорости – ещё и с тактовыми сигналами PLL от встроенного контроллера тактовых сигналов).

    **Угол** (corner) описывает, *в каких условиях* она работает: библиотеки для напряжения, температуры и технологического разброса, параметры межсоединений после экстракции. В угол SDC-файлы не входят.

    **Вид анализа** – пара «режим + угол». Финальный анализ выполняют для всех нужных пар: в САПР Cadence это описание MMMC (constraint mode, delay corner, analysis view), в PrimeTime – отдельные сценарии или распределённый анализ нескольких сценариев (DMSA).

    | Режим / угол | ss, 0,72 В, 125 °C | ff, 0,88 В, −40 °C |
    |---|---|---|
    | функциональный | предустановка и удержание | предустановка и удержание |
    | сдвиг | предустановка и удержание (удержание особенно важно) | предустановка и удержание |
    | захват | предустановка и удержание | предустановка и удержание |

    **Почему проверяют всё во всех углах.** Обычно предустановка хуже всего в медленном угле, удержание – в быстром. Но в современных технологиях при низком напряжении задержка может расти при понижении температуры (обратная температурная зависимость), а перекос тактового дерева в разных углах разный. Пропустить угол – значит рискнуть пропустить нарушение.
  `,
});
