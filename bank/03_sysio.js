/* Модуль 3. Системно-синхронный ввод/вывод (Vivado XDC) */
XT.bank.module({
  id: 'sysio', order: 30, title: '3. Системно-синхронный ввод/вывод',
  about: 'Общий генератор для ПЛИС и внешних микросхем: задержки ввода/вывода с учётом трасс тактового сигнала, асинхронные входы и медленные выходы, комбинационный путь через ПЛИС, виртуальный тактовый сигнал',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.adc_in', module: 'sysio', order: 1, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Формулы и команды задержек ввода одинаковы для ПЛИС и для кристалла ASIC: задержки описывают внешнюю сторону.',
  title: 'Вход параллельного АЦП от общего генератора',
  tags: ['set_input_delay', 'системно-синхронный интерфейс', 'АЦП'],
  text: `
    Параллельный 12-разрядный АЦП с выходом КМОП и ПЛИС тактируются от общего генератора **50 МГц**. Сигнал генератора размножает буфер-разветвитель на плате: один его выход подключён ко входу CLK АЦП, другой – к выводу \`clk50\` ПЛИС. АЦП выдаёт очередной отсчёт по фронту своего тактового сигнала, а ПЛИС захватывает разряды \`adc_d[11:0]\` следующим фронтом в регистры \`adc_d_reg\`, размещённые в блоках ввода/вывода (IOB).

    | Параметр | Мин. | Макс. |
    |---|---|---|
    | Tco – задержка АЦП от фронта CLK до выхода данных | 2,0 нс | 6,5 нс |
    | Tcd – трасса тактового сигнала от буфера до АЦП | 0,9 нс | 1,1 нс |
    | Tcf – трасса тактового сигнала от буфера до ПЛИС | 0,6 нс | 0,8 нс |
    | Td – трасса данных от АЦП до ПЛИС | 0,7 нс | 1,0 нс |

    Перекос между выходами буфера-разветвителя пренебрежимо мал: задержка буфера одинаково входит в оба тактовых сигнала и в расчёт не попадает. Тактовый сигнал \`clk50\` уже описан на входном порту (блок «Уже в проекте»).

    **Задание.** Опишите задержки ввода для шины \`adc_d[11:0]\`: самый поздний момент появления новых данных и самый ранний момент изменения данных относительно фронта тактового сигнала **на выводе ПЛИС**.
  `,
  design: {
    elements: [
      { id: 'adc', t: 'chip', name: 'АЦП 12 бит', x: 176, y: 0, bw: 112, bh: 84, ext: true, pins: [{ n: 'D[11:0]', side: 'r', y: 40 }, { n: 'CLK', side: 'l', y: 62, clk: true }] },
      { id: 'cb', t: 'chip', name: 'Буфер', x: 52, y: 136, bw: 78, bh: 74, ext: true, pins: [{ n: 'IN', side: 'l', y: 46 }, { n: 'Q0', side: 'r', y: 32 }, { n: 'Q1', side: 'r', y: 56 }] },
      { id: 'osc', t: 'osc', x: 0, y: 162, label: '50 МГц', ext: true },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pd', t: 'in', name: 'adc_d', w: 12, x: 380, y: 29 },
      { id: 'ibd', t: 'ibuf', name: 'adc_d_IBUF[%]_inst', w: 12, x: 500, y: 26, noName: true },
      { id: 'r', t: 'ff', name: 'adc_d_reg', w: 12, x: 572, y: 22, tag: 'IOB', tagY: 30 },
      { id: 'lg', t: 'logic', name: 'proc', w: 12, label: 'обработка', bw: 72, x: 666, y: 17 },
      { id: 'pc', t: 'in', name: 'clk50', x: 380, y: 181 },
      { id: 'ibc', t: 'ibuf', name: 'clk50_IBUF_inst', x: 452, y: 178, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk50_IBUF_BUFG_inst', x: 506, y: 178, noName: true },
    ],
    wires: [
      { from: 'osc.out', to: 'cb.IN', kind: 'clk', dash: true },
      { from: 'cb.Q0', to: 'adc.CLK', kind: 'clk', dash: true, mx: 154, label: 'Tcd 0,9…1,1', lx: 220, ly: 113 },
      { from: 'cb.Q1', to: 'pc.pad', kind: 'clk', dash: true, label: 'Tcf 0,6…0,8', lx: 245 },
      { from: 'adc.D[11:0]', to: 'pd.pad', bus: true, bw: 12, label: 'Td 0,7…1,0', below: true, lx: 321 },
      { from: 'pd', to: 'ibd.I' },
      { from: 'ibd.O', to: 'r.D' },
      { from: 'r.Q', to: 'lg.I' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Один и тот же фронт генератора в разных точках платы', t: [-1, 23],
      signals: [
        { name: 'генератор', clock: { period: 20 }, arrows: 'rise' },
        { name: 'CLK АЦП', clock: { period: 20, rise: 1.0, fall: 11.0, jitter: 0.2 }, arrows: 'rise' },
        { name: 'D на выходе АЦП', bus: [[2.9, 7.6, 'D1']], init: 'D0' },
        { name: 'adc_d на ПЛИС', bus: [[3.6, 8.6, 'D1']], init: 'D0' },
        { name: 'clk50 на ПЛИС', clock: { period: 20, rise: 0.7, fall: 10.7, jitter: 0.2 }, arrows: 'rise', cls: 'capture' },
      ],
      marks: [{ t: 0, label: 'генератор' }, { t: 0.6, label: 'опорный фронт (0)', cls: 'launch' }, { t: 20.6, label: 'захват', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 1.1, label: 'Tcd ≤ 1,1', cls: 'clk' },
        { row: 2, t0: 1.1, t1: 7.6, label: 'Tco max 6,5', cls: 'data' },
        { row: 3, t0: 7.6, t1: 8.6, label: 'Td ≤ 1,0', cls: 'data' },
        { row: 3, t0: 0.6, t1: 8.6, label: '-max = 8,0 нс', cls: 'setup' },
        { row: 3, t0: 0.8, t1: 3.6, label: '-min = 2,8 нс', cls: 'hold' },
        { row: 4, t0: 0, t1: 0.6, label: 'Tcf ≥ 0,6', cls: 'clk' },
      ],
      caption: 'Заштрихованы интервалы неопределённости. Новые данные появляются на выводе ПЛИС через 3,6…8,6 нс после фронта генератора, а сам фронт приходит на ПЛИС через 0,6…0,8 нс. Задержка ввода отсчитывается от фронта на выводе ПЛИС: наихудшие сочетания дают 8,0 нс (-max) и 2,8 нс (-min).',
    },
  ],
  given: `create_clock -name clk50 -period 20.000 [get_ports clk50]`,
  solution: `set_input_delay -clock clk50 -max 8.000 [get_ports {adc_d[*]}]
set_input_delay -clock clk50 -min 2.800 [get_ports {adc_d[*]}]`,
  hints: [
    'Момент 0 для задержки ввода – фронт тактового сигнала в точке его определения, то есть на выводе `clk50` ПЛИС, а не на выходе генератора.',
    'Данные проходят путь «буфер → АЦП → трасса данных», а опорный фронт – путь «буфер → ПЛИС». Задержка ввода – разность этих путей. Для -max возьмите поздние составляющие пути данных и раннее прибытие тактового сигнала в ПЛИС, для -min – наоборот.',
    '-max = Tcd_max + Tco_max + Td_max − Tcf_min; -min = Tcd_min + Tco_min + Td_min − Tcf_max.',
  ],
  explain: `
    \`\`\`
    set_input_delay -clock clk50 -max 8.000 [get_ports {adc_d[*]}]
    set_input_delay -clock clk50 -min 2.800 [get_ports {adc_d[*]}]
    \`\`\`
    **Точка отсчёта.** Тактовый сигнал \`clk50\` определён на порту ПЛИС, поэтому задержки ввода отсчитываются от фронта на выводе ПЛИС. Этот фронт приходит от генератора через Tcf, а данные – через Tcd + Tco + Td. Задержка ввода равна разности: \`Tcd + Tco + Td − Tcf\`.

    **Подстановка.**
    - -max (проверка предустановки): данные как можно позже, опорный фронт как можно раньше: 1,1 + 6,5 + 1,0 − 0,6 = **8,0 нс**;
    - -min (проверка удержания): данные как можно раньше, опорный фронт как можно позже: 0,9 + 2,0 + 0,7 − 0,8 = **2,8 нс**.

    **Что получит анализ.** Захват выполняется следующим фронтом: требование к предустановке равно периоду, 20 нс. На тракт внутри ПЛИС (входной буфер, трасса до регистра в IOB, время предустановки регистра с поправкой на задержку тактового дерева) остаётся 20 − 8 = 12 нс. Для удержания данные гарантированно неизменны 2,8 нс после фронта на выводе. Из этого запаса вычитается задержка тактового дерева (IBUF, BUFG, трассировка): фронт приходит на регистр позже, чем на вывод. Хватит ли запаса, покажет проверка удержания после реализации (в ПЛИС 7-й серии ей помогает автоматическая задержка ZHOLD на входе регистра в IOB).

    **Типичные ошибки.**
    - Не учесть трассы тактового сигнала (-max = Tco_max + Td_max = 7,5 нс). Здесь тактовый сигнал приходит на АЦП позже, чем на ПЛИС, поэтому анализ предустановки станет оптимистичным на 0,5 нс: Vivado покажет запас, которого на плате нет.
    - Перепутать -max и -min: проверка предустановки получит 2,8 нс вместо 8,0, проверка удержания – 8,0 вместо 2,8. Обе проверки станут недостоверными, а реальное нарушение удержания будет скрыто.
    - Одно значение без -max/-min: оно применяется и к предустановке, и к удержанию, то есть интервал неопределённости данных (2,8…8,0 нс) сжимается в точку.

    Вместо \`clk50\` можно сослаться на виртуальный тактовый сигнал с тем же периодом (\`create_clock -name adc_vclk -period 20\`): его фронт тоже считается моментом 0 на выводе ПЛИС, и требования получаются те же. Обязательным виртуальный тактовый сигнал становится, когда тактовый сигнал внешней микросхемы не заведён в ПЛИС или отличается от внутреннего частотой и фазой.

    **Проверка в Vivado:** \`report_timing -from [get_ports {adc_d[*]}] -delay_type min_max\` – в отчёте видна строка *input delay* со значениями 8.000 (max) и 2.800 (min); \`check_timing\` не должна сообщать *no_input_delay* или *partial_input_delay*. В ConstraintLab требования видны на вкладке «Анализ путей».
  `,
  refs: 'UG903, глава «Constraining I/O Delay», раздел о системно-синхронных интерфейсах',
  tests: [
    { code: 'create_clock -name adc_vclk -period 20\nset_input_delay -clock adc_vclk -max 8.0 [get_ports {adc_d[*]}]\nset_input_delay -clock adc_vclk -min 2.8 [get_ports {adc_d[*]}]', pass: true, note: 'виртуальный тактовый сигнал с тем же периодом' },
    { code: 'set tcd {0.9 1.1}; set tcf {0.6 0.8}; set tco {2.0 6.5}; set td {0.7 1.0}\nset_input_delay -clock [get_clocks clk50] -max [expr {[lindex $tcd 1] + [lindex $tco 1] + [lindex $td 1] - [lindex $tcf 0]}] [get_ports {adc_d[*]}]\nset_input_delay -clock [get_clocks clk50] -min [expr {[lindex $tcd 0] + [lindex $tco 0] + [lindex $td 0] - [lindex $tcf 1]}] [get_ports {adc_d[*]}]', pass: true, note: 'расчёт через переменные и expr' },
    { code: 'set_input_delay -clock clk50 -max 7.5 [get_ports {adc_d[*]}]\nset_input_delay -clock clk50 -min 2.7 [get_ports {adc_d[*]}]', pass: false, note: 'трассы тактового сигнала не учтены', expect: '-max .*7\\.500 нс – неверно' },
    { code: 'set_input_delay -clock clk50 -max 2.8 [get_ports {adc_d[*]}]\nset_input_delay -clock clk50 -min 8.0 [get_ports {adc_d[*]}]', pass: false, note: 'перепутаны -max и -min', expect: 'перепутаны -max и -min' },
    { code: 'set_input_delay -clock clk50 8.0 [get_ports {adc_d[*]}]', pass: false, note: 'одно значение без -max/-min', expect: '-min .*8\\.000 нс – неверно' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.dac_out', module: 'sysio', order: 2, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Формулы и команды задержек вывода одинаковы для ПЛИС и для кристалла ASIC.',
  title: 'Выход на параллельный ЦАП от общего генератора',
  tags: ['set_output_delay', 'системно-синхронный интерфейс', 'ЦАП'],
  text: `
    Параллельный 14-разрядный ЦАП и ПЛИС тактируются от общего генератора **100 МГц** через буфер-разветвитель. ПЛИС выдаёт отсчёты \`dac_d[13:0]\` из регистров \`dac_d_reg\` (в блоках IOB) по фронту \`sys_clk\`, а ЦАП защёлкивает их следующим фронтом своего входа CLK.

    | Параметр | Значение |
    |---|---|
    | tsu – время предустановки ЦАП относительно фронта CLK | 2,0 нс |
    | th – время удержания ЦАП | 1,5 нс |
    | Tcd – трасса тактового сигнала от буфера до ЦАП | 1,2…1,4 нс |
    | Tcf – трасса тактового сигнала от буфера до ПЛИС | 0,5…0,7 нс |
    | Td – трасса данных от ПЛИС до ЦАП | 0,8…1,1 нс |

    Тактовый сигнал \`sys_clk\` уже описан на входном порту.

    **Задание.** Опишите задержки вывода для шины \`dac_d[13:0]\` относительно фронта \`sys_clk\` на выводе ПЛИС.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: 0, y: 92, label: '100 МГц', ext: true },
      { id: 'cb', t: 'chip', name: 'Буфер', x: 48, y: 66, bw: 70, bh: 74, ext: true, pins: [{ n: 'IN', side: 'l', y: 46 }, { n: 'Q0', side: 'r', y: 32 }, { n: 'Q1', side: 'r', y: 56 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pc', t: 'in', name: 'sys_clk', x: 184, y: 87 },
      { id: 'ibc', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 270, y: 84, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 318, y: 84, noName: true },
      { id: 'gen', t: 'logic', name: 'u_dds/sample', w: 14, label: 'отсчёты', bw: 70, x: 280, y: 6 },
      { id: 'r', t: 'ff', name: 'dac_d_reg', w: 14, x: 388, y: 11, tag: 'IOB', tagY: 30 },
      { id: 'ob', t: 'obuf', name: 'dac_d_OBUF[%]_inst', w: 14, x: 474, y: 15, noName: true },
      { id: 'pd', t: 'out', name: 'dac_d', w: 14, x: 524, y: 18 },
      { id: 'dac', t: 'chip', name: 'ЦАП 14 бит', x: 700, y: 0, bw: 84, bh: 110, ext: true, pins: [{ n: 'D[13:0]', side: 'l', y: 29 }, { n: 'CLK', side: 'l', y: 80, clk: true }] },
      { id: 'n1', t: 'note', x: 700, y: 120, text: 'tsu 2,0 нс\nth 1,5 нс' },
    ],
    wires: [
      { from: 'osc.out', to: 'cb.IN', kind: 'clk', dash: true },
      { from: 'cb.Q0', to: 'pc.pad', kind: 'clk', dash: true, label: 'Tcf', lx: 138 },
      { from: 'cb.Q1', to: 'dac.CLK', kind: 'clk', dash: true, via: [[136, 178], [688, 178]], label: 'Tcd 1,2…1,4 нс' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
      { from: 'gen.O', to: 'r.D' },
      { from: 'r.Q', to: 'ob.I' },
      { from: 'ob.O', to: 'pd' },
      { from: 'pd.pad', to: 'dac.D[13:0]', label: 'Td', below: true },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Допустимый интервал смены данных на выходе ПЛИС', t: [-1.5, 12.5],
      signals: [
        { name: 'sys_clk на ПЛИС', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'dac_d на ПЛИС', bus: [[1.6, 7.4, 'D1']], init: 'D0' },
        { name: 'dac_d на ЦАП', bus: [[2.4, 8.5, 'D1']], init: 'D0' },
        { name: 'CLK ЦАП', clock: { period: 10, rise: 0.7, fall: 5.7, jitter: 0.4 }, arrows: 'rise', cls: 'capture' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 10, label: 'захват (отсчёт для -max)', cls: 'capture' }],
      windows: [{ row: 2, t0: 0.9, t1: 2.4, label: 'th', cls: 'hold' }, { row: 2, t0: 8.5, t1: 10.5, label: 'tsu', cls: 'setup' }],
      spans: [
        { row: 1, t0: 7.4, t1: 10, label: '-max = 2,6 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 1.6, label: '-min = −1,6 нс', cls: 'hold' },
        { row: 2, t0: 7.4, t1: 8.5, label: 'Td ≤ 1,1', cls: 'data' },
        { row: 3, t0: 0, t1: 0.9, label: 'сдвиг ≤ 0,9', cls: 'clk' },
        { row: 3, t0: 10, t1: 10.5, label: 'сдвиг ≥ 0,5', cls: 'clk' },
      ],
      caption: 'Время отсчитывается от фронта на выводе ПЛИС. Фронт на ЦАП отстаёт от него на Tcd − Tcf = 0,5…0,9 нс. Заштрихован интервал, в котором выход ПЛИС может изменяться, не нарушая tsu и th ЦАП: от 1,6 нс после фронта до 2,6 нс перед следующим фронтом.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_output_delay -clock sys_clk -max 2.600 [get_ports {dac_d[*]}]
set_output_delay -clock sys_clk -min -1.600 [get_ports {dac_d[*]}]`,
  hints: [
    'Задержка вывода описывает внешнюю часть пути до регистра-приёмника: -max – сколько времени до фронта захвата нужно данным за пределами ПЛИС (трасса и предустановка), -min – наименьшая внешняя задержка с учётом удержания.',
    'Фронт на ЦАП отстаёт от фронта на выводе ПЛИС на Tcd − Tcf. Для предустановки опасен наименьший сдвиг (захват раньше), для удержания – наибольший (захват позже).',
    '-max = Td_max + tsu − (Tcd_min − Tcf_max); -min = Td_min − th − (Tcd_max − Tcf_min).',
  ],
  explain: `
    \`\`\`
    set_output_delay -clock sys_clk -max 2.600 [get_ports {dac_d[*]}]
    set_output_delay -clock sys_clk -min -1.600 [get_ports {dac_d[*]}]
    \`\`\`
    **Модель.** Vivado считает, что внешний регистр захватывает данные фронтом \`sys_clk\` в точке определения – на выводе ПЛИС. Задержка вывода описывает всё, что находится снаружи: -max – время, которое данным нужно до этого фронта (трасса плюс предустановка приёмника), -min – самая короткая внешняя задержка за вычетом удержания.

    **Сдвиг фронта захвата.** Фронт приходит на ЦАП через Tcd, на ПЛИС – через Tcf, то есть на ЦАП он запаздывает на Tcd − Tcf = 0,5…0,9 нс. Запаздывание фронта захвата помогает предустановке и мешает удержанию, поэтому оно вычитается из обеих формул.

    **Подстановка.**
    - -max: данные идут к ЦАП как можно дольше, а фронт захвата приходит как можно раньше: 1,1 + 2,0 − (1,2 − 0,7) = **2,6 нс**;
    - -min: данные приходят как можно раньше, а фронт захвата – как можно позже: 0,8 − 1,5 − (1,4 − 0,5) = **−1,6 нс**.

    Отрицательное -min означает, что после фронта на выводе ПЛИС данные должны оставаться неизменными ещё 1,6 нс. Обычно это выполняется само собой за счёт задержки тактового дерева и выходного буфера, но убедиться в этом позволяет только проверка удержания.

    **Типичные ошибки.**
    - Знак -min: значение +1,6 означает «данные могут смениться за 1,6 нс до фронта». Требование к удержанию станет на 3,2 нс мягче реального, и нарушение удержания ЦАП останется незамеченным.
    - Не учесть трассы тактового сигнала (-max = Td_max + tsu = 3,1 нс, -min = Td_min − th = −0,7 нс): -max завышен на 0,5 нс (лишний пессимизм), а проверка удержания станет оптимистичной на 0,9 нс.
    - Применить \`set_input_delay\` к выходному порту: Vivado отвергнет команду, путь к ЦАП останется неограниченным.

    **Проверка в Vivado:** \`report_timing -to [get_ports {dac_d[*]}] -delay_type min_max\` – в отчёте видна строка *output delay*, проверка предустановки выполняется относительно следующего фронта (требование 10 нс), проверка удержания – относительно того же фронта (требование 0 нс); \`check_timing\` не должна сообщать *no_output_delay* или *partial_output_delay*.
  `,
  refs: 'UG903, глава «Constraining I/O Delay», раздел «Output Delay»',
  tests: [
    { code: 'set tsu 2.0\nset th 1.5\nset_output_delay -clock sys_clk -max [expr {1.1 + $tsu - (1.2 - 0.7)}] [get_ports {dac_d[*]}]\nset_output_delay -clock sys_clk -min [expr {0.8 - $th - (1.4 - 0.5)}] [get_ports {dac_d[*]}]', pass: true, note: 'расчёт через expr' },
    { code: 'set_output_delay -clock [get_clocks sys_clk] -min -1.6 [get_ports dac_d*]\nset_output_delay -clock [get_clocks sys_clk] -max 2.6 [get_ports dac_d*]', pass: true, note: 'другой порядок команд и шаблон имени' },
    { code: 'set_output_delay -clock sys_clk -max 2.6 [get_ports {dac_d[*]}]\nset_output_delay -clock sys_clk -min 1.6 [get_ports {dac_d[*]}]', pass: false, note: 'неверный знак -min', expect: 'ошибка в знаке' },
    { code: 'set_output_delay -clock sys_clk -max 3.1 [get_ports {dac_d[*]}]\nset_output_delay -clock sys_clk -min -0.7 [get_ports {dac_d[*]}]', pass: false, note: 'не учтён сдвиг фронта на ЦАП', expect: '-max .*3\\.100 нс – неверно' },
    { code: 'set_input_delay -clock sys_clk -max 2.6 [get_ports {dac_d[*]}]\nset_input_delay -clock sys_clk -min -1.6 [get_ports {dac_d[*]}]', pass: false, note: 'set_input_delay для выходного порта', expect: 'выходной порт' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.slow_io', module: 'sysio', order: 3, level: 1, tool: 'vivado',
  lang: 'xdc', langNote: '`set_false_path` общий для XDC и SDC, а свойство `ASYNC_REG` есть только в Vivado. В ASIC ступени синхронизатора защищают от оптимизации средствами синтеза и проверяют структурным анализом CDC.',
  title: 'Кнопки, светодиоды и UART: что не нужно анализировать',
  tags: ['set_false_path', 'ASYNC_REG', 'синхронизатор'],
  text: `
    На отладочной плате к ПЛИС подключены четыре кнопки \`btn[3:0]\`, восемь светодиодов \`led[7:0]\` и мост USB – UART (линия приёма \`uart_rx\` и линия передачи \`uart_tx\`, 115 200 бит/с). Вся логика работает от тактового сигнала \`sys_clk\` 100 МГц (уже описан).

    Нажатие кнопки и приход бита по UART никак не связаны с фазой \`sys_clk\`, поэтому каждый вход проходит через двухтриггерный синхронизатор: \`btn_meta_reg\` → \`btn_sync_reg\` и \`rx_meta_reg\` → \`rx_sync_reg\`. Светодиоды и линия \`uart_tx\` управляются регистрами \`led_reg\` и \`tx_reg\`: для глаза человека и для приёмника UART (длительность бита 8,68 мкс) задержка в единицы наносекунд значения не имеет.

    **Задание.**
    1. Исключите из временного анализа пути от асинхронных входов \`btn[3:0]\`, \`uart_rx\` и пути к медленным выходам \`led[7:0]\`, \`uart_tx\`.
    2. Отметьте регистры обоих синхронизаторов (обе ступени) свойством, по которому Vivado размещает их вплотную друг к другу и не подвергает оптимизациям.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pb', t: 'in', name: 'btn', w: 4, x: 0, y: 37 },
      { id: 'ibb', t: 'ibuf', name: 'btn_IBUF[%]_inst', w: 4, x: 100, y: 34, noName: true },
      { id: 'bm', t: 'ff', name: 'btn_meta_reg', w: 4, x: 190, y: 30 },
      { id: 'bs', t: 'ff', name: 'btn_sync_reg', w: 4, x: 316, y: 30 },
      { id: 'cl', t: 'logic', name: 'u_ctrl/led_next', w: 8, mix: true, label: 'логика', bw: 76, x: 410, y: 25 },
      { id: 'lr', t: 'ff', name: 'led_reg', w: 8, x: 510, y: 30 },
      { id: 'obl', t: 'obuf', name: 'led_OBUF[%]_inst', w: 8, x: 596, y: 34, noName: true },
      { id: 'pl', t: 'out', name: 'led', w: 8, x: 652, y: 37 },
      { id: 'pr', t: 'in', name: 'uart_rx', x: 0, y: 173 },
      { id: 'ibr', t: 'ibuf', name: 'uart_rx_IBUF_inst', x: 100, y: 170, noName: true },
      { id: 'rm', t: 'ff', name: 'rx_meta_reg', x: 190, y: 166 },
      { id: 'rs', t: 'ff', name: 'rx_sync_reg', x: 316, y: 166 },
      { id: 'ul', t: 'logic', name: 'u_uart/tx_next', label: 'UART', bw: 76, x: 410, y: 161 },
      { id: 'tr', t: 'ff', name: 'tx_reg', x: 510, y: 166 },
      { id: 'obt', t: 'obuf', name: 'uart_tx_OBUF_inst', x: 596, y: 170, noName: true },
      { id: 'pt', t: 'out', name: 'uart_tx', x: 652, y: 173 },
      { id: 'pc', t: 'in', name: 'sys_clk', x: 0, y: 293 },
      { id: 'ibc', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 80, y: 290, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 130, y: 290, noName: true },
    ],
    wires: [
      { from: 'pb', to: 'ibb.I' },
      { from: 'ibb.O', to: 'bm.D' },
      { from: 'bm.Q', to: 'bs.D' },
      { from: 'bs.Q', to: 'cl.I' },
      { from: 'cl.O', to: 'lr.D' },
      { from: 'lr.Q', to: 'obl.I' },
      { from: 'obl.O', to: 'pl' },
      { from: 'pr', to: 'ibr.I' },
      { from: 'ibr.O', to: 'rm.D' },
      { from: 'rm.Q', to: 'rs.D' },
      { from: 'rs.Q', to: 'ul.I' },
      { from: 'ul.O', to: 'tr.D' },
      { from: 'tr.Q', to: 'obt.I' },
      { from: 'obt.O', to: 'pt' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'rm.C', kind: 'clk', via: [[178, 304]] },
      { from: 'bg.O', to: 'bm.C', kind: 'clk', via: [[178, 304]] },
      { from: 'bg.O', to: 'rs.C', kind: 'clk', via: [[304, 304]] },
      { from: 'bg.O', to: 'bs.C', kind: 'clk', via: [[304, 304]] },
      { from: 'bg.O', to: 'tr.C', kind: 'clk', via: [[498, 304]], label: 'sys_clk', lx: 401, ly: 299 },
      { from: 'bg.O', to: 'lr.C', kind: 'clk', via: [[498, 304]] },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Асинхронный вход: фаза относительно sys_clk случайна', t: [-2, 42],
      signals: [
        { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise' },
        { name: 'btn[0] (вывод)', bit: [[19.7, 19.7, 1]], init: 0 },
        { name: 'btn_meta_reg', bit: [[20, 24, 1]], init: 0, unc: true },
        { name: 'btn_sync_reg', bit: [[30, 30, 1]], init: 0 },
      ],
      marks: [{ t: 19.7, label: 'нажатие (в любой момент)' }, { t: 20, label: 'захват', cls: 'capture' }, { t: 30, label: 'вторая ступень', cls: 'capture' }],
      windows: [{ row: 1, t0: 19.4, t1: 20.4, cls: 'bad' }, { row: 2, t0: 20, t1: 30, label: 'время на успокоение ≈ T', cls: 'clk' }],
      spans: [{ row: 2, t0: 20, t1: 24, label: 'метастабильность', cls: 'hold' }],
      caption: 'Момент нажатия может попасть в окно предустановки и удержания первого регистра (выделено красным) – тогда он на время переходит в метастабильное состояние. Статический временной анализ этого не предотвращает: надёжность обеспечивает вторая ступень, которой отведён целый период на успокоение первой. Чем ближе регистры друг к другу, тем больше этого времени остаётся.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_false_path -from [get_ports {btn[*] uart_rx}]
set_false_path -to [get_ports {led[*] uart_tx}]
set_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]`,
  hints: [
    'Для асинхронного входа не существует «правильного» значения set_input_delay: его фаза относительно sys_clk случайна. Такие пути исключают из анализа командой `set_false_path`.',
    'Входы: `set_false_path -from [get_ports …]`; выходы: `set_false_path -to [get_ports …]`.',
    'Регистры синхронизатора отмечают свойством `ASYNC_REG`: `set_property ASYNC_REG TRUE [get_cells {…}]` – на обеих ступенях.',
  ],
  explain: `
    \`\`\`
    set_false_path -from [get_ports {btn[*] uart_rx}]
    set_false_path -to [get_ports {led[*] uart_tx}]
    set_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]
    \`\`\`
    **Почему эти пути не анализируют.** Статический временной анализ проверяет пути, у которых момент запуска жёстко связан с фронтом тактового сигнала. Нажатие кнопки (с дребезгом в единицы миллисекунд) и бит UART длительностью 8,68 мкс приходят в произвольный момент, и любое значение \`set_input_delay\` было бы вымыслом: Vivado получил бы требование, не отражающее ничего реального, и мог бы тратить усилия на «нарушения» или скрыть настоящие проблемы. Корректность такого входа обеспечивает синхронизатор, а не анализ. Для выходов на светодиоды и \`uart_tx\` задержка в наносекунды несущественна, поэтому ограничивать их тоже незачем.

    **Почему не set_input_delay с нулём.** Нулевая задержка относительно \`sys_clk\` утверждает, что кнопка переключается точно по фронту \`sys_clk\`, – это ложь. Путь станет анализируемым, а результат анализа – бессмысленным.

    **Зачем ASYNC_REG.**
    - Регистры синхронизатора размещаются в одном слайсе вплотную: задержка между ступенями минимальна, и на успокоение метастабильного первого регистра остаётся почти весь период. От этого времени экспоненциально зависит среднее время между отказами (MTBF).
    - Синтез и размещение не объединяют ступени в сдвиговый регистр SRL, не дублируют и не перемещают их.
    - Свойство нужно на **обеих** ступенях (и на третьей, если она есть): именно пара регистров образует синхронизатор.

    **Типичные ошибки.**
    - Нет \`ASYNC_REG\` или оно задано только на первой ступени: регистры могут оказаться далеко друг от друга, MTBF падает, а при оптимизации пара может превратиться в SRL с плохой устойчивостью к метастабильности.
    - Исключены только входы: выходы на светодиоды и \`uart_tx\` остаются неограниченными портами, которые в отчётах выглядят как забытые.
    - Синхронизатор без исключения: путь от порта к \`btn_meta_reg\` остаётся неограниченным, но любое общее ограничение \`set_input_delay … [all_inputs]\` сделает его анализируемым и бессмысленным.

    Равноценно исключить входные пути по конечным точкам: \`set_false_path -to [get_cells {btn_meta_reg[*] rx_meta_reg}]\`. Путь \`btn_meta_reg → btn_sync_reg\` при этом остаётся обычным синхронным путём внутри домена \`sys_clk\` и анализируется.

    **Проверка в Vivado:** \`report_exceptions\` показывает действующие ложные пути; \`report_property [get_cells btn_sync_reg[0]]\` – значение ASYNC_REG; \`report_cdc\` и (для UltraScale) \`report_synchronizer_mtbf\` распознают синхронизаторы по этому свойству.
  `,
  refs: 'UG903, глава «Constraining I/O Delay» и раздел о set_false_path; UG912, свойство ASYNC_REG',
  tests: [
    { code: 'set_false_path -from [get_ports {btn[*] uart_rx}]\nset_false_path -to [get_ports {led[*] uart_tx}]', pass: false, note: 'нет ASYNC_REG', expect: 'Не задано свойство ASYNC_REG' },
    { code: 'set_false_path -from [get_ports {btn[*] uart_rx}]\nset_false_path -to [get_ports {led[*] uart_tx}]\nset_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] rx_meta_reg}]', pass: false, note: 'ASYNC_REG только на первой ступени', expect: 'ASYNC_REG' },
    { code: 'set_false_path -from [get_ports {btn[*] uart_rx}]\nset_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]', pass: false, note: 'ложные пути только для входов', expect: 'без ограничений' },
    { code: 'set_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]', pass: false, note: 'только ASYNC_REG, пути не исключены', expect: 'без ограничений' },
    { code: 'set_false_path -from [get_ports {btn[0]}]\nset_false_path -from [get_ports {btn[1]}]\nset_false_path -from [get_ports {btn[2]}]\nset_false_path -from [get_ports {btn[3]}]\nset_false_path -from [get_ports uart_rx]\nset_false_path -to [get_ports {led[*]}]\nset_false_path -to [get_ports uart_tx]\nset_property ASYNC_REG TRUE [get_cells -hierarchical *_meta_reg*]\nset_property ASYNC_REG TRUE [get_cells -hierarchical *_sync_reg*]', pass: true, note: 'отдельные команды для каждого порта' },
    { code: 'set_false_path -to [get_cells {btn_meta_reg[*] rx_meta_reg}]\nset_false_path -to [all_outputs]\nset_property -dict {ASYNC_REG TRUE} [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]', pass: true, note: 'исключение входов по конечным точкам' },
    { code: 'set_input_delay -clock sys_clk 0 [get_ports {btn[*] uart_rx}]\nset_false_path -to [get_ports {led[*] uart_tx}]\nset_property ASYNC_REG TRUE [get_cells {btn_meta_reg[*] btn_sync_reg[*] rx_meta_reg rx_sync_reg}]', pass: false, note: 'нулевая задержка ввода вместо ложного пути', expect: 'Лишняя set_input_delay' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.feedthrough', module: 'sysio', order: 4, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`set_max_delay` между портами одинаково записывается в XDC и SDC.',
  title: 'Комбинационный путь через ПЛИС без тактового сигнала',
  tags: ['set_max_delay', 'комбинационный путь'],
  text: `
    ПЛИС стоит между процессором и периферийной микросхемой и пропускает четыре сигнала управления: \`ctl_in[3:0]\` → входные буферы → логика взаимной блокировки на LUT (каждый выход зависит от всех четырёх входов) → выходные буферы → \`ctl_out[3:0]\`. Регистров и тактовых сигналов на этом пути нет.

    По временной диаграмме обмена процессора с периферийной микросхемой на прохождение сигнала через ПЛИС – от любого вывода \`ctl_in\` до любого вывода \`ctl_out\` – отведено не более **7,0 нс**.

    **Задание.** Ограничьте задержку этого комбинационного пути.
  `,
  design: {
    elements: [
      { id: 'cpu', t: 'chip', name: 'Процессор', x: 0, y: 14, bw: 84, bh: 64, ext: true, pins: [{ n: 'CTL[3:0]', side: 'r', y: 34 }] },
      { id: 'per', t: 'chip', name: 'Периферия', x: 690, y: 14, bw: 84, bh: 64, ext: true, pins: [{ n: 'CTL[3:0]', side: 'l', y: 34 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pi', t: 'in', name: 'ctl_in', w: 4, x: 156, y: 37 },
      { id: 'ibi', t: 'ibuf', name: 'ctl_in_IBUF[%]_inst', w: 4, x: 270, y: 34, noName: true },
      { id: 'lk', t: 'logic', name: 'ctl_out_OBUF[%]_inst_i_1', w: 4, mix: true, label: 'блокировка', bw: 100, x: 330, y: 25 },
      { id: 'obo', t: 'obuf', name: 'ctl_out_OBUF[%]_inst', w: 4, x: 456, y: 34, noName: true },
      { id: 'po', t: 'out', name: 'ctl_out', w: 4, x: 512, y: 37 },
      { id: 'n1', t: 'note', x: 250, y: 112, text: 'ctl_in → ctl_out: не более 7,0 нс' },
    ],
    wires: [
      { from: 'cpu.CTL[3:0]', to: 'pi.pad', bus: true, bw: 4 },
      { from: 'pi', to: 'ibi.I' },
      { from: 'ibi.O', to: 'lk.I' },
      { from: 'lk.O', to: 'obo.I' },
      { from: 'obo.O', to: 'po' },
      { from: 'po.pad', to: 'per.CTL[3:0]' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Бюджет комбинационного пути', t: [-1, 11],
      signals: [
        { name: 'ctl_in[i]', bit: [[0, 0.3, 1]], init: 0 },
        { name: 'ctl_out[j]', bit: [[5.2, 5.5, 1]], init: 0, unc: true },
      ],
      marks: [{ t: 0, label: 'изменение входа', cls: 'launch' }, { t: 7, label: 'предел 7,0 нс', cls: 'capture' }],
      windows: [{ row: 1, t0: 0, t1: 7, label: 'допустимо', cls: 'valid' }, { row: 1, t0: 7, t1: 11, label: 'нарушение', cls: 'bad' }],
      spans: [{ row: 1, t0: 0, t1: 7, label: 'set_max_delay 7.0', cls: 'setup' }],
      caption: 'Тактового сигнала нет: требование задаётся непосредственно как предельная задержка от входного порта до выходного. В нём учитываются входной буфер, трассировка, LUT и выходной буфер.',
    },
  ],
  solution: `set_max_delay 7.000 -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}]`,
  hints: [
    'Задержки ввода/вывода задаются относительно тактового сигнала, а здесь его нет. Нужна команда, которая задаёт предельную задержку пути напрямую.',
    'Синтаксис: `set_max_delay <нс> -from <начальные точки> -to <конечные точки>`. Начальные точки – входные порты, конечные – выходные.',
  ],
  explain: `
    \`\`\`
    set_max_delay 7.000 -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}]
    \`\`\`
    **Почему не set_input_delay/set_output_delay.** Эти команды привязывают внешнюю часть пути к фронту тактового сигнала. На комбинационном пути «порт → порт» тактовых сигналов нет, и без исключения пути остаются неограниченными: Vivado относит их к *Unconstrained Paths*, а \`check_timing\` сообщает *no_input_delay* и *no_output_delay*.

    **Что делает set_max_delay.** Команда задаёт требование напрямую: суммарная задержка от входного порта до выходного (IBUF, трассировка, LUT, OBUF) не должна превышать 7,0 нс. Здесь анализируются 16 путей: каждый вход влияет на каждый выход через логику блокировки. Опция \`-datapath_only\` не нужна: тактовых сигналов нет, и учитывать перекос нечего.

    **Типичные ошибки.**
    - \`set_false_path\` вместо ограничения: путь исключается из анализа, трассировщик может провести его сколь угодно длинным, и система откажет уже на плате.
    - Перепутанные -from и -to: выходные порты не могут быть начальными точками, Vivado отбрасывает такие объекты, и исключение не действует – путь снова неограничен.
    - Неверное значение (например, с повторным вычитанием задержек трасс, уже учтённых в бюджете 7,0 нс).

    Если бы системе требовалась ещё и наименьшая задержка (например, для удержания на стороне приёмника), её задали бы командой \`set_min_delay\`. Встречается и другой подход – виртуальный тактовый сигнал с \`set_input_delay\`/\`set_output_delay\`, которые «съедают» часть периода. Он оправдан, когда бюджет пути задан относительно тактового сигнала процессора; при прямо заданном пределе \`set_max_delay\` нагляднее и не создаёт лишних проверок удержания.

    **Проверка в Vivado:** \`report_timing -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}] -max_paths 16\` – требование 7.000 нс с пометкой *max delay*; \`report_exceptions\` показывает, что исключение действует на все 16 путей.
  `,
  refs: 'UG903, раздел «set_max_delay»',
  tests: [
    { code: 'set_max_delay 7.0 -to [get_ports {ctl_out[*]}]', pass: true, note: 'только -to: все пути к ctl_out начинаются на ctl_in' },
    { code: 'set_max_delay 7.0 -from [get_ports {ctl_in[*]}] -through [get_cells {ctl_out_OBUF[*]_inst_i_1}] -to [get_ports {ctl_out[*]}]', pass: true, note: 'с промежуточными точками -through' },
    { code: 'set_false_path -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}]', pass: false, note: 'ложный путь вместо ограничения', expect: 'ошибочно объявлен ложным' },
    { code: 'set_max_delay 7.0 -from [get_ports {ctl_out[*]}] -to [get_ports {ctl_in[*]}]', pass: false, note: 'перепутаны -from и -to', expect: 'ПРОИГНОРИРОВАНО' },
    { code: 'set_max_delay 8.0 -from [get_ports {ctl_in[*]}] -to [get_ports {ctl_out[*]}]', pass: false, note: 'неверное значение', expect: 'неверное значение set_max_delay' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.calc', module: 'sysio', order: 5, level: 1, tool: 'vivado', type: 'numeric',
  lang: 'both', langNote: 'Расчёт задержек ввода одинаков для ПЛИС и ASIC.',
  title: 'Расчёт задержек ввода при выровненных трассах тактового сигнала',
  tags: ['set_input_delay', 'расчёт'],
  text: `
    Контроллер с синхронной параллельной шиной и ПЛИС тактируются от общего генератора **40 МГц**. Трассы тактового сигнала до обеих микросхем выровнены по длине, поэтому фронт приходит на них одновременно. Контроллер выдаёт данные \`bus_d[15:0]\` по фронту, ПЛИС захватывает их следующим фронтом.

    | Параметр | Мин. | Макс. |
    |---|---|---|
    | Tco контроллера (фронт → данные на выходе) | 1,5 нс | 5,0 нс |
    | Td – трасса данных от контроллера до ПЛИС | 0,5 нс | 0,9 нс |

    **Задание.** Рассчитайте значения \`-max\` и \`-min\` для команды \`set_input_delay\` относительно тактового сигнала ПЛИС (в наносекундах).
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: 0, y: 106, label: '40 МГц', ext: true },
      { id: 'mc', t: 'chip', name: 'Контроллер', x: 140, y: 0, bw: 120, bh: 80, ext: true, pins: [{ n: 'D[15:0]', side: 'r', y: 36 }, { n: 'CLK', side: 'l', y: 60, clk: true }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'lt', t: 'label', text: 'Tclk (та же длина)', x: 250, y: 110, anchor: 'middle', cls: 'sch-wlabel k-clk' },
      { id: 'pd', t: 'in', name: 'bus_d', w: 16, x: 400, y: 25 },
      { id: 'ib', t: 'ibuf', name: 'bus_d_IBUF[%]_inst', w: 16, x: 530, y: 22, noName: true },
      { id: 'r', t: 'ff', name: 'bus_d_reg', w: 16, x: 610, y: 18 },
      { id: 'pc', t: 'in', name: 'clk40', x: 400, y: 115 },
      { id: 'ibc', t: 'ibuf', name: 'clk40_IBUF_inst', x: 480, y: 112, noName: true },
      { id: 'bg', t: 'bufg', name: 'clk40_IBUF_BUFG_inst', x: 540, y: 112, noName: true },
    ],
    wires: [
      { from: 'osc.out', to: ['mc.CLK', 'pc.pad'], kind: 'clk', dash: true, trunk: 60, label: 'Tclk' },
      { from: 'mc.D[15:0]', to: 'pd.pad', bus: true, bw: 16, label: 'Td 0,5…0,9 нс', below: true },
      { from: 'pd', to: 'ib.I' },
      { from: 'ib.O', to: 'r.D' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Окно изменения данных (без масштаба)', t: [-1, 9], axis: false, grid: false,
      signals: [
        { name: 'CLK (обе)', clock: { period: 25 }, arrows: 'rise' },
        { name: 'выход контроллера', bus: [[1.5, 5.0, 'D1']], init: 'D0' },
        { name: 'bus_d на ПЛИС', bus: [[2.0, 5.9, 'D1']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'фронт (0)', cls: 'launch' }],
      spans: [
        { row: 1, t0: 0, t1: 1.5, label: 'Tco min', cls: 'data' },
        { row: 1, t0: 0, t1: 5.0, label: 'Tco max', cls: 'data' },
        { row: 2, t0: 0, t1: 2.0, label: '-min = ?', cls: 'hold' },
        { row: 2, t0: 0, t1: 5.9, label: '-max = ?', cls: 'setup' },
      ],
      caption: 'Фронт приходит на обе микросхемы одновременно, поэтому отсчёт от фронта на выводе ПЛИС совпадает с отсчётом от фронта на контроллере. К интервалу изменения на выходе контроллера добавляется задержка трассы данных.',
    },
  ],
  fields: [
    { label: '`set_input_delay -max`', answer: 5.9, tol: 0.01, unit: 'нс' },
    { label: '`set_input_delay -min`', answer: 2.0, tol: 0.01, unit: 'нс' },
  ],
  hints: [
    'При выровненных трассах тактового сигнала слагаемые Tcd и Tcf одинаковы и взаимно уничтожаются.',
    '-max = Tco_max + Td_max, -min = Tco_min + Td_min.',
  ],
  explain: `
    Общая формула системно-синхронного ввода: \`-max = Tcd_max + Tco_max + Td_max − Tcf_min\`, \`-min = Tcd_min + Tco_min + Td_min − Tcf_max\`. При выровненных трассах тактового сигнала Tcd = Tcf, и они сокращаются:
    - -max = 5,0 + 0,9 = **5,9 нс**;
    - -min = 1,5 + 0,5 = **2,0 нс**.

    \`\`\`
    set_input_delay -clock clk40 -max 5.900 [get_ports {bus_d[*]}]
    set_input_delay -clock clk40 -min 2.000 [get_ports {bus_d[*]}]
    \`\`\`
    Период (25 нс) в задержку ввода не входит: его учитывает сам анализ, сравнивая момент прихода данных со следующим фронтом. На тракт внутри ПЛИС остаётся 25 − 5,9 = 19,1 нс.

    **Типичные ошибки:** смешать минимальные и максимальные значения (например, \`Tco_max + Td_min\`), вычесть результат из периода (это уже делает Vivado) или взять одно значение для -max и -min.

    Если трассы тактового сигнала не выровнены, вернитесь к общей формуле: при Tcd > Tcf (фронт приходит на контроллер позже) -max увеличивается, при Tcd < Tcf – уменьшается.
  `,
  refs: 'UG903, глава «Constraining I/O Delay»',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'sysio.vclk_q', module: 'sysio', order: 6, level: 2, tool: 'vivado', type: 'choice', multi: true,
  lang: 'both', langNote: 'Виртуальные тактовые сигналы одинаковы в XDC и SDC; в ASIC через них задают и бюджеты блоков кристалла (см. [[q:asic.vclk_io|задачу о бюджетах блока]]).',
  title: 'Когда нужен виртуальный тактовый сигнал?',
  tags: ['виртуальный тактовый сигнал', 'понимание'],
  text: `
    Виртуальный тактовый сигнал создаётся командой \`create_clock\` без объектов, например \`create_clock -name codec_vclk -period 40\`. Он не распространяется по схеме ПЛИС и служит только опорой для \`set_input_delay\` и \`set_output_delay\`.

    На рисунке – пример: синтезатор частот выдаёт 100 МГц на ПЛИС и согласованные по фазе 25 МГц на кодек, которому ПЛИС передаёт данные \`codec_d[7:0]\`.

    В каких ситуациях задержки ввода/вывода **следует** задавать относительно виртуального тактового сигнала? Выберите все подходящие варианты.
  `,
  design: {
    elements: [
      { id: 'syn', t: 'chip', name: 'Синтезатор', x: 0, y: 60, bw: 92, bh: 80, ext: true, pins: [{ n: '100 МГц', side: 'r', y: 32 }, { n: '25 МГц', side: 'r', y: 60 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pc', t: 'in', name: 'sys_clk', x: 160, y: 81 },
      { id: 'ibc', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 248, y: 78, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 300, y: 78, noName: true },
      { id: 'gen', t: 'logic', name: 'u_audio/sample', w: 8, label: 'отсчёты', bw: 72, x: 256, y: 0 },
      { id: 'r', t: 'ff', name: 'codec_d_reg', w: 8, x: 370, y: 5 },
      { id: 'ob', t: 'obuf', name: 'codec_d_OBUF[%]_inst', w: 8, x: 458, y: 9, noName: true },
      { id: 'pd', t: 'out', name: 'codec_d', w: 8, x: 514, y: 12 },
      { id: 'cdc', t: 'chip', name: 'Кодек', x: 700, y: 0, bw: 84, bh: 104, ext: true, pins: [{ n: 'D[7:0]', side: 'l', y: 23 }, { n: 'CLK', side: 'l', y: 80, clk: true }] },
    ],
    wires: [
      { from: 'syn.100 МГц', to: 'pc.pad', kind: 'clk', dash: true },
      { from: 'syn.25 МГц', to: 'cdc.CLK', kind: 'clk', dash: true, via: [[116, 170], [688, 170]], label: '25 МГц – в ПЛИС не заходит' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk' },
      { from: 'gen.O', to: 'r.D' },
      { from: 'r.Q', to: 'ob.I' },
      { from: 'ob.O', to: 'pd' },
      { from: 'pd.pad', to: 'cdc.D[7:0]' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Опорные фронты для вывода на кодек', t: [-4, 84],
      signals: [
        { name: 'sys_clk 100 МГц', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'CLK кодека 25 МГц', clock: { period: 40 }, arrows: 'rise', cls: 'capture' },
        { name: 'codec_vclk', clock: { period: 40 }, arrows: 'rise' },
      ],
      marks: [{ t: 30, label: 'запуск', cls: 'launch' }, { t: 40, label: 'захват', cls: 'capture' }],
      spans: [{ row: 1, t0: 30, t1: 40, label: '10 нс', cls: 'setup' }],
      caption: 'Тактового сигнала кодека в ПЛИС нет, поэтому его описывают виртуальным тактовым сигналом с тем же периодом и фазой. Vivado развернёт 100 и 25 МГц на общий период (40 нс) и найдёт ближайшую пару фронтов «запуск – захват».',
    },
  ],
  options: [
    { text: 'Внешняя микросхема тактируется сигналом, который в ПЛИС не заведён: как кодек на рисунке, получающий 25 МГц от синтезатора, согласованные по фазе с 100 МГц на входе ПЛИС.', ok: true, why: 'Верно. Задержки вывода отсчитываются от фронтов тактового сигнала кодека. Такого сигнала в проекте нет, поэтому его описывают виртуальным: `create_clock -name codec_vclk -period 40`, а затем `set_output_delay -clock codec_vclk …`.' },
    { text: 'Ввод/вывод тактируется выходом MMCM, частота которого не кратна частоте сигнала на входе ПЛИС (например, 100 → 66,667 МГц), а внешняя микросхема работает на частоте выхода MMCM.', ok: true, why: 'Верно. Если сослаться на входной тактовый сигнал 100 МГц, Vivado развернёт 100 и 66,667 МГц на общий период и выберет самую близкую пару фронтов – требование окажется нереально малым. Виртуальный тактовый сигнал с периодом 15 нс задаёт естественную пару «запуск – захват».' },
    { text: 'Нужно задать неопределённость или задержку платы (`set_clock_uncertainty`, `set_clock_latency -source`) только для внешнего тактового сигнала, не меняя анализ внутренних путей.', ok: true, why: 'Верно. Свойства виртуального тактового сигнала влияют только на пути ввода/вывода, которые на него ссылаются; пути между регистрами внутри ПЛИС анализируются по-прежнему.' },
    { text: 'АЦП и ПЛИС тактируются одним генератором, и его сигнал заведён на вывод ПЛИС.', why: 'Не обязательно. Задержки можно задать относительно тактового сигнала, описанного на этом выводе: его фронт и так служит моментом 0 на выводе ПЛИС. Виртуальный сигнал с тем же периодом даст те же требования – это вопрос стиля, а не необходимость.' },
    { text: 'Вход асинхронный (кнопка, линия UART): чтобы путь не анализировался, задержку задают относительно виртуального тактового сигнала.', why: 'Неверно. Задержка относительно любого тактового сигнала делает путь анализируемым, причём с бессмысленным требованием. Асинхронные входы исключают командой `set_false_path`, а надёжность обеспечивает синхронизатор.' },
    { text: 'Микросхема передаёт данные вместе со своим тактовым сигналом, который заведён на тактовый вход ПЛИС (синхронизация от источника).', why: 'Не нужно. Опорный сигнал физически приходит в ПЛИС и описывается командой `create_clock` на этом порту; задержки задают относительно него. Виртуальный сигнал с тем же периодом лишь продублировал бы описание.' },
  ],
  explain: `
    Виртуальный тактовый сигнал описывает **внешний** тактовый сигнал, которого нет в схеме ПЛИС. Его используют, когда:
    1. опорный тактовый сигнал внешней микросхемы не заведён в ПЛИС;
    2. ввод/вывод тактируется внутренним сигналом (выход MMCM), который нельзя корректно сопоставить с сигналом платы из-за некратного отношения частот;
    3. нужно задать неопределённость или задержку только для внешнего тактового сигнала.

    Для примера на рисунке:
    \`\`\`
    create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
    create_clock -name codec_vclk -period 40.000
    set_output_delay -clock codec_vclk -max <tsu + трасса> [get_ports {codec_d[*]}]
    set_output_delay -clock codec_vclk -min <трасса − th> [get_ports {codec_d[*]}]
    \`\`\`
    Vivado считает тактовые сигналы связанными (по умолчанию все тактовые сигналы связаны): данные, запущенные фронтом 100 МГц в момент 30 нс, захватываются фронтом кодека в момент 40 нс – требование 10 нс. Если фазы сигналов на выводах микросхем различаются, это учитывают опцией -waveform виртуального сигнала или командой \`set_clock_latency -source\`.

    Когда же внешняя микросхема и ПЛИС тактируются одним сигналом, заведённым на вывод ПЛИС, виртуальный тактовый сигнал не обязателен: тактовый сигнал на порту даёт те же требования.

    Проверка в Vivado: \`report_clocks\` (виртуальный сигнал без точек определения), \`report_clock_interaction\` – пара «внутренний – виртуальный» анализируется как синхронная.
  `,
  refs: 'UG903, раздел «Virtual Clocks»',
});
