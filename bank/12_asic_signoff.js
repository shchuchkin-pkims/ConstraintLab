/* Модуль 12. SDC для ASIC: иерархический маршрут и финальный анализ */
XT.bank.module({
  id: 'asic_signoff', order: 94, title: '12. SDC для ASIC: иерархия и финальный анализ',
  about: 'Бюджеты блока с задержкой тактового сигнала от верхнего уровня, правила проектирования (длительность фронта, ёмкость), расчёт запасов с реальным перекосом тактового дерева, разброс параметров на кристалле (OCV) и снятие пессимизма общего участка (CRPR), режимы, углы и виды анализа (MMMC)',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.hier_budget', module: 'asic_signoff', order: 1, level: 3, tool: 'sdc',
  lang: 'sdc', langNote: 'Команды `set_clock_latency -source` и виртуальные тактовые сигналы есть и в Vivado, но распределение бюджетов между блоками кристалла с учётом задержек общего тактового дерева – практика иерархического маршрута ASIC.',
  title: 'Иерархический маршрут: бюджет блока и задержки тактового дерева',
  tags: ['set_clock_latency', '-source', 'виртуальный тактовый сигнал', 'бюджеты', 'иерархия'],
  text: `
    Кристалл собирают иерархически: блок \`dsp_core\` синтезируют и размещают отдельно, а архитектор распределил бюджеты. Тактовый сигнал **400 МГц** (T = 2,5 нс) идёт от корня тактового дерева кристалла:

    | Точка | Задержка от корня дерева |
    |---|---|
    | порт \`clk\` блока \`dsp_core\` | 0,60 нс |
    | регистры блока-источника \`u_src\` | 1,00 нс |
    | регистры блока-приёмника \`u_dst\` | 1,10 нс |

    Данные \`din[15:0]\` появляются на входах \`dsp_core\` через **0,50 нс** после фронта на регистрах \`u_src\`; блоку \`u_dst\` нужно, чтобы \`dout[15:0]\` пришли на его входы за **0,60 нс** до фронта на его регистрах.

    Методика проекта: задержку тактового сигнала вне блока задают командой \`set_clock_latency -source\` для тактового сигнала блока, а внешнюю сторону описывают виртуальными тактовыми сигналами соседних блоков с их собственной задержкой (\`set_clock_latency\`).

    **Задание.** Напишите SDC-файл блока: тактовый сигнал \`clk\` и его задержку вне блока, виртуальные тактовые сигналы \`vclk_src\` и \`vclk_dst\` с их задержками, задержки ввода для \`din[15:0]\` и вывода для \`dout[15:0]\`.
  `,
  design: {
    elements: [
      { id: 'src', t: 'chip', name: 'u_src', title: 'источник u_src', x: 0, y: 40, bw: 112, bh: 80, ext: true, pins: [{ n: 'Q', side: 'r', y: 40 }, { n: 'CK', side: 'b', x: 56 }] },
      { id: 'nsrc', t: 'note', x: 0, y: -18, text: 'данные через 0,5 нс\nпосле фронта CK' },
      { id: 'blk', t: 'boundary', label: 'Блок dsp_core' },
      { id: 'pdin', t: 'in', name: 'din', w: 16, x: 156, y: 69 },
      { id: 'rdin', t: 'dff', name: 'din_reg', w: 16, x: 262, y: 62 },
      { id: 'proc', t: 'logic', name: 'u_proc', w: 16, label: 'обработка', x: 350, y: 57 },
      { id: 'rdout', t: 'dff', name: 'dout_reg', w: 16, x: 452, y: 62 },
      { id: 'pdout', t: 'out', name: 'dout', w: 16, x: 540, y: 69 },
      { id: 'pclk', t: 'in', name: 'clk', x: 166, y: 169 },
      { id: 'dst', t: 'chip', name: 'u_dst', title: 'приёмник u_dst', x: 672, y: 40, bw: 112, bh: 80, ext: true, pins: [{ n: 'D', side: 'l', y: 40 }, { n: 'CK', side: 'b', x: 56 }] },
      { id: 'ndst', t: 'note', x: 672, y: -18, text: 'нужны за 0,6 нс\nдо фронта CK' },
      { id: 'root', t: 'chip', name: 'u_ctree', title: 'корень тактового дерева 400 МГц', titleY: 25, x: 290, y: 300, bw: 230, bh: 40, ext: true, pins: [{ n: 'O', side: 't', x: 115, label: '' }] },
    ],
    wires: [
      { from: 'src.Q', to: 'pdin.pad' },
      { from: 'pdin', to: 'rdin.D' },
      { from: 'rdin.Q', to: 'proc.I' },
      { from: 'proc.O', to: 'rdout.D' },
      { from: 'rdout.Q', to: 'pdout' },
      { from: 'pdout.pad', to: 'dst.D' },
      { from: 'pclk', to: 'rdin.CK', kind: 'clk' },
      { from: 'pclk', to: 'rdout.CK', kind: 'clk', via: [[440, 180]], label: 'clk' },
      { from: 'root.O', to: 'src.CK', label: '1,00 нс', lx: 90, ly: 283 },
      { from: 'root.O', to: 'pclk.pad', via: [[154, 268]], label: '0,60 нс', lx: 200, ly: 263 },
      { from: 'root.O', to: 'dst.CK', label: '1,10 нс', lx: 640, ly: 283 },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Пунктир – соседние блоки и ветви общего тактового дерева кристалла с задержками от его корня. Оранжевые линии – тактовый сигнал внутри dsp_core. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Один фронт корня дерева в разных точках кристалла', t: [-0.2, 4.0], width: 600,
      signals: [
        { name: 'корень дерева', clock: { period: 2.5 }, arrows: 'rise' },
        { name: 'порт clk блока', clock: { period: 2.5, rise: 0.6, fall: 1.85 }, arrows: 'rise' },
        { name: 'регистры u_src', clock: { period: 2.5, rise: 1.0, fall: 2.25 }, arrows: 'rise', cls: 'launch' },
        { name: 'din на входе', bus: [[1.5, 1.56, 'N']], init: 'N−1' },
        { name: 'регистры u_dst', clock: { period: 2.5, rise: 1.1, fall: 2.35 }, arrows: 'rise' },
        { name: 'dout на выходе', bus: [[2.2, 2.6, 'M']], init: 'M−1' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 0.6, label: '0,60', cls: 'clk' },
        { row: 2, t0: 0, t1: 1.0, label: '1,00', cls: 'clk' },
        { row: 3, t0: 1.0, t1: 1.5, label: '0,5 нс', cls: 'data' },
        { row: 4, t0: 0, t1: 1.1, label: '1,10', cls: 'clk' },
        { row: 5, t0: 3.0, t1: 3.6, label: '0,6 нс', cls: 'setup' },
      ],
      windows: [{ row: 5, t0: 3.0, t1: 3.6, cls: 'setup' }],
      marks: [{ t: 3.6, label: 'захват в u_dst', cls: 'capture' }],
      caption: 'Данные из u_src выходят в 1,0 + 0,5 = 1,5 нс после фронта корня. dout должны прийти не позже 2,5 + 1,1 − 0,6 = 3,0 нс. Задержки вне блока одинаково входят в отсчёт до и после синтеза тактового дерева блока.',
    },
  ],
  solution: `create_clock -name clk -period 2.500 [get_ports clk]
set_clock_latency -source 0.600 [get_clocks clk]
create_clock -name vclk_src -period 2.500
create_clock -name vclk_dst -period 2.500
set_clock_latency 1.000 [get_clocks vclk_src]
set_clock_latency 1.100 [get_clocks vclk_dst]
set_input_delay  -clock vclk_src 0.500 [get_ports {din[*]}]
set_output_delay -clock vclk_dst 0.600 [get_ports {dout[*]}]`,
  check: { requireVirtual: true, clockNames: ['clk', 'vclk_src', 'vclk_dst'] },
  hints: [
    'Задержка от корня до порта блока лежит *вне* блока: `set_clock_latency -source 0.6 [get_clocks clk]`. Без `-source` это была бы оценка дерева внутри блока, которая после его синтеза заменяется реальной задержкой.',
    'Соседние блоки тактируются тем же сигналом, но их регистры видят фронт позже корня на 1,00 и 1,10 нс. Это два разных виртуальных тактовых сигнала (период 2,5 нс) со своими задержками `set_clock_latency`.',
    'Задержки портов – время, занятое вне блока: `set_input_delay -clock vclk_src 0.5 [get_ports {din[*]}]`, `set_output_delay -clock vclk_dst 0.6 [get_ports {dout[*]}]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk -period 2.500 [get_ports clk]
    set_clock_latency -source 0.600 [get_clocks clk]
    create_clock -name vclk_src -period 2.500
    create_clock -name vclk_dst -period 2.500
    set_clock_latency 1.000 [get_clocks vclk_src]
    set_clock_latency 1.100 [get_clocks vclk_dst]
    set_input_delay  -clock vclk_src 0.500 [get_ports {din[*]}]
    set_output_delay -clock vclk_dst 0.600 [get_ports {dout[*]}]
    \`\`\`
    **Как САПР считает путь \`din → din_reg\`.** Запуск – фронт \`vclk_src\`: 0 + 1,00 (задержка виртуального сигнала) + 0,50 (задержка ввода) = 1,50 нс от фронта корня. Захват – следующий фронт \`clk\`: 2,5 + 0,60 (задержка \`-source\`) + задержка дерева блока до \`din_reg\`. На путь внутри блока остаётся 2,5 + 0,60 + T_дерева − 1,50 − t_su.

    **Путь \`dout_reg → dout\`.** Запуск – фронт \`clk\` на регистре: 0,60 + T_дерева. Захват – фронт \`vclk_dst\`: 2,5 + 1,10 − 0,60 = 3,00 нс от фронта корня.

    **Почему \`-source\` для \`clk\`.** Задержка без \`-source\` – оценка дерева *внутри* блока: после синтеза дерева блока (\`set_propagated_clock\`) её заменяет рассчитанная задержка. Задержка от корня кристалла до порта блока от этого не меняется, поэтому её задают как \`-source\`: она действует и до, и после синтеза дерева блока.

    **Почему виртуальные сигналы с задержкой.** Виртуальный тактовый сигнал всегда идеальный, и его \`set_clock_latency\` действует на всех этапах (для виртуального сигнала задержка с \`-source\` и без неё равноценны: дерева у него нет). Соседние блоки видят фронт в разные моменты, поэтому сигналов два. Бюджет при этом записан так же, как в документе архитектора: «0,5 нс после фронта источника», «0,6 нс до фронта приёмника», и при изменении дерева кристалла меняются только задержки сигналов, а не числа в \`set_input_delay\` и \`set_output_delay\`.

    **Типичные ошибки:**
    - \`set_clock_latency 0.6 [get_clocks clk]\` без \`-source\`: после синтеза дерева блока эти 0,6 нс пропадут, и бюджеты сдвинутся;
    - задержки относительно \`clk\`: вход окажется оптимистичным на 1,00 − 0,60 = 0,40 нс (запуск у источника на самом деле позже), выход – пессимистичным на 1,10 − 0,60 = 0,50 нс;
    - один виртуальный сигнал с задержкой 1,00 для обоих соседей: требование к выходу окажется на 0,1 нс строже реального;
    - числа «внутри блока» (1,4 нс, 1,8 нс) вместо времени, занятого снаружи.

    **Проверка.** \`report_clocks\` – \`clk\` и два виртуальных сигнала; в PrimeTime \`report_clock -skew\` показывает задержки сигналов, \`report_timing -from [get_ports {din[0]}] -path_type full_clock\` – задержку \`vclk_src\` в начале пути. ConstraintLab анализирует идеальные соотношения фронтов и сравнивает значения задержек тактовых сигналов с эталоном.
  `,
  tests: [
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_clock_latency -source 0.6 [get_clocks clk]\ncreate_clock -name vclk_src -period 2.5\ncreate_clock -name vclk_dst -period 2.5\nset_clock_latency -source 1.0 [get_clocks vclk_src]\nset_clock_latency -source 1.1 [get_clocks vclk_dst]\nset_input_delay 0.5 -clock [get_clocks vclk_src] [get_ports din*]\nset_output_delay 0.6 -clock [get_clocks vclk_dst] [get_ports dout*]', pass: true, note: 'задержка виртуальных сигналов с -source (равноценно)' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_clock_latency 0.6 [get_clocks clk]\ncreate_clock -name vclk_src -period 2.5\ncreate_clock -name vclk_dst -period 2.5\nset_clock_latency 1.0 [get_clocks vclk_src]\nset_clock_latency 1.1 [get_clocks vclk_dst]\nset_input_delay -clock vclk_src 0.5 [get_ports {din[*]}]\nset_output_delay -clock vclk_dst 0.6 [get_ports {dout[*]}]', pass: false, note: 'задержка clk без -source', expect: 'Не задано: set_clock_latency' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_clock_latency -source 0.6 [get_clocks clk]\ncreate_clock -name vclk_src -period 2.5\ncreate_clock -name vclk_dst -period 2.5\nset_clock_latency 1.0 [get_clocks vclk_src]\nset_clock_latency 1.1 [get_clocks vclk_dst]\nset_input_delay -clock clk 0.5 [get_ports {din[*]}]\nset_output_delay -clock clk 0.6 [get_ports {dout[*]}]', pass: false, note: 'задержки относительно clk', expect: 'отсчитывают от виртуального' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_clock_latency -source 0.6 [get_clocks clk]\ncreate_clock -name vclk_src -period 2.5\nset_clock_latency 1.0 [get_clocks vclk_src]\nset_input_delay -clock vclk_src 0.5 [get_ports {din[*]}]\nset_output_delay -clock vclk_src 0.6 [get_ports {dout[*]}]', pass: false, note: 'один виртуальный сигнал для обоих соседей', expect: 'vclk_dst' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_clock_latency -source 0.6 [get_clocks clk]\ncreate_clock -name vclk_src -period 2.5\ncreate_clock -name vclk_dst -period 2.5\nset_clock_latency 1.1 [get_clocks vclk_src]\nset_clock_latency 1.0 [get_clocks vclk_dst]\nset_input_delay -clock vclk_src 0.5 [get_ports {din[*]}]\nset_output_delay -clock vclk_dst 0.6 [get_ports {dout[*]}]', pass: false, note: 'задержки соседей перепутаны', expect: 'set_clock_latency: неверное значение' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.drv', module: 'asic_signoff', order: 2, level: 1, tool: 'sdc',
  lang: 'sdc', langNote: 'Правила проектирования (`set_max_transition`, `set_max_capacitance`, `set_input_transition`) – команды САПР ASIC; в ПЛИС ячейки и трассы готовые, и таких ограничений в XDC нет.',
  title: 'Правила проектирования: длительность фронта и ёмкость',
  tags: ['set_max_transition', '-clock_path', 'set_max_capacitance', 'set_input_transition', 'design rules'],
  text: `
    Для блока \`io_ctrl\` из требований библиотеки и надёжности заданы правила проектирования (design rules):

    | Требование | Значение |
    |---|---|
    | максимальная длительность фронта в цепях данных | 0,25 нс |
    | максимальная длительность фронта в тактовых цепях \`clk\` | 0,10 нс |
    | максимальная ёмкость нагрузки любого выхода ячейки | 0,08 пФ |
    | длительность фронта на входах данных \`din[7:0]\` и \`cfg[3:0]\` (их формирует соседний блок) | 0,12 нс |

    Тактовый сигнал \`clk\` (250 МГц) уже описан. Единицы библиотеки: время – наносекунды, ёмкость – пикофарады.

    **Задание.** Задайте эти правила командами SDC.
  `,
  design: {
    elements: [
      { id: 'nb', t: 'chip', name: 'u_nbr', title: 'соседний блок', x: 0, y: 30, bw: 110, bh: 120, ext: true, pins: [{ n: 'D', side: 'r', y: 30 }, { n: 'C', side: 'r', y: 90 }] },
      { id: 'blk', t: 'boundary', label: 'Блок io_ctrl' },
      { id: 'pdin', t: 'in', name: 'din', w: 8, x: 160, y: 49 },
      { id: 'pcfg', t: 'in', name: 'cfg', w: 4, x: 160, y: 109 },
      { id: 'pclk', t: 'in', name: 'clk', x: 160, y: 199 },
      { id: 'lg', t: 'logic', name: 'u_ctrl', w: 8, label: 'логика', bw: 80, mix: true, x: 290, y: 55 },
      { id: 'r', t: 'dff', name: 'out_reg', w: 8, x: 420, y: 60 },
      { id: 'pout', t: 'out', name: 'dout', w: 8, x: 530, y: 67 },
    ],
    wires: [
      { from: 'nb.D', to: 'pdin.pad', label: '0,12 нс', lx: 135, ly: 54 },
      { from: 'nb.C', to: 'pcfg.pad' },
      { from: 'pdin', to: 'lg.I' },
      { from: 'pcfg', to: 'lg.I' },
      { from: 'lg.O', to: 'r.D' },
      { from: 'r.Q', to: 'pout' },
      { from: 'pclk', to: 'r.CK', kind: 'clk', label: 'clk ≤ 0,10 нс', lx: 330, ly: 205 },
    ],
  },
  given: 'create_clock -name clk -period 4.000 [get_ports clk]',
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Пунктир – соседний блок, который формирует входы с длительностью фронта 0,12 нс. Оранжевая линия – тактовая цепь с более строгим ограничением фронта. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Длительность фронта: допустимая и превышенная', t: [-0.2, 3.2], width: 560,
      signals: [
        { name: 'тактовая цепь', bit: [[0.5, 0.6, 1], [2.0, 2.1, 0]], init: 0 },
        { name: 'цепь данных', bit: [[0.5, 0.75, 1], [2.0, 2.25, 0]], init: 0 },
        { name: 'нарушение', bit: [[0.5, 0.95, 1], [2.0, 2.45, 0]], init: 0 },
      ],
      spans: [
        { row: 0, t0: 0.5, t1: 0.6, label: '0,10 нс – предел для clk', cls: 'clk', lt: 0.7, anchor: 'start' },
        { row: 1, t0: 0.5, t1: 0.75, label: '0,25 нс – предел для данных', cls: 'data', lt: 0.85, anchor: 'start' },
        { row: 2, t0: 0.5, t1: 0.95, label: '0,45 нс – синтез вставит буфер', cls: 'setup', lt: 1.05, anchor: 'start' },
      ],
      caption: 'Длительность фронта – время перехода сигнала между пороговыми уровнями, заданными в библиотеке (обычно 10–90 % или 20–80 % питания). Пологий фронт увеличивает задержку следующей ячейки и её ток короткого замыкания, а в тактовой цепи – чувствительность к шумам и перекос.',
    },
  ],
  solution: `set_max_transition 0.250 [current_design]
set_max_transition 0.100 -clock_path [get_clocks clk]
set_max_capacitance 0.080 [current_design]
set_input_transition 0.120 [get_ports {din[*] cfg[*]}]`,
  check: { clockNames: ['clk'] },
  hints: [
    'Ограничение на весь блок задают на объекте `[current_design]`: `set_max_transition 0.25 [current_design]`, `set_max_capacitance 0.08 [current_design]`.',
    'Более строгое ограничение для тактовых цепей задают на тактовом сигнале с опцией `-clock_path`: `set_max_transition 0.1 -clock_path [get_clocks clk]`.',
    'Длительность фронта на входах без указания управляющей ячейки – `set_input_transition 0.12 [get_ports {din[*] cfg[*]}]`.',
  ],
  explain: `
    \`\`\`
    set_max_transition 0.250 [current_design]
    set_max_transition 0.100 -clock_path [get_clocks clk]
    set_max_capacitance 0.080 [current_design]
    set_input_transition 0.120 [get_ports {din[*] cfg[*]}]
    \`\`\`
    **Правила проектирования (DRV)** – ограничения, которые синтез и топологическое проектирование выполняют в первую очередь, даже ценой временного запаса: при нарушении они увеличивают ячейки и вставляют буферы. Похожие ограничения есть и в библиотеке (атрибуты \`max_transition\` и \`max_capacitance\` выводов); действует более строгое значение.

    **\`set_max_transition\`.** Пологий фронт увеличивает задержку следующей ячейки, ток короткого замыкания и чувствительность к помехам. Для тактовых цепей предел строже: длительность фронта влияет на перекос и на задержку «тактовый вход – выход» всех триггеров. Опция \`-clock_path\` с тактовым сигналом в списке объектов ограничивает только тактовые цепи этого сигнала. Без неё (\`set_max_transition 0.1 [get_clocks clk]\`) предел 0,1 нс получили бы и цепи данных этого домена.

    **\`set_max_capacitance\`** ограничивает нагрузку выхода любой ячейки (входы следующих ячеек и межсоединения): большая ёмкость – медленный фронт и электромиграция в выходных проводах. Единица – из библиотеки: здесь 0,08 пФ, а не 80.

    **\`set_input_transition\`** задаёт длительность фронта на входах, когда управляющая ячейка неизвестна или не важна. С \`set_driving_cell\` (задача [[q:asic.block_basic|о базовом SDC-файле блока]]) САПР сама рассчитает фронт по нагрузке порта; \`set_input_transition\` задаёт его числом.

    **Типичные ошибки:**
    - нет \`-clock_path\` – строгий предел распространяется на все пути домена \`clk\`, синтез раздувает логику данных;
    - \`set_max_capacitance 80\` – ёмкость в фемтофарадах при библиотеке в пикофарадах: ограничение фактически снято;
    - правила на портах вместо \`[current_design]\` – внутренние цепи блока остаются без ограничений.

    **Проверка.** В Design Compiler и PrimeTime: \`report_constraint -all_violators\` – нарушения правил проектирования и временных ограничений. В ConstraintLab значения сравниваются с эталоном.
  `,
  tests: [
    { code: 'set_max_transition 0.25 [current_design]\nset_max_transition 0.1 -clock_path [get_clocks clk]\nset_max_capacitance 0.08 [current_design]\nset_input_transition 0.12 [remove_from_collection [all_inputs] [get_ports clk]]', pass: true, note: 'все входы, кроме clk' },
    { code: 'set_max_transition 0.25 [current_design]\nset_max_transition 0.1 [get_clocks clk]\nset_max_capacitance 0.08 [current_design]\nset_input_transition 0.12 [get_ports {din[*] cfg[*]}]', pass: false, note: 'нет -clock_path', expect: 'Не задано: set_max_transition' },
    { code: 'set_max_transition 0.25 [current_design]\nset_max_transition 0.1 -clock_path [get_clocks clk]\nset_max_capacitance 80 [current_design]\nset_input_transition 0.12 [get_ports {din[*] cfg[*]}]', pass: false, note: 'ёмкость в фемтофарадах', expect: 'set_max_capacitance: неверное значение 80' },
    { code: 'set_max_transition 0.25 [current_design]\nset_max_transition 0.1 -clock_path [get_clocks clk]\nset_max_capacitance 0.08 [current_design]\nset_driving_cell -lib_cell BUFX4 [get_ports {din[*] cfg[*]}]', pass: false, note: 'управляющая ячейка вместо длительности фронта', expect: 'Не задано: set_input_transition' },
    { code: 'set_max_transition 0.25 [all_inputs]\nset_max_transition 0.1 -clock_path [get_clocks clk]\nset_max_capacitance 0.08 [current_design]\nset_input_transition 0.12 [get_ports {din[*] cfg[*]}]', pass: false, note: 'правило на портах вместо блока', expect: 'Не задано: set_max_transition' },
  ],
});

// ---------------------------------------------------------------------------
const SIGNOFF_TREE = {
  elements: [
    { id: 'blk', t: 'boundary', label: 'Блок после синтеза тактового дерева' },
    { id: 'pclk', t: 'in', name: 'clk', x: 20, y: 219 },
    { id: 'b0', t: 'ckbuf', name: 'u_cts_root', x: 130, y: 216 },
    { id: 'ba', t: 'ckbuf', name: 'u_cts_a', x: 240, y: 130 },
    { id: 'bb', t: 'ckbuf', name: 'u_cts_b', x: 470, y: 180 },
    { id: 'ra', t: 'dff', name: 'a_reg', x: 320, y: 40 },
    { id: 'lg', t: 'logic', name: 'u_path', label: 'логика', bh: 36, x: 430, y: 40 },
    { id: 'rb', t: 'dff', name: 'b_reg', x: 560, y: 40 },
  ],
  wires: [
    { from: 'pclk', to: 'b0.A', kind: 'clk', label: 'clk' },
    { from: 'b0.Y', to: ['ba.A', 'bb.A'], kind: 'clk' },
    { from: 'ba.Y', to: 'ra.CK', kind: 'clk' },
    { from: 'bb.Y', to: 'rb.CK', kind: 'clk' },
    { from: 'ra.Q', to: 'lg.I' },
    { from: 'lg.O', to: 'rb.D' },
  ],
};

XT.bank.add({
  id: 'asic.skew_num', module: 'asic_signoff', order: 3, level: 2, tool: 'sdc', type: 'numeric',
  lang: 'both', langNote: 'Расчёт запаса одинаков в PrimeTime и в Vivado: в ПЛИС задержки тактового дерева тоже реальные, и перекос входит в отчёт report_timing (строки clock path и clock skew).',
  title: 'Расчёт: запасы с реальным перекосом тактового дерева',
  tags: ['перекос', 'set_propagated_clock', 'предустановка', 'удержание', 'расчёт'],
  text: `
    После синтеза тактового дерева путь \`a_reg → b_reg\` (один тактовый сигнал, T = **2,0 нс**) по отчёту PrimeTime имеет такие параметры:

    | Параметр | Значение |
    |---|---|
    | задержка тактового дерева до \`a_reg\` (запуск) | 0,30 нс |
    | задержка тактового дерева до \`b_reg\` (захват) | 0,42 нс |
    | задержка «тактовый вход – выход» \`a_reg\`: мин. / макс. | 0,08 / 0,10 нс |
    | задержка логики между регистрами: мин. / макс. | 0,12 / 1,45 нс |
    | время предустановки / удержания \`b_reg\` | 0,06 / 0,04 нс |
    | неопределённость для предустановки / удержания | 0,05 / 0,02 нс |

    **Задание.** Рассчитайте перекос тактового сигнала (задержка до захвата минус задержка до запуска), запас по предустановке и запас по удержанию.
  `,
  design: SIGNOFF_TREE,
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Тактовое дерево после синтеза: корневой буфер и две ветви. До a_reg тактовый сигнал идёт 0,30 нс, до b_reg – 0,42 нс.' },
    {
      kind: 'timing', title: 'Запуск, захват и окна проверок', t: [-0.1, 2.7], width: 600,
      signals: [
        { name: 'clk на порту', clock: { period: 2 }, arrows: 'rise' },
        { name: 'a_reg/CK', clock: { period: 2, rise: 0.30, fall: 1.30 }, arrows: 'rise', cls: 'launch' },
        { name: 'b_reg/D', bus: [[0.50, 1.85, 'D1']], init: 'D0' },
        { name: 'b_reg/CK', clock: { period: 2, rise: 0.42, fall: 1.42 }, arrows: 'rise' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 0.30, label: '0,30', cls: 'clk' },
        { row: 3, t0: 0, t1: 0.42, label: '0,42', cls: 'clk' },
        { row: 2, t0: 0.30, t1: 1.85, label: 'данные: 0,30 + 0,10 + 1,45 = 1,85', cls: 'data', lt: 1.0 },
      ],
      windows: [{ row: 2, t0: 2.31, t1: 2.42, cls: 'setup' }, { row: 2, t0: 0.42, t1: 0.48, cls: 'hold' }],
      marks: [{ t: 2.31, label: 'данные нужны к 2,31', cls: 'capture' }],
      caption: 'Самые поздние данные устанавливаются на b_reg/D в 1,85 нс, а нужны к 2,0 + 0,42 − 0,06 − 0,05 = 2,31 нс. Самые ранние новые данные приходят в 0,30 + 0,08 + 0,12 = 0,50 нс, а должны держаться до 0,42 + 0,04 + 0,02 = 0,48 нс (окно удержания показано у фронта захвата).',
    },
  ],
  fields: [
    { label: 'Перекос тактового сигнала (захват − запуск)', answer: 0.12, tol: 0.005, unit: 'нс' },
    { label: 'Запас по предустановке (setup slack)', answer: 0.46, tol: 0.005, unit: 'нс' },
    { label: 'Запас по удержанию (hold slack)', answer: 0.02, tol: 0.005, unit: 'нс' },
  ],
  hints: [
    'Предустановка: данные должны прийти до следующего фронта на захватывающем регистре: требуемое время = T + задержка до захвата − t_su − неопределённость. Время прихода = задержка до запуска + максимальная Tco + максимальная задержка логики.',
    'Удержание: самые ранние новые данные (минимальные задержки) должны прийти позже, чем закончится окно удержания на захватывающем регистре для того же фронта: задержка до захвата + t_h + неопределённость.',
  ],
  explain: `
    **Перекос** = 0,42 − 0,30 = **0,12 нс**: захватывающий регистр видит фронт позже запускающего.

    **Предустановка.**
    - Время прихода: 0,30 + 0,10 + 1,45 = 1,85 нс.
    - Требуемое время: 2,0 + 0,42 − 0,06 − 0,05 = 2,31 нс.
    - Запас: 2,31 − 1,85 = **0,46 нс**.

    **Удержание.**
    - Время прихода (минимальные задержки): 0,30 + 0,08 + 0,12 = 0,50 нс.
    - Требуемое время: 0,42 + 0,04 + 0,02 = 0,48 нс.
    - Запас: 0,50 − 0,48 = **0,02 нс**.

    **Вывод.** Положительный перекос (захват позже запуска) *добавляет* время предустановке и *отнимает* его у удержания. Без перекоса запас по предустановке был бы 0,34 нс, а по удержанию 0,14 нс. Этим пользуется синтез тактового дерева: намеренный «полезный перекос» (useful skew) помогает критическим путям предустановки, но каждый такой сдвиг нужно оплачивать запасом удержания на соседних путях – отсюда буферы, которые вставляют при исправлении удержания.

    **Связь с SDC.** Такой расчёт выполняется только для распространяемых тактовых сигналов (\`set_propagated_clock\`, задача [[q:asic.cts|о синтезе тактового дерева]]). Неопределённость здесь уже без оценки перекоса: перекос входит в расчёт напрямую.

    **Проверка в PrimeTime:** \`report_timing -from [get_cells a_reg] -to [get_cells b_reg] -delay_type min_max -path_type full_clock_expanded\` – в отчёте видны задержки ветвей дерева, время прихода данных, требуемое время и запас.
  `,
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.ocv_crpr', module: 'asic_signoff', order: 4, level: 3, tool: 'sdc', type: 'numeric',
  lang: 'sdc', langNote: 'Коэффициенты разброса `set_timing_derate` – команда САПР ASIC (в Vivado разброс уже заложен в модели задержек). Снятие пессимизма общего участка Vivado выполняет так же: строка clock pessimism в отчёте report_timing.',
  title: 'Расчёт: разброс на кристалле (OCV) и общий участок дерева (CRPR)',
  tags: ['OCV', 'set_timing_derate', 'CRPR', 'финальный анализ', 'расчёт'],
  text: `
    Финальный анализ в PrimeTime учитывает разброс параметров на кристалле (on-chip variation, OCV) постоянными коэффициентами:

    \`\`\`
    set_timing_derate -late  1.08
    set_timing_derate -early 0.92
    \`\`\`
    Коэффициенты умножают задержки ячеек и цепей – тактовых и информационных: для проверки предустановки путь запуска считается «поздним» (×1,08), путь захвата – «ранним» (×0,92). Ко времени предустановки коэффициенты не применяются.

    Путь \`a_reg → b_reg\`, T = **2,0 нс**. Номинальные задержки:

    | Участок | Задержка |
    |---|---|
    | общий участок тактового дерева: от порта до точки разветвления | 0,40 нс |
    | ветвь до \`a_reg\` | 0,20 нс |
    | ветвь до \`b_reg\` | 0,25 нс |
    | «тактовый вход – выход» \`a_reg\` | 0,10 нс |
    | логика между регистрами | 1,20 нс |
    | время предустановки \`b_reg\` | 0,05 нс |

    **Задание.** Рассчитайте запас по предустановке: без учёта OCV; с OCV без снятия пессимизма общего участка; поправку CRPR; итоговый запас с OCV и CRPR.
  `,
  design: SIGNOFF_TREE,
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Общий участок дерева – порт clk и корневой буфер u_cts_root (0,40 нс); дальше ветви до a_reg (0,20 нс) и b_reg (0,25 нс).' },
    {
      kind: 'timing', title: 'Один и тот же буфер не может быть сразу медленным и быстрым', t: [-0.1, 2.9], width: 600,
      signals: [
        { name: 'общий участок: поздно', clock: { period: 2, rise: 0.432, fall: 1.432 }, arrows: 'rise', cls: 'launch' },
        { name: 'общий участок: рано', clock: { period: 2, rise: 0.368, fall: 1.368 }, arrows: 'rise' },
        { name: 'a_reg/CK (поздно)', clock: { period: 2, rise: 0.648, fall: 1.648 }, arrows: 'rise', cls: 'launch' },
        { name: 'b_reg/CK (рано)', clock: { period: 2, rise: 0.598, fall: 1.598 }, arrows: 'rise' },
      ],
      spans: [
        { row: 0, t0: 0.368, t1: 0.432, label: 'CRPR: 0,064 нс', cls: 'setup', lt: 0.55, anchor: 'start' },
        { row: 2, t0: 0, t1: 0.648, label: '0,60 × 1,08', cls: 'clk' },
        { row: 3, t0: 0, t1: 0.598, label: '0,65 × 0,92', cls: 'clk' },
      ],
      caption: 'Без снятия пессимизма анализ считает общий участок медленным для запуска (0,432 нс) и быстрым для захвата (0,368 нс) одновременно. Физически это один и тот же буфер, поэтому разницу 0,064 нс возвращают в запас (CRPR).',
    },
  ],
  fields: [
    { label: 'Запас без учёта OCV', answer: 0.70, tol: 0.002, unit: 'нс' },
    { label: 'Запас с OCV, без снятия пессимизма', answer: 0.496, tol: 0.002, unit: 'нс' },
    { label: 'Поправка CRPR (снятие пессимизма общего участка)', answer: 0.064, tol: 0.002, unit: 'нс' },
    { label: 'Итоговый запас с OCV и CRPR', answer: 0.56, tol: 0.002, unit: 'нс' },
  ],
  hints: [
    'Без OCV: время прихода = 0,40 + 0,20 + 0,10 + 1,20; требуемое время = T + (0,40 + 0,25) − t_su.',
    'С OCV все задержки пути запуска (тактовые и информационные) умножают на 1,08, а задержки пути захвата – на 0,92.',
    'Общий участок (0,40 нс) входит в оба пути: в одном с коэффициентом 1,08, в другом – 0,92. Поправка CRPR = 0,40 × (1,08 − 0,92).',
  ],
  explain: `
    **Без OCV.** Приход: 0,40 + 0,20 + 0,10 + 1,20 = 1,90 нс. Требуемое: 2,0 + 0,65 − 0,05 = 2,60 нс. Запас **0,70 нс**.

    **С OCV.** Путь запуска «поздний»: 1,90 × 1,08 = 2,052 нс. Путь захвата «ранний»: 0,65 × 0,92 = 0,598 нс; требуемое: 2,0 + 0,598 − 0,05 = 2,548 нс. Запас **0,496 нс**.

    **CRPR.** Общий участок 0,40 нс посчитан в пути запуска как 0,432 нс, а в пути захвата – как 0,368 нс. Но это одни и те же ячейки и провода: в одном и том же фронте они не могут быть одновременно медленными и быстрыми. Разницу 0,40 × (1,08 − 0,92) = **0,064 нс** возвращают в запас. Итог: 0,496 + 0,064 = **0,560 нс**.

    **Почему это важно.** OCV моделирует разброс параметров *внутри одного кристалла*: соседние ячейки изготовлены чуть по-разному и работают при разной температуре и напряжении питания. Постоянные коэффициенты пессимистичны для длинных цепочек ячеек, поэтому в современных маршрутах применяют зависящие от глубины и расстояния коэффициенты (AOCV) или статистическое описание разброса (POCV). Снятие пессимизма общего участка (CRPR, в САПР Cadence – CPPR) обязательно при любом из этих подходов: в PrimeTime его включает переменная \`timing_remove_clock_reconvergence_pessimism\`.

    **Где задают коэффициенты.** \`set_timing_derate\` относится к углу анализа, а не к режиму: в разных углах коэффициенты разные. В описании MMMC их задают для угла задержек (delay corner), в PrimeTime – в сценарии этого угла.

    **Проверка в PrimeTime:** \`report_timing -path_type full_clock_expanded\` – в отчёте видны применённые коэффициенты и строка clock reconvergence pessimism.
  `,
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.mmmc_q', module: 'asic_signoff', order: 5, level: 2, tool: 'sdc', type: 'choice', multi: true,
  lang: 'sdc', langNote: 'Режимы, углы и виды анализа (MMMC) – организация финального анализа в САПР ASIC. Vivado анализирует медленный и быстрый углы автоматически, отдельных режимов в нём не описывают.',
  title: 'Режимы, углы и виды анализа (MMMC)',
  tags: ['MMMC', 'constraint mode', 'delay corner', 'analysis view', 'понимание'],
  text: `
    Блок готовят к финальному анализу в Tempus или Innovus по схеме MMMC (multi-mode multi-corner): режимы (constraint mode), углы задержек (delay corner) и виды анализа (analysis view). Есть два SDC-файла – функциональный режим (\`func.sdc\`) и сдвиг при сканировании (\`shift.sdc\`), – наборы библиотек ss и ff и модели межсоединений (RC) cmax и cmin.

    **Задание.** Отметьте все верные утверждения.
  `,
  design: {
    elements: [
      { id: 'mf', t: 'chip', name: 'mode_func', title: 'режим func\n(func.sdc)', x: 0, y: 40, bw: 130, bh: 54, ext: true, pins: [{ n: 'O', side: 'r', y: 27, label: '' }] },
      { id: 'ms', t: 'chip', name: 'mode_shift', title: 'режим shift\n(shift.sdc)', x: 0, y: 200, bw: 130, bh: 54, ext: true, pins: [{ n: 'O', side: 'r', y: 27, label: '' }] },
      { id: 'v1', t: 'chip', name: 'func_ss', title: 'вид func_ss', x: 250, y: 0, bw: 120, bh: 40, ext: true, pins: [{ n: 'M', side: 'l', y: 20, label: '' }, { n: 'C', side: 'r', y: 20, label: '' }] },
      { id: 'v2', t: 'chip', name: 'func_ff', title: 'вид func_ff', x: 250, y: 80, bw: 120, bh: 40, ext: true, pins: [{ n: 'M', side: 'l', y: 20, label: '' }, { n: 'C', side: 'r', y: 20, label: '' }] },
      { id: 'v3', t: 'chip', name: 'shift_ss', title: 'вид shift_ss', x: 250, y: 160, bw: 120, bh: 40, ext: true, pins: [{ n: 'M', side: 'l', y: 20, label: '' }, { n: 'C', side: 'r', y: 20, label: '' }] },
      { id: 'v4', t: 'chip', name: 'shift_ff', title: 'вид shift_ff', x: 250, y: 240, bw: 120, bh: 40, ext: true, pins: [{ n: 'M', side: 'l', y: 20, label: '' }, { n: 'C', side: 'r', y: 20, label: '' }] },
      { id: 'cs', t: 'chip', name: 'corner_ss', title: 'угол ss_cmax\nбиблиотеки ss, RC cmax', x: 490, y: 40, bw: 180, bh: 54, ext: true, pins: [{ n: 'O', side: 'l', y: 27, label: '' }] },
      { id: 'cf', t: 'chip', name: 'corner_ff', title: 'угол ff_cmin\nбиблиотеки ff, RC cmin', x: 490, y: 200, bw: 180, bh: 54, ext: true, pins: [{ n: 'O', side: 'l', y: 27, label: '' }] },
    ],
    wires: [
      { from: 'mf.O', to: ['v1.M', 'v2.M'], trunk: 40 },
      { from: 'ms.O', to: ['v3.M', 'v4.M'], trunk: 40 },
      { from: 'cs.O', to: 'v1.C', via: [[440, 67], [440, 20]] },
      { from: 'cs.O', to: 'v3.C', via: [[440, 67], [440, 180]] },
      { from: 'cf.O', to: 'v2.C', via: [[460, 227], [460, 100]] },
      { from: 'cf.O', to: 'v4.C', via: [[460, 227], [460, 260]] },
    ],
  },
  figures: [{ kind: 'schematic', title: 'Схема MMMC', caption: 'Вид анализа – пара «режим + угол». Режим задают SDC-файлы, угол – библиотеки (PVT) и модели межсоединений (RC). Предустановку и удержание проверяют на своих наборах видов.' }],
  options: [
    { text: 'Constraint mode – набор SDC-файлов одного режима работы; один и тот же режим анализируют в нескольких углах.', ok: true, why: 'Верно. Частоты, константы и внешние задержки – свойства режима, они не зависят от угла.' },
    { text: 'Delay corner объединяет набор библиотек (условия PVT) и модель межсоединений (RC); частот и задержек ввода/вывода в нём нет.', ok: true, why: 'Верно. Угол описывает, в каких условиях работает схема, а не что от неё требуется.' },
    { text: 'Analysis view – пара «режим + угол»; проверку предустановки и удержания назначают своим наборам видов (`set_analysis_view -setup … -hold …`).', ok: true, why: 'Верно. Обычно предустановку проверяют в медленных углах, удержание – в быстрых, но при обратной температурной зависимости задержек виды для обеих проверок подбирают внимательнее.' },
    { text: 'Для угла ff копируют SDC-файл и уменьшают периоды тактовых сигналов: в быстром угле схема работает быстрее.', why: 'Неверно. Период – требование системы, оно одинаково во всех углах. Быстрый угол нужен в основном для проверки удержания.' },
    { text: 'Коэффициенты OCV (`set_timing_derate`) одинаковы для всех углов, поэтому их всегда записывают в SDC-файл режима.', why: 'Неверно. Разброс зависит от напряжения, температуры и технологии, то есть от угла. В описании MMMC коэффициенты задают для угла задержек, в PrimeTime – в сценарии угла.' },
    { text: 'В PrimeTime то же организуют сценариями «режим + угол»: отдельными прогонами или распределённым анализом нескольких сценариев (DMSA).', ok: true, why: 'Верно. Сценарий PrimeTime соответствует виду анализа в MMMC.' },
  ],
  hints: [
    'Разделите сведения на «что требуется от схемы» (частоты, константы, внешние задержки) и «в каких условиях она работает» (библиотеки, температура, напряжение, межсоединения).',
    'Разброс параметров на кристалле зависит от условий работы.',
  ],
  explain: `
    **Режим** (constraint mode) – что требуется от схемы: тактовые сигналы и частоты, константы \`set_case_analysis\`, задержки ввода/вывода, исключения. Его задают SDC-файлы.

    **Угол задержек** (delay corner) – в каких условиях работает схема: библиотеки для напряжения, температуры и технологического разброса (library set), модель межсоединений после экстракции (RC corner), а также коэффициенты разброса на кристалле (\`set_timing_derate\` для угла).

    **Вид анализа** (analysis view) – пара «режим + угол». Командой \`set_analysis_view -setup {…} -hold {…}\` назначают, какие виды используются для проверки предустановки, а какие – для удержания.

    | Вид | Режим | Угол | Проверки |
    |---|---|---|---|
    | func_ss | func.sdc | ss + cmax | предустановка |
    | func_ff | func.sdc | ff + cmin | удержание |
    | shift_ss | shift.sdc | ss + cmax | предустановка |
    | shift_ff | shift.sdc | ff + cmin | удержание |

    В реальном проекте видов больше: углы для разных температур, напряжений и экстракций, а при обратной температурной зависимости обе проверки выполняют в большем числе углов. В PrimeTime каждой паре соответствует сценарий; несколько сценариев анализируют отдельными прогонами или распределённо (DMSA).
  `,
});
