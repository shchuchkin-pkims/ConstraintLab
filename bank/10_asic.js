/* Модуль 10. SDC для ASIC (Design Compiler, PrimeTime, Innovus, OpenSTA) */
XT.bank.module({
  id: 'asic', order: 90, title: '10. SDC для ASIC: блок и тактовые сигналы',
  about: 'Окружение блока до синтеза тактового дерева, PLL и делители частоты (create_generated_clock, -edges), режимы работы и set_case_analysis, виртуальные тактовые сигналы, изменения после синтеза тактового дерева',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.block_basic', module: 'asic', order: 1, level: 2, tool: 'sdc',
  lang: 'sdc', langNote: '`set_driving_cell`, `set_clock_transition`, `set_max_transition` и оценка задержки тактового дерева в Vivado не применяются: тактовые сети ПЛИС готовые. `create_clock` и задержки ввода/вывода общие.',
  title: 'Базовый SDC-файл блока: тактовый сигнал и окружение',
  tags: ['create_clock', 'set_clock_uncertainty', 'set_clock_latency', 'set_clock_transition', 'set_driving_cell', 'set_load', 'set_max_transition'],
  text: `
    Цифровой блок \`core_top\` синтезируется на частоту **500 МГц**. Блок принимает 8-разрядные данные \`din[7:0]\` с признаком \`valid_in\`, обрабатывает их за один такт и выдаёт результат \`dout[7:0]\` с признаком \`valid_out\`.

    Вход \`rst_n\` – внешний асинхронный сброс. Внутри блока он проходит через синхронизатор \`u_rst_sync\`, а требования к нему описывает отдельный файл ограничений верхнего уровня. Поэтому в этой задаче для \`rst_n\` **не задаются** ни задержка, ни управляющая ячейка.

    Архитектор системы на кристалле выделил блоку следующий бюджет:

    | Параметр | Значение |
    |---|---|
    | Тактовый сигнал \`clk\` | 500 МГц (T = 2,0 нс), коэффициент заполнения 50 % |
    | Неопределённость тактового сигнала (uncertainty) | 0,12 нс для предустановки, 0,05 нс для удержания |
    | Оценка задержки тактового дерева (до его синтеза) | 0,35 нс |
    | Длительность фронта тактового сигнала (до синтеза дерева) | 0,06 нс |
    | Входные задержки: все входы, кроме \`clk\` и \`rst_n\` | 60 % периода относительно \`clk\` = 1,2 нс |
    | Выходные задержки: все выходы | 40 % периода относительно \`clk\` = 0,8 нс |
    | Управляющая ячейка (driving cell) входов, кроме \`clk\` и \`rst_n\` | библиотечная ячейка \`BUFX4\` |
    | Нагрузка каждого выхода | 0,015 пФ |
    | Максимальная длительность фронта в блоке | 0,15 нс |

    Единицы библиотеки: время – наносекунды, ёмкость – пикофарады.

    **Задание.** Напишите SDC-файл блока \`core_top\`: опишите тактовый сигнал \`clk\` и все параметры из таблицы.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок core_top' },
      { id: 'pdin', t: 'in', name: 'din', w: 8, x: 20, y: 27 },
      { id: 'pvin', t: 'in', name: 'valid_in', x: 20, y: 157 },
      { id: 'prst', t: 'in', name: 'rst_n', x: 40, y: 293 },
      { id: 'pclk', t: 'in', name: 'clk', x: 40, y: 383 },
      { id: 'rdin', t: 'dff', name: 'din_reg', w: 8, x: 170, y: 20 },
      { id: 'rvin', t: 'dff', name: 'valid_in_reg', x: 170, y: 150 },
      {
        id: 'rs', t: 'block', name: 'u_rst_sync', title: 'синхронизатор', x: 170, y: 270, bw: 130, bh: 70,
        pins: [{ n: 'RST_N', d: 'in', y: 34 }, { n: 'CK', d: 'in', clk: true, y: 56 }, { n: 'RST_N_SYNC', d: 'out', y: 34 }],
        timing: { seq: true, clk: 'CK', launch: { RST_N_SYNC: ['rise'] }, async: { RST_N: ['rise'] } },
      },
      { id: 'proc', t: 'logic', name: 'u_proc', w: 8, label: 'обработка', x: 300, y: 15 },
      { id: 'and', t: 'and2', name: 'u_vld_and', x: 330, y: 158 },
      { id: 'rdout', t: 'dff', name: 'dout_reg', w: 8, x: 430, y: 20 },
      { id: 'rvout', t: 'dff', name: 'valid_out_reg', x: 430, y: 158 },
      { id: 'pdout', t: 'out', name: 'dout', w: 8, x: 560, y: 27 },
      { id: 'pvout', t: 'out', name: 'valid_out', x: 560, y: 165 },
    ],
    wires: [
      { from: 'pdin', to: 'rdin.D' },
      { from: 'rdin.Q', to: 'proc.I' },
      { from: 'proc.O', to: 'rdout.D' },
      { from: 'rdout.Q', to: 'pdout' },
      { from: 'pvin', to: 'rvin.D' },
      { from: 'rvin.Q', to: 'and.A' },
      { from: 'and.Y', to: 'rvout.D' },
      { from: 'rvout.Q', to: 'pvout' },
      { from: 'prst', to: 'rs.RST_N', kind: 'rst' },
      { from: 'rs.RST_N_SYNC', to: 'and.B', kind: 'rst', mx: 314, net: 'rst_sync_n' },
      { from: 'pclk', to: ['rdin.CK', 'rvin.CK', 'rs.CK'], kind: 'clk', trunk: 50, label: 'clk' },
      { from: 'pclk', to: ['rdout.CK', 'rvout.CK'], kind: 'clk', via: [[418, 394]] },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные, фиолетовые – сброс. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Бюджет блока при T = 2 нс', t: [-0.3, 4.3], width: 560,
      signals: [
        { name: 'clk (порт)', clock: { period: 2 }, arrows: 'rise' },
        { name: 'clk (регистры)', clock: { period: 2, rise: 0.35, fall: 1.35, jitter: 0.12 }, arrows: 'rise' },
        { name: 'din, valid_in', bus: [[1.2, 1.26, 'N'], [3.2, 3.26, 'N+1']], init: 'N−1' },
        { name: 'dout, valid_out', bus: [[0.7, 1.2, 'M']], init: 'X' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 2, label: 'захват', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 0.35, label: 'оценка дерева 0,35', cls: 'clk' },
        { row: 2, t0: 0, t1: 1.2, label: 'вход: 1,2 нс (60 %)', cls: 'data' },
        { row: 3, t0: 1.2, t1: 2, label: 'выход: 0,8 нс (40 %)', cls: 'setup' },
      ],
      windows: [{ row: 3, t0: 1.2, t1: 2, cls: 'setup' }],
      caption: 'Входные данные появляются через 1,2 нс после фронта clk на порту, выходные должны установиться за 0,8 нс до следующего фронта. На тактовом сигнале у регистров показаны оценка задержки дерева и полоса неопределённости шириной 0,12 нс. До синтеза дерева DC и PrimeTime прибавляют оценку задержки и к моменту запуска внешних данных, и к моменту захвата, поэтому для путей через порты она взаимно компенсируется, а неопределённость уменьшает бюджет.',
    },
  ],
  solutions: [`create_clock -name clk -period 2.000 [get_ports clk]
set_clock_uncertainty -setup 0.120 [get_clocks clk]
set_clock_uncertainty -hold  0.050 [get_clocks clk]
set_clock_latency    0.350 [get_clocks clk]
set_clock_transition 0.060 [get_clocks clk]

set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
set_input_delay  -clock clk 1.200 $inputs
set_output_delay -clock clk 0.800 [all_outputs]
set_driving_cell -lib_cell BUFX4 $inputs
set_load 0.015 [all_outputs]
set_max_transition 0.150 [current_design]`, `create_clock -name clk -period 2.000 [get_ports clk]
set_clock_uncertainty -setup 0.120 [get_clocks clk]
set_clock_uncertainty -hold  0.050 [get_clocks clk]
set_clock_latency    0.350 [get_clocks clk]
set_clock_transition 0.060 [get_clocks clk]

set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
set_input_delay  -clock clk 1.200 $inputs
set_output_delay -clock clk 0.800 [all_outputs]
# выход ячейки указан явно (для буфера необязательно)
set_driving_cell -lib_cell BUFX4 -pin Y $inputs
set_load 0.015 [all_outputs]
set_max_transition 0.150 [current_design]`],
  check: { clockNames: true },
  hints: [
    'Начните с тактового сигнала: `create_clock` на порту `clk`, T = 1000 / 500 = 2 нс. Параметры идеального тактового сигнала (неопределённость, оценка задержки дерева, длительность фронта) задают командами `set_clock_*` для `[get_clocks clk]`.',
    'Разные значения неопределённости – две команды `set_clock_uncertainty` с опциями `-setup` и `-hold`. Оценка задержки тактового дерева – `set_clock_latency` **без** `-source`.',
    'Входы без тактового порта и сброса: `set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]`. Дальше: `set_input_delay -clock clk 1.2 $inputs`, `set_driving_cell -lib_cell BUFX4 $inputs`, `set_output_delay -clock clk 0.8 [all_outputs]`, `set_load 0.015 [all_outputs]`, `set_max_transition 0.15 [current_design]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk -period 2.000 [get_ports clk]
    set_clock_uncertainty -setup 0.120 [get_clocks clk]
    set_clock_uncertainty -hold  0.050 [get_clocks clk]
    set_clock_latency    0.350 [get_clocks clk]
    set_clock_transition 0.060 [get_clocks clk]

    set inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]
    set_input_delay  -clock clk 1.200 $inputs
    set_output_delay -clock clk 0.800 [all_outputs]
    set_driving_cell -lib_cell BUFX4 $inputs
    set_load 0.015 [all_outputs]
    set_max_transition 0.150 [current_design]
    \`\`\`
    **Тактовый сигнал до синтеза тактового дерева (CTS).** При логическом синтезе тактового дерева ещё нет: тактовый сигнал *идеальный* и приходит на все регистры одновременно, с нулевой задержкой и бесконечно крутым фронтом. Три команды делают эту модель реалистичной:
    - \`set_clock_uncertainty\` – запас на джиттер генератора, будущий перекос тактового дерева и погрешность модели. Для предустановки он сокращает период: 2,0 − 0,12 = 1,88 нс на путь «регистр – регистр»; для удержания требует, чтобы данные не менялись ещё 0,05 нс после фронта. Значения различаются, поэтому команд две.
    - \`set_clock_latency\` (без \`-source\`) – оценка задержки тактового дерева (network latency). Моменты в отчётах становятся близкими к будущим реальным. Для путей через порты DC и PrimeTime по умолчанию добавляют эту оценку и к моменту запуска внешних данных (опция \`-network_latency_included\` команд \`set_input_delay\` и \`set_output_delay\` это отключает), поэтому бюджеты ввода/вывода до синтеза дерева от неё не зависят.
    - \`set_clock_transition\` – длительность фронта на тактовых выводах регистров. Задержка «тактовый вход – выход» и время предустановки в библиотеке зависят от длительности фронта тактового сигнала; без этой команды она считалась бы нулевой, и оценки были бы оптимистичными.

    **Окружение блока.**
    - \`set_input_delay 1.2\` – внешняя логика использует 60 % периода. На внутренний путь от порта до регистра остаётся 2,0 − 1,2 − 0,12 = 0,68 нс (минус время предустановки регистра).
    - \`set_output_delay 0.8\` – приёмнику нужно 40 % периода. От фронта на регистре \`dout_reg\` до порта остаётся 2,0 − 0,8 − 0,12 = 1,08 нс (включая задержку «тактовый вход – выход»).
    - \`set_driving_cell -lib_cell BUFX4\` – входы управляются реальной ячейкой с конечным выходным сопротивлением: САПР рассчитывает длительность фронта на входе и задержку, зависящую от нагрузки порта. Без неё вход считается идеальным. Опция \`-pin\` (выход ячейки) нужна только для ячеек с несколькими выходами.
    - \`set_load 0.015\` – ёмкость, которую видит выходной формирователь (вход соседнего блока и межсоединение). Единица – из библиотеки (здесь пФ).
    - \`set_max_transition 0.15 [current_design]\` – правило проектирования (design rule) для всего блока: синтез и топологическое проектирование вставляют буферы и увеличивают размер ячеек, если фронт где-либо длиннее 0,15 нс.

    **Почему исключены \`clk\` и \`rst_n\`.** \`all_inputs\` возвращает все входы, включая тактовый. Входная задержка на порту тактового сигнала бессмысленна (это не данные), а длительность фронта тактового сигнала до синтеза дерева задаёт \`set_clock_transition\`. Для \`rst_n\` задержка относительно \`clk\` создала бы проверки восстановления и снятия сброса (recovery/removal) на синхронизаторе – для асинхронного входа это лишние требования, которые синтез пытался бы выполнить.

    **Типичные ошибки и их последствия:**
    - одна команда \`set_clock_uncertainty 0.12\` без \`-setup\`/\`-hold\`: требование к удержанию завышено на 0,07 нс, и после синтеза тактового дерева в блок будут вставлены лишние буферы для исправления удержания;
    - \`set_clock_latency -source 0.35\`: это задержка *вне* блока (от генератора до порта). После синтеза дерева сетевая оценка заменяется реальной задержкой дерева, а задержка \`-source\` остаётся: в отчётах тактовый сигнал будет приходить на регистры на 0,35 нс позже, чем в действительности, а требования к путям между \`clk\` и другими тактовыми сигналами (например, виртуальным) сместятся на те же 0,35 нс;
    - \`set_load 15\` (фемтофарады при библиотеке в пикофарадах): нагрузка в 1000 раз больше реальной, синтез поставит огромные выходные буферы;
    - пропущенная \`set_clock_transition\` или \`set_driving_cell\`: оптимистичные задержки, нарушения проявятся только после топологического проектирования.

    **Проверка.** В PrimeTime: \`report_clock -skew\` (неопределённость, задержка и длительность фронта идеального тактового сигнала), \`report_port -verbose\` (задержки, управляющие ячейки и нагрузки портов), \`check_timing\` (порты без задержек; \`rst_n\` в списке *no_input_delay* здесь ожидаем – сброс ограничивается на верхнем уровне), \`report_timing -from [get_ports {din[*]}]\`. В OpenSTA – \`report_clock_properties\`, \`check_setup\`, \`report_checks\`. В консоли ConstraintLab – \`report_clocks\`, \`check_timing\`, \`report_timing -from [get_ports {din[*]}]\`.
  `,
  tests: [
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty 0.12 -setup [get_clocks clk]\nset_clock_uncertainty 0.05 -hold [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset_input_delay 1.2 -clock clk [get_ports {din[*] valid_in}]\nset_output_delay 0.8 -clock clk [get_ports {dout[*] valid_out}]\nset_driving_cell -lib_cell BUFX4 [get_ports {din[*] valid_in}]\nset_load 0.015 [get_ports {dout[*] valid_out}]\nset_max_transition 0.15 [current_design]', pass: true, note: 'явные списки портов' },
    { code: 'set T 2.0\ncreate_clock -name clk -period $T [get_ports clk]\nset_clock_uncertainty -setup 0.12 clk\nset_clock_uncertainty -hold 0.05 clk\nset_clock_latency 0.35 clk\nset_clock_transition 0.06 clk\nset in_ports [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk [expr {0.6*$T}] $in_ports\nset_output_delay -clock clk [expr {0.4*$T}] [all_outputs]\nset_driving_cell -lib_cell BUFX4 $in_ports\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: true, note: 'через переменные и expr' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty -setup 0.12 [get_clocks clk]\nset_clock_uncertainty -hold 0.05 [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk 1.2 $inputs\nset_output_delay -clock clk 0.8 [all_outputs]\nset_driving_cell -lib_cell [get_lib_cells */BUFX4] -pin Y $inputs\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: true, note: 'get_lib_cells и явный выход -pin Y' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty -setup 0.12 [get_clocks clk]\nset_clock_uncertainty -hold 0.05 [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset_input_delay -clock clk 1.2 [all_inputs]\nset_output_delay -clock clk 0.8 [all_outputs]\nset_driving_cell -lib_cell BUFX4 [all_inputs]\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: false, note: 'all_inputs вместе с clk и rst_n', expect: 'Лишняя set_input_delay' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty 0.12 [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk 1.2 $inputs\nset_output_delay -clock clk 0.8 [all_outputs]\nset_driving_cell -lib_cell BUFX4 $inputs\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: false, note: 'одна неопределённость для предустановки и удержания', expect: 'set_clock_uncertainty: неверное значение 0.12' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty -setup 0.12 [get_clocks clk]\nset_clock_uncertainty -hold 0.05 [get_clocks clk]\nset_clock_latency -source 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk 1.2 $inputs\nset_output_delay -clock clk 0.8 [all_outputs]\nset_driving_cell -lib_cell BUFX4 $inputs\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: false, note: 'задержка вне блока (-source) вместо оценки тактового дерева', expect: 'Не задано: set_clock_latency' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty -setup 0.12 [get_clocks clk]\nset_clock_uncertainty -hold 0.05 [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset_clock_transition 0.06 [get_clocks clk]\nset inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk 1.2 $inputs\nset_output_delay -clock clk 0.8 [all_outputs]\nset_driving_cell -lib_cell BUFX4 $inputs\nset_load 15 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: false, note: 'нагрузка в фемтофарадах', expect: 'set_load: неверное значение 15' },
    { code: 'create_clock -name clk -period 2 [get_ports clk]\nset_clock_uncertainty -setup 0.12 [get_clocks clk]\nset_clock_uncertainty -hold 0.05 [get_clocks clk]\nset_clock_latency 0.35 [get_clocks clk]\nset inputs [remove_from_collection [all_inputs] [get_ports {clk rst_n}]]\nset_input_delay -clock clk 0.8 $inputs\nset_output_delay -clock clk 1.2 [all_outputs]\nset_driving_cell -lib_cell BUFX4 $inputs\nset_load 0.015 [all_outputs]\nset_max_transition 0.15 [current_design]', pass: false, note: 'перепутаны входной и выходной бюджеты, нет set_clock_transition', expect: ['set_input_delay -max относительно фронта «clk»: 0.8', 'Не задано: set_clock_transition'] },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.pll_div', module: 'asic', order: 2, level: 2, tool: 'sdc',
  lang: 'both', langNote: 'В Vivado для выходов MMCM/PLL такие команды не нужны: тактовые сигналы выводятся автоматически. Делитель на регистре описывают одинаково.',
  title: 'PLL и делитель частоты: производные тактовые сигналы в ASIC',
  tags: ['create_generated_clock', '-multiply_by', '-divide_by', 'PLL'],
  text: `
    Система на кристалле тактируется от внешнего кварцевого генератора **25 МГц**, подключённого к порту \`ref_clk\`. Аналоговый блок PLL \`u_pll\` умножает частоту на **16**: его выход \`u_pll/CLKOUT0\` (400 МГц) тактирует ядро. Периферия работает на **200 МГц**: этот тактовый сигнал формирует делитель на 2 – триггер \`div_reg\`, выход которого через инвертор подаётся обратно на его вход D.

    Регистры ядра \`core_reg[15:0]\` передают данные в регистры периферии \`periph_reg[15:0]\`. Оба тактовых сигнала получены из одного опорного, поэтому передача синхронная и должна анализироваться.

    В Vivado тактовые сигналы на выходах MMCM/PLL выводятся автоматически. Design Compiler и PrimeTime о коэффициенте умножения ничего не знают: модель аналогового блока в библиотеке (Liberty, .lib) его не содержит, и тактовый сигнал через PLL сам не распространяется.

    **Задание.** Опишите три тактовых сигнала: опорный \`ref_clk\` на порту, \`pll_clk\` на выходе PLL и \`clk_div2\` на выходе делителя. Тактовые сигналы PLL и делителя должны быть связаны с опорным.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: -40, y: 143, label: '25 МГц', ext: true },
      { id: 'chip', t: 'boundary', label: 'Кристалл' },
      { id: 'pref', t: 'in', name: 'ref_clk', x: 66, y: 152 },
      { id: 'pll', t: 'apll', name: 'u_pll', x: 170, y: 120, note: '×16', outs: [{ pin: 'CLKOUT0', label: 'CLKOUT0: 400 МГц' }] },
      { id: 'core', t: 'logic', name: 'u_core', w: 16, label: 'логика ядра', bw: 94, x: 380, y: 55 },
      { id: 'rcore', t: 'dff', name: 'core_reg', w: 16, x: 500, y: 60 },
      { id: 'inv', t: 'inv', name: 'u_div_inv', x: 430, y: 170, noName: true },
      { id: 'rdiv', t: 'dff', name: 'div_reg', x: 500, y: 230 },
      { id: 'rper', t: 'dff', name: 'periph_reg', w: 16, x: 660, y: 190 },
    ],
    wires: [
      { from: 'osc.out', to: 'pref.pad' },
      { from: 'pref', to: 'pll.REFCLK', kind: 'clk' },
      { from: 'pll.CLKOUT0', to: ['rcore.CK', 'rdiv.CK'], kind: 'clk', label: '400 МГц' },
      { from: 'core.O', to: 'rcore.D' },
      { from: 'rcore.Q', to: 'rper.D', mx: 620 },
      { from: 'rdiv.Q', to: 'rper.CK', kind: 'clk', label: '200 МГц' },
      { from: 'rdiv.Q', to: 'inv.A', kind: 'clk', my: 160 },
      { from: 'inv.Y', to: 'rdiv.D' },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные, пунктир – вне кристалла. Выход делителя div_reg/Q – одна цепь: она тактирует periph_reg и через инвертор возвращается на вход D. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Все тактовые сигналы привязаны к фронту ref_clk', t: [-1, 21], width: 600,
      signals: [
        { name: 'ref_clk 25 МГц', clock: { period: 40 }, arrows: 'rise' },
        { name: 'pll_clk 400 МГц', clock: { period: 2.5 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk_div2 200 МГц', clock: { period: 5 }, arrows: 'rise' },
      ],
      marks: [{ t: 0, label: 'общий фронт' }, { t: 7.5, label: 'запуск', cls: 'launch' }, { t: 10, label: 'захват', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 2.5, label: 'T = 40 / 16 = 2,5 нс', cls: 'clk' },
        { row: 2, t0: 7.5, t1: 10, label: 'предустановка 2,5 нс', cls: 'setup' },
      ],
      caption: 'Производные тактовые сигналы отсчитываются от фронта ref_clk: каждый 16-й фронт pll_clk и каждый 8-й фронт clk_div2 совпадают с фронтом опорного сигнала. Путь core_reg → periph_reg запускается фронтом pll_clk в 7,5 нс и захватывается ближайшим фронтом clk_div2 в 10 нс: требование к предустановке 2,5 нс, к удержанию 0.',
    },
  ],
  solution: `create_clock -name ref_clk -period 40.000 [get_ports ref_clk]
create_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]
create_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]`,
  check: { clockNames: true },
  hints: [
    'Опорный тактовый сигнал – обычный `create_clock` на порту: T = 1000 / 25 = 40 нс.',
    'Выход PLL описывают производным тактовым сигналом: `-source` – точка, где присутствует исходный сигнал (порт `ref_clk` или вывод `u_pll/REFCLK`), `-multiply_by 16`, точка определения – `[get_pins u_pll/CLKOUT0]`.',
    'Делитель: `create_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]`. Исходный сигнал – на тактовом входе триггера, производный – на его выходе.',
  ],
  explain: `
    \`\`\`
    create_clock -name ref_clk -period 40.000 [get_ports ref_clk]
    create_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]
    create_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]
    \`\`\`
    **Почему в ASIC выход PLL описывают вручную.** PLL – аналоговый блок (hard macro). Его модель в библиотеке описывает выводы, но не частотное соотношение: коэффициент умножения задаётся делителями в цепи обратной связи и часто программируется после включения. Временна́я дуга REFCLK → CLKOUT в модели либо отсутствует, и тогда статический анализ останавливает тактовый сигнал на входе PLL, либо описывает только задержку, но не умножение частоты. Vivado знает параметры MMCM/PLL из настроек примитива и выводит тактовые сигналы сам, а в SDC это делает разработчик.

    **Что будет без \`pll_clk\`.** За PLL нет ни одного тактового сигнала: \`check_timing\` сообщит о регистрах без тактового сигнала (*no_clock*), а все пути ядра и периферии останутся без ограничений. Синтез не будет их оптимизировать, а в отчёте \`report_timing\` не окажется ни одного нарушения: отчёт выглядит безупречным, хотя ничего не проверено. Это самая опасная разновидность ошибки.

    **Почему производный, а не \`create_clock\` на CLKOUT0.** Производный тактовый сигнал хранит связь с опорным: в отчётах указан исходный сигнал, при изменении периода \`ref_clk\` период \`pll_clk\` пересчитывается автоматически, а программы структурной проверки передачи между тактовыми доменами считают такие сигналы синхронными. Кроме того, компенсацию задержки цепью обратной связи PLL в PrimeTime описывают именно производным тактовым сигналом (опции \`-pll_feedback\` и \`-pll_output\` команды \`create_generated_clock\`): задержки тактового дерева учитываются так, как их компенсирует реальная PLL. Первичный тактовый сигнал на CLKOUT0 – независимый, и вся эта информация теряется. Опорную точку можно указать и на входе PLL: \`-source [get_pins u_pll/REFCLK]\` – тактовый сигнал \`ref_clk\` там присутствует, результат тот же.

    **Делитель.** \`-source\` – тактовый вход триггера \`div_reg/CK\`, где присутствует исходный \`pll_clk\`; точка определения – выход \`div_reg/Q\`. \`-divide_by 2\` даёт период 5 нс и форму {0 2,5}: фронты \`clk_div2\` совпадают с каждым вторым фронтом \`pll_clk\` (равноценная запись – \`-edges {1 3 5}\`). То, что сигнал \`div_reg/Q\` через инвертор возвращается на вход D, на описание не влияет: это обычный путь данных в домене \`pll_clk\`.

    **Путь ядро → периферия.** Запуск фронтом \`pll_clk\` в 7,5 нс, захват ближайшим фронтом \`clk_div2\` в 10 нс: требование к предустановке 2,5 нс, к удержанию 0. Без \`clk_div2\` регистры \`periph_reg\` остались бы без тактового сигнала.

    **Типичные ошибки:**
    - \`create_clock -period 2.5 [get_pins u_pll/CLKOUT0]\` – независимый первичный тактовый сигнал (см. выше);
    - неверный коэффициент (\`-multiply_by 8\`): период 5 нс вместо 2,5 – ядро синтезируется на половину требуемой частоты, а кристалл на 400 МГц работать не будет;
    - \`-source [get_pins div_reg/Q]\` – перепутаны точка-источник и точка определения: на выходе делителя исходного тактового сигнала нет, и САПР не сможет вычислить производный тактовый сигнал (в PrimeTime о нём сообщит \`check_timing\`, раздел *generated_clocks*);
    - \`create_clock -period 5 [get_pins div_reg/Q]\` вместо производного: задержка тактового дерева от PLL до \`div_reg/CK\` и задержка «тактовый вход – выход» делителя выпадают из расчёта, и перекос между ядром и периферией (сотни пикосекунд при периоде 2,5 нс) будет оценён неверно.

    **Проверка.** \`report_clock\` в PrimeTime (в консоли ConstraintLab – \`report_clocks\`): у \`pll_clk\` и \`clk_div2\` указаны исходные тактовые сигналы. \`check_timing\` не должна сообщать о *no_clock* и непостроенных производных тактовых сигналах (*generated_clocks*). Путь между доменами: \`report_timing -from [get_cells {core_reg[*]}] -to [get_cells {periph_reg[*]}]\`.
  `,
  tests: [
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_pins u_pll/REFCLK] -multiply_by 16 [get_pins u_pll/CLKOUT0]\ncreate_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]', pass: true, note: '-source на входе PLL' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]\ncreate_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -edges {1 3 5} [get_pins div_reg/Q]', pass: true, note: 'делитель через -edges' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_clock -name pll_clk -period 2.5 [get_pins u_pll/CLKOUT0]\ncreate_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]', pass: false, note: 'create_clock на выходе PLL', expect: 'должен быть производным' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 8 [get_pins u_pll/CLKOUT0]\ncreate_generated_clock -name clk_div2 -source [get_pins div_reg/CK] -divide_by 2 [get_pins div_reg/Q]', pass: false, note: 'неверный коэффициент умножения', expect: 'неверный период 5' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]', pass: false, note: 'нет тактового сигнала делителя', expect: 'Не описан производный тактовый сигнал на «div_reg/Q»' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]\ncreate_generated_clock -name clk_div2 -source [get_pins div_reg/Q] -divide_by 2 [get_pins div_reg/Q]', pass: false, note: '-source на выходе делителя', expect: 'нет ни одного тактового сигнала' },
    { code: 'create_clock -name ref_clk -period 40 [get_ports ref_clk]\ncreate_generated_clock -name pll_clk -source [get_ports ref_clk] -multiply_by 16 [get_pins u_pll/CLKOUT0]\ncreate_clock -name clk_div2 -period 5 [get_pins div_reg/Q]', pass: false, note: 'create_clock на выходе делителя', expect: 'должен быть производным' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.div3', module: 'asic', order: 3, level: 3, tool: 'sdc',
  lang: 'both', langNote: 'Опция `-edges` одинакова в XDC и SDC.',
  title: 'Делитель на 3: коэффициент заполнения 1/3 и нумерация фронтов',
  tags: ['create_generated_clock', '-edges', 'коэффициент заполнения', 'спад'],
  text: `
    Тактовый сигнал \`clk\` частотой **100 МГц** поступает на порт блока. Для медленной периферии нужен тактовый сигнал **33,3 МГц**, который формирует делитель на 3:
    - двухразрядный счётчик \`cnt_reg[1:0]\` по фронтам \`clk\` считает 0, 1, 2, 0, …;
    - регистр \`div3_q_reg\` (ячейка DFF, тактируется фронтом \`clk\`) выставляет 1 ровно на один период \`clk\` из трёх.

    Выход \`div3_q_reg/Q\` – тактовый сигнал \`clk_div3\`: высокий уровень длится **10 нс**, низкий – **20 нс** (коэффициент заполнения 1/3).

    От \`clk_div3\` работают регистры \`slow_reg[7:0]\` (по фронту) и \`neg_reg[7:0]\` (по спаду, ячейки DFFN). Данные из \`slow_reg\` должны дойти до \`neg_reg\` за время высокого уровня \`clk_div3\`, а обратно, через логику \`u_slow\`, – за время низкого уровня.

    **Задание.** Опишите тактовый сигнал \`clk\` и производный тактовый сигнал \`clk_div3\` с точной формой, чтобы пути \`slow_reg → neg_reg\` и \`neg_reg → slow_reg\` получили правильные требования.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок periph_top', y: -28 },
      { id: 'pclk', t: 'in', name: 'clk', x: 20, y: 159 },
      { id: 'cnt', t: 'logic', name: 'u_cnt', w: 2, label: '+1 mod 3', x: 110, y: 55 },
      { id: 'rcnt', t: 'dff', name: 'cnt_reg', w: 2, x: 210, y: 60 },
      { id: 'dec', t: 'logic', name: 'u_dec', label: 'cnt = 2', x: 300, y: 55 },
      { id: 'rq', t: 'dff', name: 'div3_q_reg', x: 400, y: 60 },
      { id: 'slow', t: 'logic', name: 'u_slow', w: 8, label: 'u_slow', x: 500, y: 55 },
      { id: 'rslow', t: 'dff', name: 'slow_reg', w: 8, x: 600, y: 60 },
      { id: 'rneg', t: 'dffn', name: 'neg_reg', w: 8, x: 690, y: 60 },
    ],
    wires: [
      { from: 'cnt.O', to: 'rcnt.D' },
      { from: 'rcnt.Q', to: 'dec.I', noSlash: true },
      { from: 'rcnt.Q', to: 'cnt.I', via: [[292, 78], [292, 20], [98, 20]] },
      { from: 'dec.O', to: 'rq.D' },
      { from: 'pclk', to: 'rcnt.CK', kind: 'clk', via: [[198, 170]], label: 'clk' },
      { from: 'pclk', to: 'rq.CK', kind: 'clk', via: [[388, 170]] },
      { from: 'rq.Q', to: ['rslow.CK', 'rneg.CKN'], kind: 'clk', via: [[476, 200]], label: 'clk_div3' },
      { from: 'slow.O', to: 'rslow.D' },
      { from: 'rslow.Q', to: 'rneg.D' },
      { from: 'rneg.Q', to: 'slow.I', via: [[772, 78], [772, 20], [488, 20]], noSlash: true },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные. neg_reg (DFFN) тактируется спадом clk_div3. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Номера фронтов clk и форма clk_div3', t: [-2, 42], width: 620,
      signals: [
        { name: 'clk', clock: { period: 10 }, arrows: 'rise' },
        { name: 'clk_div3 {1 3 7}', clock: { period: 30, rise: 0, fall: 10 }, arrows: 'rise', cls: 'launch' },
        { name: '-divide_by 3', clock: { period: 30, rise: 0, fall: 15 } },
      ],
      notes: [
        { row: 0, t: 0.6, text: '1', anchor: 'start' }, { row: 0, t: 5.6, text: '2', anchor: 'start' }, { row: 0, t: 10.6, text: '3', anchor: 'start' },
        { row: 0, t: 15.6, text: '4', anchor: 'start' }, { row: 0, t: 20.6, text: '5', anchor: 'start' }, { row: 0, t: 25.6, text: '6', anchor: 'start' },
        { row: 0, t: 30.6, text: '7', anchor: 'start' }, { row: 0, t: 35.6, text: '8', anchor: 'start' },
      ],
      marks: [{ t: 0, label: 'запуск slow_reg ↑', cls: 'launch' }, { t: 10, label: 'захват neg_reg ↓', cls: 'capture' }, { t: 15, label: 'спад при -divide_by 3', cls: 'hold' }],
      spans: [
        { row: 1, t0: 0, t1: 10, label: '10 нс', cls: 'setup' },
        { row: 1, t0: 10, t1: 30, label: '20 нс', cls: 'setup' },
        { row: 2, t0: 0, t1: 15, label: '15 нс', cls: 'hold' },
        { row: 2, t0: 15, t1: 30, label: '15 нс', cls: 'hold' },
      ],
      caption: 'Цифры над clk – номера фронтов исходного сигнала для -edges: нечётные – фронты, чётные – спады. div3_q_reg переключается только по фронтам clk: 1 (0 нс), 3 (10 нс), 7 (30 нс). Форма -divide_by 3 ({1 4 7}) ставит спад на 15 нс – в момент спада clk, когда выход триггера измениться не может.',
    },
  ],
  solution: `create_clock -name clk -period 10.000 [get_ports clk]
create_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 7} [get_pins div3_q_reg/Q]`,
  check: { clockNames: true },
  hints: [
    'Опция `-divide_by 3` даёт коэффициент заполнения 50 % (высокий уровень 15 нс). Реальный сигнал другой – форму нужно задать по фронтам исходного тактового сигнала опцией `-edges`.',
    'Фронты `clk` нумеруются с 1: 1 – фронт в 0 нс, 2 – спад в 5 нс, 3 – фронт в 10 нс и т.д. `-edges {e1 e2 e3}`: фронт производного сигнала совпадает с e1, спад – с e2, следующий фронт – с e3.',
    'Выход `div3_q_reg` становится 1 по фронту 1 (0 нс), 0 – по фронту 3 (10 нс) и снова 1 – по фронту 7 (30 нс): `create_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 7} [get_pins div3_q_reg/Q]`.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk -period 10.000 [get_ports clk]
    create_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 7} [get_pins div3_q_reg/Q]
    \`\`\`
    **Нумерация фронтов.** Опция \`-edges\` перечисляет номера событий исходного тактового сигнала на выводе \`-source\`: нечётные номера – фронты, чётные – спады.

    | Номер | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
    |---|---|---|---|---|---|---|---|
    | Событие \`clk\` | фронт | спад | фронт | спад | фронт | спад | фронт |
    | Момент, нс | 0 | 5 | 10 | 15 | 20 | 25 | 30 |

    Три числа задают фронт производного сигнала, его спад и следующий фронт. \`div3_q_reg\` тактируется фронтом, поэтому его выход меняется только в нечётных событиях: становится 1 по фронту 1, 0 – по фронту 3 и снова 1 – по фронту 7. Отсюда \`{1 3 7}\`: период 30 нс, высокий уровень 10 нс, форма {0 10}.

    **Требования к путям.**
    - \`slow_reg → neg_reg\` (фронт → спад \`clk_div3\`): предустановка 10 нс.
    - \`neg_reg → u_slow → slow_reg\` (спад → фронт): предустановка 20 нс.
    - Пути счётчика (\`cnt_reg → cnt_reg\`, \`cnt_reg → div3_q_reg\`) анализируются в домене \`clk\`: 10 нс.

    **Почему не \`-divide_by 3\`.** \`-divide_by N\` равносильна \`-edges {1 N+1 2N+1}\`, то есть \`{1 4 7}\`: спад попадает на событие 4 – спад \`clk\` в 15 нс. Триггер, тактируемый фронтом, так переключиться не может. С формой {0 15} путь \`slow_reg → neg_reg\` получил бы 15 нс вместо 10 – анализ **оптимистичен на 5 нс**, и синтез оставил бы путь, который в кристалле не успевает. Обратный путь получил бы 15 нс вместо 20 – напрасно жёсткое требование.

    **Другие ошибки:**
    - \`-edges {1 2 7}\` – спад в 5 нс (событие 2 – спад \`clk\`): коэффициент заполнения 1/6, путь \`slow_reg → neg_reg\` получает лишь 5 нс;
    - \`-edges {1 3 5}\` – это деление на 2 (период 20 нс);
    - \`create_clock -period 30 -waveform {0 10} [get_pins div3_q_reg/Q]\` – форма верна, но тактовый сигнал первичный: задержка тактового дерева до \`div3_q_reg/CK\` и задержка «тактовый вход – выход» делителя не учитываются, а связь с \`clk\` для путей между доменами теряется.

    Если делитель действительно формирует симметричный сигнал (например, второй триггер по спаду и элемент ИЛИ на выходе), верна форма \`{1 4 7}\` и запись \`-divide_by 3\`. Форму всегда берут из реальной схемы делителя. Сдвиг отдельных фронтов на заданное время задаёт опция \`-edge_shift\` (только вместе с \`-edges\`), а \`-duty_cycle\` в SDC сочетается только с \`-multiply_by\`.

    **Проверка.** \`report_clock\` (в консоли ConstraintLab – \`report_clocks\`): у \`clk_div3\` период 30 нс и форма {0 10}. Затем \`report_timing -from [get_cells {slow_reg[*]}] -to [get_cells {neg_reg[*]}]\`: требование 10 нс.
  `,
  tests: [
    { code: 'create_clock -name clk -period 10 [get_ports clk]\ncreate_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -divide_by 3 [get_pins div3_q_reg/Q]', pass: false, note: '-divide_by 3: коэффициент заполнения 50 %', expect: 'неверная форма' },
    { code: 'create_clock -name clk -period 10 [get_ports clk]\ncreate_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 2 7} [get_pins div3_q_reg/Q]', pass: false, note: 'спад по событию 2', expect: 'неверная форма' },
    { code: 'create_clock -name clk -period 10 [get_ports clk]\ncreate_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges {1 3 5} [get_pins div3_q_reg/Q]', pass: false, note: 'деление на 2', expect: 'неверный период 20' },
    { code: 'create_clock -name clk -period 10 [get_ports clk]\ncreate_clock -name clk_div3 -period 30 -waveform {0 10} [get_pins div3_q_reg/Q]', pass: false, note: 'первичный тактовый сигнал на выходе делителя', expect: 'должен быть производным' },
    { code: 'set e [list 1 3 7]\ncreate_clock -name clk -period 10 [get_ports clk]\ncreate_generated_clock -name clk_div3 -source [get_pins div3_q_reg/CK] -edges $e [get_pins div3_q_reg/Q]', pass: true, note: 'список через переменную' },
    { code: 'create_clock -name clk -period 10 [get_ports clk]\ncreate_generated_clock -name clk_div3 -source [get_ports clk] -edges {1 3 7} [get_pins div3_q_reg/Q]', pass: true, note: '-source на порту' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.test_mux', module: 'asic', order: 4, level: 2, tool: 'sdc',
  lang: 'both', langNote: '`set_case_analysis` есть и в Vivado (например, для статического выбора на BUFGMUX); сканирующие триггеры и тестовые режимы – тема ASIC.',
  title: 'Функциональный режим: мультиплексор тестового тактового сигнала и сканирование',
  tags: ['set_case_analysis', 'CKMUX2', 'сканирование', 'режимы работы'],
  text: `
    Ядро тактируется через мультиплексор тактовых сигналов \`u_clk_mux\` (ячейка CKMUX2): при \`test_mode = 0\` на регистры проходит функциональный тактовый сигнал \`func_clk\` **250 МГц**, при \`test_mode = 1\` – тестовый \`tck\` **20 МГц**. Оба сигнала поступают на порты. Сигнал \`tck\` тактирует также контроллер JTAG \`u_tap\`, который работает и в функциональном режиме (отладочный доступ).

    Регистры ядра \`core_reg[7:0]\` – сканируемые триггеры (SDFF): при \`scan_en = 1\` они загружают данные с входа SI (цепочка сканирования начинается с порта \`scan_in\`), при \`scan_en = 0\` – с функционального входа D.

    Нужен SDC-файл для статического анализа **функционального режима**, в котором \`test_mode\` и \`scan_en\` всегда равны 0. Порты сканирования в этом режиме не используются, задержки для них не задаются.

    **Задание.** Опишите тактовые сигналы \`func_clk\` и \`tck\` и зафиксируйте функциональный режим константами на портах \`test_mode\` и \`scan_en\`: на регистры ядра должен приходить только \`func_clk\`, а пути через вход разрешения сканирования не должны анализироваться.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок core_top' },
      { id: 'psi', t: 'in', name: 'scan_in', x: 41, y: 219 },
      { id: 'pse', t: 'in', name: 'scan_en', x: 41, y: 279 },
      { id: 'pfc', t: 'in', name: 'func_clk', x: 34, y: 337 },
      { id: 'ptck', t: 'in', name: 'tck', x: 54, y: 365 },
      { id: 'ptm', t: 'in', name: 'test_mode', x: 28, y: 409 },
      { id: 'mux', t: 'ckmux2', name: 'u_clk_mux', x: 200, y: 330 },
      { id: 'rc', t: 'sdff', name: 'core_reg', w: 8, x: 330, y: 214, nameX: 46 },
      { id: 'lg', t: 'logic', name: 'u_logic', w: 8, label: 'логика ядра', bw: 94, x: 440, y: 209 },
      {
        id: 'tap', t: 'block', name: 'u_tap', title: 'контроллер JTAG (TAP)', x: 330, y: 440, bw: 170, bh: 50,
        pins: [{ n: 'TCK', d: 'in', clk: true, y: 32 }], timing: { seq: true, clk: 'TCK' },
      },
    ],
    wires: [
      { from: 'psi', to: 'rc.SI', mx: 290 },
      { from: 'pse', to: 'rc.SE', mx: 296 },
      { from: 'pfc', to: 'mux.A', kind: 'clk' },
      { from: 'ptck', to: 'mux.B', kind: 'clk' },
      { from: 'ptck', to: 'tap.TCK', kind: 'clk', via: [[150, 472]] },
      { from: 'ptm', to: 'mux.S' },
      { from: 'mux.Y', to: 'rc.CK', kind: 'clk', mx: 312, net: 'clk_core' },
      { from: 'rc.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'rc.D', my: 180 },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы, синие – данные и управляющие сигналы. Вход 0 мультиплексора выбирается при test_mode = 0. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Без set_case_analysis: func_clk и tck на одних регистрах', t: [-2, 58], width: 620,
      signals: [
        { name: 'func_clk 250 МГц', clock: { period: 4 }, arrows: 'rise', cls: 'launch' },
        { name: 'tck 20 МГц', clock: { period: 50 }, arrows: 'rise' },
        { name: 'test_mode', bit: [], init: 0 },
      ],
      marks: [{ t: 48, label: 'запуск func_clk', cls: 'launch' }, { t: 50, label: 'захват tck', cls: 'capture' }],
      spans: [{ row: 1, t0: 48, t1: 50, label: 'предустановка 2 нс', cls: 'setup' }],
      caption: 'Если tck не остановлен на мультиплексоре, на core_reg приходят оба тактовых сигнала, и САПР проверяет пути func_clk → tck и tck → func_clk. На общем периоде 100 нс худшая пара фронтов разнесена всего на 2 нс (48 → 50 нс) – требование, которого нет ни в одном реальном режиме: test_mode задаётся статически и во время работы не переключается.',
    },
  ],
  solution: `create_clock -name func_clk -period 4.000 [get_ports func_clk]
create_clock -name tck -period 50.000 [get_ports tck]
set_case_analysis 0 [get_ports test_mode]
set_case_analysis 0 [get_ports scan_en]`,
  check: { clockNames: true },
  hints: [
    'Оба тактовых сигнала описывают на портах: 250 МГц → 4 нс, 20 МГц → 50 нс. `tck` нужен и в функциональном режиме: им тактируется контроллер TAP.',
    'Режим фиксируют константами на управляющих входах: `set_case_analysis <значение> <порты>`. САПР распространяет константу через логику и отключает неактивные входы мультиплексоров.',
    '`set_case_analysis 0 [get_ports test_mode]` – мультиплексор пропускает только `func_clk`; `set_case_analysis 0 [get_ports scan_en]` – триггеры работают с входа D.',
  ],
  explain: `
    \`\`\`
    create_clock -name func_clk -period 4.000 [get_ports func_clk]
    create_clock -name tck -period 50.000 [get_ports tck]
    set_case_analysis 0 [get_ports test_mode]
    set_case_analysis 0 [get_ports scan_en]
    \`\`\`
    **Как работает \`set_case_analysis\`.** Команда задаёт логическую константу, и САПР распространяет её через ячейки так же, как это сделала бы логическая схема. Константа 0 на \`u_clk_mux/S\` отключает временны́е дуги B → Y и S → Y мультиплексора: \`tck\` останавливается на его входе, и на \`core_reg\` приходит только \`func_clk\`. Константа 0 на \`scan_en\` делает выводы SE постоянными: путей от порта \`scan_en\` нет, а проверки на входе SI в библиотеке сканируемого триггера обычно заданы при условии SE = 1 и тоже отключаются. Контроллер TAP подключён к \`tck\` напрямую и по-прежнему анализируется на 20 МГц. Константы задают именно на портах, а не на выводе \`u_clk_mux/S\`: в реальном проекте \`test_mode\` и \`scan_en\` управляют сотнями ячеек тестовой логики, и константа на порту распространяется на все сразу.

    **Что будет без \`set_case_analysis\`.** Оба тактовых сигнала проходят через мультиплексор: \`check_timing\` сообщит о нескольких тактовых сигналах на тактовых выводах (*multiple_clock*), а САПР проверит пути \`core_reg → core_reg\` для всех четырёх пар: \`func_clk → func_clk\` (4 нс), \`tck → tck\` (50 нс) и междоменные \`func_clk → tck\`, \`tck → func_clk\` с требованием 2 нс (см. диаграмму). Синтез будет тратить площадь и мощность на выполнение несуществующих требований, а отчёты окажутся засорены ложными нарушениями.

    **\`set_case_analysis 1\`** – это тестовый режим: на ядро приходит только \`tck\`, и логика ядра анализируется на 20 МГц вместо 250 МГц. Нарушения функционального режима окажутся невидимыми.

    **\`set_clock_groups -logically_exclusive -group func_clk -group tck\`** вместо констант убирает только междоменные проверки. Оба тактовых сигнала по-прежнему приходят на \`core_reg\`, пути через \`scan_en\` остаются. Такой приём применяют в объединённом (merged) анализе, когда несколько режимов проверяют одним прогоном. Для выхода мультиплексора тогда описывают по производному тактовому сигналу на каждый вход (\`-combinational\`, \`-add\`, \`-master_clock\`) и объявляют их \`-physically_exclusive\`. Это экономит прогоны, но в анализе остаются пути, существующие только в тестовом режиме. Для финальной проверки (signoff) функционального режима точнее и проще отдельный SDC-файл с \`set_case_analysis\`; для тестового режима пишут свой файл (\`test_mode = 1\`, \`scan_en = 1\` для сдвига, задержки на портах сканирования).

    **Проверка.** В PrimeTime: \`report_case_analysis\` (действующие константы), \`report_disable_timing\` (дуги, отключённые константами), \`check_timing\` – предупреждения *multiple_clock* быть не должно. В консоли ConstraintLab: \`check_timing\` без замечаний, а \`report_clock_interaction\` показывает единственную пару \`func_clk → func_clk\` (внутренние пути контроллера TAP на схеме не показаны). Проверки входа SI ConstraintLab, как и библиотека, выполняет только при SE = 1, поэтому после \`set_case_analysis 0 [get_ports scan_en]\` порт \`scan_in\` не попадает в список входов без задержки: его ограничивают в SDC-файле тестового режима.
  `,
  tests: [
    { code: 'create_clock -name func_clk -period 4 [get_ports func_clk]\ncreate_clock -name tck -period 50 [get_ports tck]', pass: false, note: 'без set_case_analysis', expect: 'лишние: tck' },
    { code: 'create_clock -name func_clk -period 4 [get_ports func_clk]\ncreate_clock -name tck -period 50 [get_ports tck]\nset_case_analysis 1 [get_ports test_mode]\nset_case_analysis 0 [get_ports scan_en]', pass: false, note: 'тестовый режим вместо функционального', expect: ['не хватает: func_clk', 'set_case_analysis: неверное значение 1'] },
    { code: 'create_clock -name func_clk -period 4 [get_ports func_clk]\ncreate_clock -name tck -period 50 [get_ports tck]\nset_clock_groups -logically_exclusive -group [get_clocks func_clk] -group [get_clocks tck]', pass: false, note: 'группы тактовых сигналов вместо констант', expect: 'Не задано: set_case_analysis' },
    { code: 'create_clock -name func_clk -period 4 [get_ports func_clk]\ncreate_clock -name tck -period 50 [get_ports tck]\nset_case_analysis 0 [get_ports test_mode]', pass: false, note: 'не зафиксирован scan_en', expect: 'Не задано: set_case_analysis' },
    { code: 'create_clock -name func_clk -period 4 [get_ports func_clk]\nset_case_analysis 0 [get_ports test_mode]\nset_case_analysis 0 [get_ports scan_en]', pass: false, note: 'не описан tck', expect: 'Не описан тактовый сигнал на «tck»' },
    { code: 'create_clock -period 4 [get_ports func_clk]\ncreate_clock -period 50 [get_ports tck]\nset_case_analysis 0 [get_ports {test_mode scan_en}]', pass: true, note: 'одна команда для двух портов, имена по умолчанию' },
    { code: 'create_clock -name func_clk -period 4.0 [get_ports func_clk]\ncreate_clock -name tck -period [expr {1000.0 / 20}] [get_ports tck]\nforeach p {test_mode scan_en} { set_case_analysis zero [get_ports $p] }', pass: true, note: 'цикл foreach, значение zero, период через expr' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.vclk_io', module: 'asic', order: 5, level: 3, tool: 'sdc',
  lang: 'both', langNote: 'Виртуальный тактовый сигнал и задержки ввода/вывода общие; в ASIC так задают бюджеты блоков кристалла.',
  title: 'Виртуальный тактовый сигнал для бюджетов ввода/вывода блока',
  tags: ['create_clock', 'виртуальный тактовый сигнал', 'set_input_delay', 'set_output_delay'],
  text: `
    Блок \`dsp_core\` работает на частоте **400 МГц** (T = 2,5 нс) и обменивается данными с соседними блоками кристалла: блок-источник \`u_src\` передаёт ему 16-разрядные данные \`din[15:0]\`, а блок-приёмник \`u_dst\` принимает результат \`dout[15:0]\`. Все три блока тактируются разными ветвями одного тактового дерева, то есть одним и тем же тактовым сигналом 400 МГц.

    Бюджет, согласованный на уровне кристалла:
    - блок-источник выдаёт данные через **1,1 нс** после своего фронта тактового сигнала;
    - блок-приёмник требует, чтобы данные были на его входах за **0,7 нс** до своего фронта (выходная задержка 0,7 нс).

    Для простоты каждое значение задаёт обе границы: команды пишутся без \`-max\` и \`-min\`.

    Внутренний тактовый сигнал блока описывают на порту \`clk\`. Соседние блоки запускают и захватывают данные фронтами на своих регистрах; эти фронты задержаны собственными ветвями дерева и не совпадают с фронтом на порту \`clk\` блока \`dsp_core\`. Поэтому внешний тактовый сигнал принято описывать отдельно – **виртуальным** тактовым сигналом.

    **Задание.** Опишите тактовый сигнал \`clk\` на порту, виртуальный тактовый сигнал с тем же периодом (например, \`vclk\`) и задержки ввода/вывода относительно виртуального тактового сигнала.
  `,
  design: {
    elements: [
      { id: 'src', t: 'chip', name: 'u_src', title: 'источник u_src', x: 0, y: 40, bw: 112, bh: 80, ext: true, pins: [{ n: 'Q', side: 'r', y: 40 }, { n: 'CK', side: 'b', x: 56 }] },
      { id: 'nsrc', t: 'note', x: 0, y: -18, text: 'через 1,1 нс\nпосле фронта CK' },
      { id: 'blk', t: 'boundary', label: 'Блок dsp_core' },
      { id: 'pdin', t: 'in', name: 'din', w: 16, x: 156, y: 69 },
      { id: 'rdin', t: 'dff', name: 'din_reg', w: 16, x: 262, y: 62 },
      { id: 'proc', t: 'logic', name: 'u_proc', w: 16, label: 'обработка', x: 350, y: 57 },
      { id: 'rdout', t: 'dff', name: 'dout_reg', w: 16, x: 452, y: 62 },
      { id: 'pdout', t: 'out', name: 'dout', w: 16, x: 540, y: 69 },
      { id: 'pclk', t: 'in', name: 'clk', x: 166, y: 169 },
      { id: 'dst', t: 'chip', name: 'u_dst', title: 'приёмник u_dst', x: 672, y: 40, bw: 112, bh: 80, ext: true, pins: [{ n: 'D', side: 'l', y: 40 }, { n: 'CK', side: 'b', x: 56 }] },
      { id: 'ndst', t: 'note', x: 672, y: -18, text: 'нужны за 0,7 нс\nдо фронта CK' },
      { id: 'root', t: 'chip', name: 'u_ctree', title: 'корень тактового дерева 400 МГц', titleY: 25, x: 290, y: 280, bw: 230, bh: 40, ext: true, pins: [{ n: 'O', side: 't', x: 115, label: '' }] },
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
      { from: 'root.O', to: 'src.CK' },
      { from: 'root.O', to: 'pclk.pad', via: [[154, 268]] },
      { from: 'root.O', to: 'dst.CK' },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Оранжевые линии – тактовые сигналы блока, синие – данные, пунктир – соседние блоки и ветви тактового дерева вне dsp_core. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Бюджеты относительно общего фронта, T = 2,5 нс', t: [-0.3, 5.3], width: 600,
      signals: [
        { name: 'vclk (u_src, u_dst)', clock: { period: 2.5 }, arrows: 'rise', cls: 'launch' },
        { name: 'clk (dsp_core)', clock: { period: 2.5 }, arrows: 'rise' },
        { name: 'din на входе', bus: [[1.1, 1.18, 'N'], [3.6, 3.68, 'N+1']], init: 'N−1' },
        { name: 'dout на выходе', bus: [[1.0, 1.8, 'M'], [3.5, 4.3, 'M+1']], init: 'M−1' },
      ],
      marks: [{ t: 0, label: 'фронт во всех блоках', cls: 'launch' }, { t: 2.5, label: 'следующий фронт', cls: 'capture' }],
      spans: [
        { row: 2, t0: 0, t1: 1.1, label: 'u_src: 1,1 нс', cls: 'data' },
        { row: 2, t0: 1.1, t1: 2.5, label: 'dsp_core: 1,4 нс', cls: 'setup' },
        { row: 3, t0: 0, t1: 1.8, label: 'dsp_core: 1,8 нс', cls: 'setup' },
        { row: 3, t0: 1.8, t1: 2.5, label: 'u_dst: 0,7 нс', cls: 'data' },
      ],
      windows: [{ row: 3, t0: 1.8, t1: 2.5, cls: 'setup' }],
      caption: 'Вход: данные появляются через 1,1 нс после фронта блока-источника, внутреннему пути dsp_core остаётся 2,5 − 1,1 = 1,4 нс. Выход: данные должны установиться за 0,7 нс до фронта блока-приёмника, путь от dout_reg до порта получает 2,5 − 0,7 = 1,8 нс (без учёта неопределённости и времени предустановки).',
    },
  ],
  solution: `create_clock -name clk  -period 2.500 [get_ports clk]
create_clock -name vclk -period 2.500
set_input_delay  -clock vclk 1.100 [get_ports {din[*]}]
set_output_delay -clock vclk 0.700 [get_ports {dout[*]}]`,
  check: {
    requireVirtual: true, clockNames: ['clk'],
  },
  hints: [
    'Виртуальный тактовый сигнал – это `create_clock` **без объектов**; опция `-name` для него обязательна.',
    'Период виртуального сигнала тот же, 2,5 нс: соседние блоки тактируются тем же тактовым сигналом 400 МГц, только другими ветвями дерева.',
    '`set_input_delay -clock vclk 1.1 [get_ports {din[*]}]` и `set_output_delay -clock vclk 0.7 [get_ports {dout[*]}]`. Значения – это время, занятое *вне* блока: задержка источника после фронта и запас, который нужен приёмнику до фронта.',
  ],
  explain: `
    \`\`\`
    create_clock -name clk  -period 2.500 [get_ports clk]
    create_clock -name vclk -period 2.500
    set_input_delay  -clock vclk 1.100 [get_ports {din[*]}]
    set_output_delay -clock vclk 0.700 [get_ports {dout[*]}]
    \`\`\`
    **Что описывает виртуальный тактовый сигнал.** \`vclk\` не привязан ни к одному объекту проекта: это модель тактового сигнала *на регистрах соседних блоков*. Задержки ввода/вывода отсчитываются от его фронтов, а внутренние регистры \`dsp_core\` тактируются \`clk\`. Так как оба сигнала описаны с одинаковым периодом и нулевой фазой, САПР анализирует передачу как синхронную: на вход отводится 2,5 − 1,1 = 1,4 нс, на выход 2,5 − 0,7 = 1,8 нс (минус неопределённость и время предустановки).

    **Зачем отдельный сигнал, если период тот же.**
    - *Независимые параметры внешней стороны.* Задержку ветви дерева соседнего блока задают на виртуальном сигнале: \`set_clock_latency 0.40 [get_clocks vclk]\`; неопределённость передачи между блоками – \`set_clock_uncertainty -from [get_clocks vclk] -to [get_clocks clk] …\`. Внутренний \`clk\` при этом не меняется.
    - *Согласованность до и после синтеза тактового дерева.* После CTS \`clk\` переводят в режим \`set_propagated_clock\`: регистры \`dsp_core\` получают реальную задержку дерева (допустим, 0,4 нс). Для портов дерева нет, и задержки, заданные относительно \`clk\`, отсчитывались бы от фронта на порту с нулевой задержкой. Анализ считал бы, что соседний блок выдаёт данные на 0,4 нс раньше, чем на самом деле: вход получил бы лишние 0,4 нс (оптимистично), выход потерял бы их (пессимистично). Виртуальный тактовый сигнал всегда идеальный, его \`set_clock_latency\` действует и после CTS, и бюджеты остаются честными. В реальном маршруте поэтому добавляют \`set_clock_latency\` для \`vclk\` (оценку задержки ветвей соседних блоков) и такую же оценку для \`clk\` до CTS; в этой задаче задержки дерева не заданы, и в эталоне их нет.
    - *Чистое разделение бюджетов.* Ограничения ввода/вывода блока обычно формирует распределение бюджетов (budgeting) верхнего уровня, и они не должны зависеть от того, как устроен тактовый сигнал внутри блока (стробирование тактового сигнала, clock gating, делители, переименования).

    **Типичные ошибки:**
    - задержки относительно \`clk\`: до синтеза дерева числа в отчёте те же, но после CTS бюджеты сдвигаются на задержку дерева (см. выше);
    - \`set_input_delay 1.4\` (= 2,5 − 1,1): в команду записывают время, занятое **вне** блока, а не оставшееся внутри – иначе вход получит лишь 1,1 нс вместо 1,4;
    - \`set_output_delay 1.8\` (= 2,5 − 0,7): аналогичная ошибка для выхода – от выходного пути потребуется 0,7 нс вместо 1,8, синтез будет напрасно ускорять его;
    - виртуальный тактовый сигнал с другим периодом: требования к путям ввода/вывода определит худшая пара фронтов на общем периоде, и они не будут соответствовать реальному обмену.

    **Проверка.** \`report_clock\` (в консоли ConstraintLab – \`report_clocks\`): \`vclk\` – виртуальный, без источника. \`report_timing -from [get_ports {din[*]}]\`: фронт запуска – \`vclk\`, входная задержка 1,1 нс, захват – \`clk\`. \`check_timing\` не должна сообщать о входах без задержки (*no_input_delay*) и о неограниченных конечных точках (*unconstrained_endpoints*); в консоли ConstraintLab – о портах без задержек (*no_input_delay*, *no_output_delay*).
  `,
  tests: [
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\nset_input_delay -clock clk 1.1 [get_ports {din[*]}]\nset_output_delay -clock clk 0.7 [get_ports {dout[*]}]', pass: false, note: 'задержки относительно clk, без виртуального тактового сигнала', expect: ['Нет виртуального тактового сигнала', 'отсчитывают от виртуального тактового сигнала'] },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\ncreate_clock -name vclk -period 2.5\nset_input_delay -clock [get_clocks clk] 1.1 [get_ports {din[*]}]\nset_output_delay -clock [get_clocks clk] 0.7 [get_ports {dout[*]}]', pass: false, note: 'виртуальный тактовый сигнал создан, но не используется', expect: 'отсчитывают от виртуального тактового сигнала' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\ncreate_clock -name vclk -period 2.5\nset_input_delay -clock vclk 1.4 [get_ports {din[*]}]\nset_output_delay -clock vclk 0.7 [get_ports {dout[*]}]', pass: false, note: 'во входной задержке – оставшееся время', expect: 'set_input_delay -max относительно фронта «vclk»: 1.400' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\ncreate_clock -name vclk -period 2.5\nset_input_delay -clock vclk 1.1 [get_ports {din[*]}]\nset_output_delay -clock vclk 1.8 [get_ports {dout[*]}]', pass: false, note: 'в выходной задержке – бюджет блока', expect: 'set_output_delay -max относительно фронта «vclk»: 1.800' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\ncreate_clock -name v_nbr -period 2.5 -waveform {0 1.25}\nset_input_delay -clock v_nbr -max 1.1 [remove_from_collection [all_inputs] [get_ports clk]]\nset_input_delay -clock v_nbr -min 1.1 [remove_from_collection [all_inputs] [get_ports clk]]\nset_output_delay -clock v_nbr 0.7 [all_outputs]', pass: true, note: 'другое имя, -max/-min, all_inputs без clk' },
    { code: 'create_clock -name clk -period 2.5 [get_ports clk]\ncreate_clock -name vclk -period 2.5\nset_input_delay 1.1 -clock [get_clocks vclk] [get_ports din*]\nset_output_delay 0.7 -clock [get_clocks vclk] [get_ports dout*]', pass: true, note: 'шаблоны портов, get_clocks' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'asic.cts', module: 'asic', order: 6, level: 1, tool: 'sdc', type: 'choice', multi: true,
  lang: 'sdc', langNote: 'В ПЛИС тактовые сети готовые и всегда распространяемые (propagated), синтеза тактового дерева нет.',
  title: 'Что меняется в SDC после синтеза тактового дерева?',
  tags: ['set_propagated_clock', 'CTS', 'set_clock_latency', 'set_clock_uncertainty', 'понимание'],
  text: `
    SDC-файл блока \`core_top\` из задачи [[q:asic.block_basic|«Базовый SDC-файл блока»]] использовался при логическом синтезе. Теперь в Innovus выполнен синтез тактового дерева (clock tree synthesis, CTS): построено дерево из ячеек CKBUF, реальная задержка от порта \`clk\` до тактовых выводов регистров – от 0,31 до 0,39 нс. Блок готовят к финальному статическому анализу (signoff) в PrimeTime.

    Фрагмент исходного файла (неопределённость для предустановки 0,12 нс = джиттер 0,04 нс + оценка перекоса дерева 0,06 нс + запас 0,02 нс; для удержания 0,05 нс = перекос 0,03 нс + запас 0,02 нс):

    \`\`\`
    create_clock -name clk -period 2.000 [get_ports clk]
    set_clock_uncertainty -setup 0.120 [get_clocks clk]
    set_clock_uncertainty -hold  0.050 [get_clocks clk]
    set_clock_latency    0.350 [get_clocks clk]
    set_clock_transition 0.060 [get_clocks clk]
    set_input_delay  -clock clk 1.200 $inputs
    set_output_delay -clock clk 0.800 [all_outputs]
    set_driving_cell -lib_cell BUFX4 $inputs
    set_load 0.015 [all_outputs]
    set_max_transition 0.150 [current_design]
    \`\`\`

    **Задание.** Отметьте все изменения, которые нужно внести в SDC-файл для анализа после синтеза тактового дерева.
  `,
  design: {
    elements: [
      { id: 'blk', t: 'boundary', label: 'Блок core_top после CTS' },
      { id: 'pclk', t: 'in', name: 'clk', x: 20, y: 199 },
      { id: 'b0', t: 'ckbuf', name: 'u_cts_root', x: 110, y: 196 },
      { id: 'ba', t: 'ckbuf', name: 'u_cts_a', x: 220, y: 120 },
      { id: 'bb', t: 'ckbuf', name: 'u_cts_b', x: 450, y: 160 },
      { id: 'ra', t: 'dff', name: 'din_reg', w: 8, x: 300, y: 30 },
      { id: 'lg', t: 'logic', name: 'u_proc', w: 8, label: 'обработка', bh: 36, x: 410, y: 30 },
      { id: 'rb', t: 'dff', name: 'dout_reg', w: 8, x: 530, y: 30 },
    ],
    wires: [
      { from: 'pclk', to: 'b0.A', kind: 'clk', label: 'clk' },
      { from: 'b0.Y', to: ['ba.A', 'bb.A'], kind: 'clk' },
      { from: 'ba.Y', to: 'ra.CK', kind: 'clk', label: '0,31 нс', lx: 250, ly: 98 },
      { from: 'bb.Y', to: 'rb.CK', kind: 'clk', label: '0,39 нс', lx: 480, ly: 98 },
      { from: 'ra.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'rb.D' },
    ],
  },
  figures: [
    { kind: 'schematic', title: 'Схема', caption: 'Тактовое дерево после CTS: корневой буфер и два буфера ветвей. Подписи – реальная задержка от порта clk до тактовых выводов регистров. Щелчок по элементу вставляет его запрос в редактор.' },
    {
      kind: 'timing', title: 'Тактовый сигнал на регистрах до и после CTS', t: [-0.2, 2.6], width: 600,
      signals: [
        { name: 'clk на порту', clock: { period: 2 }, arrows: 'rise' },
        { name: 'до CTS: оценка', clock: { period: 2, rise: 0.35, fall: 1.35, jitter: 0.12 }, arrows: 'rise' },
        { name: 'после CTS: din_reg', clock: { period: 2, rise: 0.31, fall: 1.31 }, arrows: 'rise', cls: 'launch' },
        { name: 'после CTS: dout_reg', clock: { period: 2, rise: 0.39, fall: 1.39 }, arrows: 'rise' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 0.35, label: 'set_clock_latency 0,35 нс', cls: 'clk' },
        { row: 2, t0: 0, t1: 0.31, label: 'дерево: 0,31 нс', cls: 'data' },
        { row: 3, t0: 0, t1: 0.39, label: 'дерево: 0,39 нс', cls: 'clk' },
        { row: 3, t0: 0.31, t1: 0.39, label: 'перекос 0,08 нс', cls: 'setup' },
      ],
      caption: 'До CTS тактовый сигнал идеальный: одна оценка задержки для всех регистров и полоса неопределённости шириной 0,12 нс, в которую заложен ожидаемый перекос. После CTS у каждого регистра своя рассчитанная задержка, а перекос (здесь 0,08 нс) входит в анализ напрямую.',
    },
  ],
  options: [
    { text: 'Добавить `set_propagated_clock [all_clocks]`.', ok: true, why: 'Верно. Без этой команды PrimeTime продолжит считать тактовый сигнал идеальным: реальная задержка и перекос дерева в анализ не попадут. Программы топологического проектирования (Innovus, IC Compiler II) после CTS обычно переводят тактовые сигналы в этот режим сами, но в SDC-файле для финального анализа в PrimeTime команду пишут явно.' },
    { text: 'Удалить оценку задержки тактового дерева `set_clock_latency 0.350` (без `-source`).', ok: true, why: 'Верно. Для распространяемого (propagated) тактового сигнала сетевая задержка рассчитывается по дереву, а оценка игнорируется – оставлять её бессмысленно, она только запутывает. Задержку вне блока (`set_clock_latency -source`), если она задана, сохраняют: в дереве блока её нет.' },
    { text: 'Уменьшить `set_clock_uncertainty`: оставить джиттер и запас, убрать оценку перекоса.', ok: true, why: 'Верно. Перекос теперь рассчитывается по реальным задержкам до каждого регистра. Если оставить его и в неопределённости, он будет учтён дважды: анализ станет излишне пессимистичным (лишние буферы для исправления удержания, недобор частоты). Здесь: 0,06 нс для предустановки и 0,02 нс для удержания.' },
    { text: '`set_clock_transition` больше не нужна.', ok: true, why: 'Верно. Длительность фронта на каждом тактовом выводе теперь вычисляется по реальным ячейкам дерева и их нагрузке; для распространяемых тактовых сигналов команда игнорируется.' },
    { text: 'Изменить `create_clock`: задать тактовый сигнал на выходе корневого буфера `u_cts_root`.', why: 'Неверно. Период и точка определения не меняются: тактовый сигнал по-прежнему входит в блок через порт `clk`, и задержка от порта через все буферы дерева как раз должна учитываться. Тактовый сигнал на выходе буфера исключил бы часть дерева из анализа.' },
    { text: 'Скорректировать числа в `set_input_delay` и `set_output_delay` на величину задержки построенного тактового дерева.', why: 'Неверно. Эти числа описывают внешнюю сторону: сколько времени занимает логика за пределами блока относительно фронта тактового сигнала на его источнике. Снаружи блока после CTS ничего не изменилось, поэтому и числа те же, а реальную задержку до внутренних регистров PrimeTime учтёт сам. То, что после CTS входные пути получают больше времени, а выходные меньше, – физический эффект, который анализ и должен показать. Если внешняя сторона сама тактируется ветвью того же дерева (соседние блоки кристалла), её задержку описывают не правкой чисел, а `set_clock_latency` виртуального тактового сигнала: она действует и после CTS.' },
    { text: 'Удалить `set_driving_cell`, `set_load` и `set_max_transition`: после топологического проектирования они не нужны.', why: 'Неверно. Это описание окружения блока и правило проектирования, они действуют на всех этапах. После CTS ограничения для тактовых цепей часто даже ужесточают отдельной командой `set_max_transition -clock_path`.' },
  ],
  hints: [
    'Подумайте, какие команды описывают *идеальный* тактовый сигнал, то есть заменяют собой ещё не построенное дерево.',
    'Внешнее окружение блока (период, порты, задержки ввода/вывода, нагрузки) от синтеза дерева внутри блока не зависит.',
  ],
  explain: `
    | Команда | До CTS | После CTS |
    |---|---|---|
    | \`create_clock\` | на порту \`clk\` | без изменений |
    | \`set_propagated_clock\` | – | \`[all_clocks]\` |
    | \`set_clock_latency\` (сетевая) | оценка 0,35 нс | удаляют: задержка рассчитывается по дереву |
    | \`set_clock_latency -source\` | задержка вне блока | без изменений |
    | \`set_clock_uncertainty\` | джиттер + перекос + запас | джиттер + запас |
    | \`set_clock_transition\` | оценка 0,06 нс | удаляют: рассчитывается по дереву |
    | задержки ввода/вывода, окружение, правила проектирования | как в исходном файле | без изменений |

    Файл для анализа после CTS:

    \`\`\`
    create_clock -name clk -period 2.000 [get_ports clk]
    set_propagated_clock [all_clocks]
    set_clock_uncertainty -setup 0.060 [get_clocks clk] ;# без перекоса
    set_clock_uncertainty -hold  0.020 [get_clocks clk] ;# без перекоса
    set_input_delay  -clock clk 1.200 $inputs
    set_output_delay -clock clk 0.800 [all_outputs]
    set_driving_cell -lib_cell BUFX4 $inputs
    set_load 0.015 [all_outputs]
    set_max_transition 0.150 [current_design]
    \`\`\`
    **Логика изменений.** До CTS три команды (\`set_clock_latency\`, \`set_clock_transition\` и часть \`set_clock_uncertainty\`) *заменяют* собой ещё не построенное дерево. После CTS дерево существует, и PrimeTime рассчитывает его задержку, перекос и длительность фронтов сам – если тактовый сигнал объявлен распространяемым. Всё, что описывает мир *снаружи* блока, остаётся прежним.

    **Что меняется в бюджетах ввода/вывода.** До CTS оценка 0,35 нс добавлялась и к запуску внешних данных, и к захвату, поэтому взаимно компенсировалась. После CTS у порта задержки дерева нет, а у регистров она реальная: входные пути получают дополнительно около 0,35 нс, выходные теряют столько же. Это не ошибка ограничений, а физика: внешний фронт приходит на порт, а внутренние регистры видят его позже. Поэтому для выходов с жёстким бюджетом при CTS стараются уменьшить задержку дерева до выходных регистров, а для обмена между блоками одного кристалла используют виртуальный тактовый сигнал (см. [[q:asic.vclk_io|задачу о виртуальном тактовом сигнале]]).

    **Проверка в PrimeTime:** \`report_clock -skew\` и \`report_clock_timing -type skew\` (реальная задержка и перекос), \`report_timing -path_type full_clock_expanded\` (путь тактового сигнала через буферы дерева), \`check_timing -include {ideal_clocks}\` – тактовых сигналов, оставшихся идеальными, быть не должно.
  `,
});
