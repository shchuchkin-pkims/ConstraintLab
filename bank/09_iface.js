/* Модуль 9. Интерфейсы целиком и отладка ограничений (Vivado XDC) */
XT.bank.module({
  id: 'iface', order: 85, title: '9. Интерфейсы целиком и отладка',
  about: 'SPI с тактовым сигналом от делителя, SDR SDRAM, поиск ошибок в XDC, чтение check_timing',
});

const SPI_DESIGN = {
  elements: [
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    { id: 'p', t: 'in', name: 'sys_clk', x: 0, y: 150 },
    { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 96, y: 147, noName: true },
    { id: 'bg', t: 'bufg', name: 'sys_clk_bufg', x: 166, y: 147, noName: true },
    { id: 'sr', t: 'ff', name: 'sclk_reg', x: 300, y: 20 },
    { id: 'tg', t: 'logic', name: 'sclk_toggle', label: 'счётчик', x: 400, y: -40 },
    { id: 'sob', t: 'obuf', name: 'sclk_obuf', x: 560, y: 24, noName: true },
    { id: 'psc', t: 'out', name: 'spi_sclk', x: 640, y: 27 },
    { id: 'mr', t: 'ff', name: 'mosi_reg', x: 300, y: 140 },
    { id: 'mob', t: 'obuf', name: 'mosi_obuf', x: 560, y: 144, noName: true },
    { id: 'pm', t: 'out', name: 'spi_mosi', x: 640, y: 147 },
    { id: 'pmi', t: 'in', name: 'spi_miso', x: 0, y: 267 },
    { id: 'mib', t: 'ibuf', name: 'miso_ibuf', x: 96, y: 264, noName: true },
    { id: 'mir', t: 'ff', name: 'miso_reg', x: 300, y: 260 },
    { id: 'fl', t: 'chip', name: 'SPI flash', x: 790, y: 0, bw: 110, bh: 320, ext: true, pins: [{ n: 'SCLK', side: 'l', y: 38 }, { n: 'SI', side: 'l', y: 158 }, { n: 'SO', side: 'l', y: 278 }] },
  ],
  wires: [
    { from: 'p', to: 'ib.I', kind: 'clk' },
    { from: 'ib.O', to: 'bg.I', kind: 'clk' },
    { from: 'bg.O', to: ['sr.C', 'mr.C', 'mir.C'], kind: 'clk', label: 'sys_clk', trunk: 30 },
    { from: 'sr.Q', to: ['tg.I', 'sob.I'], kind: 'clk' },
    { from: 'tg.O', to: 'sr.D', my: -66 },
    { from: 'sob.O', to: 'psc', kind: 'clk' },
    { from: 'mr.Q', to: 'mob.I' },
    { from: 'mob.O', to: 'pm' },
    { from: 'pmi', to: 'mib.I' },
    { from: 'mib.O', to: 'mir.D' },
    { from: 'psc.pad', to: 'fl.SCLK' },
    { from: 'pm.pad', to: 'fl.SI' },
    { from: 'fl.SO', to: 'pmi.pad', my: 398, label: 'MISO' },
  ],
};
const SPI_WAVE = {
  kind: 'timing', title: 'SPI режим 0: SCLK = sys_clk / 4', t: [-4, 64],
  signals: [
    { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise' },
    { name: 'spi_sclk', clock: { period: 40, rise: 0, fall: 20 }, arrows: 'rise' },
    { name: 'spi_mosi', bus: [[20, 22, 'бит n'], [60, 62, 'бит n+1']], init: 'бит n−1' },
    { name: 'spi_miso', bus: [[21, 29.6, 'бит k'], [61, 69.6, 'бит k+1']], init: 'бит k−1' },
  ],
  marks: [{ t: 20, label: 'спад: MOSI', cls: 'launch' }, { t: 40, label: 'фронт: захват', cls: 'capture' }],
  spans: [{ row: 2, t0: 20, t1: 40, label: '20 нс до захвата', cls: 'setup' }, { row: 3, t0: 20, t1: 29.6, label: 'до 9,6 нс', cls: 'data' }],
  caption: 'MOSI изменяется по спаду SCLK и захватывается ведомым по следующему фронту; ведомый выдаёт MISO по спаду, а ПЛИС принимает его в такте sys_clk, совпадающем со следующим фронтом SCLK.',
};

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'iface.spi_out', module: 'iface', order: 1, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Производный тактовый сигнал на порту, задержки вывода и многотактные пути одинаковы в XDC и SDC.',
  title: 'SPI: тактовый сигнал от делителя и выход MOSI',
  tags: ['SPI', 'create_generated_clock', 'set_output_delay', 'set_multicycle_path'],
  text: `
    Ведущее устройство SPI в ПЛИС формирует \`spi_sclk\` = 25 МГц из \`sys_clk\` = 100 МГц: регистр \`sclk_reg\` переключается каждые два такта (деление на 4) и через \`OBUF\` выводится на порт. Режим 0: ведомый захватывает MOSI по **фронту** SCLK, а регистр \`mosi_reg\` (тактируется \`sys_clk\`) обновляет MOSI в том такте, который формирует **спад** SCLK, – за два такта \`sys_clk\` до фронта.

    Требования ведомой микросхемы: время предустановки по входу SI 4,0 нс, время удержания 4,0 нс; трассы SCLK и MOSI одинаковые.

    Без дополнительных указаний Vivado будет считать, что MOSI может измениться в любом такте \`sys_clk\`, и получит требование к предустановке 10 нс и требование к удержанию 0 нс. Последнее заставит выход \`spi_mosi\` иметь задержку не менее 4 нс – это ложное нарушение.

    **Задание.**
    1. Опишите тактовый сигнал \`spi_sclk\` на выходном порту.
    2. Задайте выходные задержки для \`spi_mosi\`.
    3. Сообщите анализу, что MOSI запускается за **2** такта \`sys_clk\` до фронта захвата и **не** изменяется в течение 4 тактов (до следующего спада SCLK).

    Вход MISO рассматривается в следующей задаче – здесь его не ограничивайте.
  `,
  design: SPI_DESIGN,
  figures: [SPI_WAVE],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solutions: [
    `create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]
set_output_delay -clock spi_sclk -max 4.000 [get_ports spi_mosi]
set_output_delay -clock spi_sclk -min -4.000 [get_ports spi_mosi]
set_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
set_multicycle_path 3 -hold -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]`,
    `create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]
set_output_delay -clock spi_sclk -max 4.000 [get_ports spi_mosi]
set_output_delay -clock spi_sclk -min -4.000 [get_ports spi_mosi]
set_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
set_false_path -hold -from [get_clocks sys_clk] -to [get_clocks spi_sclk]`,
  ],
  hints: [
    'SCLK выводится из ПЛИС, поэтому описывается производным тактовым сигналом на порту `spi_sclk` с `-source [get_pins sclk_reg/C]` и `-divide_by 4`.',
    'Многотактный путь между разными тактовыми сигналами: запуск нужно перенести на такт раньше в периодах тактового сигнала **запуска** – `-setup -start`.',
    'После `-setup 2 -start` проверка удержания относится к запуску через 10 нс после запуска для предустановки. Реально следующий запуск MOSI произойдёт через 40 нс: верните проверку удержания на 3 такта – `-hold 3 -start`.',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]
    set_output_delay -clock spi_sclk -max 4.000 [get_ports spi_mosi]
    set_output_delay -clock spi_sclk -min -4.000 [get_ports spi_mosi]
    set_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
    set_multicycle_path 3 -hold  -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
    \`\`\`
    **Тактовый сигнал.** Производный сигнал на порту \`spi_sclk\` связан с \`sys_clk\`, и задержка пути \`sclk_reg → OBUF → порт\` учитывается в моменте фронта на выводе ПЛИС – так же, как задержка данных MOSI.

    **Соотношение фронтов по умолчанию.** Фронты \`sys_clk\`: 0, 10, 20, 30 нс; фронт \`spi_sclk\`: 40 нс. Ближайшая пара – запуск в 30 нс, захват в 40 нс: предустановка 10 нс, удержание 0 нс.

    **С многотактным путём.**
    - \`-setup 2 -start\` переносит запуск на такт раньше: 20 нс → 40 нс, требование к предустановке **20 нс**, бюджет 20 − 4 = 16 нс.
    - Проверка удержания после этого относится к запуску в 30 нс (требование 10 нс). На самом деле следующее изменение MOSI происходит только в 60 нс, а предыдущий захват был в 0 нс: требование −20 нс. \`-hold 3 -start\` сдвигает проверку удержания на 3 такта запуска: 10 − 30 = **−20 нс**.

    Правило «N и N−1» (\`-hold 1\`) здесь дало бы требование 0 нс и ложное нарушение удержания: выход MOSI должен был бы иметь задержку не меньше 4 нс. Допустим и вариант \`set_false_path -hold\` для этих путей – он тоже засчитывается, но \`-hold 3\` точнее описывает поведение схемы.

    Сигнал выбора ведомого CS_N ограничивают так же, как MOSI.
  `,
  tests: [
    { code: 'create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]\nset_output_delay -clock spi_sclk -max 4 [get_ports spi_mosi]\nset_output_delay -clock spi_sclk -min -4 [get_ports spi_mosi]', pass: false, note: 'без многотактного пути', expect: 'не объявлен многотактным' },
    { code: 'create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]\nset_output_delay -clock spi_sclk -max 4 [get_ports spi_mosi]\nset_output_delay -clock spi_sclk -min -4 [get_ports spi_mosi]\nset_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]\nset_multicycle_path 1 -hold -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]', pass: false, note: 'правило N-1', expect: 'Удержание' },
    { code: 'create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]\nset_output_delay -clock spi_sclk -max 4 [get_ports spi_mosi]\nset_output_delay -clock spi_sclk -min -4 [get_ports spi_mosi]\nset_multicycle_path 2 -setup -end -from [get_clocks sys_clk] -to [get_clocks spi_sclk]\nset_multicycle_path 3 -hold -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]', pass: false, note: '-end вместо -start', expect: 'Предустановка' },
    { code: 'create_clock -name spi_sclk -period 40 [get_ports spi_sclk]\nset_output_delay -clock spi_sclk -max 4 [get_ports spi_mosi]\nset_output_delay -clock spi_sclk -min -4 [get_ports spi_mosi]', pass: false, note: 'первичный тактовый сигнал на выходе', expect: 'производным' },
    { code: 'create_generated_clock -name sclk -source [get_pins sclk_reg/C] -edges {1 5 9} [get_ports spi_sclk]\nset_output_delay -clock sclk -max 4 [get_ports spi_mosi]\nset_output_delay -clock sclk -min -4 [get_ports spi_mosi]\nset_multicycle_path 2 -setup -start -to [get_ports spi_mosi]\nset_multicycle_path 3 -hold -start -to [get_ports spi_mosi]', pass: true, note: 'через -edges и -to порт' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'iface.spi_in', module: 'iface', order: 2, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Задержки ввода с `-clock_fall` и многотактные пути с `-end` одинаковы в XDC и SDC.',
  title: 'SPI: вход MISO с круговой задержкой',
  tags: ['SPI', 'set_input_delay', '-clock_fall', 'set_multicycle_path'],
  text: `
    Продолжение предыдущей задачи. Ведомая микросхема выдаёт MISO по **спаду** SCLK: от спада на её выводе до появления новых данных проходит 0…8,0 нс. Задержка трасс: SCLK до микросхемы 0,5…0,8 нс, MISO обратно 0,5…0,8 нс.

    Регистр \`miso_reg\` тактируется \`sys_clk\` и принимает MISO в такте, совпадающем со следующим **фронтом** SCLK, – через 2 такта \`sys_clk\` после спада. В остальные такты он данные не принимает (сигнал разрешения).

    Ограничения тактовых сигналов и выхода MOSI уже заданы.

    **Задание.**
    1. Задайте входные задержки MISO относительно тактового сигнала \`spi_sclk\` на выводе ПЛИС.
    2. Опишите многотактный путь от \`spi_sclk\` к \`sys_clk\`: захват через 2 такта \`sys_clk\` после спада SCLK, а следующий захват – только через 4 такта.
  `,
  design: SPI_DESIGN,
  figures: [SPI_WAVE],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
create_generated_clock -name spi_sclk -source [get_pins sclk_reg/C] -divide_by 4 [get_ports spi_sclk]
set_output_delay -clock spi_sclk -max 4.000 [get_ports spi_mosi]
set_output_delay -clock spi_sclk -min -4.000 [get_ports spi_mosi]
set_multicycle_path 2 -setup -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]
set_multicycle_path 3 -hold -start -from [get_clocks sys_clk] -to [get_clocks spi_sclk]`,
  solution: `set_input_delay -clock spi_sclk -clock_fall -max 9.600 [get_ports spi_miso]
set_input_delay -clock spi_sclk -clock_fall -min 1.000 [get_ports spi_miso]
set_multicycle_path 2 -setup -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]
set_multicycle_path 3 -hold -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]`,
  hints: [
    'Опорный фронт – спад `spi_sclk`: `-clock_fall`. Задержка включает путь SCLK до ведомого, его время выдачи и путь MISO обратно: max = 0,8 + 8,0 + 0,8.',
    'По умолчанию захват – ближайший фронт `sys_clk` после спада SCLK (через 10 нс). Захват на 2 такта позже задаётся в периодах тактового сигнала **захвата**: `-setup 2 -end`.',
    'После этого проверка удержания относится к фронту за 10 нс до захвата. Реальный предыдущий захват был на 40 нс раньше: `-hold 3 -end`.',
  ],
  explain: `
    \`\`\`
    set_input_delay -clock spi_sclk -clock_fall -max 9.600 [get_ports spi_miso]
    set_input_delay -clock spi_sclk -clock_fall -min 1.000 [get_ports spi_miso]
    set_multicycle_path 2 -setup -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]
    set_multicycle_path 3 -hold  -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]
    \`\`\`
    **Входная задержка – круговой путь.** Отсчёт ведётся от спада SCLK на выводе ПЛИС:
    - max = 0,8 (SCLK до ведомого) + 8,0 (выдача MISO) + 0,8 (MISO обратно) = **9,6 нс**;
    - min = 0,5 + 0 + 0,5 = **1,0 нс**.

    Так как \`spi_sclk\` – производный сигнал на выходном порту, Vivado учтёт и задержку формирования SCLK внутри ПЛИС: круговой путь будет полным.

    **Многотактный путь.** Спад SCLK – 20 нс; ближайший фронт \`sys_clk\` – 30 нс, но \`miso_reg\` принимает данные в 40 нс:
    - \`-setup 2 -end\`: захват в 40 нс, требование **20 нс**, бюджет 20 − 9,6 = 10,4 нс;
    - проверка удержания по умолчанию после этого – фронт 30 нс (требование 10 нс); реальный предыдущий захват – 0 нс: \`-hold 3 -end\` даёт **−20 нс**.

    Опция \`-end\` здесь существенна: тактовые сигналы разные, и сдвиг считается в периодах \`sys_clk\` (10 нс), а не \`spi_sclk\` (40 нс).
  `,
  tests: [
    { code: 'set_input_delay -clock spi_sclk -max 9.6 [get_ports spi_miso]\nset_input_delay -clock spi_sclk -min 1.0 [get_ports spi_miso]\nset_multicycle_path 2 -setup -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]\nset_multicycle_path 3 -hold -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]', pass: false, note: 'без -clock_fall', expect: 'спада|фронта' },
    { code: 'set_input_delay -clock spi_sclk -clock_fall -max 8.0 [get_ports spi_miso]\nset_input_delay -clock spi_sclk -clock_fall -min 0 [get_ports spi_miso]\nset_multicycle_path 2 -setup -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]\nset_multicycle_path 3 -hold -end -from [get_clocks spi_sclk] -to [get_clocks sys_clk]', pass: false, note: 'без трасс', expect: '-max' },
    { code: 'set_input_delay -clock spi_sclk -clock_fall -max 9.6 [get_ports spi_miso]\nset_input_delay -clock spi_sclk -clock_fall -min 1.0 [get_ports spi_miso]\nset_multicycle_path 2 -setup -from [get_clocks spi_sclk] -to [get_clocks sys_clk]\nset_multicycle_path 3 -hold -from [get_clocks spi_sclk] -to [get_clocks sys_clk]', pass: false, note: 'hold без -end', expect: 'Удержание' },
    { code: 'set_input_delay -clock spi_sclk -clock_fall -max [expr {0.8 + 8.0 + 0.8}] [get_ports spi_miso]\nset_input_delay -clock spi_sclk -clock_fall -min [expr {0.5 + 0.5}] [get_ports spi_miso]\nset_multicycle_path 2 -setup -end -from [get_ports spi_miso] -to [get_cells miso_reg]\nset_multicycle_path 3 -hold -end -from [get_ports spi_miso] -to [get_cells miso_reg]', pass: true, note: 'через expr и объекты' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'iface.sdram', module: 'iface', order: 3, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'ODDR и IOBUF – примитивы ПЛИС; в ASIC их роль играют обычные триггеры и ячейки ввода/вывода, а ограничения те же.',
  title: 'SDR SDRAM 100 МГц: тактовый сигнал, команды и двунаправленная шина',
  tags: ['SDRAM', 'ODDR', 'IOBUF', 'set_output_delay', 'set_input_delay'],
  text: `
    Контроллер SDR SDRAM работает на \`sys_clk\` = 100 МГц. Тактовый сигнал памяти выдаётся через \`ODDR\` на вывод \`sdram_clk\`; адрес \`sdram_a[12:0]\` и шина данных \`sdram_dq[15:0]\` (двунаправленная, через \`IOBUF\`) выдаются и принимаются регистрами, тактируемыми \`sys_clk\`. Разрешение выхода шины данных формирует регистр \`dq_oe_reg\`.

    Параметры памяти (относительно фронта CLK на её выводе): время предустановки входов tIS = 1,5 нс, время удержания tIH = 0,8 нс; время доступа tAC = 5,4 нс (максимальная задержка выдачи данных чтения), время удержания выхода tOH = 2,7 нс (минимальная).

    Трассы: тактовый сигнал до памяти 0,6…0,8 нс; адрес и данные 0,6…0,9 нс.

    **Задание.**
    1. Опишите тактовый сигнал памяти \`sdram_clk\` на выходном порту.
    2. Задайте выходные задержки для \`sdram_a[*]\` и \`sdram_dq[*]\` (запись).
    3. Задайте входные задержки для \`sdram_dq[*]\` (чтение) относительно \`sdram_clk\`.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 0, y: 150 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 96, y: 147, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_bufg', x: 166, y: 147, noName: true },
      { id: 'co', t: 'oddr', name: 'sdram_clk_oddr', x: 300, y: -60 },
      { id: 'nd', t: 'label', x: 196, y: -40, text: 'D1 = 1, D2 = 0', cls: 'sch-ref' },
      { id: 'cob', t: 'obuf', name: 'sdram_clk_obuf', x: 470, y: -32, noName: true },
      { id: 'pc', t: 'out', name: 'sdram_clk', x: 560, y: -29 },
      { id: 'ar', t: 'ff', name: 'addr_reg', w: 13, x: 300, y: 80 },
      { id: 'aob', t: 'obuf', name: 'a_obuf[%]', w: 13, x: 470, y: 84, noName: true },
      { id: 'pa', t: 'out', name: 'sdram_a', w: 13, x: 560, y: 87 },
      { id: 'dor', t: 'ff', name: 'dq_out_reg', w: 16, x: 300, y: 200 },
      { id: 'iob', t: 'iobuf', name: 'dq_iobuf[%]', w: 16, x: 470, y: 207, noName: true },
      { id: 'pd', t: 'inout', name: 'sdram_dq', w: 16, flip: true, x: 560, y: 218 },
      { id: 'oer', t: 'ff', name: 'dq_oe_reg', x: 300, y: 320 },
      { id: 'dir', t: 'ff', name: 'dq_in_reg', w: 16, x: 300, y: 450 },
      { id: 'sd', t: 'chip', name: 'SDR SDRAM', x: 810, y: -60, bw: 120, bh: 330, ext: true, pins: [{ n: 'CLK', side: 'l', y: 42 }, { n: 'A[12:0]', side: 'l', y: 158 }, { n: 'DQ[15:0]', side: 'l', y: 289 }] },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['co.C', 'ar.C', 'dor.C', 'oer.C', 'dir.C'], kind: 'clk', label: 'sys_clk', trunk: 30 },
      { from: 'co.Q', to: 'cob.I', kind: 'clk' },
      { from: 'cob.O', to: 'pc', kind: 'clk' },
      { from: 'ar.Q', to: 'aob.I' },
      { from: 'aob.O', to: 'pa' },
      { from: 'dor.Q', to: 'iob.I' },
      { from: 'oer.Q', to: 'iob.T' },
      { from: 'iob.IO', to: 'pd' },
      { from: 'iob.O', to: 'dir.D', via: [[452, 240], [452, 416], [274, 416]], vfirst: true },
      { from: 'pc.pad', to: 'sd.CLK', label: '0,6…0,8 нс' },
      { from: 'pa.pad', to: 'sd.A[12:0]', bus: true, noSlash: true, label: '0,6…0,9 нс' },
      { from: 'pd.pad', to: 'sd.DQ[15:0]', bus: true, noSlash: true, label: '0,6…0,9 нс' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Чтение: данные от памяти относительно sdram_clk на выводе ПЛИС', t: [-2, 14],
      signals: [
        { name: 'sdram_clk (ПЛИС)', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'CLK (память)', clock: { period: 10, rise: 0.7, fall: 5.7 } },
        { name: 'DQ (память)', bus: [[0.7 + 2.7, 0.7 + 5.4, 'D']], init: 'D−1' },
        { name: 'DQ (ПЛИС)', bus: [[3.9, 7.1, 'D']], init: 'D−1' },
        { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise' },
      ],
      marks: [{ t: 0, label: 'запуск', cls: 'launch' }, { t: 10, label: 'захват', cls: 'capture' }],
      spans: [{ row: 3, t0: 0, t1: 7.1, label: 'max 7,1', cls: 'data' }, { row: 3, t0: 0, t1: 3.9, label: 'min 3,9', cls: 'clk' }],
      caption: 'Окно смены данных чтения на выводах ПЛИС – от 3,9 до 7,1 нс после фронта sdram_clk; захват – следующим фронтом sys_clk.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]
set_output_delay -clock sdram_clk -max 1.800 [get_ports {sdram_a[*] sdram_dq[*]}]
set_output_delay -clock sdram_clk -min -1.000 [get_ports {sdram_a[*] sdram_dq[*]}]
set_input_delay  -clock sdram_clk -max 7.100 [get_ports {sdram_dq[*]}]
set_input_delay  -clock sdram_clk -min 3.900 [get_ports {sdram_dq[*]}]`,
  hints: [
    'Тактовый сигнал памяти: `create_generated_clock -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]`.',
    'Выход: max = Tdata_max + tIS − Tclk_min = 0,9 + 1,5 − 0,6; min = Tdata_min − tIH − Tclk_max = 0,6 − 0,8 − 0,8.',
    'Вход: фронт CLK на памяти наступает через Tclk после фронта на выводе ПЛИС: max = 0,8 + 5,4 + 0,9; min = 0,6 + 2,7 + 0,6. Для двунаправленного порта нужны и входные, и выходные задержки.',
  ],
  explain: `
    \`\`\`
    create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]
    set_output_delay -clock sdram_clk -max 1.800 [get_ports {sdram_a[*] sdram_dq[*]}]
    set_output_delay -clock sdram_clk -min -1.000 [get_ports {sdram_a[*] sdram_dq[*]}]
    set_input_delay  -clock sdram_clk -max 7.100 [get_ports {sdram_dq[*]}]
    set_input_delay  -clock sdram_clk -min 3.900 [get_ports {sdram_dq[*]}]
    \`\`\`
    **Запись (ПЛИС → память).** Память захватывает данные фронтом CLK на своём выводе, который запаздывает относительно вывода ПЛИС на 0,6…0,8 нс:
    - max = 0,9 + 1,5 − 0,6 = **1,8 нс** (худший случай: данные идут дольше, тактовый сигнал приходит раньше);
    - min = 0,6 − 0,8 − 0,8 = **−1,0 нс** (данные быстрее, тактовый сигнал позже).

    **Чтение (память → ПЛИС).** Данные выдаются по фронту CLK памяти: от фронта на выводе ПЛИС до новых данных на выводе ПЛИС проходит Tclk + tAC + Tdq:
    - max = 0,8 + 5,4 + 0,9 = **7,1 нс**; min = 0,6 + 2,7 + 0,6 = **3,9 нс**.

    Захват – следующим фронтом \`sys_clk\`: требование к предустановке 10 нс, бюджет 2,9 нс.

    **Двунаправленный порт** получает обе задержки: выходные описывают запись (пути от \`dq_out_reg\` и \`dq_oe_reg\`), входные – чтение (путь к \`dq_in_reg\`).

    **Практика.** В реальной ПЛИС задержка тактового сигнала через ODDR и OBUF (несколько наносекунд) добавляется к моменту фронта \`sdram_clk\` и съедает бюджет чтения. Поэтому тактовый сигнал памяти часто сдвигают по фазе с помощью MMCM – такой сдвиг Vivado учтёт автоматически, если сигнал описан как производный.
  `,
  tests: [
    { code: 'create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]\nset_output_delay -clock sdram_clk -max 1.8 [get_ports {sdram_a[*] sdram_dq[*]}]\nset_output_delay -clock sdram_clk -min -1.0 [get_ports {sdram_a[*] sdram_dq[*]}]', pass: false, note: 'нет входных задержек', expect: 'set_input_delay' },
    { code: 'create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]\nset_output_delay -clock sdram_clk -max 1.8 [get_ports {sdram_a[*] sdram_dq[*]}]\nset_output_delay -clock sdram_clk -min -1.0 [get_ports {sdram_a[*] sdram_dq[*]}]\nset_input_delay -clock sys_clk -max 7.1 [get_ports {sdram_dq[*]}]\nset_input_delay -clock sys_clk -min 3.9 [get_ports {sdram_dq[*]}]', pass: false, note: 'вход относительно sys_clk', expect: 'опорный' },
    { code: 'create_generated_clock -name sdram_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]\nset_output_delay -clock sdram_clk -max 2.4 [get_ports {sdram_a[*] sdram_dq[*]}]\nset_output_delay -clock sdram_clk -min -1.0 [get_ports {sdram_a[*] sdram_dq[*]}]\nset_input_delay -clock sdram_clk -max 7.1 [get_ports {sdram_dq[*]}]\nset_input_delay -clock sdram_clk -min 3.9 [get_ports {sdram_dq[*]}]', pass: false, note: 'не учтена задержка тактового сигнала', expect: '-max' },
    { code: 'set tclk_min 0.6; set tclk_max 0.8; set td_min 0.6; set td_max 0.9\ncreate_generated_clock -name mem_clk -source [get_pins sdram_clk_oddr/C] -divide_by 1 [get_ports sdram_clk]\nset out [get_ports {sdram_a[*] sdram_dq[*]}]\nset_output_delay -clock mem_clk -max [expr {$td_max + 1.5 - $tclk_min}] $out\nset_output_delay -clock mem_clk -min [expr {$td_min - 0.8 - $tclk_max}] $out\nset_input_delay -clock mem_clk -max [expr {$tclk_max + 5.4 + $td_max}] [get_ports {sdram_dq[*]}]\nset_input_delay -clock mem_clk -min [expr {$tclk_min + 2.7 + $td_min}] [get_ports {sdram_dq[*]}]', pass: true, note: 'через переменные' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'iface.fix_xdc', module: 'iface', order: 4, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Ошибки в этом файле одинаково возможны и в SDC.',
  title: 'Найдите ошибки в XDC-файле',
  tags: ['отладка', 'порядок команд', 'синтаксис'],
  text: `
    Коллега написал ограничения для простого тракта: входные регистры \`din_reg\`, комбинационная обработка, выходные регистры \`dout_reg\`; тактовый сигнал 100 МГц на порту \`sys_clk\`. По замыслу автора:

    - входные задержки: max 2,0 нс, min 0,5 нс;
    - выходные задержки: max 1,5 нс, min −0,5 нс;
    - путь \`din_reg → dout_reg\` многотактный: данные обновляются раз в 2 такта.

    Файл загружается в Vivado с критическими предупреждениями, а анализ не соответствует замыслу.

    **Задание.** Найдите и исправьте все ошибки (их пять). Исходный файл уже в редакторе.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'p', t: 'in', name: 'sys_clk', x: 0, y: 180 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_ibuf', x: 96, y: 177, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_bufg', x: 166, y: 177, noName: true },
      { id: 'pi', t: 'in', name: 'din', w: 8, x: 0, y: 47 },
      { id: 'dib', t: 'ibuf', name: 'din_ibuf[%]', w: 8, x: 120, y: 44, noName: true },
      { id: 'r1', t: 'ff', name: 'din_reg', w: 8, x: 260, y: 40 },
      { id: 'lg', t: 'logic', name: 'proc', w: 8, label: 'обработка', x: 370, y: 35 },
      { id: 'r2', t: 'ff', name: 'dout_reg', w: 8, x: 500, y: 40 },
      { id: 'dob', t: 'obuf', name: 'dout_obuf[%]', w: 8, x: 620, y: 44, noName: true },
      { id: 'po', t: 'out', name: 'dout', w: 8, x: 700, y: 47 },
    ],
    wires: [
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['r1.C', 'r2.C'], kind: 'clk', label: 'sys_clk', trunk: 30 },
      { from: 'pi', to: 'dib.I' },
      { from: 'dib.O', to: 'r1.D' },
      { from: 'r1.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'r2.D' },
      { from: 'r2.Q', to: 'dob.I' },
      { from: 'dob.O', to: 'po' },
    ],
  },
  starter: `# Ограничения тракта обработки
set_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]
create_clock -name sys_clk -period 10.000 [get_ports sysclk]
set_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]
set_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}] # max
set_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]
set_multicycle_path 2 -setup -from [get_pins {din_reg[*]/Q}] -to [get_cells {dout_reg[*]}]`,
  solution: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]
set_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]
set_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]
set_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}] ;# max
set_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]
set_multicycle_path 2 -setup -from [get_cells {din_reg[*]}] -to [get_cells {dout_reg[*]}]
set_multicycle_path 1 -hold -from [get_cells {din_reg[*]}] -to [get_cells {dout_reg[*]}]`,
  hints: [
    'Нажмите «Проверить» с исходным текстом и прочитайте сообщения: каждое указывает на строку.',
    'Ошибки: порядок команд, имя порта, комментарий в конце строки, начальная точка исключения, отсутствие парной команды для проверки удержания.',
  ],
  explain: `
    1. **Порядок команд.** \`set_input_delay\` ссылается на тактовый сигнал \`sys_clk\` до его создания – Vivado выдаёт критическое предупреждение и пропускает команду. В XDC тактовые сигналы описывают первыми.
    2. **Имя порта.** \`sysclk\` вместо \`sys_clk\`: \`get_ports\` ничего не находит, и тактовый сигнал не создаётся.
    3. **Комментарий в конце строки.** В Tcl символ \`#\` начинает комментарий только в начале команды; в конце строки нужно \`;#\`. Иначе \`#\` и \`max\` становятся лишними аргументами, и команда не выполняется.
    4. **Начальная точка исключения.** \`din_reg[*]/Q\` – выход регистра, а не начальная точка. Начальная точка – тактовый вывод \`C\` или сама ячейка: \`[get_cells {din_reg[*]}]\`. С выводами Q исключение не покрывает ни одного пути.
    5. **Нет парной команды -hold.** После \`set_multicycle_path 2 -setup\` нужно \`set_multicycle_path 1 -hold\`, иначе требование к удержанию станет равным 10 нс.

    Полезная привычка: после чтения XDC запускать \`check_timing\` и \`report_exceptions\` – первая покажет неограниченные порты и регистры, вторая – исключения, которые ничего не покрывают.
  `,
  tests: [
    { code: '# Ограничения тракта обработки\nset_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]\ncreate_clock -name sys_clk -period 10.000 [get_ports sysclk]\nset_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]\nset_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}] # max\nset_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]\nset_multicycle_path 2 -setup -from [get_pins {din_reg[*]/Q}] -to [get_cells {dout_reg[*]}]', pass: false, note: 'исходный текст', expect: 'не найден|комментарий' },
    { code: 'create_clock -name sys_clk -period 10.000 [get_ports sys_clk]\nset_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]\nset_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]\nset_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}]\nset_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]\nset_multicycle_path 2 -setup -from [get_cells {din_reg[*]}] -to [get_cells {dout_reg[*]}]', pass: false, note: 'исправлено всё, кроме -hold', expect: 'set_multicycle_path -hold' },
    { code: 'create_clock -name sys_clk -period 10.000 [get_ports sys_clk]\nset_input_delay -clock sys_clk -max 2.0 [get_ports {din[*]}]\nset_input_delay -clock sys_clk -min 0.5 [get_ports {din[*]}]\nset_output_delay -clock sys_clk -max 1.5 [get_ports {dout[*]}]\nset_output_delay -clock sys_clk -min -0.5 [get_ports {dout[*]}]\nset_multicycle_path 2 -setup -from [get_pins {din_reg[*]/C}] -to [get_pins {dout_reg[*]/D}]\nset_multicycle_path 1 -hold -from [get_pins {din_reg[*]/C}] -to [get_pins {dout_reg[*]/D}]', pass: true, note: 'через тактовые выводы' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'iface.check_timing', module: 'iface', order: 5, level: 2, tool: 'vivado', type: 'choice', multi: true,
  lang: 'both', langNote: 'Отчёт в задаче – из Vivado; в PrimeTime `check_timing` устроен так же, часть категорий называется иначе (например, *unconstrained_endpoints*).',
  title: 'Чтение отчёта check_timing',
  tags: ['check_timing', 'отладка'],
  text: `
    После чтения ограничений проекта отчёт \`check_timing\` выдал:

    \`\`\`text
    1. no_clock: 16 регистров (slow_reg[0..15])
    2. no_input_delay: 12 портов (adc_d[0..11])
    3. partial_input_delay: 1 порт (adc_ovr)
    4. multiple_clock: 8 выводов (proc_reg[0..7]/C: clk_a, clk_b)
    5. generated_clocks: 1 (clk_div2: исходный тактовый сигнал не достигает вывода div_reg/C)
    \`\`\`

    Регистры \`slow_reg\` тактируются выходом делителя на триггере; АЦП \`adc_d\` – синхронный интерфейс; \`proc_reg\` тактируется через мультиплексор тактовых сигналов.

    Какие утверждения **верны**?
  `,
  options: [
    { text: 'Пункт 1: регистрам `slow_reg` не хватает производного тактового сигнала; он описан (пункт 5), но не построен – нужно исправить `-source`.', ok: true, why: 'Верно: производный сигнал не построен, поэтому регистры за делителем остались без тактового сигнала. Обычно -source указывает не туда, куда распространяется исходный сигнал.' },
    { text: 'Пункт 2 лучше всего устранить командой `set_false_path -from [get_ports {adc_d[*]}]`.', why: 'Нет: интерфейс АЦП синхронный, его нужно ограничить задержками ввода (set_input_delay -max/-min). Ложный путь скроет реальные нарушения.' },
    { text: 'Пункт 3: для `adc_ovr` задано только `-max` или только `-min`, поэтому одна из проверок (предустановки или удержания) не выполняется.', ok: true, why: 'Верно: partial_input_delay означает неполную пару задержек.' },
    { text: 'Пункт 4 нормален и требует действия только в случае, если `clk_a` и `clk_b` не существуют одновременно на выходе мультиплексора: тогда нужно `set_clock_groups -physically_exclusive` (обычно между производными сигналами на выходе мультиплексора).', ok: true, why: 'Верно: несколько тактовых сигналов на выводе после мультиплексора допустимы, но пути между ними на этих регистрах физически невозможны и должны быть исключены.' },
    { text: 'Все пять пунктов – предупреждения, которые на итоговый анализ не влияют.', why: 'Нет: каждый пункт означает, что часть путей не анализируется вообще или анализируется неверно.' },
  ],
  explain: `
    \`check_timing\` – первое, что запускают после чтения ограничений. Каждый пункт – признак того, что часть путей не анализируется или анализируется неверно:
    - *no_clock* – регистры без тактового сигнала: пути к ним и от них не проверяются;
    - *no_input_delay / no_output_delay* – порты без задержек: пути через них не ограничены;
    - *partial_input_delay / partial_output_delay* – задана только одна граница;
    - *multiple_clock* – несколько тактовых сигналов на выводе: нормально для мультиплексоров, но требует исключения невозможных пар;
    - *generated_clocks* – производный тактовый сигнал не построен.

    В ConstraintLab те же проверки доступны в консоли: \`check_timing\`.
  `,
});
