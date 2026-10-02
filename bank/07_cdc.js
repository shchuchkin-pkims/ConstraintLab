/* Модуль 7. Передача между тактовыми доменами (Vivado XDC) */
XT.bank.module({
  id: 'cdc', order: 70, title: '7. Передача между тактовыми доменами',
  about: 'синхронизаторы и ASYNC_REG, адресный ложный путь, код Грея: set_max_delay -datapath_only и set_bus_skew, ловушка set_clock_groups при макросах XPM, связанные тактовые сигналы',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'cdc.sync1', module: 'cdc', order: 1, level: 2, tool: 'vivado',
  lang: 'xdc', langNote: 'Адресный `set_false_path` общий для XDC и SDC, а `ASYNC_REG` есть только в Vivado.',
  title: 'Однобитный признак: двухтриггерный синхронизатор',
  tags: ['set_false_path', 'ASYNC_REG', 'синхронизатор', 'метастабильность'],
  text: `
    Признак занятости \`busy_reg\` формируется в домене \`clk_a\` (**100 МГц**) и передаётся в домен \`clk_b\` (**80 МГц**) через двухтриггерный синхронизатор \`busy_sync_reg[0]\` → \`busy_sync_reg[1]\`. Тактовые сигналы приходят от разных кварцевых генераторов: фазовое соотношение между ними случайно и медленно «плывёт».

    Вместе с признаком в домен \`clk_b\` передаётся шина состояния \`stat_reg[3:0]\`. Приёмник \`stat_q_reg[3:0]\` загружает её только при \`busy = 0\` (по синхронизированному признаку), когда шина давно неизменна. Для шины ограничение уже задано – \`set_max_delay -datapath_only\` в блоке «Уже в проекте». Группы тактовых сигналов в проекте не используются: каждый путь между доменами ограничивают отдельно.

    **Задание.** Исключите ложным путём только путь \`busy_reg → busy_sync_reg[0]\` и пометьте обе ступени синхронизатора свойством \`ASYNC_REG\`.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pa', t: 'in', name: 'clk_a', x: 10, y: 87 },
      { id: 'iba', t: 'ibuf', name: 'clk_a_IBUF_inst', x: 96, y: 84, noName: true },
      { id: 'bga', t: 'bufg', name: 'clk_a_IBUF_BUFG_inst', x: 156, y: 84, noName: true },
      { id: 'pb', t: 'in', name: 'clk_b', x: 10, y: 303 },
      { id: 'ibb', t: 'ibuf', name: 'clk_b_IBUF_inst', x: 96, y: 300, noName: true },
      { id: 'bgb', t: 'bufg', name: 'clk_b_IBUF_BUFG_inst', x: 156, y: 300, noName: true },
      { id: 'ctl', t: 'block', name: 'u_ctrl', title: 'контроллер', x: 230, y: 30, bw: 110, bh: 170, pins: [{ n: 'CLK', clk: true, y: 68 }, { n: 'STAT', d: 'out', w: 4, y: 28 }, { n: 'BUSY', d: 'out', y: 158 }], timing: { seq: true, clk: 'CLK', launch: { STAT: ['rise'], BUSY: ['rise'] } } },
      { id: 'st', t: 'ff', name: 'stat_reg', w: 4, x: 390, y: 40 },
      { id: 'bz', t: 'ff', name: 'busy_reg', x: 390, y: 170 },
      { id: 's0', t: 'ff', name: 'busy_sync_reg[0]', x: 560, y: 170 },
      { id: 's1', t: 'ff', name: 'busy_sync_reg[1]', x: 690, y: 170 },
      { id: 'inv', t: 'logic', name: 'ld_inv', label: 'НЕ', x: 800, y: 100, bw: 60 },
      { id: 'sq', t: 'ff', name: 'stat_q_reg', w: 4, ce: true, x: 920, y: 40 },
    ],
    wires: [
      { from: 'pa', to: 'iba.I', kind: 'clk' },
      { from: 'iba.O', to: 'bga.I', kind: 'clk' },
      { from: 'pb', to: 'ibb.I', kind: 'clk' },
      { from: 'ibb.O', to: 'bgb.I', kind: 'clk' },
      { from: 'bga.O', to: 'ctl.CLK', kind: 'clk' },
      { from: 'bga.O', to: 'st.C', kind: 'clk', via: [[210, 215], [370, 215], [370, 98]], label: 'clk_a', lx: 290, ly: 230, below: true },
      { from: 'bga.O', to: 'bz.C', kind: 'clk', via: [[210, 215], [370, 215], [370, 228]] },
      { from: 'bgb.O', to: 's0.C', kind: 'clk', via: [[548, 314], [548, 228]], label: 'clk_b', lx: 470, ly: 309 },
      { from: 'bgb.O', to: 's1.C', kind: 'clk', via: [[678, 314], [678, 228]] },
      { from: 'bgb.O', to: 'sq.C', kind: 'clk', via: [[908, 314], [908, 98]] },
      { from: 'ctl.STAT', to: 'st.D', bus: true, bw: 4 },
      { from: 'ctl.BUSY', to: 'bz.D' },
      { from: 'st.Q', to: 'sq.D' },
      { from: 'bz.Q', to: 's0.D' },
      { from: 's0.Q', to: 's1.D' },
      { from: 's1.Q', to: 'inv.I', mx: 784 },
      { from: 'inv.O', to: 'sq.CE', label: 'ld' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Без исключения: случайная пара фронтов разнесена на 2,5 нс', t: [-1, 52],
      signals: [
        { name: 'clk_a 100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_b 80', clock: { period: 12.5 }, arrows: 'rise' },
        { name: 'busy_reg', bit: [[10.5, 10.7, 1], [40.5, 40.7, 0]], init: 0 },
        { name: 'busy_sync_reg[0]', bit: [[12.6, 13.6, 1], [50.1, 50.4, 0]], init: 0, unc: true },
        { name: 'busy_sync_reg[1]', bit: [[25.1, 25.4, 1]], init: 0 },
      ],
      marks: [{ t: 10, label: 'запуск', cls: 'launch' }, { t: 12.5, label: 'захват', cls: 'capture' }, { t: 25, label: 'вторая ступень', cls: 'default' }],
      spans: [{ row: 1, t0: 10, t1: 12.5, label: '2,5 нс', cls: 'setup' }, { row: 3, t0: 12.6, t1: 25, label: 'время на разрешение метастабильности' }],
      caption: 'Если считать тактовые сигналы связанными, Vivado найдёт на общем периоде 50 нс пару фронтов с разносом 2,5 нс. На самом деле разнос случаен и может быть сколь угодно малым: первая ступень иногда захватывает изменение в окне предустановки (штриховка). Вторая ступень даёт ей целый период clk_b на разрешение метастабильного состояния.',
    },
  ],
  given: `create_clock -name clk_a -period 10.000 [get_ports clk_a]
create_clock -name clk_b -period 12.500 [get_ports clk_b]
# шина состояния: ограничение задержки тракта данных
set_max_delay -datapath_only -from [get_cells {stat_reg[*]}] -to [get_cells {stat_q_reg[*]}] 10.000`,
  solution: `set_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]
set_false_path -to [get_cells {busy_sync_reg[0]}]`,
  hints: [
    'Конечная точка исключения – первая ступень синхронизатора: `-to [get_cells {busy_sync_reg[0]}]`. Начальную точку можно не указывать или указать ячейку `busy_reg` (не вывод Q!).',
    'Не объявляйте тактовые сигналы асинхронными и не исключайте пути clk_a → clk_b целиком: это перекроет `set_max_delay` для шины `stat_reg`.',
    'Свойство: `set_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]` – для обеих ступеней.',
  ],
  explain: `
    \`\`\`
    set_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]
    set_false_path -to [get_cells {busy_sync_reg[0]}]
    \`\`\`
    **Почему путь к первой ступени не анализируют.** Между генераторами нет фиксированного соотношения, поэтому любое требование для пути \`busy_reg → busy_sync_reg[0]\` случайно. Считая сигналы связанными, Vivado нашёл бы на общем периоде 50 нс пару фронтов с разносом 2,5 нс (запуск 10 нс, захват 12,5 нс), а в действительности разнос бывает сколь угодно малым. Рано или поздно первая ступень захватит изменение в окне предустановки или удержания – это нормально, для этого синхронизатор и нужен. Отчёт \`report_clock_interaction\` без исключения показал бы пару \`clk_a → clk_b\` как *Timed (unsafe)*.

    **Метастабильность и MTBF.** При нарушении окна захвата \`busy_sync_reg[0]\` может на время зависнуть в промежуточном состоянии. Вторая ступень берёт его выход через целый период \`clk_b\` – за это время состояние почти наверняка разрешится. Средняя наработка на отказ (MTBF) растёт экспоненциально с увеличением времени на разрешение, поэтому путь \`busy_sync_reg[0] → busy_sync_reg[1]\` **остаётся** под анализом: чем меньше его задержка, тем больше запас.

    **ASYNC_REG.** Свойство сообщает Vivado, что триггеры образуют синхронизатор: их размещают рядом (в одном слайсе), не упаковывают в сдвиговый регистр SRL, не дублируют и не удаляют при оптимизации; \`report_cdc\` относит такую структуру к категории «1-bit synchronized with ASYNC_REG property».

    **Почему не set_clock_groups.** Группы отключили бы все пути между \`clk_a\` и \`clk_b\` и, имея наивысший приоритет, перекрыли бы \`set_max_delay\` для шины \`stat_reg\`. То же сделал бы ложный путь «тактовый сигнал → тактовый сигнал»: ложный путь старше ограничения задержки. Адресный ложный путь затрагивает только вход синхронизатора.

    **Альтернатива: set_max_delay -datapath_only.** В проектах со строгими требованиями к задержке синхронизации вместо ложного пути ограничивают задержку тракта данных: \`set_max_delay -datapath_only -from [get_cells busy_reg] -to [get_cells {busy_sync_reg[0]}] 10.000\`. Тогда трассировщик не сможет проложить путь через половину кристалла, и время доставки признака остаётся предсказуемым. Для однобитного признака допустимы оба варианта; в этой задаче требуется ложный путь.

    Типичные ошибки:
    - \`-from [get_pins busy_reg/Q]\` – выход Q не является начальной точкой: Vivado выдаёт предупреждение и игнорирует исключение, путь по-прежнему анализируется с требованием 2,5 нс;
    - \`-to [get_cells {busy_sync_reg[1]}]\` – исключён путь между ступенями (а его нужно анализировать), а вход синхронизатора остался под анализом;
    - нет \`ASYNC_REG\` – ступени могут оказаться далеко друг от друга или в SRL, MTBF резко падает.

    Проверка в Vivado: \`report_exceptions\` – новое исключение покрывает один путь, а \`set_max_delay\` для шины по-прежнему действует; \`report_timing -from [get_cells busy_reg]\` – путь не анализируется; \`report_cdc -details\` – синхронизатор опознан.
  `,
  refs: 'UG903, раздел «Constraining Clock Domain Crossings»; UG906, report_cdc; UG912, свойство ASYNC_REG; справочник: «Передача между тактовыми доменами: что ограничивать»',
  tests: [
    { code: 'set_false_path -from [get_cells busy_reg] -to [get_cells {busy_sync_reg[0]}]\nset_property ASYNC_REG TRUE [get_cells {busy_sync_reg[0] busy_sync_reg[1]}]', pass: true, note: '-from ячейки -to ячейки' },
    { code: 'set_false_path -to [get_pins {busy_sync_reg[0]/D}]\nset_property -dict {ASYNC_REG TRUE} [get_cells busy_sync_reg*]', pass: true, note: '-to на вывод D, set_property -dict' },
    { code: 'set_false_path -from [get_pins busy_reg/Q] -to [get_cells {busy_sync_reg[0]}]\nset_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]', pass: false, note: 'начальная точка – вывод Q', expect: ['ПРОИГНОРИРОВАНО', 'должен быть исключён'] },
    { code: 'set_false_path -to [get_cells {busy_sync_reg[1]}]\nset_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]', pass: false, note: 'ложный путь ко второй ступени', expect: ['ошибочно объявлен ложным', 'должен быть исключён'] },
    { code: 'set_false_path -to [get_cells {busy_sync_reg[0]}]', pass: false, note: 'нет ASYNC_REG', expect: 'Не задано свойство ASYNC_REG' },
    { code: 'set_clock_groups -asynchronous -group [get_clocks clk_a] -group [get_clocks clk_b]\nset_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]', pass: false, note: 'асинхронные группы', expect: 'ошибочно объявлены асинхронными' },
    { code: 'set_false_path -from [get_clocks clk_a] -to [get_clocks clk_b]\nset_property ASYNC_REG TRUE [get_cells {busy_sync_reg[*]}]', pass: false, note: 'ложный путь между тактовыми сигналами', expect: 'ошибочно объявлен ложным' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'cdc.gray', module: 'cdc', order: 2, level: 3, tool: 'vivado',
  lang: 'xdc', langNote: '`set_max_delay -datapath_only`, `set_bus_skew` и `ASYNC_REG` в таком виде есть только в XDC. В маршруте ASIC передачу кода Грея ограничивают средствами конкретной САПР и проверяют структурным анализом CDC.',
  title: 'Указатель FIFO в коде Грея: set_max_delay -datapath_only и set_bus_skew',
  tags: ['set_max_delay -datapath_only', 'set_bus_skew', 'код Грея', 'асинхронное FIFO', 'ASYNC_REG'],
  text: `
    В самостоятельно написанном асинхронном FIFO указатель записи в коде Грея \`wptr_gray_reg[3:0]\` (домен \`wr_clk\`, **125 МГц**) передаётся в домен \`rd_clk\` (**100 МГц**, независимый генератор) через двухступенчатый синхронизатор \`wptr_sync1_reg[3:0]\` → \`wptr_sync2_reg[3:0]\`. Логика чтения сравнивает синхронизированный указатель со своим и формирует признак «FIFO пусто».

    Соседние значения кода Грея отличаются одним разрядом, поэтому даже если первая ступень захватит изменение «на границе», приёмник получит либо старое, либо новое значение указателя. Но это верно, только пока задержки разрядов до первой ступени близки друг к другу и меньше периода источника: иначе за время пути указатель успеет измениться ещё раз, и в приёмнике смешаются разряды разных значений.

    **Задание.**
    1. Пометьте обе ступени синхронизатора свойством \`ASYNC_REG\`.
    2. Ограничьте задержку путей \`wptr_gray_reg → wptr_sync1_reg\` периодом тактового сигнала источника так, как это принято для путей между асинхронными доменами.
    3. Ограничьте перекос этой шины (разброс задержек разрядов) наименьшим из двух периодов.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pw', t: 'in', name: 'wr_clk', x: 10, y: 87 },
      { id: 'ibw', t: 'ibuf', name: 'wr_clk_IBUF_inst', x: 96, y: 84, noName: true },
      { id: 'bgw', t: 'bufg', name: 'wr_clk_IBUF_BUFG_inst', x: 156, y: 84, noName: true },
      { id: 'pr', t: 'in', name: 'rd_clk', x: 10, y: 207 },
      { id: 'ibr', t: 'ibuf', name: 'rd_clk_IBUF_inst', x: 96, y: 204, noName: true },
      { id: 'bgr', t: 'bufg', name: 'rd_clk_IBUF_BUFG_inst', x: 156, y: 204, noName: true },
      { id: 'wr', t: 'block', name: 'u_wr', title: 'логика записи', x: 230, y: 30, bw: 110, bh: 86, pins: [{ n: 'CLK', clk: true, y: 68 }, { n: 'G', d: 'out', w: 4, y: 28 }], timing: { seq: true, clk: 'CLK', launch: { G: ['rise'] } } },
      { id: 'g', t: 'ff', name: 'wptr_gray_reg', w: 4, x: 390, y: 40 },
      { id: 's1', t: 'ff', name: 'wptr_sync1_reg', w: 4, x: 560, y: 40 },
      { id: 's2', t: 'ff', name: 'wptr_sync2_reg', w: 4, x: 700, y: 40 },
      { id: 'rd', t: 'block', name: 'u_rd', title: 'логика чтения', x: 840, y: 30, bw: 110, bh: 86, pins: [{ n: 'W', d: 'in', w: 4, y: 28 }, { n: 'CLK', clk: true, y: 68 }], timing: { seq: true, clk: 'CLK', capture: { W: ['rise'] } } },
      { id: 'n1', t: 'note', x: 430, y: 226, text: 'домен wr_clk (125 МГц)  →  домен rd_clk (100 МГц)', box: false },
    ],
    wires: [
      { from: 'pw', to: 'ibw.I', kind: 'clk' },
      { from: 'ibw.O', to: 'bgw.I', kind: 'clk' },
      { from: 'pr', to: 'ibr.I', kind: 'clk' },
      { from: 'ibr.O', to: 'bgr.I', kind: 'clk' },
      { from: 'bgw.O', to: 'wr.CLK', kind: 'clk' },
      { from: 'bgw.O', to: 'g.C', kind: 'clk', via: [[210, 135], [370, 135], [370, 98]], label: 'wr_clk', lx: 290, ly: 130 },
      { from: 'bgr.O', to: 's1.C', kind: 'clk', via: [[548, 218], [548, 98]], label: 'rd_clk', lx: 400, ly: 213 },
      { from: 'bgr.O', to: 's2.C', kind: 'clk', via: [[688, 218], [688, 98]] },
      { from: 'bgr.O', to: 'rd.CLK', kind: 'clk', via: [[828, 218], [828, 98]] },
      { from: 'wr.G', to: 'g.D', bus: true, bw: 4 },
      { from: 'g.Q', to: 's1.D' },
      { from: 's1.Q', to: 's2.D' },
      { from: 's2.Q', to: 'rd.W' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Задержки разрядов 2 и 6 нс: обе меньше 8 нс, перекос 4 нс', t: [-1, 33],
      signals: [
        { name: 'wr_clk', clock: { period: 8 }, arrows: 'rise', cls: 'launch' },
        { name: 'wptr_gray_reg', bus: [[0.5, 1, '0001'], [8.5, 9, '0011'], [16.5, 17, '0010'], [24.5, 25, '0110']], init: '0000' },
        { name: 'разряд 0 у sync1', bit: [[2.5, 2.7, 1], [18.5, 18.7, 0]], init: 0 },
        { name: 'разряд 1 у sync1', bit: [[14.5, 14.7, 1]], init: 0 },
        { name: 'rd_clk', clock: { period: 10, rise: 3, fall: 8 }, arrows: 'rise' },
      ],
      marks: [{ t: 8.5, label: 'запуск 0011', cls: 'launch' }, { t: 14.5, label: 'приход разряда 1', cls: 'default' }],
      spans: [{ row: 3, t0: 8.5, t1: 14.5, label: 'd1 = 6 нс', cls: 'data' }, { row: 2, t0: 0.5, t1: 2.5, label: 'd0 = 2 нс', cls: 'data' }],
      caption: 'Каждый разряд доходит до первой ступени быстрее периода источника (8 нс), а разброс задержек разрядов (6 − 2 = 4 нс) меньше наименьшего периода. Изменения приходят в том же порядке, в каком их выдал источник, и к любому фронту rd_clk на входах первой ступени меняется не более одного разряда: синхронизатор выдаёт либо старое, либо новое значение указателя.',
    },
  ],
  given: `create_clock -name wr_clk -period 8.000 [get_ports wr_clk]
create_clock -name rd_clk -period 10.000 [get_ports rd_clk]`,
  solution: `set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]
set_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000
set_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000`,
  hints: [
    'Ложный путь не подходит: он снимает любые ограничения, а коду Грея нужна ограниченная задержка. Для путей между асинхронными доменами применяют `set_max_delay` с опцией, которая исключает тактовые деревья из расчёта и отключает проверку удержания.',
    'Период источника `wr_clk` – 8 нс; наименьший из двух периодов – тоже 8 нс. Перекос ограничивает команда `set_bus_skew -from … -to … <значение>`.',
    '`set_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000` и `set_bus_skew` с теми же объектами и значением 8.000; плюс ASYNC_REG на `wptr_sync1_reg[*]` и `wptr_sync2_reg[*]`.',
  ],
  explain: `
    \`\`\`
    set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]
    set_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000
    set_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000
    \`\`\`
    **Почему не ложный путь.** Код Грея гарантирует изменение одного разряда за шаг, но только на выходе \`wptr_gray_reg\`. Без ограничений трассировщик может провести один разряд через половину кристалла: тогда, пока он идёт, указатель изменится ещё раз, и первая ступень захватит смесь разрядов двух разных значений. Указатель «перепрыгнет», и логика чтения выдаст слово, которое ещё не записано. Ложный путь снимает всякие ограничения, а здесь нужна ограниченная задержка.

    **set_max_delay 8 нс.** Задержка каждого разряда не превышает периода источника: пока новое значение доходит до приёмника, указатель меняется не более одного раза.

    **-datapath_only.** Тактовые сигналы асинхронны, и сравнивать задержки их тактовых деревьев бессмысленно. Опция исключает из расчёта задержки тактовых сигналов источника и приёмника, оставляя только тракт данных (Tco, трассировка, логика), и отключает проверку удержания – требование к удержанию между асинхронными сигналами случайно. Без \`-datapath_only\` Vivado проверял бы удержание с требованием, найденным по общему периоду (здесь 0 нс), и учитывал бы перекос тактовых деревьев.

    **set_bus_skew.** Ограничение задержки не мешает одному разряду прийти через 1 нс, а другому – через 7,9 нс. \`set_bus_skew\` ограничивает именно разброс времён прихода разрядов к первой ступени – главное условие корректности для шины в коде Грея. Значение – наименьший из двух периодов, как в макросе XPM_CDC_GRAY. Это не исключение, а отдельная проверка: её результаты показывает отчёт \`report_bus_skew\`.

    **Готовое решение.** Макрос \`xpm_cdc_gray\` (и асинхронное FIFO \`xpm_fifo_async\`) содержит синхронизатор и создаёт ровно такие ограничения автоматически. Самописные схемы приходится ограничивать вручную.

    **Опасность глобальных исключений.** \`set_clock_groups -asynchronous\` и \`set_false_path\` между тактовыми сигналами имеют приоритет над \`set_max_delay\`: если позже кто-то объявит домены асинхронными «на всякий случай», ограничение задержки перестанет действовать (проверка перекоса останется, но задержка станет неограниченной).

    Типичные ошибки:
    - \`set_false_path\` вместо \`set_max_delay\` – задержка разрядов не ограничена;
    - \`set_max_delay\` без \`-datapath_only\` – анализируется удержание между асинхронными сигналами и учитываются тактовые деревья;
    - значение 10 нс (период приёмника) – за 10 нс указатель источника успевает измениться ещё раз (его период 8 нс);
    - нет \`set_bus_skew\` – разряды могут прийти с разбросом почти в период.

    Проверка в Vivado: \`report_timing -from [get_cells {wptr_gray_reg[0]}] -to [get_cells {wptr_sync1_reg[0]}]\` – требование 8 нс, тактовые деревья не учитываются; \`report_bus_skew\` – проверка перекоса шины; \`report_cdc\` – распознанные синхронизаторы.
  `,
  refs: 'UG903, разделы «Constraining Clock Domain Crossings» и «Set Bus Skew»; UG974, макросы XPM_CDC_GRAY и XPM_FIFO_ASYNC; справочник: «Передача между тактовыми доменами: что ограничивать»',
  tests: [
    { code: 'set src [get_cells {wptr_gray_reg[*]}]\nset dst [get_cells {wptr_sync1_reg[*]}]\nset t_src [get_property PERIOD [get_clocks wr_clk]]\nset t_dst [get_property PERIOD [get_clocks rd_clk]]\nset_max_delay -datapath_only -from $src -to $dst $t_src\nset_bus_skew -from $src -to $dst [expr {min($t_src, $t_dst)}]\nset_property ASYNC_REG TRUE [get_cells {wptr_sync*_reg[*]}]', pass: true, note: 'значения из свойств тактовых сигналов, как в XPM' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_max_delay 8 -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_pins {wptr_sync1_reg[*]/D}]\nset_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8', pass: true, note: 'set_max_delay на выводы D' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_false_path -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}]\nset_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000', pass: false, note: 'ложный путь вместо ограничения задержки', expect: 'ошибочно объявлен ложным' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_max_delay -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000\nset_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000', pass: false, note: 'нет -datapath_only', expect: 'проверка должна быть отключена \\(-datapath_only\\)' },
    { code: 'set_clock_groups -asynchronous -group [get_clocks wr_clk] -group [get_clocks rd_clk]\nset_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000\nset_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000', pass: false, note: 'асинхронные группы перекрывают set_max_delay', expect: 'ошибочно объявлены асинхронными' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000', pass: false, note: 'нет set_bus_skew', expect: 'Не задано: set_bus_skew' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {wptr_sync1_reg[*] wptr_sync2_reg[*]}]\nset_max_delay -datapath_only -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 10.000\nset_bus_skew -from [get_cells {wptr_gray_reg[*]}] -to [get_cells {wptr_sync1_reg[*]}] 8.000', pass: false, note: 'период приёмника вместо периода источника', expect: 'неверное значение set_max_delay' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'cdc.xpm_trap', module: 'cdc', order: 3, level: 3, tool: 'vivado',
  lang: 'xdc', langNote: 'Макросы XPM и их ограничения – особенность Vivado; сам принцип (глобальные группы перекрывают адресные ограничения) верен и для SDC.',
  title: 'Найдите ошибку: set_clock_groups отменяет ограничения XPM',
  tags: ['set_clock_groups', 'XPM_FIFO_ASYNC', 'приоритет исключений', 'найдите ошибку'],
  text: `
    В проекте два независимых тактовых сигнала: \`clk_a\` (**100 МГц**) и \`clk_b\` (**125 МГц**). Данные между ними передаются через асинхронное FIFO \`u_fifo\` – макрос XPM_FIFO_ASYNC. Указатели FIFO в коде Грея проходят через синхронизаторы внутри макроса, и макрос сам добавляет для них ограничения \`set_max_delay -datapath_only\` и \`set_bus_skew\`. Они показаны в блоке «Уже в проекте»; имена регистров упрощены, на схеме показан только указатель записи (указатель чтения передаётся в обратном направлении так же).

    Кроме того, разработчик сделал собственный двухтриггерный синхронизатор признака \`flag_reg\` → \`flag_sync_reg[0]\` → \`flag_sync_reg[1]\`; свойство ASYNC_REG для него уже задано. Чтобы «убрать междоменные нарушения», он добавил в свой XDC-файл одну команду – она в редакторе.

    **Задание.** Исправьте пользовательские ограничения: ограничения макроса должны действовать, а путь к первой ступени собственного синхронизатора должен быть исключён из анализа.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС', pad: 40, bw: 860 },
      { id: 'fifo', t: 'boundary', label: 'u_fifo (XPM_FIFO_ASYNC)', x: 218, y: 14, bw: 590, bh: 186 },
      { id: 'pa', t: 'in', name: 'clk_a', x: 10, y: 107 },
      { id: 'iba', t: 'ibuf', name: 'clk_a_IBUF_inst', x: 96, y: 104, noName: true },
      { id: 'bga', t: 'bufg', name: 'clk_a_IBUF_BUFG_inst', x: 156, y: 104, noName: true },
      { id: 'pb', t: 'in', name: 'clk_b', x: 10, y: 409 },
      { id: 'ibb', t: 'ibuf', name: 'clk_b_IBUF_inst', x: 96, y: 406, noName: true },
      { id: 'bgb', t: 'bufg', name: 'clk_b_IBUF_BUFG_inst', x: 156, y: 406, noName: true },
      { id: 'wc', t: 'block', name: 'u_fifo/wr_ctl', label: 'wr_ctl', title: 'запись', x: 230, y: 60, bw: 110, bh: 70, pins: [{ n: 'CLK', clk: true, y: 58 }, { n: 'G', d: 'out', w: 4, y: 28 }], timing: { seq: true, clk: 'CLK', launch: { G: ['rise'] } } },
      { id: 'wg', t: 'ff', name: 'u_fifo/wr_gray_reg', label: 'wr_gray_reg[3:0]', w: 4, x: 390, y: 70 },
      { id: 'rs1', t: 'ff', name: 'u_fifo/rd_sync1_reg', label: 'rd_sync1_reg[3:0]', w: 4, x: 560, y: 70 },
      { id: 'rs2', t: 'ff', name: 'u_fifo/rd_sync2_reg', label: 'rd_sync2_reg[3:0]', w: 4, x: 700, y: 70 },
      { id: 'n1', t: 'note', x: 232, y: 168, text: 'указатель чтения rd → wr не показан', box: false },
      { id: 'rg', t: 'ff', name: 'u_fifo/rd_gray_reg', w: 4, x: 0, y: 0, hidden: true },
      { id: 'ws1', t: 'ff', name: 'u_fifo/wr_sync1_reg', w: 4, x: 0, y: 0, hidden: true },
      { id: 'ws2', t: 'ff', name: 'u_fifo/wr_sync2_reg', w: 4, x: 0, y: 0, hidden: true },
      { id: 'app', t: 'block', name: 'u_app', title: 'приложение', x: 230, y: 240, bw: 110, bh: 56, pins: [{ n: 'CLK', clk: true, y: 44 }, { n: 'F', d: 'out', y: 28 }], timing: { seq: true, clk: 'CLK', launch: { F: ['rise'] } } },
      { id: 'fr', t: 'ff', name: 'flag_reg', x: 390, y: 250 },
      { id: 'fs0', t: 'ff', name: 'flag_sync_reg[0]', x: 560, y: 250, nameX: 52 },
      { id: 'fs1', t: 'ff', name: 'flag_sync_reg[1]', x: 700, y: 250, nameX: 52 },
    ],
    wires: [
      { from: 'pa', to: 'iba.I', kind: 'clk' },
      { from: 'iba.O', to: 'bga.I', kind: 'clk' },
      { from: 'pb', to: 'ibb.I', kind: 'clk' },
      { from: 'ibb.O', to: 'bgb.I', kind: 'clk' },
      { from: 'bga.O', to: ['wc.CLK', 'app.CLK', 'fr.C'], kind: 'clk', label: 'clk_a', lx: 300, ly: 322 },
      { from: 'bga.O', to: 'wg.C', kind: 'clk', via: [[210, 145], [370, 145], [370, 128]] },
      { from: 'bga.O', to: ['ws1.C', 'ws2.C'], kind: 'clk' },
      { from: 'bgb.O', to: ['rs1.C', 'fs0.C'], kind: 'clk', mx: 548, label: 'clk_b', lx: 380, ly: 415 },
      { from: 'bgb.O', to: ['rs2.C', 'fs1.C'], kind: 'clk', mx: 688 },
      { from: 'bgb.O', to: 'rg.C', kind: 'clk' },
      { from: 'wc.G', to: 'wg.D', bus: true, bw: 4 },
      { from: 'wg.Q', to: 'rs1.D' },
      { from: 'rs1.Q', to: 'rs2.D' },
      { from: 'rg.Q', to: 'ws1.D' },
      { from: 'ws1.Q', to: 'ws2.D' },
      { from: 'app.F', to: 'fr.D' },
      { from: 'fr.Q', to: 'fs0.D' },
      { from: 'fs0.Q', to: 'fs1.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Приоритет: группы тактовых сигналов перекрывают ограничение задержки', t: [-1, 31],
      signals: [
        { name: 'clk_a 100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_b 125', clock: { period: 8 }, arrows: 'rise' },
        { name: 'с set_max_delay', bit: [], init: 0 },
        { name: 'с set_clock_groups', bit: [], init: 0 },
      ],
      marks: [{ t: 10, label: 'запуск указателя', cls: 'launch' }],
      spans: [{ row: 2, t0: 10, t1: 20, label: 'задержка тракта ≤ 10 нс', cls: 'setup' }, { row: 3, t0: 10, t1: 30, label: 'задержка не ограничена', cls: 'hold' }],
      caption: 'С ограничением макроса указатель записи обязан дойти до первой ступени синхронизатора за период clk_a. После set_clock_groups путь исключён целиком: трассировщик вправе проложить разряды как угодно, и FIFO изредка теряет или дублирует слова.',
    },
  ],
  given: `create_clock -name clk_a -period 10.000 [get_ports clk_a]
create_clock -name clk_b -period 8.000 [get_ports clk_b]
# --- ограничения макроса XPM_FIFO_ASYNC (применяются автоматически) ---
set_max_delay -datapath_only -from [get_cells {u_fifo/wr_gray_reg[*]}] -to [get_cells {u_fifo/rd_sync1_reg[*]}] 10.000
set_bus_skew -from [get_cells {u_fifo/wr_gray_reg[*]}] -to [get_cells {u_fifo/rd_sync1_reg[*]}] 8.000
set_max_delay -datapath_only -from [get_cells {u_fifo/rd_gray_reg[*]}] -to [get_cells {u_fifo/wr_sync1_reg[*]}] 8.000
set_bus_skew -from [get_cells {u_fifo/rd_gray_reg[*]}] -to [get_cells {u_fifo/wr_sync1_reg[*]}] 8.000
set_property ASYNC_REG TRUE [get_cells {u_fifo/rd_sync1_reg[*] u_fifo/rd_sync2_reg[*] u_fifo/wr_sync1_reg[*] u_fifo/wr_sync2_reg[*]}]
# --- синхронизатор признака ---
set_property ASYNC_REG TRUE [get_cells {flag_sync_reg[*]}]`,
  starter: `# домены clk_a и clk_b независимы
set_clock_groups -asynchronous -group [get_clocks clk_a] -group [get_clocks clk_b]`,
  solution: `set_false_path -to [get_cells {flag_sync_reg[0]}]`,
  hints: [
    'Вспомните приоритет исключений: что старше – `set_clock_groups` или `set_max_delay`?',
    'Любое глобальное исключение между `clk_a` и `clk_b` (группы, ложные пути между тактовыми сигналами) отключит и пути указателей FIFO. Исключите только то, что действительно нужно.',
    'Удалите `set_clock_groups` и добавьте `set_false_path -to [get_cells {flag_sync_reg[0]}]`.',
  ],
  explain: `
    \`\`\`
    set_false_path -to [get_cells {flag_sync_reg[0]}]
    \`\`\`
    **Что было не так.** \`set_clock_groups\` – исключение с наивысшим приоритетом, и действует оно на **все** пути между группами в обоих направлениях. Под него попадают и пути указателей FIFO, для которых макрос задал \`set_max_delay -datapath_only\`: после команды разработчика Vivado перестаёт ограничивать их задержку (в \`report_exceptions\` ограничения макроса значатся перекрытыми). Синхронизация указателей в коде Грея корректна, только пока задержки разрядов меньше периода, – без ограничения трассировщик вправе проложить разряд сколь угодно длинным путём. FIFO при этом изредка теряет или дублирует слова, причём ошибка проявляется лишь на отдельных платах, при определённой температуре или после очередной перекомпиляции.

    \`set_bus_skew\` – не исключение, а отдельная проверка: группы её не отменяют, и \`report_bus_skew\` продолжит работать. Но ограничение задержки тракта пропадает, а с ним – и гарантия, что указатель не изменится ещё раз за время пути.

    **Как правильно.** Убрать глобальное исключение и исключить адресно только вход собственного синхронизатора. Пути внутри макроса ограничены его собственными командами; пути \`clk_a → clk_b\`, о которых разработчик не подумал, после этого будут видны в отчётах как *Timed (unsafe)* – и это полезно: каждую такую передачу нужно разобрать и ограничить осознанно.

    То же самое сделала бы пара \`set_false_path\` между тактовыми сигналами в обоих направлениях: ложный путь тоже старше \`set_max_delay\`. Поэтому рекомендация для проектов с XPM_CDC и XPM_FIFO_ASYNC: не объявлять тактовые сигналы асинхронными целиком, а ограничивать собственные передачи адресно (\`set_false_path\` или \`set_max_delay -datapath_only\` до первой ступени синхронизатора).

    Проверка в Vivado: \`report_exceptions\` – ограничения макроса действуют, а не перекрыты; \`report_clock_interaction\` – пары \`clk_a ↔ clk_b\` больше не *Asynchronous Groups*; \`report_cdc\` – обе схемы синхронизации опознаны; \`report_methodology\` (проверки группы TIMING) сообщает о подозрительных междоменных передачах, например о синхронизаторах без ASYNC_REG.
  `,
  refs: 'UG903, разделы «Exceptions Priority» и «Constraining Clock Domain Crossings»; UG974, XPM_FIFO_ASYNC и XPM_CDC; справочник: «Приоритет исключений»',
  tests: [
    { code: 'set_clock_groups -asynchronous -group [get_clocks clk_a] -group [get_clocks clk_b]', pass: false, note: 'исходный код', expect: 'ошибочно объявлены асинхронными' },
    { code: 'set_false_path -from [get_clocks clk_a] -to [get_clocks clk_b]\nset_false_path -from [get_clocks clk_b] -to [get_clocks clk_a]', pass: false, note: 'ложные пути в обоих направлениях', expect: 'ошибочно объявлен ложным' },
    { code: 'set_false_path -from [get_cells flag_reg] -to [get_cells {flag_sync_reg[0]}]', pass: true, note: '-from и -to на ячейки' },
    { code: 'set_false_path -from [get_clocks clk_a] -to [get_cells {flag_sync_reg[0]}]', pass: true, note: '-from тактовый сигнал, -to конкретная ячейка' },
    { code: '# set_clock_groups удалена', pass: false, note: 'группы удалены, синхронизатор не исключён', expect: 'должен быть исключён' },
    { code: 'set_clock_groups -asynchronous -group [get_clocks clk_a]\nset_false_path -to [get_cells {flag_sync_reg[0]}]', pass: false, note: 'одна группа: то же самое', expect: 'ошибочно объявлены асинхронными' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'cdc.related', module: 'cdc', order: 4, level: 2, tool: 'vivado', type: 'choice', multi: true,
  lang: 'both', langNote: 'Рассуждение общее: тактовые сигналы одного PLL связаны и в ПЛИС, и в ASIC.',
  title: 'Связанные домены 100 → 150 МГц: требование 3,333 нс нарушено',
  tags: ['связанные тактовые сигналы', 'MMCM', 'понимание'],
  text: `
    IP-блок Clocking Wizard формирует из одного входного сигнала тактовые сигналы \`clk_a\` (**100 МГц**) и \`clk_b\` (**150 МГц**). Результат обработки из регистров \`src_reg[15:0]\` (домен \`clk_a\`) проходит через комбинационную логику масштабирования и записывается в регистры \`dst_reg[15:0]\` (домен \`clk_b\`).

    Отчёт \`report_timing\` показывает для путей \`src_reg → dst_reg\` требование к предустановке **3,333 нс** и отрицательный запас: задержка логики около 5 нс.

    **Задание.** Выберите все правильные действия.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 10, y: 135 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 96, y: 132, noName: true },
      {
        id: 'm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 150, y: 94, mult: 9, divclk: 1,
        outs: [{ pin: 'CLKOUT0', div: 9, clk: 'clk_a', label: 'CLKOUT0: 100 МГц' }, { pin: 'CLKOUT1', div: 6, clk: 'clk_b', label: 'CLKOUT1: 150 МГц' }],
      },
      { id: 'ba', t: 'bufg', name: 'u_clk/clkout0_buf', x: 360, y: 84, noName: true },
      { id: 'bb', t: 'bufg', name: 'u_clk/clkout1_buf', x: 360, y: 204, noName: true },
      { id: 'rs', t: 'ff', name: 'src_reg', w: 16, x: 450, y: 40 },
      { id: 'lg', t: 'logic', name: 'scale', w: 16, label: 'масштаб', x: 560, y: 35 },
      { id: 'rd', t: 'ff', name: 'dst_reg', w: 16, x: 700, y: 40 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'm.CLKIN1', kind: 'clk' },
      { from: 'm.CLKOUT0', to: 'ba.I', kind: 'clk' },
      { from: 'm.CLKOUT1', to: 'bb.I', kind: 'clk' },
      { from: 'ba.O', to: 'rs.C', kind: 'clk', label: 'clk_a' },
      { from: 'bb.O', to: 'rd.C', kind: 'clk', mx: 680, label: 'clk_b' },
      { from: 'rs.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'rd.D' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Тактовые сигналы одного MMCM: худшая пара фронтов', t: [-1, 21.5],
      signals: [
        { name: 'clk_a 100', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_b 150', clock: { period: 20 / 3 }, arrows: 'rise' },
        { name: 'src_reg → dst_reg', bit: [], init: 0 },
      ],
      marks: [{ t: 10, label: 'запуск', cls: 'launch' }, { t: 40 / 3, label: 'захват', cls: 'capture' }],
      spans: [{ row: 2, t0: 10, t1: 40 / 3, label: '3,333 нс', cls: 'setup' }, { row: 2, t0: 10, t1: 15, label: 'задержка логики ≈ 5 нс', cls: 'data' }],
      windows: [{ row: 2, t0: 40 / 3, t1: 15, label: 'нарушение', cls: 'bad' }],
      caption: 'Фазы сигналов жёстко связаны, и пара фронтов 10 нс → 13,333 нс повторяется каждые 20 нс. Это реальное требование: данные, запущенные фронтом clk_a в 10 нс, захватываются фронтом clk_b в 13,333 нс.',
    },
  ],
  hints: [
    'Связаны ли тактовые сигналы, полученные от одного MMCM? Отражает ли требование 3,333 нс реальное поведение схемы?',
    'Правильное действие либо меняет схему, либо точно описывает её реальное поведение. «Спрятать» путь из отчёта – не решение.',
  ],
  options: [
    { text: 'Объявить тактовые сигналы асинхронными: `set_clock_groups -asynchronous -group clk_a -group clk_b`.', why: 'Неверно. Сигналы одного MMCM синхронны, и путь действительно должен укладываться в 3,333 нс. Группы лишь уберут нарушение из отчёта, а в аппаратуре данные будут захватываться с ошибками; к тому же 16-разрядная шина без синхронизатора некорректна и как асинхронная передача.' },
    { text: 'Если источник обновляет данные не чаще одного раза за несколько тактов и приёмник захватывает их по сигналу разрешения в согласованный момент, описать путь многотактным: `set_multicycle_path` с парной командой `-hold` и правильной опцией `-start`/`-end`.', ok: true, why: 'Верно при выполнении условия: многотактный путь описывает реальное поведение схемы. Без такой гарантии в логике проекта это было бы сокрытием ошибки.' },
    { text: 'Изменить проект: перенести логику масштабирования в один из доменов (до регистра-источника или после регистра-приёмника), чтобы между доменами остался прямой путь «регистр → регистр».', ok: true, why: 'Верно. Прямой путь между регистрами легко укладывается в 3,333 нс, а логика получает полный период своего тактового сигнала. Это основной способ исправления.' },
    { text: 'Увеличить период в `create_clock` (или задать тактовые сигналы MMCM вручную с большим периодом), чтобы требование стало больше.', why: 'Неверно. Ограничения должны описывать реальные частоты: отчёт станет «зелёным», а схема будет работать на прежней частоте с нарушениями. Тактовые сигналы MMCM Vivado выводит сам из настроек блока.' },
    { text: 'Поставить на каждый разряд шины двухтриггерный синхронизатор и исключить пути `set_false_path`.', why: 'Неверно. Для связанных тактовых сигналов синхронизатор не нужен, а для многоразрядных данных он и вовсе ошибочен: разряды могут пройти синхронизатор в разных тактах, и приёмник увидит значение, которого не было.' },
  ],
  explain: `
    Тактовые сигналы одного MMCM **связаны**: их фазы жёстко заданы, и на общем периоде 20 нс пара фронтов 10 нс → 13,333 нс повторяется всегда. Требование 3,333 нс – не артефакт анализа, а реальное время, которое схема отводит на путь. Поэтому любые способы «спрятать» путь (группы, ложный путь, неверный период) оставляют ошибку в аппаратуре.

    Правильные пути решения:
    1. **Изменить схему** – вынести логику по одну сторону границы доменов, добавить конвейерный регистр. Это основной вариант.
    2. **Многотактный путь** – только если логика проекта гарантирует, что данные неизменны несколько тактов, а приёмник захватывает их в известный момент (сигнал разрешения, синхронный с фазой тактовых сигналов). Для 100 → 150 МГц соотношение не кратное, и согласовать момент захвата сложнее, чем для 50 → 200 МГц: нужно аккуратно выбрать множители и опции \`-start\`/\`-end\`.

    Асинхронные приёмы (синхронизаторы, асинхронное FIFO, \`set_clock_groups\`) предназначены для независимых тактовых сигналов. Для связанных они либо не нужны, либо маскируют реальные нарушения. Исключение – когда соотношение частот неудобно и проще работать через асинхронное FIFO; тогда ограничения задаёт сам макрос FIFO, а глобальные группы по-прежнему не нужны.

    Проверка: \`report_clock_interaction\` показывает пару \`clk_a → clk_b\` как *Timed* (без пометки unsafe) – сигналы связаны; \`report_timing -from [get_cells {src_reg[0]}] -to [get_cells {dst_reg[0]}]\` – требование 3,333 нс.
  `,
  refs: 'UG903, раздел «Clock Relationships»; UG949, рекомендации по путям между синхронными доменами; справочник: «Соотношение фронтов»',
});
