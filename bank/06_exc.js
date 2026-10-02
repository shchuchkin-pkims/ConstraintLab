/* Модуль 6. Исключения: многотактные и ложные пути (Vivado XDC) */
XT.bank.module({
  id: 'exc', order: 60, title: '6. Исключения: многотактные и ложные пути',
  about: 'set_multicycle_path (-setup/-hold, -start/-end), функционально ложные пути, синхронизатор сброса и проверки восстановления/снятия сброса, приоритет исключений',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.mcp_ce', module: 'exc', order: 1, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`set_multicycle_path` и значения по умолчанию (`-end` для предустановки, `-start` для удержания) одинаковы в Vivado и PrimeTime.',
  title: 'Умножитель с сигналом разрешения: многотактный путь',
  tags: ['set_multicycle_path', '-setup', '-hold', 'сигнал разрешения'],
  text: `
    Блок масштабирования отсчётов тактируется сигналом \`clk\` частотой **200 МГц** (период 5 нс). Операнды из регистров \`a_reg[7:0]\` и \`b_reg[7:0]\` поступают на комбинационный умножитель 8 × 8 бит, произведение записывается в регистр \`prod_reg[15:0]\`.

    Новые отсчёты приходят вдвое реже тактовой частоты, поэтому все три регистра загружаются только по сигналу разрешения \`ce\` (входы CE). Его формирует счётчик-делитель внутри блока-источника \`u_src\`: \`ce = 1\` в каждом втором такте. Операнды, загруженные фронтом *k*, не изменяются до фронта *k* + 2, и именно этим фронтом произведение записывается в \`prod_reg\`. Умножитель без конвейерных регистров не укладывается в 5 нс, но укладывается в 10 нс.

    **Задание.** Разрешите путям через умножитель (от регистров операндов к регистру произведения) два такта на предустановку и сохраните правильную проверку удержания. Остальные пути проекта, в том числе пути сигнала разрешения, должны остаться однотактными.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pc', t: 'in', name: 'clk', x: 10, y: 380 },
      { id: 'ib', t: 'ibuf', name: 'clk_IBUF_inst', x: 76, y: 377, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk_IBUF_BUFG_inst', x: 120, y: 377, noName: true },
      {
        id: 'src', t: 'block', name: 'u_src', title: 'источник отсчётов', titleY: 62, x: 30, y: 40, bw: 150, bh: 180,
        pins: [{ n: 'A', d: 'out', w: 8, y: 18 }, { n: 'CE', d: 'out', y: 100 }, { n: 'B', d: 'out', w: 8, y: 148 }, { n: 'CLK', clk: true, side: 'b', x: 138 }],
        timing: { seq: true, clk: 'CLK', launch: { A: ['rise'], B: ['rise'], CE: ['rise'] } },
      },
      { id: 'ra', t: 'ff', name: 'a_reg', w: 8, ce: true, x: 330, y: 40 },
      { id: 'rb', t: 'ff', name: 'b_reg', w: 8, ce: true, x: 330, y: 170 },
      { id: 'mul', t: 'logic', name: 'mul', w: 16, mix: true, label: '×', x: 452, y: 95, bw: 84, bh: 80 },
      { id: 'rp', t: 'ff', name: 'prod_reg', w: 16, ce: true, x: 600, y: 117 },
    ],
    wires: [
      { from: 'pc', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'src.CLK', kind: 'clk' },
      { from: 'bg.O', to: ['ra.C', 'rb.C'], kind: 'clk', label: 'clk', mx: 300 },
      { from: 'bg.O', to: 'rp.C', kind: 'clk', mx: 588 },
      { from: 'src.A', to: 'ra.D', bus: true, bw: 8 },
      { from: 'src.B', to: 'rb.D', bus: true, bw: 8 },
      { from: 'src.CE', to: ['ra.CE', 'rb.CE'], label: 'ce', mx: 270 },
      { from: 'src.CE', to: 'rp.CE', via: [[192, 275], [576, 275], [576, 155]] },
      { from: 'ra.Q', to: 'mul.I0' },
      { from: 'rb.Q', to: 'mul.I3' },
      { from: 'mul.O', to: 'rp.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Предустановка: произведение захватывается вторым фронтом', t: [-1.5, 22],
      signals: [
        { name: 'clk', clock: { period: 5 }, arrows: 'rise' },
        { name: 'ce', bit: [[0.5, 0.7, 0], [5.5, 5.7, 1], [10.5, 10.7, 0], [15.5, 15.7, 1], [20.5, 20.7, 0]], init: 1 },
        { name: 'a_reg, b_reg', bus: [[0.4, 0.8, 'A1, B1'], [10.4, 10.8, 'A2, B2'], [20.4, 20.8, 'A3, B3']], init: 'A0, B0' },
        { name: 'выход умножителя', bus: [[0.8, 8.2, 'A1·B1'], [10.8, 18.2, 'A2·B2']], init: 'A0·B0' },
        { name: 'prod_reg', bus: [[10.4, 10.8, 'A1·B1'], [20.4, 20.8, 'A2·B2']], init: 'A0·B0' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 5, label: 'захват по умолчанию', cls: 'default' }, { t: 10, label: 'захват: -setup 2', cls: 'capture' }],
      spans: [{ row: 3, t0: 0.8, t1: 8.2, label: 'задержка умножителя', cls: 'data' }, { row: 4, t0: 0, t1: 10, label: 'требование к предустановке 10 нс', cls: 'setup' }],
      caption: 'Операнды, загруженные фронтом 0 нс, остаются неизменными до фронта 10 нс. На промежуточном фронте 5 нс сигнал ce = 0, и prod_reg хранит прежнее значение: неготовое произведение не захватывается.',
    },
    {
      kind: 'timing', title: 'Удержание: куда сдвигается проверка', t: [-1.5, 17],
      signals: [
        { name: 'clk', clock: { period: 5 }, arrows: 'rise' },
        { name: 'a_reg, b_reg', bus: [[0.4, 0.8, 'A1, B1'], [10.4, 10.8, 'A2, B2']], init: 'A0, B0' },
        { name: 'только -setup 2', bit: [], init: 0 },
        { name: '-setup 2 и -hold 1', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск A1', cls: 'launch' }, { t: 5, label: 'удержание без -hold', cls: 'hold' }, { t: 10, label: 'захват A1·B1', cls: 'capture' }],
      spans: [
        { row: 2, t0: 0, t1: 10, label: 'предустановка: 10 нс', cls: 'setup' }, { row: 2, t0: 0, t1: 5, label: 'удержание: 5 нс', cls: 'hold' },
        { row: 3, t0: 0, t1: 10, label: 'предустановка: 10 нс', cls: 'setup' }, { row: 3, t0: 0, t1: 0, label: 'удержание: 0 нс – проверка на фронте запуска', cls: 'hold' },
      ],
      caption: 'Проверка удержания выполняется по фронту, предшествующему фронту захвата. После -setup 2 это фронт 5 нс: путь через умножитель обязан быть длиннее 5 нс, что невыполнимо. Команда -hold 1 возвращает проверку на фронт запуска (требование 0 нс).',
    },
  ],
  given: `create_clock -name clk -period 5.000 [get_ports clk]`,
  solution: `set_multicycle_path 2 -setup -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]
set_multicycle_path 1 -hold  -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]`,
  hints: [
    'Сколько периодов проходит от фронта, загрузившего операнды, до фронта, который записывает произведение? Это множитель для `-setup`.',
    'После `set_multicycle_path N -setup` проверка удержания сдвигается вместе с фронтом захвата. Вернуть её на исходный фронт можно второй командой `set_multicycle_path N-1 -hold` с теми же `-from` и `-to`.',
    'Область действия: `-from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]`. Запись только с `-to [get_cells {prod_reg[*]}]` слишком широка: она захватит и путь сигнала разрешения `u_src → prod_reg/CE`.',
  ],
  explain: `
    \`\`\`
    set_multicycle_path 2 -setup -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]
    set_multicycle_path 1 -hold  -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]
    \`\`\`
    - **Предустановка.** По умолчанию данные, запущенные фронтом 0 нс, захватываются следующим фронтом: требование 5 нс. Команда \`-setup 2\` переносит захват на второй фронт после запуска: требование 2 · 5 = 10 нс. Множитель отсчитывается в периодах тактового сигнала захвата (\`-end\` действует по умолчанию); при одном тактовом сигнале это безразлично.
    - **Удержание.** Проверка удержания выполняется по фронту, предшествующему фронту захвата. После \`-setup 2\` это фронт 5 нс, и требование к удержанию становится 5 нс: даже самый короткий путь через умножитель должен быть длиннее 5 нс. Vivado попытается «исправить» такое нарушение задержками в трассировке и ухудшит предустановку. Команда \`-hold 1\` возвращает проверку на фронт запуска: требование 0 нс, как у обычного однотактного пути.
    - **Почему это корректно.** Операнды не изменяются два такта, а на промежуточном фронте 5 нс сигнал \`ce = 0\`, и \`prod_reg\` хранит прежнее значение. Многотактный путь допустим, только если это гарантирует логика проекта (здесь – сигнал разрешения); иначе исключение скроет реальную ошибку.
    - **Область действия.** Сигнал \`ce\` изменяется каждый такт, поэтому пути \`u_src → …/CE\` должны остаться однотактными. Запись \`-to [get_cells {prod_reg[*]}]\` без \`-from\` охватывает все информационные входы регистра, включая CE: требование к пути \`u_src → prod_reg/CE\` выросло бы до 10 нс, и ошибка в разводке сигнала разрешения осталась бы незамеченной. Равноценная узкая запись – \`-to [get_pins {prod_reg[*]/D}]\`: к выводам D приходят только пути от регистров операндов.

    Типичные ошибки:
    - нет \`-hold\` – требование к удержанию 5 нс: ложные нарушения и лишние задержки в трассировке;
    - \`-hold 2\` – проверка уходит на фронт −5 нс (требование −5 нс): она выполняется заведомо и уже не защищает от реальных нарушений, например из-за перекоса тактового сигнала;
    - исключение между тактовыми сигналами (\`-from [get_clocks clk] -to [get_clocks clk]\`) – двухтактными становятся все пути проекта.

    Проверка в Vivado: \`report_timing -from [get_cells {a_reg[0]}] -to [get_cells {prod_reg[15]}] -delay_type min_max\` – в строке Requirement 10 нс для предустановки и 0 нс для удержания; \`report_exceptions\` покажет, сколько путей покрывает каждое исключение. В ConstraintLab то же видно на вкладке «Анализ путей».
  `,
  refs: 'UG903, раздел «Multicycle Paths»; справочник: «Многотактные пути без ошибок»',
  tests: [
    { code: 'set_multicycle_path 2 -setup -to [get_pins {prod_reg[*]/D}]\nset_multicycle_path 1 -hold -to [get_pins {prod_reg[*]/D}]', pass: true, note: 'только -to на выводы D' },
    { code: 'set ops [get_cells {a_reg[*] b_reg[*]}]\nset res [get_pins {prod_reg[*]/D}]\nset_multicycle_path 2 -from $ops -to $res\nset_multicycle_path -hold 1 -from $ops -to $res', pass: true, note: 'переменные, -setup по умолчанию' },
    { code: 'set_multicycle_path 2 -setup -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]', pass: false, note: 'нет -hold', expect: 'не задан set_multicycle_path -hold' },
    { code: 'set_multicycle_path 2 -setup -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]\nset_multicycle_path 2 -hold -from [get_cells {a_reg[*] b_reg[*]}] -to [get_cells {prod_reg[*]}]', pass: false, note: '-hold 2', expect: 'Удержание \\(hold\\): требование -5' },
    { code: 'set_multicycle_path 2 -setup -to [get_cells {prod_reg[*]}]\nset_multicycle_path 1 -hold -to [get_cells {prod_reg[*]}]', pass: false, note: 'только -to на ячейки: захвачен вход CE', expect: 'многотактный путь задан без оснований' },
    { code: 'set_multicycle_path 2 -setup -from [get_clocks clk] -to [get_clocks clk]\nset_multicycle_path 1 -hold -from [get_clocks clk] -to [get_clocks clk]', pass: false, note: 'между тактовыми сигналами', expect: 'без оснований' },
  ],
});

// ---------------------------------------------------------------------------
// Общая часть проекта для задач 50 ↔ 200 МГц: MMCM из 100 МГц
const EXC_CLK50_200 = {
  elements: [
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    { id: 'p', t: 'in', name: 'sys_clk', x: 10, y: 205 },
    { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 96, y: 202, noName: true },
    {
      id: 'm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 150, y: 164, mult: 10, divclk: 1,
      outs: [{ pin: 'CLKOUT0', div: 20, clk: 'clk50', label: 'CLKOUT0: 50 МГц' }, { pin: 'CLKOUT1', div: 5, clk: 'clk200', label: 'CLKOUT1: 200 МГц' }],
    },
    { id: 'b50', t: 'bufg', name: 'u_clk/clkout0_buf', x: 360, y: 84, noName: true },
    { id: 'b200', t: 'bufg', name: 'u_clk/clkout1_buf', x: 360, y: 290, noName: true },
  ],
  wires: [
    { from: 'p', to: 'ib.I', kind: 'clk' },
    { from: 'ib.O', to: 'm.CLKIN1', kind: 'clk' },
    { from: 'm.CLKOUT0', to: 'b50.I', kind: 'clk' },
    { from: 'm.CLKOUT1', to: 'b200.I', kind: 'clk' },
  ],
};

XT.bank.add({
  id: 'exc.slow_fast', module: 'exc', order: 2, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Опции `-start`/`-end` и правило N и N−1 одинаковы в XDC и SDC; тактовые сигналы MMCM в ASIC пришлось бы описать вручную.',
  title: 'Из медленного домена в быстрый: многотактный путь с -end',
  tags: ['set_multicycle_path', '-end', 'связанные тактовые сигналы', 'MMCM'],
  text: `
    IP-блок Clocking Wizard (\`u_clk\`) формирует из сигнала **100 МГц** на входе \`sys_clk\` два тактовых сигнала: **50 МГц** (\`clk50\`) и **200 МГц** (\`clk200\`). Оба получены от одного MMCM, поэтому связаны: фронты \`clk50\` совпадают с каждым четвёртым фронтом \`clk200\`. Vivado выводит эти тактовые сигналы автоматически.

    Блок адаптации в домене \`clk50\` обновляет коэффициент \`coef_reg[7:0]\` каждым фронтом своего тактового сигнала. Тракт фильтра в домене \`clk200\` переписывает коэффициент в регистр \`coef_q_reg[7:0]\` по сигналу разрешения \`ld\` от фазового счётчика \`u_ph\`: \`ld = 1\` только в том такте \`clk200\`, который заканчивается фронтом, совпадающим с фронтом \`clk50\`. Значит, данные, запущенные фронтом \`clk50\`, неизменны 4 периода \`clk200\` и захватываются 4-м фронтом \`clk200\` после запуска.

    **Задание.** Опишите передачу \`coef_reg → coef_q_reg\` многотактным путём: захват на 4-м фронте \`clk200\` после запуска, проверка удержания – на исходном фронте (требование 0 нс).
  `,
  design: {
    elements: EXC_CLK50_200.elements.concat([
      { id: 'adp', t: 'block', name: 'u_adapt', title: 'адаптация', x: 450, y: 20, bw: 120, bh: 56, pins: [{ n: 'CLK', clk: true, y: 44 }, { n: 'K', d: 'out', w: 8, y: 38 }], timing: { seq: true, clk: 'CLK', launch: { K: ['rise'] } } },
      { id: 'rs', t: 'ff', name: 'coef_reg', w: 8, x: 620, y: 40 },
      { id: 'ph', t: 'block', name: 'u_ph', title: 'фазовый счётчик', x: 600, y: 330, bw: 130, bh: 56, pins: [{ n: 'CLK', clk: true, y: 32 }, { n: 'LD', d: 'out', y: 32 }], timing: { seq: true, clk: 'CLK', launch: { LD: ['rise'] } } },
      { id: 'rd', t: 'ff', name: 'coef_q_reg', w: 8, ce: true, x: 800, y: 246 },
    ]),
    wires: EXC_CLK50_200.wires.concat([
      { from: 'b50.O', to: ['adp.CLK', 'rs.C'], kind: 'clk', label: 'clk50', trunk: 24, lx: 530, ly: 93 },
      { from: 'b200.O', to: ['rd.C', 'ph.CLK'], kind: 'clk', label: 'clk200' },
      { from: 'adp.K', to: 'rs.D', bus: true, bw: 8 },
      { from: 'rs.Q', to: 'rd.D' },
      { from: 'ph.LD', to: 'rd.CE', label: 'ld' },
    ]),
  },
  figures: [
    {
      kind: 'timing', title: 'Запуск фронтом clk50, захват 4-м фронтом clk200', t: [-2, 44],
      signals: [
        { name: 'clk50', clock: { period: 20 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk200', clock: { period: 5 }, arrows: 'rise' },
        { name: 'coef_reg', bus: [[0.5, 1.2, 'K1'], [20.5, 21.2, 'K2'], [40.5, 41.2, 'K3']], init: 'K0' },
        { name: 'ld', bit: [[15.5, 15.7, 1], [20.5, 20.7, 0], [35.5, 35.7, 1], [40.5, 40.7, 0]], init: 0 },
        { name: 'coef_q_reg', bus: [[20.4, 20.9, 'K1'], [40.4, 40.9, 'K2']], init: 'K0' },
        { name: 'предустановка', bit: [], init: 0 },
        { name: 'удержание', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 5, label: 'захват по умолчанию', cls: 'default' }, { t: 15, label: 'удержание без -hold', cls: 'hold' }, { t: 20, label: 'захват: -setup 4 -end', cls: 'capture' }],
      spans: [
        { row: 5, t0: 0, t1: 5, label: 'по умолчанию 5 нс' }, { row: 5, t0: 0, t1: 20, label: '-setup 4 -end: 20 нс', cls: 'setup' },
        { row: 6, t0: 0, t1: 15, label: 'только -setup: 15 нс', cls: 'hold' },
      ],
      caption: 'Без исключения захват выполняется ближайшим фронтом clk200 (5 нс). -setup 4 -end сдвигает его на 3 периода clk200 – к 20 нс. Проверка удержания сдвигается следом (к 15 нс); -hold 3 -end возвращает её на 3 периода clk200 назад, к фронту 0 нс.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_multicycle_path 4 -setup -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]
set_multicycle_path 3 -hold  -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]`,
  hints: [
    'Для `-setup` множитель по умолчанию отсчитывается в периодах тактового сигнала захвата (`-end`), здесь это `clk200`. На каком по счёту фронте `clk200` происходит захват?',
    'Проверку удержания нужно вернуть на 3 периода **быстрого** сигнала назад. Но для `-hold` по умолчанию действует `-start` – периоды тактового сигнала запуска (`clk50`, 20 нс).',
    '`set_multicycle_path 4 -setup -end …` и `set_multicycle_path 3 -hold -end …` с одинаковыми `-from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]`.',
  ],
  explain: `
    \`\`\`
    set_multicycle_path 4 -setup -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]
    set_multicycle_path 3 -hold  -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]
    \`\`\`
    **Без исключений.** Для пары 50 → 200 МГц Vivado выбирает ближайший фронт захвата после запуска: запуск 0 нс, захват 5 нс – требование к предустановке 5 нс, к удержанию 0 нс. Это строже, чем нужно: по протоколу данные захватываются на 20 нс.

    **Предустановка.** \`-setup 4 -end\` сдвигает фронт захвата на 3 периода \`clk200\` вперёд: 5 + 3 · 5 = 20 нс. Опция \`-end\` для -setup действует по умолчанию, но явная запись делает намерение очевидным.

    **Удержание.** Проверка удержания идёт следом за захватом: после сдвига она выполняется по фронту \`clk200\`, предшествующему захвату, то есть на 15 нс, – требование 15 нс. \`-hold 3 -end\` сдвигает её на 3 периода **тактового сигнала захвата** назад: 15 − 3 · 5 = 0 нс.

    **Главная ловушка – -end у -hold.** Для -hold по умолчанию действует \`-start\` (периоды тактового сигнала запуска). Команда \`set_multicycle_path 3 -hold\` без \`-end\` сдвинет проверку на 3 · 20 = 60 нс: требование 15 − 60 = −45 нс, и проверка удержания потеряет смысл.

    | Ограничения | Предустановка | Удержание |
    |---|---|---|
    | без исключений | 5 нс | 0 нс |
    | только \`4 -setup -end\` | 20 нс | 15 нс |
    | \`4 -setup -end\` и \`3 -hold -end\` | 20 нс | 0 нс – верно |
    | \`4 -setup -end\` и \`3 -hold\` (без -end) | 20 нс | −45 нс |
    | \`4 -setup -start\` и \`3 -hold -start\` | 65 нс | 0 нс |

    Правило: при передаче от медленного тактового сигнала к быстрому множители считают в периодах быстрого сигнала захвата, и **обе** команды пишут с \`-end\`.

    Здесь между доменами нет других путей, поэтому запись \`-from [get_clocks clk50] -to [get_clocks clk200]\` равноценна. В реальном проекте адресная запись через ячейки надёжнее: исключение между тактовыми сигналами незаметно расслабит и любые новые передачи между этими доменами.

    Проверка в Vivado: \`report_timing -from [get_cells {coef_reg[0]}] -to [get_cells {coef_q_reg[0]}] -delay_type min_max\` – в строке Requirement 20 нс для предустановки и 0 нс для удержания. В ConstraintLab на вкладке «Анализ путей» щелчок по строке строит диаграмму фронтов запуска и захвата.
  `,
  refs: 'UG903, раздел «Multicycle Paths», пример для тактовых сигналов с разными частотами; справочник: «Многотактные пути без ошибок»',
  tests: [
    { code: 'set_multicycle_path 4 -setup -end -from [get_clocks clk50] -to [get_clocks clk200]\nset_multicycle_path 3 -hold -end -from [get_clocks clk50] -to [get_clocks clk200]', pass: true, note: 'между тактовыми сигналами' },
    { code: 'set_multicycle_path 4 -setup -from [get_cells {coef_reg[*]}] -to [get_pins {coef_q_reg[*]/D}]\nset_multicycle_path 3 -hold -end -from [get_cells {coef_reg[*]}] -to [get_pins {coef_q_reg[*]/D}]', pass: true, note: '-setup без -end (по умолчанию), выводы D' },
    { code: 'set_multicycle_path 4 -setup -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]\nset_multicycle_path 3 -hold -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]', pass: false, note: '-hold без -end', expect: ['требование -45', 'нужен -end'] },
    { code: 'set_multicycle_path 4 -setup -start -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]\nset_multicycle_path 3 -hold -start -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]', pass: false, note: '-start вместо -end', expect: 'Предустановка \\(setup\\): требование 65' },
    { code: 'set_multicycle_path 4 -setup -end -from [get_cells {coef_reg[*]}] -to [get_cells {coef_q_reg[*]}]', pass: false, note: 'нет -hold', expect: 'не задан set_multicycle_path -hold' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.fast_slow', module: 'exc', order: 3, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Опции `-start`/`-end` и правило N и N−1 одинаковы в XDC и SDC.',
  title: 'Из быстрого домена в медленный: многотактный путь с -start',
  tags: ['set_multicycle_path', '-start', 'связанные тактовые сигналы', 'MMCM'],
  text: `
    Тот же MMCM: \`clk200\` (200 МГц) и \`clk50\` (50 МГц); фронты \`clk50\` совпадают с каждым четвёртым фронтом \`clk200\`.

    Накопитель в домене \`clk200\` суммирует отсчёты и обновляет регистр результата \`sum_reg[7:0]\` только по сигналу разрешения \`ld\` фазового счётчика \`u_ph\` – один раз за четыре такта, фронтом, совпадающим с фронтом \`clk50\`. Блок в домене \`clk50\` переписывает результат в регистр \`sum_q_reg[7:0]\` каждым своим фронтом. Значение, запущенное фронтом 0 нс, остаётся неизменным до 20 нс и захватывается фронтом \`clk50\` в момент 20 нс.

    **Задание.** Опишите передачу \`sum_reg → sum_q_reg\` многотактным путём: на предустановку отводится полный период \`clk50\` (4 периода \`clk200\`), проверка удержания должна остаться на исходном фронте (требование 0 нс).
  `,
  design: {
    elements: EXC_CLK50_200.elements.concat([
      { id: 'acc', t: 'block', name: 'u_acc', title: 'накопитель', x: 450, y: 226, bw: 120, bh: 56, pins: [{ n: 'CLK', clk: true, y: 44 }, { n: 'S', d: 'out', w: 8, y: 38 }], timing: { seq: true, clk: 'CLK', launch: { S: ['rise'] } } },
      { id: 'rs', t: 'ff', name: 'sum_reg', w: 8, ce: true, x: 620, y: 246 },
      { id: 'ph', t: 'block', name: 'u_ph', title: 'фазовый счётчик', x: 440, y: 330, bw: 130, bh: 56, pins: [{ n: 'CLK', clk: true, y: 32 }, { n: 'LD', d: 'out', y: 32 }], timing: { seq: true, clk: 'CLK', launch: { LD: ['rise'] } } },
      { id: 'rd', t: 'ff', name: 'sum_q_reg', w: 8, x: 800, y: 40 },
    ]),
    wires: EXC_CLK50_200.wires.concat([
      { from: 'b50.O', to: 'rd.C', kind: 'clk', label: 'clk50' },
      { from: 'b200.O', to: ['acc.CLK', 'rs.C', 'ph.CLK'], kind: 'clk', label: 'clk200', trunk: 24, lx: 510, ly: 298 },
      { from: 'acc.S', to: 'rs.D', bus: true, bw: 8 },
      { from: 'rs.Q', to: 'rd.D' },
      { from: 'ph.LD', to: 'rs.CE', label: 'ld' },
    ]),
  },
  figures: [
    {
      kind: 'timing', title: 'Запуск фронтом clk200 раз в 4 такта, захват фронтом clk50', t: [-2, 44],
      signals: [
        { name: 'clk200', clock: { period: 5 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk50', clock: { period: 20 }, arrows: 'rise' },
        { name: 'ld', bit: [[0.5, 0.7, 0], [15.5, 15.7, 1], [20.5, 20.7, 0], [35.5, 35.7, 1], [40.5, 40.7, 0]], init: 1 },
        { name: 'sum_reg', bus: [[0.4, 0.9, 'S1'], [20.4, 20.9, 'S2'], [40.4, 40.9, 'S3']], init: 'S0' },
        { name: 'sum_q_reg', bus: [[20.4, 20.9, 'S1'], [40.4, 40.9, 'S2']], init: 'S0' },
        { name: 'предустановка', bit: [], init: 0 },
        { name: 'удержание', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск: -setup 4 -start', cls: 'launch' }, { t: 5, label: 'запуск для удержания без -hold', cls: 'hold' }, { t: 15, label: 'запуск по умолчанию', cls: 'default' }, { t: 20, label: 'захват', cls: 'capture' }],
      spans: [
        { row: 5, t0: 15, t1: 20, label: 'по умолчанию 5 нс' }, { row: 5, t0: 0, t1: 20, label: '-setup 4 -start: 20 нс', cls: 'setup' },
        { row: 6, t0: 5, t1: 20, label: 'только -setup: 15 нс', cls: 'hold' },
      ],
      caption: 'По умолчанию Vivado берёт последний фронт clk200 перед захватом (15 нс). -setup 4 -start сдвигает фронт запуска на 3 периода clk200 назад, к 0 нс. Проверка удержания после этого сравнивает захват на 20 нс со следующим фронтом запуска (5 нс); -hold 3 -start переносит этот фронт к 20 нс – требование 0 нс.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_multicycle_path 4 -setup -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]
set_multicycle_path 3 -hold  -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]`,
  hints: [
    'Здесь медленный сигнал – это сигнал захвата. Сдвигать нужно фронт **запуска** назад, а множитель считать в периодах `clk200`. Какая опция выбирает тактовый сигнал запуска?',
    'После `-setup 4 -start` проверка удержания тоже сдвинется. Верните её на 3 периода тактового сигнала запуска: `-hold 3 -start` (для -hold опция -start действует по умолчанию).',
    '`set_multicycle_path 4 -setup -start …` и `set_multicycle_path 3 -hold -start …` с одинаковыми `-from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]`.',
  ],
  explain: `
    \`\`\`
    set_multicycle_path 4 -setup -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]
    set_multicycle_path 3 -hold  -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]
    \`\`\`
    **Без исключений.** Для пары 200 → 50 МГц Vivado выбирает последний фронт запуска перед захватом: запуск 15 нс, захват 20 нс – требование к предустановке 5 нс, к удержанию 0 нс.

    **Предустановка.** \`-setup 4 -start\` сдвигает фронт запуска на 3 периода \`clk200\` назад: 15 − 3 · 5 = 0 нс, требование 20 − 0 = 20 нс. Без \`-start\` (по умолчанию для -setup действует \`-end\`) сдвиг считался бы в периодах \`clk50\`: захват на 20 + 3 · 20 = 80 нс, требование 65 нс – путь получил бы на 45 нс больше, чем есть на самом деле, и реальное нарушение было бы скрыто.

    **Удержание.** После сдвига проверка удержания сравнивает захват на 20 нс со *следующим* фронтом запуска – 5 нс: требование 15 нс. \`-hold 3 -start\` переносит фронт запуска этой проверки на 3 периода \`clk200\` вперёд, к 20 нс: требование 0 нс. Опция \`-start\` для -hold действует по умолчанию, но явная запись нагляднее.

    | Ограничения | Предустановка | Удержание |
    |---|---|---|
    | без исключений | 5 нс | 0 нс |
    | только \`4 -setup -start\` | 20 нс | 15 нс |
    | \`4 -setup -start\` и \`3 -hold -start\` | 20 нс | 0 нс – верно |
    | \`4 -setup -end\` и \`3 -hold -end\` | 65 нс | 0 нс |

    **Условие корректности.** Источник обязан держать данные неизменными 4 такта \`clk200\` (это обеспечивает сигнал \`ld\`) и обновлять их фронтом, совпадающим с фронтом \`clk50\`. Если бы \`sum_reg\` изменялся каждый такт, многотактный путь скрыл бы реальную ошибку передачи: это был бы обычный путь с требованием 5 нс.

    Правило для связанных тактовых сигналов: от медленного к быстрому – \`-end\`, от быстрого к медленному – \`-start\`; множитель удержания на единицу меньше множителя предустановки и записывается с той же опцией.

    Проверка в Vivado: \`report_timing -from [get_cells {sum_reg[0]}] -to [get_cells {sum_q_reg[0]}] -delay_type min_max\` – в строке Requirement 20 нс для предустановки и 0 нс для удержания.
  `,
  refs: 'UG903, раздел «Multicycle Paths»; справочник: «Многотактные пути без ошибок»',
  tests: [
    { code: 'set_multicycle_path 4 -setup -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]\nset_multicycle_path 3 -hold -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]', pass: true, note: '-hold без -start (по умолчанию)' },
    { code: 'set_multicycle_path 4 -setup -start -from [get_clocks clk200] -to [get_clocks clk50]\nset_multicycle_path 3 -hold -start -from [get_clocks clk200] -to [get_clocks clk50]', pass: true, note: 'между тактовыми сигналами' },
    { code: 'set_multicycle_path 4 -setup -end -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]\nset_multicycle_path 3 -hold -end -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]', pass: false, note: '-end вместо -start', expect: 'Предустановка \\(setup\\): требование 65' },
    { code: 'set_multicycle_path 4 -setup -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]\nset_multicycle_path 3 -hold -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]', pass: false, note: '-setup без -start', expect: 'требование 65' },
    { code: 'set_multicycle_path 4 -setup -start -from [get_cells {sum_reg[*]}] -to [get_cells {sum_q_reg[*]}]', pass: false, note: 'нет -hold', expect: 'не задан set_multicycle_path -hold' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.static_cfg', module: 'exc', order: 4, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Адресный `set_false_path` одинаков в XDC и SDC.',
  title: 'Регистры конфигурации: функционально ложный путь',
  tags: ['set_false_path', 'квазистатические сигналы', 'связанные тактовые сигналы'],
  text: `
    Процессор (домен \`clk_cpu\`, **100 МГц**) записывает в регистры конфигурации \`cfg_reg[15:0]\` коэффициент усиления для тракта обработки (домен \`clk_dsp\`, **150 МГц**). Оба тактовых сигнала формирует один MMCM, поэтому Vivado анализирует пути между доменами как синхронные.

    По протоколу работы коэффициент меняется только при остановленном тракте: программа снимает разрешение работы, записывает \`cfg_reg\` и лишь затем запускает тракт командой, которая проходит по пути \`start_reg → run_reg\`. От записи коэффициента до его первого использования проходят сотни тактов. Сама команда пуска – обычная синхронная передача между доменами.

    Сейчас отчёт о временном анализе показывает для путей \`cfg_reg → res_reg\` требование к предустановке 3,333 нс и нарушения.

    **Задание.** Исключите из временного анализа пути от регистров конфигурации к тракту обработки. Остальные пути, в том числе другие пути между \`clk_cpu\` и \`clk_dsp\`, должны по-прежнему анализироваться.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 10, y: 205 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 96, y: 202, noName: true },
      {
        id: 'm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 150, y: 164, mult: 9, divclk: 1,
        outs: [{ pin: 'CLKOUT0', div: 9, clk: 'clk_cpu', label: 'CLKOUT0: 100 МГц' }, { pin: 'CLKOUT1', div: 6, clk: 'clk_dsp', label: 'CLKOUT1: 150 МГц' }],
      },
      { id: 'bc', t: 'bufg', name: 'u_clk/clkout0_buf', x: 360, y: 84, noName: true },
      { id: 'bd', t: 'bufg', name: 'u_clk/clkout1_buf', x: 360, y: 384, noName: true },
      { id: 'cpu', t: 'block', name: 'u_cpu', title: 'шина процессора', x: 450, y: 20, bw: 120, bh: 100, pins: [{ n: 'CLK', clk: true, y: 78 }, { n: 'WDATA', d: 'out', w: 16, y: 38 }, { n: 'START', d: 'out', y: 62 }], timing: { seq: true, clk: 'CLK', launch: { WDATA: ['rise'], START: ['rise'] } } },
      { id: 'rc', t: 'ff', name: 'cfg_reg', w: 16, x: 640, y: 40 },
      { id: 'rst', t: 'ff', name: 'start_reg', x: 640, y: 170 },
      { id: 'adc', t: 'block', name: 'u_adc', title: 'приём отсчётов', x: 450, y: 340, bw: 120, bh: 70, pins: [{ n: 'CLK', clk: true, y: 58 }, { n: 'DATA', d: 'out', w: 16, y: 38 }], timing: { seq: true, clk: 'CLK', launch: { DATA: ['rise'] } } },
      { id: 'g', t: 'logic', name: 'gain', w: 16, label: 'усиление', x: 790, y: 330, bw: 84, bh: 60 },
      { id: 'rr', t: 'ff', name: 'res_reg', w: 16, x: 930, y: 342 },
      { id: 'run', t: 'ff', name: 'run_reg', x: 930, y: 170 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'm.CLKIN1', kind: 'clk' },
      { from: 'm.CLKOUT0', to: 'bc.I', kind: 'clk' },
      { from: 'm.CLKOUT1', to: 'bd.I', kind: 'clk' },
      { from: 'bc.O', to: 'cpu.CLK', kind: 'clk' },
      { from: 'bc.O', to: 'rc.C', kind: 'clk', via: [[420, 140], [612, 140], [612, 98]], label: 'clk_cpu', lx: 520, ly: 135 },
      { from: 'bc.O', to: 'rst.C', kind: 'clk', via: [[420, 140], [612, 140], [612, 228]] },
      { from: 'bd.O', to: 'adc.CLK', kind: 'clk' },
      { from: 'bd.O', to: 'rr.C', kind: 'clk', via: [[420, 432], [918, 432], [918, 400]], label: 'clk_dsp', lx: 680, ly: 427 },
      { from: 'bd.O', to: 'run.C', kind: 'clk', via: [[420, 432], [918, 432], [918, 228]] },
      { from: 'cpu.WDATA', to: 'rc.D', bus: true, bw: 16 },
      { from: 'cpu.START', to: 'rst.D', mx: 618 },
      { from: 'rc.Q', to: 'g.I0' },
      { from: 'adc.DATA', to: 'g.I3', bus: true, bw: 16 },
      { from: 'g.O', to: 'rr.D' },
      { from: 'rst.Q', to: 'run.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Связанные тактовые сигналы 100 и 150 МГц: худшая пара фронтов', t: [-1, 21.5],
      signals: [
        { name: 'clk_cpu 100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_dsp 150', clock: { period: 20 / 3 }, arrows: 'rise' },
        { name: 'требование', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 20 / 3, label: 'захват', cls: 'capture' }, { t: 10, label: 'запуск', cls: 'launch' }, { t: 40 / 3, label: 'захват', cls: 'capture' }],
      spans: [{ row: 2, t0: 0, t1: 20 / 3, label: '6,667 нс' }, { row: 2, t0: 10, t1: 40 / 3, label: '3,333 нс', cls: 'setup' }],
      caption: 'Общий период сигналов 100 и 150 МГц – 20 нс. Худшая пара – запуск 10 нс и захват 13,333 нс: требование к предустановке 3,333 нс. Для команды пуска это реальное требование, для квазистатических регистров конфигурации – нет.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_false_path -from [get_cells {cfg_reg[*]}]`,
  hints: [
    'Тактовые сигналы связаны (один MMCM), поэтому `set_clock_groups -asynchronous` здесь неуместен. Исключение должно касаться только путей, которые начинаются в `cfg_reg`.',
    '`set_false_path -from [get_cells {cfg_reg[*]}]` – все пути, начинающиеся в регистрах конфигурации. Можно добавить `-to` для наглядности.',
  ],
  explain: `
    \`\`\`
    set_false_path -from [get_cells {cfg_reg[*]}]
    \`\`\`
    **Откуда 3,333 нс.** Общий период сигналов 100 и 150 МГц – 20 нс. На нём фронты \`clk_cpu\`: 0 и 10 нс; фронты \`clk_dsp\`: 0; 6,667; 13,333 нс. Для запуска в 10 нс ближайший захват – 13,333 нс: требование к предустановке 3,333 нс. Vivado обязан проверить каждый синхронный путь по худшей паре фронтов.

    **Почему путь функционально ложный.** Значение \`cfg_reg\` меняется только при остановленном тракте и используется спустя сотни тактов, поэтому на каком фронте \`clk_dsp\` новое значение окажется в тракте – безразлично. Это свойство **протокола**, а не тактовых сигналов: сигналы синхронны, и другие пути между ними анализировать нужно. Такие сигналы называют квазистатическими.

    **Чем плохи глобальные исключения.** \`set_clock_groups -asynchronous\` или \`set_false_path -from [get_clocks clk_cpu] -to [get_clocks clk_dsp]\` исключат и команду пуска \`start_reg → run_reg\`. Это настоящая синхронная передача: без анализа она может не уложиться в 3,333 нс, и тракт будет запускаться через раз. К тому же объявлять асинхронными тактовые сигналы одного MMCM методически неверно – \`report_clock_interaction\` перестанет показывать реальное соотношение доменов.

    **Не захватить лишнее.** \`set_false_path -to [get_cells {res_reg[*]}]\` исключит и пути от приёмника отсчётов \`u_adc\` к \`res_reg\` внутри домена \`clk_dsp\` – основной тракт обработки останется без анализа.

    **Альтернатива: ограничение задержки.** Если важно, когда новое значение гарантированно дойдёт до тракта (например, тракт не останавливают на время записи), вместо ложного пути задают предельную задержку: \`set_max_delay 20.000 -from [get_cells {cfg_reg[*]}] -to [get_cells {res_reg[*]}]\`. Путь будет ограничен разумной величиной (здесь два периода \`clk_cpu\`), но не 3,333 нс. Выбор зависит от протокола; в этой задаче протокол гарантирует остановку тракта, поэтому достаточно ложного пути.

    Проверка в Vivado: \`report_clock_interaction\` – для пары \`clk_cpu → clk_dsp\` состояние *Partial False Path* (часть путей исключена, остальные анализируются); \`report_exceptions\` – исключение покрывает 16 путей; \`report_timing -from [get_cells start_reg]\` – путь пуска по-прежнему с требованием 3,333 нс.
  `,
  refs: 'UG903, раздел «False Paths»; UG949, раздел о квазистатических сигналах; справочник: «Передача между тактовыми доменами: что ограничивать»',
  tests: [
    { code: 'set_false_path -from [get_cells {cfg_reg[*]}] -to [get_cells {res_reg[*]}]', pass: true, note: 'с -to' },
    { code: 'set_false_path -from [get_cells cfg_reg*] -to [get_clocks clk_dsp]', pass: true, note: '-to на тактовый сигнал' },
    { code: 'set_clock_groups -asynchronous -group [get_clocks clk_cpu] -group [get_clocks clk_dsp]', pass: false, note: 'асинхронные группы', expect: 'ошибочно объявлены асинхронными' },
    { code: 'set_false_path -from [get_clocks clk_cpu] -to [get_clocks clk_dsp]', pass: false, note: 'ложный путь между тактовыми сигналами', expect: 'ошибочно объявлен ложным' },
    { code: 'set_false_path -to [get_cells {res_reg[*]}]', pass: false, note: 'только -to: захвачен тракт u_adc', expect: 'ошибочно объявлен ложным' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.reset_sync', module: 'exc', order: 5, level: 2, tool: 'vivado',
  lang: 'xdc', langNote: '`set_false_path` и проверки восстановления и снятия сброса общие для XDC и SDC; свойство `ASYNC_REG` есть только в Vivado.',
  title: 'Синхронизатор сброса: ложный путь от кнопки, ASYNC_REG',
  tags: ['set_false_path', 'ASYNC_REG', 'сброс', 'recovery/removal'],
  text: `
    Кнопка сброса подключена к выводу \`rst_n\` (активный уровень – низкий); нажатие и отпускание никак не связаны с тактовыми сигналами. В ПЛИС сигнал проходит входной буфер и инвертор и поступает на входы асинхронной установки PRE синхронизатора сброса из двух триггеров FDPE: \`rst_sync_reg[0]\` и \`rst_sync_reg[1]\`. На вход D первого триггера подан логический 0, на вход D второго – выход первого.

    Схема **устанавливает** сброс асинхронно (нажатие сразу переводит оба триггера в 1), а **снимает** синхронно – через два фронта \`clk\` после отпускания кнопки. Выход \`rst_sync_reg[1]\` подключён к асинхронным входам сброса CLR рабочих регистров \`cnt_reg[7:0]\` (FDCE).

    Тактовый сигнал \`clk\` (100 МГц) уже описан. Задержка ввода для \`rst_n\` не задана, и \`check_timing\` сообщает об этом порте: *no_input_delay*.

    **Задание.** Исключите из анализа пути от порта \`rst_n\` и пометьте оба триггера синхронизатора свойством \`ASYNC_REG\`. Пути от синхронизатора к рабочим регистрам должны остаться под анализом.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pr', t: 'in', name: 'rst_n', x: 10, y: 219 },
      { id: 'ibr', t: 'ibuf', name: 'rst_n_IBUF_inst', x: 100, y: 216, noName: true },
      { id: 'inv', t: 'logic', name: 'rst_inv', label: 'НЕ', x: 170, y: 207 },
      { id: 'pc', t: 'in', name: 'clk', x: 10, y: 309 },
      { id: 'ibc', t: 'ibuf', name: 'clk_IBUF_inst', x: 100, y: 306, noName: true },
      { id: 'bgc', t: 'bufg', name: 'clk_IBUF_BUFG_inst', x: 160, y: 306, noName: true },
      { id: 'gnd', t: 'gnd', name: 'GND', x: 226, y: 94 },
      { id: 's0', t: 'fdpe', name: 'rst_sync_reg[0]', x: 320, y: 60 },
      { id: 's1', t: 'fdpe', name: 'rst_sync_reg[1]', x: 450, y: 60 },
      { id: 'cnt', t: 'fdce', name: 'cnt_reg', w: 8, x: 650, y: 60 },
      { id: 'inc', t: 'logic', name: 'cnt_inc', w: 8, label: '+1', x: 740, y: 150 },
    ],
    wires: [
      { from: 'pr', to: 'ibr.I' },
      { from: 'ibr.O', to: 'inv.I' },
      { from: 'inv.O', to: ['s0.PRE', 's1.PRE'], label: 'rst' },
      { from: 'gnd.G', to: 's0.D' },
      { from: 's0.Q', to: 's1.D' },
      { from: 's1.Q', to: 'cnt.CLR', my: 175, label: 'rst_sync' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bgc.I', kind: 'clk' },
      { from: 'bgc.O', to: ['s0.C', 's1.C', 'cnt.C'], kind: 'clk', label: 'clk', trunk: 70 },
      { from: 'cnt.Q', to: 'inc.I' },
      { from: 'inc.O', to: 'cnt.D', my: 30 },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Асинхронная установка и синхронное снятие сброса', t: [-2, 62],
      signals: [
        { name: 'clk', clock: { period: 10 }, arrows: 'rise' },
        { name: 'rst_n (кнопка)', bit: [[3.7, 3.7, 0], [28.6, 28.6, 1]], init: 1 },
        { name: 'rst_sync_reg[0]', bit: [[4.0, 4.3, 1], [30.4, 32.2, 0]], init: 0, unc: true },
        { name: 'rst_sync_reg[1]', bit: [[4.1, 4.4, 1], [40.4, 40.7, 0]], init: 0 },
        { name: 'cnt_reg', bus: [[4.5, 4.9, '0'], [50.4, 50.8, '1'], [60.4, 60.8, '2']], init: '17' },
      ],
      marks: [{ t: 3.7, label: 'нажатие', cls: 'default' }, { t: 28.6, label: 'отпускание', cls: 'default' }, { t: 40, label: 'запуск снятия сброса', cls: 'launch' }, { t: 50, label: 'захват: восстановление', cls: 'capture' }],
      spans: [{ row: 3, t0: 40, t1: 50, label: '10 нс', cls: 'setup' }],
      caption: 'Нажатие сразу переводит оба триггера в 1 (асинхронно), и рабочие регистры сбрасываются. Отпускание случайно по отношению к clk: первый триггер может стать метастабильным (штриховка), второй даёт ему целый период на разрешение. Сброс снимается фронтом 40 нс, и путь rst_sync_reg[1] → CLR проверяется как восстановление (до фронта 50 нс) и снятие сброса (относительно фронта 40 нс).',
    },
  ],
  given: `create_clock -name clk -period 10.000 [get_ports clk]`,
  solution: `set_false_path -from [get_ports rst_n]
set_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]`,
  hints: [
    'Пути от кнопки бессмысленно проверять относительно `clk`: момент нажатия случаен, для этого и стоит синхронизатор. Нужен ложный путь с начальной точкой – портом.',
    'Свойство задаётся командой `set_property ASYNC_REG TRUE [get_cells …]` – для обоих триггеров синхронизатора.',
    'Не исключайте пути `rst_sync_reg[1] → cnt_reg/CLR`: это проверки восстановления (recovery) и снятия сброса (removal), они обязательны.',
  ],
  explain: `
    \`\`\`
    set_false_path -from [get_ports rst_n]
    set_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]
    \`\`\`
    **Путь от кнопки.** Нажатие и отпускание не связаны с \`clk\`, поэтому проверки для пути \`rst_n → PRE\` бессмысленны: синхронизатор как раз рассчитан на произвольный момент изменения входа. Без задержки ввода Vivado этот путь и так не анализирует, но порт остаётся в отчёте \`check_timing\` (*no_input_delay*), а если позже кто-то задаст общее ограничение вроде \`set_input_delay … [all_inputs]\`, путь начнёт анализироваться относительно \`clk\` с бессмысленным результатом. Явный ложный путь фиксирует намерение.

    **ASYNC_REG.** Отпускание кнопки может попасть в окно восстановления первого триггера, и \`rst_sync_reg[0]\` перейдёт в метастабильное состояние. Второй триггер даёт ему целый период на разрешение. Свойство \`ASYNC_REG\` сообщает Vivado, что триггеры образуют синхронизатор: их размещают рядом (в одном слайсе), не объединяют в сдвиговый регистр SRL, не дублируют при оптимизации и учитывают при оценке наработки на отказ (MTBF).

    **Восстановление и снятие сброса.** Выход \`rst_sync_reg[1]\` изменяется синхронно с \`clk\`, а асинхронный вход CLR триггера имеет свои временные требования: сброс должен сниматься не позже чем за время восстановления (recovery) до фронта и не раньше чем через время снятия сброса (removal) после фронта. Иначе часть регистров выйдет из сброса на такт позже остальных, и счётчик или автомат начнёт работу в недопустимом состоянии. Vivado анализирует путь \`rst_sync_reg[1] → cnt_reg/CLR\` как обычный синхронный: требование к восстановлению 10 нс, к снятию сброса 0 нс. Исключать его нельзя – именно ради этой проверки сброс и снимают синхронно.

    Типичные ошибки:
    - \`set_false_path -to [get_pins -hier -filter {REF_PIN_NAME == CLR}]\` или \`-from [get_cells {rst_sync_reg[1]}]\` – отключают восстановление и снятие сброса. Цепь сброса с большим коэффициентом разветвления по выходу легко имеет задержку в несколько наносекунд, и нарушение останется незамеченным;
    - \`set_false_path -to [get_cells {rst_sync_reg[*]}]\` – вместе с путями от кнопки исключается путь \`rst_sync_reg[0] → rst_sync_reg[1]\`. Это синхронный путь внутри синхронизатора: чем он короче, тем больше времени остаётся на разрешение метастабильности;
    - нет \`ASYNC_REG\` – синтез может упаковать триггеры в SRL или разнести их по кристаллу.

    Проверка в Vivado: \`report_timing -to [get_pins {cnt_reg[0]/CLR}] -delay_type min_max\` показывает проверки восстановления (recovery) и снятия сброса (removal); \`report_exceptions\` показывает ложный путь от \`rst_n\` (в списке *no_input_delay* отчёта \`check_timing\` порт может остаться: эта проверка смотрит на наличие задержки на порту, а не на исключения); \`report_property [get_cells {rst_sync_reg[0]}]\` – значение ASYNC_REG.
  `,
  refs: 'UG903, раздел «False Paths»; UG949, рекомендации по сбросу и синхронизаторам; UG912, свойство ASYNC_REG',
  tests: [
    { code: 'set_false_path -from [get_ports rst_n] -to [get_cells {rst_sync_reg[*]}]\nset_property ASYNC_REG true [get_cells {rst_sync_reg[0] rst_sync_reg[1]}]', pass: true, note: 'с -to и перечислением ячеек' },
    { code: 'set_false_path -from [get_ports rst_n]\nset_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]\nset_false_path -to [get_pins -hier -filter {REF_PIN_NAME == CLR}]', pass: false, note: 'ложный путь ко всем входам CLR', expect: 'Восстановление \\(recovery\\): путь ошибочно объявлен ложным' },
    { code: 'set_false_path -from [get_ports rst_n]', pass: false, note: 'нет ASYNC_REG', expect: 'Не задано свойство ASYNC_REG' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]', pass: false, note: 'нет ложного пути от порта', expect: 'путь остался без ограничений' },
    { code: 'set_false_path -to [get_cells {rst_sync_reg[*]}]\nset_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]', pass: false, note: 'ложный путь ко всему синхронизатору', expect: 'ошибочно объявлен ложным' },
    { code: 'set_false_path -from [get_ports rst_n]\nset_false_path -from [get_cells {rst_sync_reg[1]}]\nset_property ASYNC_REG TRUE [get_cells {rst_sync_reg[*]}]', pass: false, note: 'ложный путь от второй ступени', expect: 'Снятие сброса \\(removal\\)' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.priority', module: 'exc', order: 6, level: 2, tool: 'vivado', type: 'choice',
  lang: 'both', langNote: 'Порядок «ложный путь → ограничение задержки → многотактный путь» в PrimeTime тот же.',
  title: 'Три исключения на одном пути: что проверит Vivado?',
  tags: ['приоритет исключений', 'set_max_delay', 'set_false_path -hold'],
  text: `
    В проекте с тактовым сигналом \`clk\` **100 МГц** (период 10 нс) на путь \`ctl_reg → dout_reg\` действуют сразу три исключения из разных файлов ограничений:

    \`\`\`
    set_multicycle_path 2 -setup -from [get_cells ctl_reg] -to [get_cells dout_reg]
    set_max_delay 4.000 -from [get_cells ctl_reg] -to [get_cells dout_reg]
    set_false_path -hold -from [get_cells ctl_reg] -to [get_cells dout_reg]
    \`\`\`

    **Задание.** Определите, какие проверки Vivado выполнит для этого пути и с каким требованием.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pc', t: 'in', name: 'clk', x: 10, y: 139 },
      { id: 'ib', t: 'ibuf', name: 'clk_IBUF_inst', x: 90, y: 136, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk_IBUF_BUFG_inst', x: 150, y: 136, noName: true },
      { id: 'a', t: 'ff', name: 'ctl_reg', x: 270, y: 30 },
      { id: 'lg', t: 'logic', name: 'dec', label: 'логика', x: 380, y: 25 },
      { id: 'b', t: 'ff', name: 'dout_reg', x: 510, y: 30 },
    ],
    wires: [
      { from: 'pc', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['a.C', 'b.C'], kind: 'clk', label: 'clk', trunk: 40 },
      { from: 'a.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'b.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Требования, которые предлагают три исключения', t: [-1.5, 23], tick: 5,
      signals: [
        { name: 'clk', clock: { period: 10 }, arrows: 'rise' },
        { name: 'set_max_delay', bit: [], init: 0 },
        { name: 'по умолчанию', bit: [], init: 0 },
        { name: 'set_multicycle_path', bit: [], init: 0 },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 10, label: 'следующий фронт', cls: 'default' }, { t: 20, label: 'второй фронт', cls: 'default' }],
      spans: [{ row: 1, t0: 0, t1: 4, label: '4 нс', cls: 'data' }, { row: 2, t0: 0, t1: 10, label: '10 нс', cls: 'clk' }, { row: 3, t0: 0, t1: 20, label: '20 нс', cls: 'data' }],
      caption: 'Каждое исключение по отдельности дало бы своё требование к предустановке. Какое из них действует, определяет приоритет исключений, а не порядок команд и не строгость значения.',
    },
  ],
  hints: [
    'Приоритет определяется типом исключения: группы тактовых сигналов → ложный путь → `set_max_delay`/`set_min_delay` → многотактный путь.',
    'Опция `-hold` у `set_false_path` означает, что исключение касается только проверки удержания. Для предустановки нужно найти следующее по старшинству исключение.',
  ],
  options: [
    { text: 'Предустановка с требованием 4 нс (от `set_max_delay`); удержание не проверяется.', ok: true, why: 'Верно. Ограничение задержки старше многотактного пути, поэтому для предустановки действует 4 нс. Ложный путь с опцией -hold отключает только проверку удержания.' },
    { text: 'Предустановка с требованием 20 нс (многотактный путь); удержание не проверяется.', why: 'Многотактный путь – исключение с наименьшим приоритетом: set_max_delay на том же пути его перекрывает независимо от порядка команд в файле.' },
    { text: 'Путь не анализируется совсем: ложный путь имеет наивысший приоритет из трёх.', why: 'Приоритет ложного пути действует только для той проверки, к которой он относится. С опцией -hold отключается удержание, а предустановка остаётся.' },
    { text: 'Предустановка 4 нс; удержание с требованием 10 нс, сдвинутое многотактным путём без -hold.', why: 'Удержание отключено ложным путём -hold. Кроме того, set_multicycle_path здесь полностью перекрыт ограничением set_max_delay и не сдвигает никаких проверок.' },
    { text: 'Действует самое строгое значение: предустановка 4 нс, удержание 0 нс по умолчанию.', why: 'Исключения не сравниваются по строгости: выбор определяется типом исключения. Совпадение по предустановке здесь случайно – при set_max_delay 25 действовали бы 25 нс, хотя многотактный путь даёт 20 нс. А удержание отключено ложным путём.' },
  ],
  explain: `
    Приоритет исключений в Vivado (и в SDC):
    1. \`set_clock_groups\` – наивысший;
    2. \`set_false_path\`;
    3. \`set_max_delay\` и \`set_min_delay\`;
    4. \`set_multicycle_path\` – наинизший.

    Приоритет применяется **отдельно** к проверке предустановки и к проверке удержания:
    - **предустановка:** ложного пути для неё нет (он задан с \`-hold\`), а \`set_max_delay 4\` старше многотактного пути – требование 4 нс;
    - **удержание:** \`set_false_path -hold\` – проверка не выполняется.

    Многотактный путь перекрыт полностью и ни на что не влияет. Порядок команд в файле на приоритет **между типами** не влияет. Внутри одного типа выигрывает более конкретное исключение: заданное на ячейках и выводах важнее заданного на тактовых сигналах, \`-from\` важнее \`-to\`; при равной конкретности действует последнее.

    Обратите внимание: \`set_max_delay\` без \`-datapath_only\` по-прежнему учитывает перекос тактовых сигналов, а требование 4 нс здесь **строже** обычного (10 нс) – такое ограничение иногда ставят, чтобы зарезервировать время на путь. Если же разработчик рассчитывал на многотактный путь, он получит неожиданные нарушения: смешивать исключения разных типов на одном пути – источник ошибок.

    Проверка: \`report_exceptions\` показывает, какие исключения действуют и какие перекрыты (в ConstraintLab – «перекрыто исключением с более высоким приоритетом»); в Vivado полностью перекрытые исключения перечисляет \`report_exceptions -ignored\`. \`report_timing -from [get_cells ctl_reg] -to [get_cells dout_reg] -delay_type min_max\` покажет требование 4 нс для предустановки и отсутствие проверки удержания.
  `,
  refs: 'UG903, раздел «Exceptions Priority»; справочник: «Приоритет исключений»',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'exc.mcp_numbers', module: 'exc', order: 7, level: 2, tool: 'vivado', type: 'numeric',
  lang: 'both', langNote: 'Расчёт требований многотактного пути одинаков в Vivado и PrimeTime.',
  title: 'Расчёт: многотактный путь без -hold и с ним',
  tags: ['set_multicycle_path', 'расчёт'],
  text: `
    Регистры \`x_reg\` и \`y_reg\` тактируются одним сигналом с периодом **T = 5 нс**; источник обновляет данные раз в три такта, приёмник захватывает их по сигналу разрешения. Разработчик описал путь командой

    \`\`\`
    set_multicycle_path 3 -setup -from [get_cells x_reg] -to [get_cells y_reg]
    \`\`\`

    и забыл про удержание. Позже он добавил вторую команду:

    \`\`\`
    set_multicycle_path 2 -hold -from [get_cells x_reg] -to [get_cells y_reg]
    \`\`\`

    Фронт запуска – момент 0 нс, тактовый сигнал идеальный.

    **Задание.** Определите требования (соотношения фронтов) в наносекундах.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pc', t: 'in', name: 'clk', x: 10, y: 139 },
      { id: 'ib', t: 'ibuf', name: 'clk_IBUF_inst', x: 90, y: 136, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk_IBUF_BUFG_inst', x: 150, y: 136, noName: true },
      { id: 'a', t: 'ff', name: 'x_reg', x: 270, y: 30 },
      { id: 'lg', t: 'logic', name: 'calc', label: 'вычисление', x: 380, y: 25, bw: 90 },
      { id: 'b', t: 'ff', name: 'y_reg', x: 530, y: 30 },
    ],
    wires: [
      { from: 'pc', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['a.C', 'b.C'], kind: 'clk', label: 'clk', trunk: 40 },
      { from: 'a.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'b.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Данные источника неизменны три такта', t: [-1.5, 22],
      signals: [
        { name: 'clk', clock: { period: 5 }, arrows: 'rise' },
        { name: 'x_reg', bus: [[0.4, 0.9, 'D1'], [15.4, 15.9, 'D2']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 5, label: 'фронт 1', cls: 'default' }, { t: 10, label: 'фронт 2', cls: 'default' }, { t: 15, label: 'фронт 3', cls: 'default' }, { t: 20, label: 'фронт 4', cls: 'default' }],
      caption: 'Отсчитайте, на какой фронт переносит захват команда -setup 3 и по какому фронту после этого выполняется проверка удержания.',
    },
  ],
  fields: [
    { label: 'Требование к предустановке (только `-setup 3`)', answer: 15, tol: 0.01, unit: 'нс' },
    { label: 'Требование к удержанию (только `-setup 3`)', answer: 10, tol: 0.01, unit: 'нс' },
    { label: 'Требование к удержанию после добавления `-hold 2`', answer: 0, tol: 0.01, unit: 'нс' },
  ],
  hints: [
    'Захват по умолчанию – следующий фронт (5 нс). `-setup N` переносит его на N-й фронт после запуска.',
    'Проверка удержания выполняется по фронту, предшествующему фронту захвата предустановки, а `-hold M` сдвигает её ещё на M периодов назад.',
  ],
  explain: `
    **Предустановка.** Захват переносится на 3-й фронт после запуска: 3 · T = 15 нс.

    **Удержание без -hold.** Проверка удержания выполняется по фронту захвата, предшествующему фронту предустановки: 15 − 5 = 10 нс, то есть (N − 1) · T. Требование 10 нс означает, что путь обязан быть **длиннее** 10 нс – нарушение почти неизбежно, а попытки Vivado исправить его задержками в трассировке испортят предустановку.

    **С -hold 2.** Проверка сдвигается ещё на 2 периода назад: 10 − 2 · 5 = 0 нс – как у обычного однотактного пути. Данные, запущенные следующим фронтом источника, не должны испортить захват на том же фронте.

    Общая формула для одного тактового сигнала: предустановка N · T; удержание (N − 1 − M) · T, где M – множитель \`-hold\`. Правильная пара: M = N − 1.

    | Ограничения | Предустановка | Удержание |
    |---|---|---|
    | без исключений | 5 нс | 0 нс |
    | \`3 -setup\` | 15 нс | 10 нс |
    | \`3 -setup\`, \`2 -hold\` | 15 нс | 0 нс |
    | \`3 -setup\`, \`3 -hold\` (лишний такт) | 15 нс | −5 нс |

    Проверить расчёт можно в консоли любой задачи с одним тактовым сигналом: \`report_timing -from … -to … -delay_type min_max\` показывает требование для обеих проверок.
  `,
  refs: 'UG903, раздел «Multicycle Paths»; справочник: «Многотактные пути без ошибок»',
});
