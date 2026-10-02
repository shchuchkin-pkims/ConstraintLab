/* Модуль 5. Синхронизация от источника: выходы (Vivado XDC) */
XT.bank.module({
  id: 'ssout', order: 50, title: '5. Синхронизация от источника: выходы',
  about: 'Передача тактового сигнала приёмнику через ODDR, производный тактовый сигнал на выходном порту, set_output_delay относительно переданного тактового сигнала, выравнивание по центру, RGMII',
});

// ---------------------------------------------------------------------------
// Общая схема: регистры данных и ODDR, формирующий тактовый сигнал для ЦАП.
// inv = true – ODDR с D1 = 0, D2 = 1 (тактовый сигнал выдаётся инверсным).
function ssoutDacDesign(inv) {
  const consts = inv
    ? [
      { id: 'one', t: 'vcc', name: 'dac_clk_d2_VCC', x: 218, y: 130 },
      { id: 'zero', t: 'gnd', name: 'dac_clk_d1_GND', x: 254, y: 130 },
    ]
    : [
      { id: 'one', t: 'vcc', name: 'dac_clk_d1_VCC', x: 245, y: 140 },
      { id: 'zero', t: 'gnd', name: 'dac_clk_d2_GND', x: 245, y: 210 },
    ];
  const constWires = inv
    ? [
      { from: 'one.P', to: 'oddr.D2' },
      { from: 'zero.G', to: 'oddr.D1', via: [[264, 118], [246, 118], [246, 178]] },
    ]
    : [
      { from: 'one.P', to: 'oddr.D1' },
      { from: 'zero.G', to: 'oddr.D2' },
    ];
  return {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pck', t: 'in', name: 'sys_clk', x: 10, y: 269 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 95, y: 266, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 150, y: 266, noName: true },
      { id: 'gen', t: 'logic', name: 'u_gen/sample', w: 14, label: 'формирователь', bw: 100, x: 165, y: 35 },
      { id: 'r', t: 'ff', name: 'dac_d_reg', w: 14, x: 310, y: 40 },
      { id: 'obd', t: 'obuf', name: 'dac_d_OBUF[%]_inst', w: 14, x: 410, y: 44, noName: true },
      { id: 'pd', t: 'out', name: 'dac_d', w: 14, x: 480, y: 47 },
      ...consts,
      { id: 'oddr', t: 'oddr', name: 'dac_clk_oddr', x: 310, y: 150 },
      { id: 'obc', t: 'obuf', name: 'dac_clk_OBUF_inst', x: 410, y: 178, noName: true },
      { id: 'pc', t: 'out', name: 'dac_clk', x: 507, y: 181 },
      { id: 'dac', t: 'chip', name: 'ЦАП 14 бит', x: 630, y: 25, bw: 104, bh: 200, ext: true, pins: [{ n: 'D[13:0]', side: 'l', y: 33 }, { n: 'CLK', side: 'l', y: 167, clk: true }] },
    ],
    wires: [
      { from: 'pck', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk', label: 'sys_clk', mx: 205 },
      { from: 'bg.O', to: 'oddr.C', kind: 'clk', mx: 285 },
      { from: 'gen.O', to: 'r.D' },
      { from: 'r.Q', to: 'obd.I' },
      { from: 'obd.O', to: 'pd' },
      ...constWires,
      { from: 'oddr.Q', to: 'obc.I', kind: 'clk' },
      { from: 'obc.O', to: 'pc', kind: 'clk' },
      { from: 'pd.pad', to: 'dac.D[13:0]' },
      { from: 'pc.pad', to: 'dac.CLK', kind: 'clk', dash: true },
    ],
  };
}

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssout.sdr_fwd', module: 'ssout', order: 1, level: 2, tool: 'vivado',
  lang: 'both', langNote: '`create_generated_clock` на выходном порту и `set_output_delay` одинаковы в XDC и SDC; в ASIC так описывают, например, тактовый сигнал SPI или внешней памяти, который выдаёт кристалл. ODDR – примитив ПЛИС.',
  title: 'ЦАП с тактовым сигналом от ПЛИС',
  tags: ['create_generated_clock', 'set_output_delay', 'ODDR'],
  text: `
    Параллельный ЦАП с входом КМОП работает на частоте **100 МГц**. ПЛИС выдаёт ему 14-разрядные отсчёты \`dac_d[13:0]\` из регистров \`dac_d_reg\` и **сама формирует тактовый сигнал** ЦАП \`dac_clk\`: тактовый сигнал \`sys_clk\` подан на ODDR \`dac_clk_oddr\` с постоянными входами D1 = 1 и D2 = 0, поэтому на выходе Q повторяется форма \`sys_clk\`. Данные и тактовый сигнал запускаются одним и тем же фронтом \`sys_clk\` и проходят похожие цепи (регистр или ODDR, затем OBUF).

    Из технического описания ЦАП (относительно фронта сигнала на его выводе CLK):

    | Параметр | Значение |
    |---|---|
    | время предустановки t_su | 1,5 нс |
    | время удержания t_h | 0,8 нс |

    Трассы тактового сигнала и данных на плате выровнены по длине, поэтому их задержки взаимно компенсируются. Тактовый сигнал \`sys_clk\` (10 нс) уже описан.

    **Задание.** Опишите тактовый сигнал, который ПЛИС передаёт ЦАП, и задержки выходов \`dac_d[13:0]\` для проверки предустановки и удержания.
  `,
  design: ssoutDacDesign(false),
  figures: [
    {
      kind: 'timing', title: 'Требования ЦАП', t: [-2, 22], width: 540,
      signals: [
        { name: 'dac_clk на ЦАП', clock: { period: 10 }, arrows: 'rise' },
        { name: 'dac_d на ЦАП', bus: [[0.15, 1.1, 'N'], [10.15, 11.1, 'N+1'], [20.15, 21.1, 'N+2']], init: 'N−1' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 10, label: 'захват', cls: 'capture' }],
      windows: [{ row: 1, t0: 8.5, t1: 10, cls: 'setup' }, { row: 1, t0: 10, t1: 10.8, cls: 'hold' }],
      spans: [
        { row: 0, t0: 0, t1: 10, label: 'требование к предустановке 10 нс', cls: 'setup' },
        { row: 1, t0: 8.5, t1: 10, label: 't_su = 1,5 нс → -max 1.5', cls: 'setup' },
        { row: 1, t0: 10, t1: 10.8, label: 't_h = 0,8 нс → -min -0.8', cls: 'hold' },
      ],
      caption: 'Данные, запущенные фронтом в момент 0, захватываются следующим фронтом dac_clk: они должны установиться за t_su до него (зелёное окно) и не меняться t_h после него (фиолетовое окно). При одинаковых путях данные меняются почти одновременно с фронтом dac_clk – окно удержания попадает на смену данных. Ограничения должны позволить Vivado это обнаружить.',
    },
    {
      kind: 'timing', title: 'Задержки путей в ПЛИС', t: [-1, 26], width: 540,
      signals: [
        { name: 'sys_clk в ПЛИС', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'dac_clk на порту', clock: { period: 10, rise: 4, fall: 9 }, arrows: 'rise' },
        { name: 'dac_d на порту', bus: [[3.6, 4.6, 'N'], [13.6, 14.6, 'N+1'], [23.6, 24.6, 'N+2']], init: 'N−1' },
      ],
      marks: [{ t: 0, label: 'запуск (sys_clk)', cls: 'launch' }, { t: 14, label: 'захват (dac_clk)', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 4, label: 'путь тактового сигнала', cls: 'clk' },
        { row: 2, t0: 0, t1: 3.6, label: 'путь данных', cls: 'data' },
      ],
      caption: 'Задержки показаны условно. Один фронт sys_clk запускает и данные, и переданный тактовый сигнал; на портах оба сдвинуты почти одинаково. Производный тактовый сигнал на порту dac_clk включает задержку своего пути (BUFG, ODDR, OBUF), и Vivado сравнивает данные с настоящим фронтом dac_clk, а не с фронтом sys_clk внутри ПЛИС.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]`,
  hints: [
    'Какой тактовый сигнал видит ЦАП на своём выводе CLK? Он получен в ПЛИС из sys_clk, значит, это производный тактовый сигнал. Где он определяется – там, где его «видит» приёмник.',
    'Производный тактовый сигнал задают на выходном порту, а -source указывает на тактовый вывод ODDR: `create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]`.',
    'Задержки выходов – относительно dac_clk: -max = t_su = 1,5 нс, -min = −t_h = −0,8 нс (трассы выровнены, поправок нет).',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
    set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
    set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
    \`\`\`
    **Тактовый сигнал приёмника.** ODDR с D1 = 1 и D2 = 0 выдаёт 1 по фронту и 0 по спаду своего тактового входа C, то есть повторяет \`sys_clk\`. Это производный тактовый сигнал с коэффициентом деления 1 (\`-divide_by 1\`). Точка определения – выходной порт \`dac_clk\`: сигнал именно в этой точке поступает на ЦАП. Опция \`-source\` указывает на вывод, где присутствует исходный тактовый сигнал, – тактовый вход ODDR. Vivado сам находит путь от \`sys_clk\` через IBUF, BUFG, ODDR и OBUF до порта и включает его задержку в задержку тактового сигнала \`dac_clk\`.

    **Задержки выхода.** Для приёмника, тактируемого переданным тактовым сигналом:
    - \`-max\` = t_su + (t_трассы данных, max − t_трассы такт., min) = 1,5 + 0 = **1,5 нс**;
    - \`-min\` = −t_h + (t_трассы данных, min − t_трассы такт., max) = −0,8 + 0 = **−0,8 нс**.

    **Требования, которые получаются.** Данные запускаются фронтом \`sys_clk\` в момент 0.
    - Предустановка: захват следующим фронтом \`dac_clk\` (10 нс), требование **10 нс**. Бюджет 10 − 1,5 = **8,5 нс**: задержка пути данных до порта может превышать задержку пути тактового сигнала до порта не более чем на 8,5 нс.
    - Удержание: данные, запущенные в момент 10, не должны испортить захват в момент 10, требование **0**. Бюджет 0 − (−0,8) = **0,8 нс**: путь данных должен быть длиннее пути тактового сигнала не менее чем на 0,8 нс.

    Главное: в обе проверки входит **разность** задержек путей данных и тактового сигнала. Одинаковые участки (тактовое дерево, OBUF) взаимно компенсируются, как и на самом деле.

    **Что покажет анализ.** Регистр данных, размещённый в блоке ввода/вывода (задача [[q:phys.iob|«Регистры в блоках ввода/вывода»]]), и ODDR имеют почти одинаковую задержку, поэтому данные меняются на выводах ЦАП почти одновременно с фронтом \`dac_clk\`. Запас по предустановке большой (около 8,5 нс), а удержание не выполняется примерно на 0,8 нс. Ограничения здесь правильные: они честно показывают недостаток самой схемы. Как его устранить, разобрано в задаче [[q:ssout.inv_fwd|«Тактовый сигнал по центру окна данных»]].

    **Типичные ошибки.**
    - Задержки относительно \`sys_clk\`. Vivado считает, что ЦАП захватывает данные фронтом \`sys_clk\` без всякой задержки: путь тактового сигнала через ODDR и OBUF теряется. Проверка предустановки становится пессимистичной на всю его задержку, а проверка удержания – оптимистичной: она проходит, хотя в действительности данные меняются вместе с фронтом \`dac_clk\`. Реальное нарушение удержания будет скрыто.
    - \`create_clock\` на порту \`dac_clk\`. Получится независимый первичный тактовый сигнал с нулевой задержкой в точке определения: связь с \`sys_clk\` и задержка пути через ODDR и OBUF пропадают, \`report_clock_interaction\` покажет пару \`sys_clk → dac_clk\` как *Timed (unsafe)*.
    - Тактовый сигнал на выводе \`dac_clk_oddr/Q\` вместо порта: задержка OBUF не войдёт в путь тактового сигнала, хотя данные через такой же OBUF проходят.
    - Нет \`-min\`: проверка удержания не выполняется, \`check_timing\` сообщит *partial_output_delay* – именно той проверки, которая выявляет проблему этой схемы, не будет.

    **Проверка в Vivado:** \`report_clocks\` – \`dac_clk\` производный, исходный тактовый сигнал \`sys_clk\`; \`report_timing -to [get_ports {dac_d[*]}] -delay_type min_max\` – в разделе пути тактового сигнала захвата (Destination Clock Path) видны ODDR и OBUF; \`check_timing\` – без *partial_output_delay*.
  `,
  refs: 'UG903, «Constraining Forwarded Clocks» (create_generated_clock), «Constraining I/O Delay»; UG949, раздел о выходных интерфейсах с синхронизацией от источника',
  tests: [
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock [get_clocks sys_clk] -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock [get_clocks sys_clk] -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: 'задержки относительно внутреннего тактового сигнала', expect: 'опорный' },
    { code: 'create_clock -name dac_clk -period 10 [get_ports dac_clk]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: 'create_clock на выходном порту', expect: 'производн' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock dac_clk 1.5 [get_ports {dac_d[*]}]', pass: false, note: 'одно значение и для -max, и для -min', expect: '-min' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]', pass: false, note: 'нет -min', expect: 'нет значения -min' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min 0.8 [get_ports {dac_d[*]}]', pass: false, note: 'знак -min', expect: 'знаке' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_pins dac_clk_oddr/Q]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: 'тактовый сигнал на выходе ODDR, а не на порту', expect: 'не в той точке' },
    { code: 'set tsu 1.5\nset th 0.8\ncreate_generated_clock -source [get_pins dac_clk_oddr/C] -multiply_by 1 [get_ports dac_clk]\nset_output_delay -clock [get_clocks -of_objects [get_ports dac_clk]] -max $tsu [get_ports dac_d*]\nset_output_delay -clock [get_clocks -of_objects [get_ports dac_clk]] -min [expr {-$th}] [get_ports dac_d*]', pass: true, note: 'имя по умолчанию, переменные, -multiply_by 1' },
    { code: 'create_generated_clock -name fwd_clk -source [get_pins -of_objects [get_cells dac_clk_oddr] -filter {REF_PIN_NAME == C}] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock fwd_clk -max 1.5 [get_ports -filter {NAME =~ dac_d[*]}]\nset_output_delay -clock fwd_clk -min -0.8 [get_ports -filter {NAME =~ dac_d[*]}]', pass: true, note: 'другое имя, выбор выводов через -of_objects и -filter' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssout.inv_fwd', module: 'ssout', order: 2, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Опции `-invert` и `-edges` одинаковы в XDC и SDC.',
  title: 'Тактовый сигнал по центру окна данных',
  tags: ['create_generated_clock', '-invert', 'set_output_delay', 'ODDR'],
  text: `
    Анализ в задаче [[q:ssout.sdr_fwd|«ЦАП с тактовым сигналом от ПЛИС»]] показал недостаток схемы: данные и тактовый сигнал проходят почти одинаковые пути, поэтому на выводах ЦАП данные меняются одновременно с фронтом \`dac_clk\`, и время удержания 0,8 нс не выдерживается.

    Схему изменили: на ODDR \`dac_clk_oddr\` теперь поданы D1 = 0 и D2 = 1. По фронту \`sys_clk\` выход Q переходит в 0, по спаду – в 1, то есть тактовый сигнал выдаётся **инверсным**. Его фронт приходится на середину интервала, в котором данные неизменны (выравнивание по центру). ЦАП по-прежнему захватывает данные **фронтом** сигнала на своём выводе CLK.

    Остальное без изменений: 100 МГц (\`sys_clk\` уже описан), t_su = 1,5 нс, t_h = 0,8 нс, трассы выровнены по длине.

    **Задание.** Опишите тактовый сигнал \`dac_clk\` с учётом инверсии и задержки выходов \`dac_d[13:0]\`.
  `,
  design: ssoutDacDesign(true),
  figures: [
    {
      kind: 'timing', title: 'Фронт в середине окна данных', t: [-2, 22], width: 540,
      signals: [
        { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'dac_clk на ЦАП', clock: { period: 10, rise: 5, fall: 10 }, arrows: 'rise' },
        { name: 'dac_d на ЦАП', bus: [[0.15, 1.1, 'N'], [10.15, 11.1, 'N+1'], [20.15, 21.1, 'N+2']], init: 'N−1' },
      ],
      marks: [{ t: 0, label: 'запуск N', cls: 'launch' }, { t: 5, label: 'захват N', cls: 'capture' }, { t: 10, label: 'запуск N+1', cls: 'launch' }],
      windows: [
        { row: 2, t0: 3.5, t1: 5, cls: 'setup' }, { row: 2, t0: 5, t1: 5.8, cls: 'hold' },
        { row: 2, t0: 13.5, t1: 15, cls: 'setup' }, { row: 2, t0: 15, t1: 15.8, cls: 'hold' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 5, label: 'предустановка: 5 нс', cls: 'setup' },
        { row: 1, t0: 10, t1: 5, label: 'удержание: −5 нс', cls: 'hold' },
      ],
      caption: 'Фронт инверсного тактового сигнала приходится на середину интервала, в котором данные неизменны. Окна t_su и t_h (зелёное и фиолетовое) удалены от моментов смены данных примерно на полпериода с обеих сторон.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 -invert [get_ports dac_clk]
set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]`,
  hints: [
    'Нарисуйте сигнал на выходе ODDR: по фронту C выдаётся D1 (0), по спаду – D2 (1). Где теперь фронты dac_clk относительно sys_clk?',
    'Фронты dac_clk совпадают со спадами sys_clk – это инверсная копия. В create_generated_clock для этого есть опция -invert (равноценно: -edges {2 3 4}).',
    'Задержки выходов не меняются: ЦАП захватывает данные фронтом своего тактового сигнала, -clock_fall не нужен.',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 -invert [get_ports dac_clk]
    set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
    set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
    \`\`\`
    **Форма тактового сигнала.** ODDR с D1 = 0 и D2 = 1 переходит в 0 по фронту \`sys_clk\` (0, 10, 20 нс) и в 1 по спаду (5, 15 нс). Сигнал на порту – инверсная копия \`sys_clk\` с формой \`{5 10}\`. Её описывают опцией \`-invert\`. Равноценная запись – \`-edges {2 3 4}\`: перепады исходного сигнала нумеруются с единицы (1 – фронт в 0 нс, 2 – спад в 5 нс, 3 – фронт в 10 нс, 4 – спад в 15 нс), фронт производного сигнала берётся на 2-м перепаде, спад – на 3-м, а период заканчивается на 4-м: форма \`{5 10}\`, период 10 нс.

    **Задержки выхода** остаются прежними: ЦАП захватывает данные фронтом сигнала на своём выводе, а форму этого сигнала теперь правильно описывает \`dac_clk\`. Опция \`-clock_fall\` здесь не нужна.

    **Требования.** Данные запускаются фронтом \`sys_clk\` в момент 0.
    - Предустановка: ближайший фронт \`dac_clk\` после запуска – 5 нс, требование **5 нс**, бюджет 5 − 1,5 = **3,5 нс**.
    - Удержание: данные, запущенные в момент 10, не должны испортить захват в момент 5, требование **−5 нс**, бюджет −5 − (−0,8) = **−4,2 нс**.

    | | Без инверсии | С инверсией |
    |---|---|---|
    | требование к предустановке | 10 нс | 5 нс |
    | требование к удержанию | 0 | −5 нс |
    | допустимая разность задержек путей данных и тактового сигнала | от 0,8 до 8,5 нс | от −4,2 до 3,5 нс |

    Ширина допустимого диапазона одна и та же: 10 − 1,5 − 0,8 = 7,7 нс. Инверсия лишь **сдвигает запас** с предустановки на удержание. Реальная разность задержек путей близка к нулю (регистр в блоке ввода/вывода и ODDR, одинаковые OBUF, выровненные трассы). Без инверсии ноль лежит вне диапазона – удержание нарушено на 0,8 нс. С инверсией ноль оказывается почти посередине: запас 3,5 нс по предустановке и 4,2 нс по удержанию. Поэтому выравнивание по центру устойчиво к перекосу между путями, к разбросу задержек по температуре и напряжению и к джиттеру.

    **Типичные ошибки.**
    - Нет \`-invert\`. Описанная форма \`{0 5}\` не совпадает с реальным сигналом: Vivado будет проверять предустановку за 10 нс вместо 5 (оптимистично на 5 нс) и сообщит о несуществующем нарушении удержания.
    - Нет \`-invert\`, но задержки выхода заданы с \`-clock_fall\`. Числа совпадут с эталоном, но описание противоречит действительности: спад «описанного» тактового сигнала стоит там, где на выводе фронт. Две ошибки компенсируют друг друга, и любое другое ограничение или отчёт, использующие \`dac_clk\`, окажутся неверными.
    - \`-invert\` и одновременно \`-clock_fall\`: двойная инверсия возвращает захват к фронту \`sys_clk\` – снова требования 10 нс и 0.

    **Проверка в Vivado:** \`report_clocks\` – у \`dac_clk\` форма \`{5.000 10.000}\`; в \`report_timing -to [get_ports {dac_d[0]}]\` фронт захвата \`dac_clk\` – 5 нс.
  `,
  refs: 'UG903, «Constraining Forwarded Clocks», create_generated_clock -invert и -edges; UG949, выравнивание тактового сигнала по центру окна данных',
  tests: [
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: 'нет -invert', expect: 'форма' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]\nset_output_delay -clock dac_clk -clock_fall -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -clock_fall -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: 'нет -invert, компенсация через -clock_fall', expect: 'форма' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 -invert [get_ports dac_clk]\nset_output_delay -clock dac_clk -clock_fall -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -clock_fall -min -0.8 [get_ports {dac_d[*]}]', pass: false, note: '-invert и -clock_fall одновременно', expect: 'спада' },
    { code: 'create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -edges {2 3 4} [get_ports dac_clk]\nset_output_delay -clock dac_clk -max 1.5 [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min -0.8 [get_ports {dac_d[*]}]', pass: true, note: '-edges {2 3 4}' },
    { code: 'create_generated_clock -name dac_clk -source [get_ports sys_clk] -invert -divide_by 1 [get_ports dac_clk]\nset d [get_ports {dac_d[*]}]\nset_output_delay -clock dac_clk -min -0.8 $d\nset_output_delay -clock dac_clk -max 1.5 $d', pass: true, note: '-source на входном порту, другой порядок команд' },
  ],
});

// ---------------------------------------------------------------------------
const SSOUT_RGMII_DESIGN = {
  elements: [
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    {
      id: 'macd', t: 'block', name: 'u_mac/tx_data', title: 'MAC', noName: true, x: 16, y: 24, bw: 92, bh: 52,
      pins: [{ n: 'TXD_L', d: 'out', w: 4, side: 'r', y: 24, label: 'TXD[3:0]' }, { n: 'TXD_H', d: 'out', w: 4, side: 'r', y: 42, label: 'TXD[7:4]' }],
    },
    {
      id: 'macc', t: 'block', name: 'u_mac/tx_ctrl', title: 'MAC', noName: true, x: 16, y: 144, bw: 92, bh: 52,
      pins: [{ n: 'TX_EN', d: 'out', side: 'r', y: 24, label: 'TX_EN' }, { n: 'TX_EN_ER', d: 'out', side: 'r', y: 42, label: 'EN⊕ER' }],
    },
    { id: 'od', t: 'oddr', name: 'txd_oddr', w: 4, x: 150, y: 20 },
    { id: 'oc', t: 'oddr', name: 'ctl_oddr', x: 150, y: 140 },
    { id: 'one', t: 'vcc', name: 'txc_d1_VCC', x: 70, y: 260 },
    { id: 'zero', t: 'gnd', name: 'txc_d2_GND', x: 70, y: 328 },
    { id: 'ot', t: 'oddr', name: 'txc_oddr', x: 150, y: 270 },
    { id: 'bd', t: 'obuf', name: 'rgmii_txd_OBUF[%]_inst', w: 4, x: 262, y: 48, noName: true },
    { id: 'bc', t: 'obuf', name: 'rgmii_tx_ctl_OBUF_inst', x: 262, y: 168, noName: true },
    { id: 'bt', t: 'obuf', name: 'rgmii_txc_OBUF_inst', x: 262, y: 298, noName: true },
    { id: 'pd', t: 'out', name: 'rgmii_txd', w: 4, x: 333, y: 51 },
    { id: 'pc', t: 'out', name: 'rgmii_tx_ctl', x: 353, y: 171 },
    { id: 'pt', t: 'out', name: 'rgmii_txc', x: 373, y: 301 },
    { id: 'pg', t: 'in', name: 'gtx_clk', x: 10, y: 451 },
    { id: 'ib', t: 'ibuf', name: 'gtx_clk_IBUF_inst', x: 95, y: 448, noName: true },
    {
      id: 'mmcm', t: 'mmcm', name: 'u_clk/mmcm_inst', x: 150, y: 410, mult: 8, divclk: 1, note: 'VCO 1000 МГц',
      outs: [{ pin: 'CLKOUT0', div: 8, phase: 0, clk: 'clk125', label: 'CLKOUT0 0°' }, { pin: 'CLKOUT1', div: 8, phase: 90, clk: 'clk125_90', label: 'CLKOUT1 90°' }],
    },
    { id: 'bg0', t: 'bufg', name: 'u_clk/clkout0_buf', x: 318, y: 416, noName: true },
    { id: 'bg1', t: 'bufg', name: 'u_clk/clkout1_buf', x: 318, y: 468, noName: true },
    {
      id: 'phy', t: 'chip', name: 'PHY Ethernet', x: 510, y: 20, bw: 110, bh: 330, ext: true,
      pins: [{ n: 'TXD[3:0]', side: 'l', y: 42 }, { n: 'TX_CTL', side: 'l', y: 162 }, { n: 'TXC', side: 'l', y: 292, clk: true }],
    },
  ],
  wires: [
    { from: 'macd.TXD_L', to: 'od.D1' },
    { from: 'macd.TXD_H', to: 'od.D2' },
    { from: 'macc.TX_EN', to: 'oc.D1' },
    { from: 'macc.TX_EN_ER', to: 'oc.D2' },
    { from: 'one.P', to: 'ot.D1' },
    { from: 'zero.G', to: 'ot.D2' },
    { from: 'od.Q', to: 'bd.I' },
    { from: 'oc.Q', to: 'bc.I' },
    { from: 'ot.Q', to: 'bt.I', kind: 'clk' },
    { from: 'bd.O', to: 'pd' },
    { from: 'bc.O', to: 'pc' },
    { from: 'bt.O', to: 'pt', kind: 'clk' },
    { from: 'pg', to: 'ib.I', kind: 'clk' },
    { from: 'ib.O', to: 'mmcm.CLKIN1', kind: 'clk' },
    { from: 'mmcm.CLKOUT0', to: 'bg0.I', kind: 'clk' },
    { from: 'mmcm.CLKOUT1', to: 'bg1.I', kind: 'clk' },
    { from: 'bg0.O', to: ['od.C', 'oc.C'], kind: 'clk', label: 'clk125', via: [[366, 430], [366, 382], [0, 382]], vfirst: true, lx: 50, ly: 377 },
    { from: 'bg1.O', to: 'ot.C', kind: 'clk', label: 'clk125_90', via: [[378, 482], [378, 368], [125, 368]], vfirst: true, lx: 310, ly: 363 },
    { from: 'pd.pad', to: 'phy.TXD[3:0]' },
    { from: 'pc.pad', to: 'phy.TX_CTL' },
    { from: 'pt.pad', to: 'phy.TXC', kind: 'clk', dash: true },
  ],
};
const SSOUT_RGMII_REF = `create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]
set_output_delay -clock [get_clocks rgmii_txc] -max 1.000 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
set_output_delay -clock [get_clocks rgmii_txc] -min -0.800 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -max 1.000 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -min -0.800 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]`;
const SSOUT_RGMII_FP = `set_false_path -setup -rise_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]
set_false_path -setup -fall_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
set_false_path -hold -rise_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
set_false_path -hold -fall_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]`;
XT.bank.add({
  id: 'ssout.rgmii_tx', module: 'ssout', order: 3, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Тактовые сигналы MMCM Vivado выводит сам; в ASIC выходы PLL пришлось бы описать командой `create_generated_clock`.',
  title: 'Передатчик RGMII со сдвигом тактового сигнала на 90°',
  tags: ['RGMII', 'DDR', 'create_generated_clock', 'set_output_delay', '-clock_fall', 'MMCM'],
  text: `
    ПЛИС передаёт данные микросхеме физического уровня Ethernet (PHY) по интерфейсу **RGMII**: четыре разряда \`rgmii_txd[3:0]\` и сигнал управления \`rgmii_tx_ctl\` передаются с удвоенной скоростью – **по фронту и по спаду** тактового сигнала \`rgmii_txc\` частотой **125 МГц** (по фронту – младшая тетрада байта, по спаду – старшая).

    Тактовый сигнал 125 МГц поступает на вход \`gtx_clk\` (уже описан, 8 нс). MMCM \`u_clk/mmcm_inst\` (умножение 8, деление 1, частота генератора VCO 1000 МГц) формирует два тактовых сигнала 125 МГц: **clk125** (CLKOUT0, фаза 0°) и **clk125_90** (CLKOUT1, фаза 90°, то есть сдвиг 2 нс). Vivado выводит их автоматически под этими именами.

    - Данные и \`rgmii_tx_ctl\` выдаются через ODDR, тактируемые **clk125**: данные меняются по фронту и спаду clk125.
    - Тактовый сигнал \`rgmii_txc\` формирует ODDR \`txc_oddr\` (D1 = 1, D2 = 0), тактируемый **clk125_90**. Поэтому фронты и спады TXC приходятся на середину каждого бита.

    PHY настроен **без внутренней задержки** тактового сигнала и требует относительно **каждого фронта и каждого спада** сигнала на своём выводе TXC:

    | Параметр | Значение |
    |---|---|
    | время предустановки t_su | 1,0 нс |
    | время удержания t_h | 0,8 нс |

    Трассы TXC и данных выровнены по длине.

    **Задание.** Опишите тактовый сигнал \`rgmii_txc\`, который ПЛИС передаёт PHY, и задержки выходов \`rgmii_txd[3:0]\` и \`rgmii_tx_ctl\` относительно фронта и спада \`rgmii_txc\`. Если вы знаете, какие из получившихся проверок нестрогие, можете исключить их из анализа: такой вариант тоже засчитывается.
  `,
  design: SSOUT_RGMII_DESIGN,
  figures: [
    {
      kind: 'timing', title: 'Выравнивание по центру', t: [-1, 17], width: 560,
      signals: [
        { name: 'clk125', clock: { period: 8 }, arrows: 'both', cls: 'launch' },
        { name: 'rgmii_txc', clock: { period: 8, rise: 2, fall: 6 }, arrows: 'both' },
        { name: 'rgmii_txd', bus: [[-0.15, 0.15, 'N[3:0]'], [3.85, 4.15, 'N[7:4]'], [7.85, 8.15, 'N+1[3:0]'], [11.85, 12.15, 'N+1[7:4]'], [15.85, 16.15, 'N+2[3:0]']], init: 'N−1[7:4]' },
      ],
      marks: [{ t: 0, label: 'запуск ↑', cls: 'launch' }, { t: 4, label: 'запуск ↓', cls: 'launch' }, { t: 8, label: 'запуск ↑', cls: 'launch' }, { t: 12, label: 'запуск ↓', cls: 'launch' }],
      windows: [
        { row: 2, t0: 1, t1: 2, cls: 'setup' }, { row: 2, t0: 2, t1: 2.8, cls: 'hold' },
        { row: 2, t0: 5, t1: 6, cls: 'setup' }, { row: 2, t0: 6, t1: 6.8, cls: 'hold' },
        { row: 2, t0: 9, t1: 10, cls: 'setup' }, { row: 2, t0: 10, t1: 10.8, cls: 'hold' },
        { row: 2, t0: 13, t1: 14, cls: 'setup' }, { row: 2, t0: 14, t1: 14.8, cls: 'hold' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 2, label: '90° = 2 нс', cls: 'clk' },
        { row: 2, t0: 1, t1: 2, label: 't_su 1,0', cls: 'setup' },
        { row: 2, t0: 2, t1: 2.8, label: 't_h 0,8', cls: 'hold' },
      ],
      caption: 'Данные меняются по фронту и спаду clk125, а фронты и спады rgmii_txc сдвинуты на 90° (2 нс) – на середину каждого бита. PHY требует t_su = 1,0 нс и t_h = 0,8 нс относительно каждого фронта и каждого спада TXC (зелёные и фиолетовые окна).',
    },
    {
      kind: 'timing', title: 'Строгие и нестрогие проверки', t: [-8, 9], width: 560,
      signals: [
        { name: 'clk125', clock: { period: 8 }, arrows: 'rise', cls: 'launch' },
        { name: 'rgmii_txc', clock: { period: 8, rise: 2, fall: 6 }, arrows: 'both' },
      ],
      marks: [
        { t: -6, label: 'удержание ↑→↑ (нестрогая)', cls: 'default' }, { t: -2, label: 'удержание ↑→↓', cls: 'hold' }, { t: 0, label: 'запуск ↑', cls: 'launch' },
        { t: 2, label: 'предустановка ↑→↑', cls: 'capture' }, { t: 6, label: 'предустановка ↑→↓ (нестрогая)', cls: 'default' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 2, label: '2 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 6, label: '6 нс' },
        { row: 1, t0: 0, t1: -2, label: '−2 нс', cls: 'hold' },
        { row: 1, t0: 0, t1: -6, label: '−6 нс' },
      ],
      caption: 'Проверки для данных, запущенных фронтом clk125 в момент 0 (стрелки ↑ и ↓ – фронт и спад). Строгие: предустановка до ближайшего фронта TXC, 2 нс (зелёная), и удержание относительно предыдущего спада TXC, которым PHY захватывает предыдущую тетраду, −2 нс (фиолетовая). Нестрогие проверки (6 нс и −6 нс, чёрные) выполняются автоматически, если выполнены строгие. Для данных, запущенных спадом clk125, картина та же со сдвигом на 4 нс.',
    },
  ],
  given: `create_clock -name gtx_clk -period 8.000 [get_ports gtx_clk]`,
  solutions: [SSOUT_RGMII_REF, SSOUT_RGMII_REF + '\n' + SSOUT_RGMII_FP],
  hints: [
    'Сигнал на выводе rgmii_txc – копия clk125_90 (ODDR с D1 = 1, D2 = 0). Это производный тактовый сигнал на выходном порту, -source – тактовый вывод txc_oddr.',
    'PHY захватывает данные и фронтом, и спадом TXC: нужны четыре set_output_delay – -max и -min относительно фронта и то же с -clock_fall. Команды для спада пишут с -add_delay, иначе они перезапишут задержки относительно фронта.',
    '-max = t_su = 1,0 нс, -min = −t_h = −0,8 нс. Сдвиг на 90° уже заложен в форму clk125_90 (фронт в 2 нс) и переходит к rgmii_txc через -source – вручную его учитывать не нужно.',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]
    set_output_delay -clock [get_clocks rgmii_txc] -max 1.000 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
    set_output_delay -clock [get_clocks rgmii_txc] -min -0.800 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
    set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -max 1.000 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
    set_output_delay -clock [get_clocks rgmii_txc] -clock_fall -min -0.800 -add_delay [get_ports {rgmii_txd[*] rgmii_tx_ctl}]
    \`\`\`
    **Тактовый сигнал.** \`txc_oddr\` с D1 = 1 и D2 = 0 повторяет свой тактовый сигнал clk125_90, поэтому \`rgmii_txc\` – производный тактовый сигнал с \`-divide_by 1\` на выходном порту. Через \`-source [get_pins txc_oddr/C]\` он наследует форму clk125_90: фронт в 2 нс, спад в 6 нс. Сдвиг на 90° создаёт MMCM, а ограничения лишь правильно его описывают.

    **Задержки выхода.** PHY захватывает данные и фронтом, и спадом TXC, поэтому на каждом порту по две пары значений: относительно фронта и относительно спада (\`-clock_fall\`). Вторая пара записывается с \`-add_delay\`. Значения одинаковые: \`-max\` = t_su = 1,0 нс, \`-min\` = −t_h = −0,8 нс (трассы выровнены).

    **Проверки.** Данные запускаются фронтом (момент 0) и спадом (4 нс) clk125, а захватываются фронтом (2 нс) и спадом (6 нс) \`rgmii_txc\`. Для каждого порта получается четыре сочетания:

    | Запуск → захват | Предустановка | Удержание |
    |---|---|---|
    | фронт clk125 → фронт TXC | **2 нс**, бюджет 2 − 1,0 = 1,0 нс | −6 нс (нестрогая) |
    | спад clk125 → спад TXC | **2 нс**, бюджет 1,0 нс | −6 нс (нестрогая) |
    | фронт clk125 → спад TXC | 6 нс (нестрогая) | **−2 нс**, бюджет −2 − (−0,8) = −1,2 нс |
    | спад clk125 → фронт TXC | 6 нс (нестрогая) | **−2 нс**, бюджет −1,2 нс |

    Строгие проверки: тетрада, запущенная фронтом clk125, захватывается ближайшим фронтом TXC через 2 нс (предустановка), а следующая тетрада, запущенная спадом clk125 в 4 нс, не должна испортить её раньше чем через t_h после этого фронта (удержание −2 нс). Разность задержек путей данных и тактового сигнала должна лежать в пределах от −1,2 до +1,0 нс. При выровненных трассах и одинаковых ODDR и OBUF она близка к нулю – запас около 1 нс с каждой стороны.

    **Нестрогие проверки** (6 нс и −6 нс) Vivado строит автоматически для всех сочетаний фронтов и спадов. Они никогда не бывают худшими: если выполнены строгие, выполнены и они. Поэтому исключать их не обязательно. Если нужны чистые отчёты, исключают сразу все четыре (засчитываются оба варианта):
    \`\`\`
    set_false_path -setup -rise_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]
    set_false_path -setup -fall_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
    set_false_path -hold -rise_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]
    set_false_path -hold -fall_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]
    \`\`\`
    Исключать нужно ровно эти четыре проверки: ложный путь на строгой проверке (например, \`-setup -rise_from … -rise_to …\`) отключит настоящий анализ.

    **Типичные ошибки.**
    - Задержки только относительно фронта: тетрады, которые PHY захватывает спадом TXC, не проверяются.
    - Команды для спада без \`-add_delay\`: они перезаписывают задержки относительно фронта, и проверяется только половина данных.
    - Задержки относительно \`clk125\` вместо \`rgmii_txc\`: пропадает и сдвиг на 90°, и задержка пути тактового сигнала через ODDR и OBUF.
    - \`-source\` на тактовом выводе ODDR данных (clk125): форма \`{0 4}\` вместо \`{2 6}\` – сдвиг на 90° не учтён, требования к предустановке и удержанию сместятся на 2 нс.
    - Сдвиг на 90° «добавлен» ещё и в ограничениях (\`-edges {1 2 3} -edge_shift {2 2 2}\`): MMCM уже сдвинул clk125_90, и описанная форма \`{4 8}\` не совпадает с сигналом на выводе.

    **Проверка в Vivado:** \`report_clocks\` – у \`rgmii_txc\` форма \`{2.000 6.000}\`, исходный тактовый сигнал clk125_90; \`report_timing -to [get_ports {rgmii_txd[0]}] -delay_type min_max\`; при исключении нестрогих проверок – \`report_exceptions\`, чтобы убедиться, что все четыре команды действуют.
  `,
  refs: 'UG903, «Constraining Forwarded Clocks», set_output_delay -clock_fall -add_delay; спецификация RGMII v2.0',
  tests: [
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]\nset_output_delay -clock rgmii_txc -max 1.0 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -min -0.8 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -clock_fall -max 1.0 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -clock_fall -min -0.8 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]', pass: false, note: 'спад без -add_delay', expect: 'add_delay' },
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]\nset_output_delay -clock rgmii_txc -max 1.0 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -min -0.8 [get_ports {rgmii_txd[*] rgmii_tx_ctl}]', pass: false, note: 'только относительно фронта', expect: 'спада' },
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]\nset p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock clk125 -max 1.0 $p\nset_output_delay -clock clk125 -min -0.8 $p\nset_output_delay -clock clk125 -clock_fall -max 1.0 -add_delay $p\nset_output_delay -clock clk125 -clock_fall -min -0.8 -add_delay $p', pass: false, note: 'задержки относительно внутреннего clk125', expect: 'опорный' },
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins {txd_oddr[0]/C}] -divide_by 1 [get_ports rgmii_txc]\nset p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -max 1.0 $p\nset_output_delay -clock rgmii_txc -min -0.8 $p\nset_output_delay -clock rgmii_txc -clock_fall -max 1.0 -add_delay $p\nset_output_delay -clock rgmii_txc -clock_fall -min -0.8 -add_delay $p', pass: false, note: '-source на ODDR данных: потерян сдвиг 90°', expect: 'форма' },
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -edges {1 2 3} -edge_shift {2 2 2} [get_ports rgmii_txc]\nset p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -max 1.0 $p\nset_output_delay -clock rgmii_txc -min -0.8 $p\nset_output_delay -clock rgmii_txc -clock_fall -max 1.0 -add_delay $p\nset_output_delay -clock rgmii_txc -clock_fall -min -0.8 -add_delay $p', pass: false, note: 'сдвиг на 90° добавлен ещё и в ограничениях (двойной сдвиг)', expect: 'форма' },
    { code: 'create_generated_clock -name rgmii_txc -source [get_pins u_clk/mmcm_inst/CLKOUT1] -divide_by 1 [get_ports rgmii_txc]\nset p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\nset_output_delay -clock rgmii_txc -max 1.0 $p\nset_output_delay -clock rgmii_txc -min -0.8 $p\nset_output_delay -clock rgmii_txc -clock_fall -max 1.0 -add_delay $p\nset_output_delay -clock rgmii_txc -clock_fall -min -0.8 -add_delay $p', pass: true, note: '-source на выходе MMCM (тот же исходный тактовый сигнал clk125_90)' },
    { code: SSOUT_RGMII_REF + '\nset_false_path -setup -rise_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]\nset_false_path -setup -fall_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]', pass: true, note: 'исключены только нестрогие проверки предустановки', expect: 'исключена нестрогая проверка' },
    { code: SSOUT_RGMII_REF + '\nset_false_path -setup -rise_from [get_clocks clk125] -rise_to [get_clocks rgmii_txc]\nset_false_path -setup -fall_from [get_clocks clk125] -fall_to [get_clocks rgmii_txc]', pass: false, note: 'ложный путь на строгих проверках', expect: 'ложным' },
    { code: 'set p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\ncreate_generated_clock -name txc_fwd -source [get_pins txc_oddr/C] -multiply_by 1 [get_ports rgmii_txc]\nset_output_delay -clock txc_fwd -clock_fall -max 1.0 $p\nset_output_delay -clock txc_fwd -clock_fall -min -0.8 $p\nset_output_delay -clock txc_fwd -max 1.0 -add_delay $p\nset_output_delay -clock txc_fwd -min -0.8 -add_delay $p', pass: true, note: 'другое имя, сначала спад, затем фронт с -add_delay' },
    { code: 'set tsu 1.0\nset th 0.8\nset p [get_ports {rgmii_txd[*] rgmii_tx_ctl}]\ncreate_generated_clock -name rgmii_txc -source [get_pins txc_oddr/C] -divide_by 1 [get_ports rgmii_txc]\nset_output_delay -clock rgmii_txc -max $tsu $p\nset_output_delay -clock rgmii_txc -min [expr {-$th}] $p\nset_output_delay -clock rgmii_txc -clock_fall -max $tsu -add_delay $p\nset_output_delay -clock rgmii_txc -clock_fall -min [expr {-$th}] -add_delay $p\nset c [get_clocks -of_objects [get_pins u_clk/mmcm_inst/CLKOUT0]]\nset_false_path -setup -rise_from $c -fall_to [get_clocks rgmii_txc]\nset_false_path -setup -fall_from $c -rise_to [get_clocks rgmii_txc]\nset_false_path -hold -rise_from $c -rise_to [get_clocks rgmii_txc]\nset_false_path -hold -fall_from $c -fall_to [get_clocks rgmii_txc]', pass: true, note: 'переменные, ссылка на clk125 через -of_objects, исключение нестрогих проверок' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssout.why_fwd', module: 'ssout', order: 4, level: 2, tool: 'vivado', type: 'choice',
  lang: 'both', langNote: 'Правило «описывать тактовый сигнал там, где он покидает кристалл» одинаково для ПЛИС и ASIC.',
  title: 'Почему опора – тактовый сигнал на выходном порту?',
  tags: ['create_generated_clock', 'set_output_delay', 'понимание'],
  text: `
    Вернёмся к схеме задачи [[q:ssout.sdr_fwd|«ЦАП с тактовым сигналом от ПЛИС»]]: ПЛИС выдаёт ЦАП данные \`dac_d[13:0]\` и тактовый сигнал \`dac_clk\`, сформированный ODDR из \`sys_clk\`.

    Почему задержки выходов \`dac_d\` задают относительно **производного тактового сигнала на выходном порту** \`dac_clk\`, а не относительно внутреннего тактового сигнала \`sys_clk\`?
  `,
  design: ssoutDacDesign(false),
  options: [
    { text: 'Это не обязательно: задержки ODDR и OBUF малы, и с опорой на `sys_clk` результат практически тот же.', why: 'Неверно. Тактовое дерево вместе с ODDR и выходным буфером LVCMOS дают задержку в несколько наносекунд – величину, сравнимую с периодом. С опорой на sys_clk проверка предустановки станет пессимистичной на эту величину, а проверка удержания – оптимистичной: реальное нарушение удержания будет скрыто.' },
    { text: 'Достаточно `create_clock -period 10` на порту `dac_clk`: Vivado сам определит, что этот тактовый сигнал получен из `sys_clk`.', why: 'Неверно. create_clock создаёт независимый первичный тактовый сигнал с нулевой задержкой в точке определения. Связь с sys_clk и задержка пути через ODDR и OBUF теряются, а report_clock_interaction покажет пару sys_clk → dac_clk как Timed (unsafe).' },
    { text: 'Только так в анализ попадает задержка пути тактового сигнала от `sys_clk` через BUFG, ODDR и OBUF до порта: Vivado сравнивает данные с фронтом, который действительно приходит на ЦАП, а одинаковые участки путей данных и тактового сигнала взаимно компенсируются.', ok: true, why: 'Верно. Производный тактовый сигнал на порту наследует форму sys_clk и получает задержку своего пути. В проверки входит разность задержек путей данных и тактового сигнала – так же, как в реальной схеме.' },
    { text: 'Производный тактовый сигнал нужен лишь для того, чтобы в отчётах было удобное имя `dac_clk`.', why: 'Неверно. Имя – второстепенное. Главное – точка определения (выходной порт) и связь с исходным тактовым сигналом: от них зависят требования к предустановке и удержанию.' },
    { text: 'Опорой должен быть виртуальный тактовый сигнал с периодом 10 нс, ведь ЦАП – внешнее устройство.', why: 'Неверно. Виртуальный тактовый сигнал не проходит через ПЛИС и не имеет задержки внутри неё; его применяют, когда тактовый сигнал приёмника формируется не в ПЛИС. Здесь тактовый сигнал ЦАП выдаёт сама ПЛИС, и задержку его пути необходимо учитывать.' },
  ],
  explain: `
    \`\`\`
    create_generated_clock -name dac_clk -source [get_pins dac_clk_oddr/C] -divide_by 1 [get_ports dac_clk]
    set_output_delay -clock [get_clocks dac_clk] -max 1.500 [get_ports {dac_d[*]}]
    set_output_delay -clock [get_clocks dac_clk] -min -0.800 [get_ports {dac_d[*]}]
    \`\`\`
    В интерфейсе с синхронизацией от источника приёмник тактируется сигналом, который выдаёт сама ПЛИС. Данные и тактовый сигнал запускаются одним фронтом и проходят похожие цепи, поэтому для приёмника важна лишь **разность** задержек этих путей. Именно её и проверяет Vivado, если опорой задержек выхода служит производный тактовый сигнал, определённый на выходном порту: путь тактового сигнала (BUFG, ODDR, OBUF) входит в анализ так же, как путь данных.

    Короткое правило: *где тактовый сигнал покидает ПЛИС, там его и описывают* – \`create_generated_clock\` на выходном порту, \`-source\` на тактовом выводе ODDR, а все \`set_output_delay\` интерфейса – относительно этого тактового сигнала.
  `,
});
