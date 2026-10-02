/* Модуль 2. Производные тактовые сигналы (Vivado XDC) */
XT.bank.module({
  id: 'gen', order: 20, title: '2. Производные тактовые сигналы',
  about: 'create_generated_clock, делитель на регистре, мультиплексор тактовых сигналов, несколько тактовых сигналов на одном порту, соотношения фронтов',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.div_reg', module: 'gen', order: 1, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`create_generated_clock` для делителя на регистре записывается одинаково в XDC и SDC.',
  title: 'Делитель частоты на регистре',
  tags: ['create_generated_clock', '-divide_by'],
  text: `
    В унаследованном проекте частота 100 МГц делится на 2 счётным триггером \`clk_div_reg\`: его выход через инвертор заведён на вход D, а сам выход через глобальный буфер \`BUFG\` тактирует регистры \`slow_reg[7:0]\`. Данные в \`slow_reg\` поступают из регистров \`fast_reg[7:0]\`, работающих на 100 МГц.

    Первичный тактовый сигнал \`sys_clk\` уже описан. Регистры \`slow_reg\` пока не получают ни одного тактового сигнала: \`check_timing\` сообщает *no_clock*, и путь \`fast_reg → slow_reg\` не анализируется.

    **Задание.** Опишите тактовый сигнал \`clk_div2\` на выходе делителя так, чтобы Vivado знал его связь с \`sys_clk\`.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 10, y: 150 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 110, y: 147, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_bufg', x: 175, y: 147, noName: true },
      { id: 'f', t: 'ff', name: 'fast_reg', w: 8, x: 300, y: 20 },
      { id: 'dv', t: 'ff', name: 'clk_div_reg', x: 300, y: 150 },
      { id: 'inv', t: 'inv', name: 'clk_div_inv', x: 392, y: 240, noName: true },
      { id: 'bg2', t: 'bufg', name: 'clk_div_bufg', x: 470, y: 154, noName: true },
      { id: 's', t: 'ff', name: 'slow_reg', w: 8, x: 600, y: 40 },
      { id: 'n', t: 'note', x: 470, y: 230, text: 'clk_div2 = sys_clk / 2', box: false },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['f.C', 'dv.C'], kind: 'clk', label: 'sys_clk' },
      { from: 'dv.Q', to: ['inv.A', 'bg2.I'], kind: 'clk' },
      { from: 'inv.Y', to: 'dv.D', my: 128 },
      { from: 'bg2.O', to: 's.C', kind: 'clk', label: 'clk_div2' },
      { from: 'f.Q', to: 's.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Исходный и производный тактовые сигналы', t: [-2, 42],
      signals: [
        { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_div2', clock: { period: 20 }, arrows: 'rise' },
      ],
      marks: [{ t: 10, label: 'запуск fast_reg', cls: 'launch' }, { t: 20, label: 'захват slow_reg', cls: 'capture' }],
      spans: [{ row: 1, t0: 10, t1: 20, label: 'предустановка 10 нс', cls: 'setup' }],
      caption: 'Фронты clk_div2 совпадают с каждым вторым фронтом sys_clk. Для пути fast_reg → slow_reg самая жёсткая пара фронтов – запуск в 10 нс и захват в 20 нс.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]`,
  hints: [
    'Тактовый сигнал, полученный из другого внутри проекта, описывают командой `create_generated_clock`.',
    'Опция `-source` – вывод, где присутствует исходный тактовый сигнал (тактовый вход делителя), а объект команды – выход делителя.',
    '`create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]`',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 2 [get_pins clk_div_reg/Q]
    \`\`\`
    - **Точка определения** – выход \`clk_div_reg/Q\`: отсюда сигнал начинает работать как тактовый. Далее Vivado сам распространит его через BUFG до \`slow_reg\`.
    - **-source** – тактовый вход делителя \`clk_div_reg/C\`. Задержка от порта \`sys_clk\` до этого вывода войдёт в задержку производного сигнала, поэтому соотношение \`sys_clk\` и \`clk_div2\` будет рассчитано правильно.
    - **-divide_by 2** – период 20 нс, фронты совпадают с каждым вторым фронтом \`sys_clk\` (эквивалентно \`-edges {1 3 5}\`).

    Путь \`fast_reg → slow_reg\` теперь анализируется как синхронный: требование к предустановке 10 нс (запуск последним фронтом \`sys_clk\` перед фронтом \`clk_div2\`), к удержанию – 0.

    **Почему не create_clock.** Первичный тактовый сигнал на \`clk_div_reg/Q\` не был бы связан с \`sys_clk\`: путь \`fast_reg → slow_reg\` стал бы переходом между несвязанными сигналами (*Timed (unsafe)*), а задержка от порта до выхода делителя не учитывалась бы.

    **Замечание по схемотехнике.** В ПЛИС тактовые сигналы лучше формировать с помощью MMCM/PLL или буферов с делением (BUFGCE_DIV, BUFR) и разрешением (BUFGCE): выход триггера проходит по логическим ресурсам и даёт большой перекос. Но если такой делитель уже есть в проекте, его обязательно описывают производным тактовым сигналом.
  `,
  tests: [
    { code: 'create_generated_clock -name clk_div2 -source [get_ports sys_clk] -divide_by 2 [get_pins clk_div_reg/Q]', pass: true, note: 'источник – порт' },
    { code: 'create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -edges {1 3 5} [get_pins clk_div_reg/Q]', pass: true, note: 'через -edges' },
    { code: 'create_clock -name clk_div2 -period 20 [get_pins clk_div_reg/Q]', pass: false, note: 'первичный вместо производного', expect: 'производным' },
    { code: 'create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/C] -divide_by 4 [get_pins clk_div_reg/Q]', pass: false, note: 'неверный коэффициент', expect: 'период' },
    { code: 'create_generated_clock -name clk_div2 -source [get_pins clk_div_reg/Q] -divide_by 2 [get_pins clk_div_reg/Q]', pass: false, note: 'источник – выход делителя', expect: 'нет ни одного тактового сигнала|не описан' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.bufgmux', module: 'gen', order: 2, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Описание мультиплексора тактовых сигналов (`-add`, `-master_clock`, `-physically_exclusive`) одинаково в Vivado и PrimeTime; в ASIC так же описывают ячейки вроде CKMUX2, часто с опцией `-combinational`.',
  title: 'Мультиплексор тактовых сигналов BUFGMUX',
  tags: ['BUFGMUX', 'create_generated_clock', '-add', 'set_clock_groups'],
  text: `
    MMCM формирует из 100 МГц два связанных тактовых сигнала: \`clk100\` (CLKOUT0) и \`clk125\` (CLKOUT1). Оба используются напрямую: регистр \`a_reg\` работает от \`clk100\`, регистр \`b_reg\` – от \`clk125\`, и между ними есть **синхронный** путь, который должен анализироваться.

    Кроме того, блок периферии тактируется через мультиплексор \`BUFGMUX\` (\`clk_mux\`): в зависимости от режима на его выходе присутствует либо \`clk100\`, либо \`clk125\`, но никогда оба одновременно. Без дополнительных ограничений Vivado анализирует пути \`m1_reg → m2_reg\` для всех сочетаний тактовых сигналов, включая физически невозможные «\`clk100\` запускает – \`clk125\` захватывает».

    **Задание.** Опишите выход мультиплексора так, как рекомендует UG903: по производному тактовому сигналу на каждый вход (\`clk100_mux\`, \`clk125_mux\`) и их взаимное исключение. Путь \`a_reg → b_reg\` должен по-прежнему анализироваться.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 0, y: 151 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 96, y: 148, noName: true },
      {
        id: 'm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 166, y: 110, mult: 10, divclk: 1,
        outs: [{ pin: 'CLKOUT0', div: 10, clk: 'clk100', label: '100 МГц' }, { pin: 'CLKOUT1', div: 8, clk: 'clk125', label: '125 МГц' }],
      },
      { id: 'b0', t: 'bufg', name: 'clk100_bufg', x: 350, y: 10, noName: true },
      { id: 'b1', t: 'bufg', name: 'clk125_bufg', x: 350, y: 290, noName: true },
      { id: 'mx', t: 'bufgmux', name: 'clk_mux', x: 380, y: 126 },
      { id: 'sl', t: 'label', x: 344, y: 204, text: 'S: выбор режима', cls: 'sch-ref' },
      { id: 'm1', t: 'ff', name: 'm1_reg', w: 8, x: 490, y: 100 },
      { id: 'm2', t: 'ff', name: 'm2_reg', w: 8, x: 610, y: 100 },
      { id: 'a', t: 'ff', name: 'a_reg', x: 730, y: -34 },
      { id: 'b', t: 'ff', name: 'b_reg', x: 730, y: 246 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'm.CLKIN1', kind: 'clk' },
      { from: 'm.CLKOUT0', to: ['b0.I', 'mx.I0'], kind: 'clk', trunk: 20 },
      { from: 'm.CLKOUT1', to: ['b1.I', 'mx.I1'], kind: 'clk', trunk: 35 },
      { from: 'b0.O', to: 'a.C', kind: 'clk', label: 'clk100' },
      { from: 'b1.O', to: 'b.C', kind: 'clk', label: 'clk125' },
      { from: 'mx.O', to: 'm1.C', kind: 'clk', label: 'clk_mux/O' },
      { from: 'mx.O', to: 'm2.C', kind: 'clk', via: [[438, 206], [598, 206]] },
      { from: 'm1.Q', to: 'm2.D' },
      { from: 'a.Q', to: 'b.D', via: [[815, -16], [815, 225], [718, 225]] },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'На выходе мультиплексора присутствует только один из сигналов', t: [-1, 41],
      signals: [
        { name: 'clk100', clock: { period: 10 }, arrows: 'rise' },
        { name: 'clk125', clock: { period: 8 }, arrows: 'rise' },
        { name: 'O (режим 0)', clock: { period: 10 }, cls: 'launch' },
        { name: 'O (режим 1)', clock: { period: 8 } },
      ],
      marks: [{ t: 30, label: 'clk100', cls: 'launch' }, { t: 32, label: 'clk125', cls: 'capture' }],
      spans: [{ row: 1, t0: 30, t1: 32, label: '2 нс – ложная проверка', cls: 'hold' }],
      caption: 'Без исключения Vivado проверит путь m1_reg → m2_reg с запуском clk100 и захватом clk125 (требование 2 нс). На выходе мультиплексора такого сочетания не бывает.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `create_generated_clock -name clk100_mux -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]
create_generated_clock -name clk125_mux -divide_by 1 -add -master_clock clk125 -source [get_pins clk_mux/I1] [get_pins clk_mux/O]
set_clock_groups -physically_exclusive -group [get_clocks clk100_mux] -group [get_clocks clk125_mux]`,
  hints: [
    'На выходе `clk_mux/O` нужны два производных тактовых сигнала: от входа I0 и от входа I1. Второй добавляется опцией `-add` с указанием `-master_clock`.',
    'Сигналы на выходе мультиплексора не могут существовать одновременно в одной цепи – это `set_clock_groups -physically_exclusive`.',
    'Не объявляйте взаимоисключающими сами `clk100` и `clk125`: между ними есть реальный путь `a_reg → b_reg`.',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name clk100_mux -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]
    create_generated_clock -name clk125_mux -divide_by 1 -add -master_clock clk125 \\
        -source [get_pins clk_mux/I1] [get_pins clk_mux/O]
    set_clock_groups -physically_exclusive -group [get_clocks clk100_mux] -group [get_clocks clk125_mux]
    \`\`\`
    - Производные сигналы, определённые на \`clk_mux/O\`, **заменяют** исходные сигналы после мультиплексора: за его выходом существуют только \`clk100_mux\` и \`clk125_mux\`.
    - Второй сигнал требует \`-add\` (иначе он заменит первый в той же точке) и \`-master_clock\` (на выходе мультиплексора несколько исходных сигналов).
    - \`-physically_exclusive\` исключает пути только между \`clk100_mux\` и \`clk125_mux\`. Путь \`a_reg → b_reg\` (\`clk100 → clk125\`) остаётся под анализом, как и любой путь между исходным сигналом и сигналом на выходе мультиплексора (если бы, например, \`a_reg\` передавал данные в \`m1_reg\`, анализировались бы пары \`clk100 → clk100_mux\` и \`clk100 → clk125_mux\`): это реальные синхронные переходы.

    **Типичная ошибка:** \`set_clock_groups -logically_exclusive -group clk100 -group clk125\`. Она убирает ложные проверки на выходе мультиплексора, но заодно отключает и реальный путь \`a_reg → b_reg\`. UG903 допускает такой вариант, только если исходные сигналы взаимодействуют исключительно через мультиплексор.
  `,
  tests: [
    { code: 'set_clock_groups -logically_exclusive -group [get_clocks clk100] -group [get_clocks clk125]', pass: false, note: 'исключение исходных сигналов', expect: 'ошибочно объявлены' },
    { code: 'create_generated_clock -name clk100_mux -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]\ncreate_generated_clock -name clk125_mux -divide_by 1 -master_clock clk125 -source [get_pins clk_mux/I1] [get_pins clk_mux/O]\nset_clock_groups -physically_exclusive -group clk125_mux', pass: false, note: 'без -add второй заменяет первый', expect: 'clk100_mux|набор тактовых сигналов|не найден' },
    { code: 'create_generated_clock -name clk100_mux -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]\ncreate_generated_clock -name clk125_mux -divide_by 1 -add -master_clock clk125 -source [get_pins clk_mux/I1] [get_pins clk_mux/O]', pass: false, note: 'без исключения', expect: 'не должны анализироваться' },
    { code: 'create_generated_clock -name m100 -divide_by 1 -source [get_pins clk_mux/I0] [get_pins clk_mux/O]\ncreate_generated_clock -name m125 -divide_by 1 -add -master_clock [get_clocks clk125] -source [get_pins clk_mux/I1] [get_pins clk_mux/O]\nset_clock_groups -logically_exclusive -group m100 -group m125', pass: true, note: 'другие имена и logically_exclusive между производными' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.two_on_port', module: 'gen', order: 3, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`create_clock -add` и группы `-physically_exclusive` поддерживаются и в Vivado, и в САПР ASIC.',
  title: 'Две возможные частоты на одном входе',
  tags: ['create_clock', '-add', 'set_clock_groups'],
  text: `
    Плата выпускается в двух исполнениях: на вывод \`clk_in\` ПЛИС устанавливается генератор либо **100 МГц**, либо **125 МГц**. Конфигурация ПЛИС одна, и она должна удовлетворять временны́м требованиям в обоих случаях.

    **Задание.** Опишите оба варианта тактового сигнала на порту \`clk_in\` (имена \`clk_100\` и \`clk_125\`) и укажите, что одновременно они существовать не могут.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'chip', name: 'Генератор 100 или 125 МГц', x: 0, y: 40, bw: 150, bh: 50, ext: true, pins: [{ n: 'OUT', side: 'r', y: 25 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'clk_in', x: 200, y: 54 },
      { id: 'ib', t: 'ibuf', name: 'clk_in_ibuf', x: 300, y: 51, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk_in_bufg', x: 370, y: 51, noName: true },
      { id: 'r1', t: 'ff', name: 'stage1_reg', w: 8, x: 500, y: 0 },
      { id: 'lg', t: 'logic', name: 'proc', w: 8, label: 'логика', x: 610, y: 70 },
      { id: 'r2', t: 'ff', name: 'stage2_reg', w: 8, x: 730, y: 0 },
    ],
    wires: [
      { from: 'osc.OUT', to: 'p.pad' },
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['r1.C', 'r2.C'], kind: 'clk', label: 'clk_in', trunk: 40 },
      { from: 'r1.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'r2.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Два варианта одного тактового входа', t: [-1, 41],
      signals: [{ name: 'clk_100', clock: { period: 10 }, arrows: 'rise' }, { name: 'clk_125', clock: { period: 8 }, arrows: 'rise' }],
      spans: [{ row: 0, t0: 0, t1: 10, label: '10 нс', cls: 'clk' }, { row: 1, t0: 0, t1: 8, label: '8 нс', cls: 'clk' }],
      caption: 'Анализ должен выполняться для каждого варианта отдельно, но не для смешанных пар «запуск 100 МГц – захват 125 МГц».',
    },
  ],
  solution: `create_clock -name clk_100 -period 10.000 [get_ports clk_in]
create_clock -name clk_125 -period 8.000 [get_ports clk_in] -add
set_clock_groups -physically_exclusive -group [get_clocks clk_100] -group [get_clocks clk_125]`,
  check: {
    forbid: [
      { cmd: 'set_clock_groups', opt: '-asynchronous', sev: 'warn', msg: 'Тактовые сигналы на одном порту не асинхронны, а взаимоисключающи', detail: 'Для анализа путей результат тот же, но точнее -physically_exclusive: сигналы не могут одновременно присутствовать в одной цепи (это важно и для анализа перекрёстных помех).' },
      { cmd: 'set_clock_groups', opt: '-logically_exclusive', sev: 'warn', msg: 'Точнее -physically_exclusive', detail: 'Сигналы на одном порту физически не могут существовать одновременно; -logically_exclusive описывает сигналы, которые одновременно присутствуют в кристалле, но не взаимодействуют.' },
    ],
  },
  hints: [
    'Второй тактовый сигнал на том же объекте добавляется опцией `-add` – без неё он заменит первый.',
    'Сигналы, которые не могут одновременно существовать в одной цепи, объявляют `set_clock_groups -physically_exclusive`.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk_100 -period 10.000 [get_ports clk_in]
    create_clock -name clk_125 -period 8.000 [get_ports clk_in] -add
    set_clock_groups -physically_exclusive -group [get_clocks clk_100] -group [get_clocks clk_125]
    \`\`\`
    - Без \`-add\` вторая команда \`create_clock\` заменит первую – анализ будет выполнен только для 125 МГц.
    - Без \`set_clock_groups\` Vivado проверит и смешанные пары: запуск фронтом 100 МГц, захват фронтом 125 МГц (требование 2 нс) и наоборот – это ложные нарушения.
    - \`-physically_exclusive\` точнее всего описывает ситуацию: в цепи присутствует либо один, либо другой сигнал.

    Так один прогон анализа покрывает оба исполнения платы: каждый путь проверяется при 100 и при 125 МГц.
  `,
  tests: [
    { code: 'create_clock -name clk_100 -period 10 [get_ports clk_in]\ncreate_clock -name clk_125 -period 8 [get_ports clk_in]\nset_clock_groups -physically_exclusive -group clk_100 -group clk_125', pass: false, note: 'нет -add', expect: 'не найден|Не описан' },
    { code: 'create_clock -name clk_100 -period 10 [get_ports clk_in]\ncreate_clock -name clk_125 -period 8 [get_ports clk_in] -add', pass: false, note: 'нет исключения', expect: 'не должны анализироваться' },
    { code: 'create_clock -name clk_100 -period 10 [get_ports clk_in]\ncreate_clock -name clk_125 -period 8 [get_ports clk_in] -add\nset_clock_groups -asynchronous -group clk_100 -group clk_125', pass: true, note: 'asynchronous: засчитывается с замечанием' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.bufr_q', module: 'gen', order: 4, level: 1, tool: 'vivado', type: 'choice',
  lang: 'xdc', langNote: 'Тактовый сигнал на выходе BUFR с делением Vivado выводит сам. В ASIC делитель описывают командой `create_generated_clock -divide_by` вручную.',
  title: 'Буфер BUFR с делением: что описывать?',
  tags: ['BUFR', 'понимание'],
  text: `
    Входной интерфейс с синхронизацией от источника: тактовый сигнал \`rx_clk\` 400 МГц поступает на вывод ПЛИС, проходит через \`BUFIO\` к регистрам ввода и через \`BUFR\` с \`BUFR_DIVIDE = 4\` к логике, работающей на 100 МГц.

    Какие ограничения для тактовых сигналов нужны в XDC?
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'rx_clk', x: 10, y: 74 },
      { id: 'ib', t: 'ibuf', name: 'rx_clk_ibuf', x: 110, y: 71, noName: true },
      { id: 'bio', t: 'bufio', name: 'rx_bufio', x: 200, y: 20, noName: true },
      { id: 'br', t: 'bufr', name: 'rx_bufr', x: 200, y: 120, noName: true, attrs: { BUFR_DIVIDE: 4 } },
      { id: 'r1', t: 'ff', name: 'iob_reg', w: 8, x: 330, y: -10 },
      { id: 'r2', t: 'ff', name: 'proc_reg', w: 32, x: 330, y: 100 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: ['bio.I', 'br.I'], kind: 'clk' },
      { from: 'bio.O', to: 'r1.C', kind: 'clk', label: '400 МГц' },
      { from: 'br.O', to: 'r2.C', kind: 'clk', label: '100 МГц' },
    ],
  },
  options: [
    { text: 'Только `create_clock -period 2.5 [get_ports rx_clk]`.', ok: true, why: 'Верно. Тактовый сигнал после BUFR с делением Vivado выводит автоматически (как и для MMCM), сохраняя связь с rx_clk.' },
    { text: '`create_clock` на порту и `create_clock -period 10` на выходе BUFR.', why: 'create_clock на выходе BUFR создаст независимый первичный сигнал: переход 400 → 100 МГц перестанет анализироваться как синхронный.' },
    { text: '`create_clock` на порту и обязательно `create_generated_clock -divide_by 4` на выходе BUFR.', why: 'Не обязательно: Vivado выводит этот сигнал сам. create_generated_clock здесь допустим только для переименования (без -source и -divide_by).' },
    { text: '`create_clock` на выходах BUFIO и BUFR, без описания порта.', why: 'Тактовый сигнал задают в точке входа в ПЛИС, иначе не учитывается задержка входного буфера, а сигналы BUFIO и BUFR окажутся несвязанными.' },
  ],
  explain: `
    Vivado автоматически выводит тактовые сигналы на выходах MMCM, PLL, \`BUFR\` с \`BUFR_DIVIDE\` (кроме BYPASS), \`BUFGCE_DIV\` и приёмопередатчиков. Описывать нужно только первичный сигнал на порту:
    \`\`\`
    create_clock -name rx_clk -period 2.500 [get_ports rx_clk]
    \`\`\`
    Проверить результат можно командой \`report_clocks\`: появится сигнал с периодом 10 нс и исходным сигналом \`rx_clk\`.
  `,
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.rel_num', module: 'gen', order: 5, level: 2, tool: 'vivado', type: 'numeric',
  lang: 'both', langNote: 'Правило выбора фронтов запуска и захвата на общем периоде одинаково в Vivado и PrimeTime.',
  title: 'Расчёт: соотношение фронтов 100 и 150 МГц',
  tags: ['соотношение фронтов', 'расчёт'],
  text: `
    MMCM формирует из одного входного сигнала тактовые сигналы **100 МГц** и **150 МГц** с совпадающими фронтами в момент 0. Регистр, работающий на 100 МГц, передаёт данные регистру, работающему на 150 МГц, и наоборот.

    Определите требования, которые получит статический временной анализ при идеальных тактовых сигналах.
  `,
  figures: [
    {
      kind: 'timing', title: 'Общий период 20 нс', t: [-1, 22],
      signals: [{ name: 'clk100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' }, { name: 'clk150', clock: { period: 20 / 3 }, arrows: 'rise' }],
      marks: [{ t: 0, label: '0' }, { t: 10, label: '10' }, { t: 13.333, label: '13,333' }, { t: 20, label: '20' }],
      caption: 'Перебираются пары «фронт запуска – ближайший следующий фронт захвата» на общем периоде, выбирается самая жёсткая.',
    },
  ],
  fields: [
    { label: 'Требование к предустановке (setup), 100 → 150 МГц', answer: 3.333, tol: 0.01, unit: 'нс' },
    { label: 'Требование к удержанию (hold), 100 → 150 МГц', answer: 0, tol: 0.01, unit: 'нс' },
    { label: 'Требование к предустановке (setup), 150 → 100 МГц', answer: 3.333, tol: 0.01, unit: 'нс' },
  ],
  hints: [
    'Общий период – наименьшее общее кратное: НОК(10; 6,667) = 20 нс. Фронты 100 МГц: 0, 10; фронты 150 МГц: 0; 6,667; 13,333.',
    'Для каждого фронта запуска найдите ближайший следующий фронт захвата и выберите наименьший интервал.',
  ],
  explain: `
    **100 → 150 МГц.** Фронты запуска 0 и 10 нс; ближайшие следующие фронты захвата – 6,667 и 13,333 нс. Интервалы 6,667 и 3,333 нс → требование к предустановке **3,333 нс**.

    Требование к удержанию: данные, запущенные в 0, не должны испортить захват предыдущим фронтом захвата – тоже в момент 0 (фронты совпадают) → **0 нс**.

    **150 → 100 МГц.** Фронты запуска 0; 6,667; 13,333; фронты захвата 10 и 20 нс. Для захвата в 10 нс последний предшествующий запуск – 6,667 нс (интервал 3,333 нс), для захвата в 20 нс – 13,333 нс (6,667 нс). Требование к предустановке **3,333 нс**.

    Это типичный случай, когда синхронная передача между связанными сигналами «съедает» большую часть периода. Если данные удерживаются несколько тактов, применяют многотактный путь; иначе – конвейеризацию или передачу через FIFO.

    Проверить можно в консоли любой задачи с MMCM: \`report_clock_interaction\`.
  `,
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'gen.phase_num', module: 'gen', order: 6, level: 3, tool: 'vivado', type: 'numeric',
  lang: 'both', langNote: 'Расчёт соотношений фронтов общий. В Vivado сдвинутый сигнал MMCM выводится сам, в ASIC сдвинутый выход PLL описывают `create_generated_clock` (сдвиг задаёт опция `-edge_shift` вместе с `-edges`).',
  title: 'Расчёт: тактовый сигнал со сдвигом фазы',
  tags: ['соотношение фронтов', 'фаза', 'расчёт'],
  text: `
    MMCM формирует из входного сигнала 125 МГц (период 8 нс) копию \`clk_90\`, сдвинутую на **+90°**. Регистр, тактируемый исходным сигналом по фронту, передаёт данные регистру, тактируемому \`clk_90\` по фронту.

    Определите требования к предустановке и удержанию. Затем те же величины для сдвига **−90°**.
  `,
  figures: [
    {
      kind: 'timing', title: 'Сдвиг +90° = 2 нс', t: [-9, 11],
      signals: [{ name: 'clk', clock: { period: 8 }, arrows: 'rise', cls: 'launch' }, { name: 'clk_90', clock: { period: 8, rise: 2, fall: 6 }, arrows: 'rise' }],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 2, label: 'захват', cls: 'capture' }, { t: -6, label: 'предыдущий захват', cls: 'hold' }],
      spans: [{ row: 1, t0: 0, t1: 2, label: '?', cls: 'setup' }, { row: 1, t0: 0, t1: -6, label: '?', cls: 'hold' }],
    },
  ],
  fields: [
    { label: 'Сдвиг +90°: требование к предустановке', answer: 2, tol: 0.01, unit: 'нс' },
    { label: 'Сдвиг +90°: требование к удержанию', answer: -6, tol: 0.01, unit: 'нс' },
    { label: 'Сдвиг −90°: требование к предустановке', answer: 6, tol: 0.01, unit: 'нс' },
    { label: 'Сдвиг −90°: требование к удержанию', answer: -2, tol: 0.01, unit: 'нс' },
  ],
  hints: [
    '+90° при периоде 8 нс – это 2 нс. Ближайший фронт захвата после запуска в 0 нс – 2 нс.',
    'Удержание: данные, запущенные в 0, не должны испортить захват предыдущим фронтом clk_90 – в момент 2 − 8 = −6 нс.',
  ],
  explain: `
    **+90°:** фронты \`clk_90\` в 2, 10, … нс. Запуск в 0 → захват в 2: предустановка **2 нс**. Предыдущий фронт захвата −6 нс, следующий фронт запуска 8 нс (относительно захвата в 2 нс: 2 − 8 = −6) → удержание **−6 нс**.

    **−90°:** фронты в 6, 14, … нс (−2 по модулю периода). Запуск в 0 → захват в 6: предустановка **6 нс**; предыдущий захват в −2 нс → удержание **−2 нс**.

    Сдвиг фазы перераспределяет запас между предустановкой и удержанием: положительный сдвиг уменьшает время на предустановку и ослабляет требование к удержанию. Именно так в интерфейсах с выравниванием данных по фронту захватывающий сигнал сдвигают на 90°, чтобы фронт пришёлся на середину окна данных.
  `,
});
