/* Модуль 4. Синхронизация от источника: входы (Vivado XDC) */
XT.bank.module({
  id: 'ssin', order: 40, title: '4. Синхронизация от источника: входы',
  about: 'Внешняя микросхема передаёт тактовый сигнал вместе с данными: SDR и DDR, выравнивание по центру и по фронту, запуск по спаду, LVDS DDR, RGMII с внутренней задержкой и без неё (сдвиг MMCM на 90°)',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssin.sdr_center', module: 'ssin', order: 1, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Задержки ввода и их расчёт одинаковы в XDC и SDC.',
  title: 'Датчик изображения: SDR, данные выровнены по центру',
  tags: ['create_clock', 'set_input_delay', 'синхронизация от источника'],
  text: `
    Датчик изображения передаёт ПЛИС 10-разрядные отсчёты \`pix_d[9:0]\` вместе с тактовым сигналом \`pix_clk\` **100 МГц**, который он формирует сам. Трассы данных и тактового сигнала выровнены по длине, поэтому техническое описание датчика задаёт временны́е параметры прямо на выводах приёмника:

    | Параметр | Значение |
    |---|---|
    | данные действительны до фронта \`pix_clk\` | не менее 2,0 нс |
    | данные действительны после фронта \`pix_clk\` | не менее 1,5 нс |

    Данные выровнены по центру: фронт \`pix_clk\` приходится на середину интервала, в котором данные действительны. В ПЛИС тактовый сигнал проходит через IBUF и BUFG, данные захватываются по фронту регистрами \`pix_d_reg\`.

    **Задание.** Опишите тактовый сигнал \`pix_clk\` и задержки ввода для шины \`pix_d[9:0]\`.
  `,
  design: {
    elements: [
      { id: 'sen', t: 'chip', name: 'Датчик', x: 0, y: 0, bw: 110, bh: 124, ext: true, pins: [{ n: 'D[9:0]', side: 'r', y: 40 }, { n: 'PIXCLK', side: 'r', y: 102 }] },
      { id: 'nt', t: 'label', text: 'трассы выровнены', x: 4, y: 132, cls: 'sch-notetext' },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pd', t: 'in', name: 'pix_d', w: 10, x: 200, y: 29 },
      { id: 'ibd', t: 'ibuf', name: 'pix_d_IBUF[%]_inst', w: 10, x: 340, y: 26, noName: true },
      { id: 'r', t: 'ff', name: 'pix_d_reg', w: 10, x: 470, y: 22 },
      { id: 'lg', t: 'logic', name: 'u_isp/proc', w: 10, label: 'обработка', x: 590, y: 17 },
      { id: 'pc', t: 'in', name: 'pix_clk', x: 200, y: 91 },
      { id: 'ibc', t: 'ibuf', name: 'pix_clk_IBUF_inst', x: 340, y: 88, noName: true },
      { id: 'bg', t: 'bufg', name: 'pix_clk_IBUF_BUFG_inst', x: 400, y: 88, noName: true },
    ],
    wires: [
      { from: 'sen.D[9:0]', to: 'pd.pad', bus: true, bw: 10 },
      { from: 'sen.PIXCLK', to: 'pc.pad', kind: 'clk', dash: true },
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
      kind: 'timing', title: 'Данные выровнены по центру: окно вокруг фронта', t: [-3, 13],
      signals: [
        { name: 'pix_clk (ПЛИС)', clock: { period: 10 }, arrows: 'rise' },
        { name: 'pix_d (ПЛИС)', bus: [[1.5, 8.0, 'D1'], [11.5, 18.0, 'D2']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'запуск D1', cls: 'launch' }, { t: 10, label: 'захват D1', cls: 'capture' }],
      windows: [
        { row: 1, t0: -2, t1: 0, label: '2,0', cls: 'setup' }, { row: 1, t0: 0, t1: 1.5, label: '1,5', cls: 'hold' },
        { row: 1, t0: 8, t1: 10, label: '2,0', cls: 'setup' }, { row: 1, t0: 10, t1: 11.5, label: '1,5', cls: 'hold' },
      ],
      spans: [
        { row: 1, t0: 0, t1: 8, label: '-max = T − 2,0 = 8,0 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 1.5, label: '-min = 1,5 нс', cls: 'hold' },
      ],
      caption: 'Окна действительности (2,0 нс до фронта и 1,5 нс после него) выделены цветом. Относительно фронта запуска (0) данные начинают меняться не раньше 1,5 нс (-min) и устанавливаются не позже 10 − 2,0 = 8,0 нс (-max). Захват – следующим фронтом, удержание проверяется на том же фронте.',
    },
  ],
  solution: `create_clock -name pix_clk -period 10.000 [get_ports pix_clk]
set_input_delay -clock pix_clk -max 8.000 [get_ports {pix_d[*]}]
set_input_delay -clock pix_clk -min 1.500 [get_ports {pix_d[*]}]`,
  hints: [
    'Тактовый сигнал приходит от датчика на порт `pix_clk` – это первичный тактовый сигнал, его описывают на порту.',
    'Задержка ввода отсчитывается от фронта, запустившего данные. Следующие данные установятся не позже чем за 2,0 нс до следующего фронта, а текущие держатся не меньше 1,5 нс после фронта.',
    '-max = T − 2,0 = 8,0 нс; -min = 1,5 нс.',
  ],
  explain: `
    \`\`\`
    create_clock -name pix_clk -period 10.000 [get_ports pix_clk]
    set_input_delay -clock pix_clk -max 8.000 [get_ports {pix_d[*]}]
    set_input_delay -clock pix_clk -min 1.500 [get_ports {pix_d[*]}]
    \`\`\`
    **Модель Vivado.** Данные считаются запущенными фронтом \`pix_clk\` в точке определения тактового сигнала – на выводе ПЛИС (момент 0). Захват выполняется следующим фронтом (10 нс), удержание проверяется на том же фронте (0 нс). Задержка ввода сообщает, когда относительно фронта запуска данные меняются.

    **Вывод формул.** Техническое описание задаёт окно действительности вокруг фронта: t_su = 2,0 нс до и t_h = 1,5 нс после.
    - Новые данные установятся не позже чем за t_su до следующего фронта: -max = T − t_su = 10 − 2,0 = **8,0 нс**;
    - текущие данные держатся t_h после фронта, то есть самое раннее изменение – -min = t_h = **1,5 нс**.

    **Что получит анализ.** Предустановка: требование 10 нс, внешняя часть пути 8,0 нс – на разницу задержек данных и тактового сигнала внутри ПЛИС и время предустановки регистра остаётся 2,0 нс. Удержание: данные неизменны 1,5 нс после фронта – запас против задержки тактового дерева (IBUF и BUFG). В интерфейсе с синхронизацией от источника важна именно эта разница: тактовый сигнал и данные идут вместе, поэтому внешние трассы в расчёт не входят.

    **Типичные ошибки.**
    - Подставить числа из технического описания напрямую (-max 2.0, -min 1.5): -max = 2,0 означает, что данные устанавливаются через 2 нс после фронта, – анализ предустановки станет оптимистичным на 6 нс.
    - Знак -min (−1,5 нс): это означало бы смену данных за 1,5 нс до фронта, проверка удержания станет на 3 нс строже реальной, и Vivado будет исправлять несуществующие нарушения.
    - Описать тактовый сигнал на выходе BUFG: задержка IBUF и BUFG выпадает из анализа, и результат для входных путей становится недостоверным.

    **Проверка в Vivado:** \`report_timing -from [get_ports {pix_d[*]}] -delay_type min_max\` – требование 10 нс для предустановки и 0 нс для удержания, строка *input delay* 8.000 и 1.500; \`report_datasheet\` показывает получившиеся требования к входам относительно \`pix_clk\`.
  `,
  refs: 'UG903, глава «Constraining I/O Delay», шаблон Source Synchronous, Center Aligned, SDR',
  tests: [
    { code: 'set T 10.0\nset tsu 2.0\nset th 1.5\ncreate_clock -name sensor_clk -period $T [get_ports pix_clk]\nset_input_delay -clock sensor_clk -max [expr {$T - $tsu}] [get_ports {pix_d[*]}]\nset_input_delay -clock sensor_clk -min $th [get_ports {pix_d[*]}]', pass: true, note: 'другое имя и расчёт через expr' },
    { code: 'create_clock -name pix_clk -period 10 [get_ports pix_clk]\nset_input_delay -clock pix_clk -max 2.0 [get_ports {pix_d[*]}]\nset_input_delay -clock pix_clk -min 1.5 [get_ports {pix_d[*]}]', pass: false, note: 'числа из технического описания без пересчёта', expect: '-max .*2\\.000 нс – неверно' },
    { code: 'create_clock -name pix_clk -period 10 [get_ports pix_clk]\nset_input_delay -clock pix_clk -max 8.0 [get_ports {pix_d[*]}]\nset_input_delay -clock pix_clk -min -1.5 [get_ports {pix_d[*]}]', pass: false, note: 'неверный знак -min', expect: 'ошибка в знаке' },
    { code: 'create_clock -name pix_clk -period 10 [get_pins pix_clk_IBUF_BUFG_inst/O]\nset_input_delay -clock pix_clk -max 8.0 [get_ports {pix_d[*]}]\nset_input_delay -clock pix_clk -min 1.5 [get_ports {pix_d[*]}]', pass: false, note: 'тактовый сигнал на выходе BUFG', expect: 'не в той точке' },
    { code: 'create_clock -name pix_clk -period 100 [get_ports pix_clk]\nset_input_delay -clock pix_clk -max 8.0 [get_ports {pix_d[*]}]\nset_input_delay -clock pix_clk -min 1.5 [get_ports {pix_d[*]}]', pass: false, note: 'частота вместо периода', expect: 'период' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssin.sdr_edge', module: 'ssin', order: 2, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Задержки ввода одинаковы в XDC и SDC. Способы исправить захват (MMCM, IDELAYE2) – примитивы ПЛИС; в ASIC для этого применяют регулируемые линии задержки или PLL со сдвигом фазы.',
  title: 'АЦП с выходом DCO: SDR, данные выровнены по фронту',
  tags: ['set_input_delay', 'синхронизация от источника', 'отрицательная задержка'],
  text: `
    АЦП с параллельным выходом КМОП выдаёт 14-разрядные отсчёты \`adc_d[13:0]\` и тактовый сигнал сопровождения DCO **80 МГц** (\`adc_dco\`). По техническому описанию данные выровнены **по фронту** DCO: относительно фронта DCO на выводах ПЛИС данные могут изменяться в интервале **от −0,4 до +0,6 нс** (трассы выровнены). ПЛИС захватывает данные по фронту \`adc_dco\` регистрами \`adc_d_reg\`.

    Тактовый сигнал уже описан (блок «Уже в проекте»).

    **Задание.** Опишите задержки ввода для шины \`adc_d[13:0]\`.
  `,
  design: {
    elements: [
      { id: 'adc', t: 'chip', name: 'АЦП 14 бит', x: 0, y: 0, bw: 110, bh: 124, ext: true, pins: [{ n: 'D[13:0]', side: 'r', y: 40 }, { n: 'DCO', side: 'r', y: 102 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pd', t: 'in', name: 'adc_d', w: 14, x: 200, y: 29 },
      { id: 'ibd', t: 'ibuf', name: 'adc_d_IBUF[%]_inst', w: 14, x: 340, y: 26, noName: true },
      { id: 'r', t: 'ff', name: 'adc_d_reg', w: 14, x: 470, y: 22 },
      { id: 'lg', t: 'logic', name: 'u_dsp/proc', w: 14, label: 'обработка', x: 590, y: 17 },
      { id: 'pc', t: 'in', name: 'adc_dco', x: 200, y: 91 },
      { id: 'ibc', t: 'ibuf', name: 'adc_dco_IBUF_inst', x: 340, y: 88, noName: true },
      { id: 'bg', t: 'bufg', name: 'adc_dco_IBUF_BUFG_inst', x: 400, y: 88, noName: true },
    ],
    wires: [
      { from: 'adc.D[13:0]', to: 'pd.pad', bus: true, bw: 14 },
      { from: 'adc.DCO', to: 'pc.pad', kind: 'clk', dash: true },
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
      kind: 'timing', title: 'Данные меняются в окрестности фронта DCO', t: [-2, 15],
      signals: [
        { name: 'adc_dco (ПЛИС)', clock: { period: 12.5 }, arrows: 'rise' },
        { name: 'adc_d (ПЛИС)', bus: [[-0.4, 0.6, 'D1'], [12.1, 13.1, 'D2']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'запуск D1 = удержание D0', cls: 'launch' }, { t: 12.5, label: 'захват D1', cls: 'capture' }],
      spans: [
        { row: 0, t0: 0, t1: 12.5, label: 'предустановка: 12,5 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 0.6, label: '-max = +0,6 нс', cls: 'setup' },
        { row: 1, t0: -0.4, t1: 0, label: '-min = −0,4 нс', cls: 'hold' },
      ],
      caption: 'Новые данные D1 появляются в интервале −0,4…+0,6 нс относительно фронта, который их запустил. По умолчанию D1 захватывает следующий фронт (12,5 нс), а удержание проверяется на том же фронте (0): данные D0 должны оставаться неизменными после него, но начинают меняться уже за 0,4 нс до фронта.',
    },
  ],
  given: `create_clock -name adc_dco -period 12.500 [get_ports adc_dco]`,
  solution: `set_input_delay -clock adc_dco -max 0.600 [get_ports {adc_d[*]}]
set_input_delay -clock adc_dco -min -0.400 [get_ports {adc_d[*]}]`,
  hints: [
    'Задержка ввода – время от фронта запуска до изменения данных. Интервал изменения данных – это и есть интервал от -min до -max.',
    'Самое позднее изменение – через 0,6 нс после фронта (-max 0.6), самое раннее – за 0,4 нс до фронта, то есть −0,4 нс (-min -0.4).',
  ],
  explain: `
    \`\`\`
    set_input_delay -clock adc_dco -max 0.600 [get_ports {adc_d[*]}]
    set_input_delay -clock adc_dco -min -0.400 [get_ports {adc_d[*]}]
    \`\`\`
    **Знак -min.** Задержка ввода – время от фронта запуска до изменения данных. АЦП формирует DCO и данные разными цепями, поэтому данные могут смениться немного *раньше* фронта, который их «запустил». Самое раннее изменение – за 0,4 нс до фронта, отсюда отрицательное значение **−0,4 нс**. Самое позднее – через **0,6 нс** после фронта.

    **Какой фронт захватывает.** По умолчанию Vivado проверяет предустановку относительно *следующего* фронта: требование 12,5 нс при внешней части пути 0,6 нс – запас огромный. Удержание проверяется относительно *того же* фронта (требование 0 нс): данные начинают меняться за 0,4 нс до него, а внутри ПЛИС фронт дополнительно задерживается тактовым деревом (IBUF и BUFG – единицы наносекунд). При прямом захвате проверка удержания почти наверняка не пройдёт – и это правильный результат анализа, а не ошибка ограничений.

    **Как это исправляют.** Ограничения описывают интерфейс и остаются прежними; меняется схема захвата:
    - сдвиг тактового сигнала захвата с помощью MMCM (Vivado выведет сдвинутый тактовый сигнал автоматически);
    - задержка данных линией IDELAYE2;
    - захват по спаду DCO, то есть в середине интервала действительности: тогда Vivado выберет пару «фронт → спад» с требованиями 6,25 нс к предустановке и −6,25 нс к удержанию.

    **Типичные ошибки.**
    - -min = +0,4 нс: проверка удержания станет на 0,8 нс мягче реальной и скроет нарушение.
    - Перепутать «до» и «после» (-max 0.4, -min −0.6): обе проверки сместятся на 0,2 нс в ошибочную сторону.
    - Применить формулы для выравнивания по центру (-max = T − …): они описывают совсем другое окно.
    - Указать порты шаблоном \`[get_ports adc_d*]\`: под него попадает и тактовый порт \`adc_dco\`. Задержка на тактовом порту бессмысленна, и Vivado предупредит об этом. Надёжнее \`[get_ports {adc_d[*]}]\`.

    **Проверка в Vivado:** \`report_timing -from [get_ports {adc_d[*]}] -hold\` – удержание относительно того же фронта, \`report_timing -from [get_ports {adc_d[*]}] -setup\` – предустановка относительно следующего.
  `,
  refs: 'UG903, глава «Constraining I/O Delay», шаблон Source Synchronous, Edge Aligned, SDR',
  tests: [
    { code: 'set_input_delay -clock [get_clocks -of_objects [get_ports adc_dco]] -min -0.4 [get_ports {adc_d[*]}]\nset_input_delay -clock [get_clocks -of_objects [get_ports adc_dco]] -max 0.6 [get_ports {adc_d[*]}]', pass: true, note: 'ссылка на тактовый сигнал через -of_objects' },
    { code: 'set_input_delay -clock adc_dco -max 0.6 [get_ports adc_d*]\nset_input_delay -clock adc_dco -min -0.4 [get_ports adc_d*]', pass: false, note: 'шаблон adc_d* захватывает и тактовый порт adc_dco', expect: 'Лишняя set_input_delay' },
    { code: 'set skew_before 0.4\nset skew_after 0.6\nset_input_delay -clock adc_dco -max $skew_after [get_ports {adc_d[*]}]\nset_input_delay -clock adc_dco -min [expr {-$skew_before}] [get_ports {adc_d[*]}]', pass: true, note: 'через переменные' },
    { code: 'set_input_delay -clock adc_dco -max 0.6 [get_ports {adc_d[*]}]\nset_input_delay -clock adc_dco -min 0.4 [get_ports {adc_d[*]}]', pass: false, note: 'неверный знак -min', expect: 'ошибка в знаке' },
    { code: 'set_input_delay -clock adc_dco -max 0.4 [get_ports {adc_d[*]}]\nset_input_delay -clock adc_dco -min -0.6 [get_ports {adc_d[*]}]', pass: false, note: 'перепутаны «до» и «после»', expect: '-max .*0\\.400 нс – неверно' },
    { code: 'set_input_delay -clock adc_dco -max 0.6 [get_ports {adc_d[*]}]', pass: false, note: 'нет -min', expect: 'нет значения -min' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssin.dvp_fall', module: 'ssin', order: 3, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Опция `-clock_fall` одинакова в XDC и SDC.',
  title: 'Камера DVP: данные выдаются по спаду',
  tags: ['set_input_delay', '-clock_fall', 'DVP'],
  text: `
    Камера с параллельным интерфейсом DVP передаёт ПЛИС байты изображения \`cam_d[7:0]\` и сигналы строчной и кадровой синхронизации \`cam_href\`, \`cam_vsync\` вместе с тактовым сигналом \`cam_pclk\` **25 МГц**. По техническому описанию камера изменяет все эти сигналы по **спаду** PCLK с задержкой **0…5 нс** (на выводах ПЛИС), а приёмник должен захватывать их по фронту.

    В ПЛИС регистры \`cam_d_reg\`, \`href_reg\` и \`vsync_reg\` тактируются фронтом \`cam_pclk\` через IBUF и BUFG.

    **Задание.** Опишите тактовый сигнал (имя – на ваш выбор) и задержки ввода для \`cam_d[7:0]\`, \`cam_href\` и \`cam_vsync\`.
  `,
  design: {
    elements: [
      { id: 'cam', t: 'chip', name: 'Камера', x: 0, y: -30, bw: 104, bh: 395, ext: true, pins: [{ n: 'D[7:0]', side: 'r', y: 50 }, { n: 'HREF', side: 'r', y: 162 }, { n: 'VSYNC', side: 'r', y: 274 }, { n: 'PCLK', side: 'r', y: 371 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'pd', t: 'in', name: 'cam_d', w: 8, x: 190, y: 9 },
      { id: 'ph', t: 'in', name: 'cam_href', x: 190, y: 121 },
      { id: 'pv', t: 'in', name: 'cam_vsync', x: 190, y: 233 },
      { id: 'pc', t: 'in', name: 'cam_pclk', x: 190, y: 330 },
      { id: 'ibd', t: 'ibuf', name: 'cam_d_IBUF[%]_inst', w: 8, x: 320, y: 6, noName: true },
      { id: 'ibh', t: 'ibuf', name: 'cam_href_IBUF_inst', x: 320, y: 118, noName: true },
      { id: 'ibv', t: 'ibuf', name: 'cam_vsync_IBUF_inst', x: 320, y: 230, noName: true },
      { id: 'ibc', t: 'ibuf', name: 'cam_pclk_IBUF_inst', x: 300, y: 327, noName: true },
      { id: 'bg', t: 'bufg', name: 'cam_pclk_IBUF_BUFG_inst', x: 352, y: 327, noName: true },
      { id: 'rd', t: 'ff', name: 'cam_d_reg', w: 8, x: 450, y: 2 },
      { id: 'rh', t: 'ff', name: 'href_reg', x: 450, y: 114 },
      { id: 'rv', t: 'ff', name: 'vsync_reg', x: 450, y: 226 },
    ],
    wires: [
      { from: 'cam.D[7:0]', to: 'pd.pad', bus: true, bw: 8 },
      { from: 'cam.HREF', to: 'ph.pad' },
      { from: 'cam.VSYNC', to: 'pv.pad' },
      { from: 'cam.PCLK', to: 'pc.pad', kind: 'clk', dash: true },
      { from: 'pd', to: 'ibd.I' },
      { from: 'ph', to: 'ibh.I' },
      { from: 'pv', to: 'ibv.I' },
      { from: 'ibd.O', to: 'rd.D' },
      { from: 'ibh.O', to: 'rh.D' },
      { from: 'ibv.O', to: 'rv.D' },
      { from: 'pc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['rd.C', 'rh.C', 'rv.C'], kind: 'clk', trunk: 30, label: 'pclk' },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Запуск по спаду, захват по фронту', t: [-4, 46],
      signals: [
        { name: 'cam_pclk', clock: { period: 40 }, arrows: 'both' },
        { name: 'cam_d, href, vsync', bus: [[20, 25, 'D1']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'удержание D0', cls: 'hold' }, { t: 20, label: 'запуск D1 (спад)', cls: 'launch' }, { t: 40, label: 'захват D1 (фронт)', cls: 'capture' }],
      spans: [
        { row: 0, t0: 20, t1: 40, label: 'предустановка: 20 нс (спад → фронт)', cls: 'setup' },
        { row: 0, t0: 0, t1: 20, label: 'удержание: −20 нс', cls: 'hold' },
        { row: 1, t0: 20, t1: 25, label: '0…5 нс', cls: 'data' },
        { row: 1, t0: 25, t1: 40, label: 'запас 15 нс', cls: 'setup' },
      ],
      caption: 'Камера меняет сигналы по спаду PCLK (20 нс) с задержкой 0…5 нс, ПЛИС захватывает их следующим фронтом (40 нс). Поэтому задержку ввода отсчитывают от спада (-clock_fall): на установку данных остаётся полпериода минус 5 нс, на удержание – полпериода.',
    },
  ],
  solution: `create_clock -name pclk -period 40.000 [get_ports cam_pclk]
set_input_delay -clock pclk -clock_fall -max 5.000 [get_ports {cam_d[*] cam_href cam_vsync}]
set_input_delay -clock pclk -clock_fall -min 0.000 [get_ports {cam_d[*] cam_href cam_vsync}]`,
  hints: [
    'Задержку ввода отсчитывают от того фронта тактового сигнала, которым внешняя микросхема запускает данные. Здесь это спад.',
    'Опция `-clock_fall` указывает, что задержка отсчитывается от спада: `set_input_delay -clock <сигнал> -clock_fall -max 5 …`, затем то же с `-min 0`.',
  ],
  explain: `
    \`\`\`
    create_clock -name pclk -period 40.000 [get_ports cam_pclk]
    set_input_delay -clock pclk -clock_fall -max 5.000 [get_ports {cam_d[*] cam_href cam_vsync}]
    set_input_delay -clock pclk -clock_fall -min 0.000 [get_ports {cam_d[*] cam_href cam_vsync}]
    \`\`\`
    **Опорный фронт – спад.** С опцией -clock_fall Vivado считает данные запущенными спадом (20 нс) и подбирает к нему фронты захвата: предустановка «спад → следующий фронт» = **20 нс**, удержание «спад → предыдущий фронт» = **−20 нс**. Запасы до учёта задержек внутри ПЛИС: 20 − 5 = 15 нс по предустановке и 20 нс по удержанию. Интерфейс так и задуман: смена по спаду и захват по фронту дают данным полпериода на установку и полпериода на удержание.

    **Без -clock_fall** задержка отсчитывается от фронта: данные «появляются» через 0…5 нс после фронта, захват – следующим фронтом (40 нс), удержание – тем же фронтом (0 нс). Анализ предустановки станет на 20 нс оптимистичнее, а удержания – на 20 нс строже: Vivado сообщит о ложных нарушениях удержания и начнёт их «исправлять» задержками.

    **Почему не -max 25 -min 20 относительно фронта.** Такие числа дают те же запасы, но только при коэффициенте заполнения ровно 50 %. Опция -clock_fall привязывает задержку к реальному спаду: если форма тактового сигнала задана через -waveform, анализ останется верным. Не годится и «инверсный» тактовый сигнал (\`-waveform {20 40}\`): регистры ПЛИС тактируются фронтом реального сигнала, и сдвиг формы сдвинет моменты захвата.

    Сигналы \`cam_href\` и \`cam_vsync\` запускаются тем же спадом, поэтому они входят в те же команды: забытый сигнал синхронизации останется неограниченным.

    **Проверка в Vivado:** \`report_timing -from [get_ports {cam_d[*]}] -delay_type min_max\` – требование к предустановке 20.000 нс вычисляется как *pclk rise@40.000ns − pclk fall@20.000ns*; \`check_timing\` не должна сообщать *no_input_delay*.
  `,
  refs: 'UG903, глава «Constraining I/O Delay», опция -clock_fall',
  tests: [
    { code: 'create_clock -name pclk -period 40 [get_ports cam_pclk]\nset_input_delay -clock pclk -max 5 [get_ports {cam_d[*] cam_href cam_vsync}]\nset_input_delay -clock pclk -min 0 [get_ports {cam_d[*] cam_href cam_vsync}]', pass: false, note: 'нет -clock_fall', expect: 'относительно спада' },
    { code: 'create_clock -name pclk -period 40 -waveform {20 40} [get_ports cam_pclk]\nset_input_delay -clock pclk -max 5 [get_ports {cam_d[*] cam_href cam_vsync}]\nset_input_delay -clock pclk -min 0 [get_ports {cam_d[*] cam_href cam_vsync}]', pass: false, note: 'инверсный тактовый сигнал вместо -clock_fall', expect: 'форма' },
    { code: 'create_clock -name pclk -period 40 [get_ports cam_pclk]\nset_input_delay -clock pclk -max 25 [get_ports {cam_d[*] cam_href cam_vsync}]\nset_input_delay -clock pclk -min 20 [get_ports {cam_d[*] cam_href cam_vsync}]', pass: false, note: 'сдвиг на полпериода вместо -clock_fall', expect: 'относительно спада' },
    { code: 'create_clock -name pclk -period 40 [get_ports cam_pclk]\nset_input_delay -clock pclk -clock_fall -max 5 [get_ports {cam_d[*]}]\nset_input_delay -clock pclk -clock_fall -min 0 [get_ports {cam_d[*]}]', pass: false, note: 'забыты сигналы синхронизации', expect: 'cam_href' },
    { code: 'create_clock -name cam_pclk -period 40.0 [get_ports cam_pclk]\nset_input_delay -clock_fall -clock [get_clocks cam_pclk] 0 [get_ports {cam_d[*] cam_href cam_vsync}]\nset_input_delay -clock_fall -clock [get_clocks cam_pclk] -max 5 [get_ports {cam_d[*] cam_href cam_vsync}]', pass: true, note: 'одно значение для обоих видов, затем уточнение -max' },
  ],
});

// ---------------------------------------------------------------------------
// LVDS DDR АЦП: общая схема и диаграмма для двух задач
const SSIN_DDR_DESIGN = {
  elements: [
    { id: 'adc', t: 'chip', name: 'АЦП LVDS', x: 0, y: 0, bw: 110, bh: 170, ext: true, pins: [{ n: 'D+[7:0]', side: 'r', y: 40 }, { n: 'D−[7:0]', side: 'r', y: 70 }, { n: 'DCO+', side: 'r', y: 120 }, { n: 'DCO−', side: 'r', y: 145 }] },
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    { id: 'pdp', t: 'in', name: 'adc_d_p', w: 8, x: 200, y: 29 },
    { id: 'pdn', t: 'in', name: 'adc_d_n', w: 8, x: 200, y: 59 },
    { id: 'pcp', t: 'in', name: 'adc_dco_p', x: 200, y: 109 },
    { id: 'pcn', t: 'in', name: 'adc_dco_n', x: 200, y: 134 },
    { id: 'ibd', t: 'ibufds', name: 'u_lvds/d_ibufds[%]', w: 8, x: 360, y: 30, noName: true },
    { id: 'ibc', t: 'ibufds', name: 'u_lvds/dco_ibufds', x: 360, y: 110, noName: true },
    { id: 'bg', t: 'bufg', name: 'u_lvds/dco_bufg', x: 430, y: 115, noName: true },
    { id: 'id', t: 'iddr', name: 'u_lvds/d_iddr[%]', w: 8, x: 530, y: 25 },
    { id: 'lg', t: 'logic', name: 'u_dsp/proc', w: 8, label: 'обработка', bh: 60, x: 660, y: 45 },
  ],
  wires: [
    { from: 'adc.D+[7:0]', to: 'pdp.pad', bus: true, bw: 8 },
    { from: 'adc.D−[7:0]', to: 'pdn.pad', bus: true, bw: 8 },
    { from: 'adc.DCO+', to: 'pcp.pad', kind: 'clk', dash: true },
    { from: 'adc.DCO−', to: 'pcn.pad', kind: 'clk', dash: true },
    { from: 'pdp', to: 'ibd.I' },
    { from: 'pdn', to: 'ibd.IB' },
    { from: 'pcp', to: 'ibc.I', kind: 'clk' },
    { from: 'pcn', to: 'ibc.IB', kind: 'clk' },
    { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
    { from: 'bg.O', to: 'id.C', kind: 'clk' },
    { from: 'ibd.O', to: 'id.D' },
    { from: 'id.Q1', to: 'lg.I0' },
    { from: 'id.Q2', to: 'lg.I2' },
  ],
};
const SSIN_DDR_EYE = {
  kind: 'timing', title: 'DDR, выравнивание по центру: окна действительности', t: [-0.8, 6.8],
  signals: [
    { name: 'adc_dco (ПЛИС)', clock: { period: 4 }, arrows: 'both' },
    { name: 'adc_d (ПЛИС)', bus: [[0.6, 1.4, 'F0'], [2.6, 3.4, 'R1'], [4.6, 5.4, 'F1']], init: 'R0' },
  ],
  marks: [{ t: 0, label: 'фронт', cls: 'launch' }, { t: 2, label: 'спад', cls: 'capture' }, { t: 4, label: 'фронт', cls: 'launch' }, { t: 6, label: 'спад', cls: 'capture' }],
  windows: [
    { row: 1, t0: -0.6, t1: 0, label: 'dv_bre', cls: 'setup' }, { row: 1, t0: 0, t1: 0.6, label: 'dv_are', cls: 'hold' },
    { row: 1, t0: 1.4, t1: 2, label: 'dv_bfe', cls: 'setup' }, { row: 1, t0: 2, t1: 2.6, label: 'dv_afe', cls: 'hold' },
  ],
  spans: [
    { row: 1, t0: 0, t1: 1.4, label: '-max = 1,4 (фронт)', cls: 'setup' },
    { row: 1, t0: 0, t1: 0.6, label: '-min = 0,6 (фронт)', cls: 'hold' },
    { row: 1, t0: 2, t1: 3.4, label: '-max = 1,4 (спад)', cls: 'setup' },
    { row: 1, t0: 2, t1: 2.6, label: '-min = 0,6 (спад)', cls: 'hold' },
  ],
  caption: 'R – данные, захватываемые фронтом, F – спадом; каждые действительны 0,6 нс до и после своего фронта (dv_bre, dv_are, dv_bfe, dv_afe). Задержка относительно фронта описывает смену R0 → F0: самое раннее изменение – через dv_are после фронта (-min = 0,6 нс), самое позднее – за dv_bfe до спада (-max = T/2 − dv_bfe = 1,4 нс). Относительно спада – симметрично.',
};

XT.bank.add({
  id: 'ssin.ddr_center', module: 'ssin', order: 4, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Шаблон DDR (`-clock_fall`, `-add_delay`) одинаков в XDC и SDC; IDDR – примитив ПЛИС.',
  title: 'АЦП с выходом LVDS DDR: выравнивание по центру',
  tags: ['set_input_delay', 'DDR', '-clock_fall', '-add_delay', 'IDDR', 'LVDS'],
  text: `
    Быстродействующий АЦП передаёт 8-разрядные отсчёты по восьми дифференциальным парам LVDS \`adc_d_p/n[7:0]\` с удвоенной скоростью (DDR) вместе с тактовым сигналом сопровождения DCO **250 МГц** (пара \`adc_dco_p/n\`). Данные **выровнены по центру**: по техническому описанию АЦП на выводах ПЛИС каждые данные действительны не менее **0,6 нс до и 0,6 нс после** своего фронта или спада DCO.

    В ПЛИС тактовый сигнал проходит через IBUFDS и BUFG, данные – через IBUFDS на триггеры IDDR, которые захватывают данные и по фронту, и по спаду.

    **Задание.** Опишите тактовый сигнал \`adc_dco\` и задержки ввода данных: значения -max и -min относительно фронта и относительно спада.
  `,
  design: SSIN_DDR_DESIGN,
  figures: [SSIN_DDR_EYE],
  solution: `create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]`,
  hints: [
    'Тактовый сигнал и задержки задают только на P-выводах дифференциальных пар.',
    'Для DDR с выравниванием по центру Vivado по умолчанию проверяет предустановку на полпериода (фронт → спад), а удержание – на тот же фронт. Поэтому задержка относительно фронта описывает данные, которые захватит ближайший спад: -max = T/2 − (действительны до спада), -min = (действительны после фронта).',
    'Четыре команды: -max 1.4 и -min 0.6 относительно фронта, затем те же значения с -clock_fall; вторая пара – обязательно с -add_delay.',
  ],
  explain: `
    \`\`\`
    create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
    set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]
    \`\`\`
    **Обозначения шаблона UG903:** dv_bre и dv_are – данные действительны до и после фронта, dv_bfe и dv_afe – до и после спада. Здесь все четыре равны 0,6 нс, T = 4 нс.

    **Почему задержка «от фронта» описывает данные, захватываемые спадом.** Опорный фронт задержки ввода – это фронт *запуска*. Анализ по умолчанию для такого интерфейса даёт предустановку на полпериода и удержание на том же фронте. Данные, сменившиеся после фронта (F0), захватит ближайший спад через T/2 = 2 нс; они обязаны установиться за dv_bfe до спада, поэтому -max = T/2 − dv_bfe = 2 − 0,6 = **1,4 нс**. Удержание проверяется на том же фронте: захваченные им данные R0 держатся dv_are после него, поэтому -min = dv_are = **0,6 нс**. Для спада всё симметрично: -max = T/2 − dv_bre, -min = dv_afe.

    **Какие проверки получаются** (вкладка «Анализ путей»):

    | Запуск → захват | Предустановка | Удержание |
    |---|---|---|
    | фронт → спад | 2 нс, запас 2 − 1,4 = 0,6 нс | −2 нс |
    | фронт → фронт | 4 нс | 0 нс, запас 0,6 нс |
    | спад → фронт | 2 нс, запас 0,6 нс | −2 нс |
    | спад → спад | 4 нс | 0 нс, запас 0,6 нс |

    Решающие проверки – предустановка на полпериода и удержание на том же фронте; запасы в точности равны окнам действительности из технического описания.

    **Зачем -add_delay.** Команда без -add_delay заменяет уже заданную задержку того же вида (-max или -min) на этом порту – даже если та задана относительно другого фронта. Без -add_delay вторая пара команд сотрёт задержки относительно фронта: половина проверок исчезнет, и Vivado не сообщит об этом как об ошибке.

    **Дифференциальные пары.** Пара – это один сигнал: тактовый сигнал и задержки задают на P-выводах, N-выводы Vivado сопоставит сам.

    **Типичные ошибки.**
    - Формулы для выравнивания по фронту (-max 0.6, -min −0.6): предустановка станет оптимистичной на 0,8 нс, удержание – строже на 1,2 нс.
    - Формула SDR (-max = T − 0,6 = 3,4 нс): проверка «фронт → спад» получит отрицательный запас – ложное нарушение предустановки.
    - Нет пары с -clock_fall или нет -add_delay: данные одной из фаз не анализируются.

    **Проверка в Vivado:** \`report_timing -rise_from [get_ports {adc_d_p[*]}] -delay_type min_max\` и то же с \`-fall_from\`; \`check_timing\` – нет *partial_input_delay*.
  `,
  refs: 'UG903, глава «Constraining I/O Delay», шаблон Source Synchronous, Center Aligned, DDR',
  tests: [
    { code: 'set input_clock adc_dco\nset input_clock_period 4.000\nset dv_bre 0.6\nset dv_are 0.6\nset dv_bfe 0.6\nset dv_afe 0.6\nset input_ports [get_ports {adc_d_p[*]}]\ncreate_clock -name $input_clock -period $input_clock_period [get_ports adc_dco_p]\nset_input_delay -clock $input_clock -max [expr {$input_clock_period/2 - $dv_bfe}] $input_ports\nset_input_delay -clock $input_clock -min $dv_are $input_ports\nset_input_delay -clock $input_clock -max [expr {$input_clock_period/2 - $dv_bre}] $input_ports -clock_fall -add_delay\nset_input_delay -clock $input_clock -min $dv_afe $input_ports -clock_fall -add_delay', pass: true, note: 'шаблон UG903 с переменными' },
    { code: 'create_clock -name adc_dco -period 4 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.4 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min 0.6 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 1.4 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.6 [get_ports {adc_d_p[*]}]', pass: false, note: 'нет -add_delay', expect: 'перезаписана' },
    { code: 'create_clock -name adc_dco -period 4 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.4 [get_ports {adc_d_p[*] adc_d_n[*]}]\nset_input_delay -clock adc_dco -min 0.6 [get_ports {adc_d_p[*] adc_d_n[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 1.4 -add_delay [get_ports {adc_d_p[*] adc_d_n[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.6 -add_delay [get_ports {adc_d_p[*] adc_d_n[*]}]', pass: false, note: 'задержки и на N-выводах', expect: 'Лишняя set_input_delay' },
    { code: 'create_clock -name adc_dco -period 4 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 0.6 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min -0.6 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 0.6 -add_delay [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min -0.6 -add_delay [get_ports {adc_d_p[*]}]', pass: false, note: 'формулы для выравнивания по фронту', expect: '-max .*0\\.600 нс – неверно' },
    { code: 'create_clock -name adc_dco -period 4 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.4 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min 0.6 [get_ports {adc_d_p[*]}]', pass: false, note: 'нет задержек относительно спада', expect: 'относительно спада' },
  ],
});

// ---------------------------------------------------------------------------
// RGMII: общие элементы схемы
function ssinRgmiiDesign(mmcm) {
  const xi = mmcm ? 566 : 470;   // абсцисса триггеров IDDR
  const els = [
    { id: 'phy', t: 'chip', name: 'PHY', x: 0, y: 0, bw: 84, bh: 290, ext: true, pins: [{ n: 'RXD[3:0]', side: 'r', y: 40 }, { n: 'RX_CTL', side: 'r', y: 154 }, { n: 'RXC', side: 'r', y: 273 }] },
    { id: 'phym', t: 'note', x: 4, y: 190, text: mmcm ? 'без\nзадержки' : 'режим\nRGMII-ID', box: false },
    { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
    { id: 'pd', t: 'in', name: 'rgmii_rxd', w: 4, x: 160, y: 29 },
    { id: 'pt', t: 'in', name: 'rgmii_rx_ctl', x: 160, y: 143 },
    { id: 'pc', t: 'in', name: 'rgmii_rxc', x: 160, y: 262 },
    { id: 'ibd', t: 'ibuf', name: 'rgmii_rxd_IBUF[%]_inst', w: 4, x: 300, y: 26, noName: true },
    { id: 'ibt', t: 'ibuf', name: 'rgmii_rx_ctl_IBUF_inst', x: 300, y: 140, noName: true },
    { id: 'ibc', t: 'ibuf', name: 'rgmii_rxc_IBUF_inst', x: 264, y: 259, noName: true },
    { id: 'idd', t: 'iddr', name: 'u_rgmii_rx/rxd_iddr[%]', w: 4, x: xi, y: 16 },
    { id: 'idt', t: 'iddr', name: 'u_rgmii_rx/ctl_iddr', x: xi, y: 130 },
    {
      id: 'mac', t: 'block', name: 'u_mac', title: 'MAC', x: xi + 104, y: 16, bw: 86, bh: 196,
      pins: [{ n: 'rxd_r', w: 4, y: 32, label: 'RXD[3:0]' }, { n: 'rxd_f', w: 4, y: 56, label: 'RXD[7:4]' }, { n: 'dv', y: 146, label: 'RX_DV' }, { n: 'er', y: 170, label: 'RX_ER⊕DV' }],
    },
  ];
  const wires = [
    { from: 'phy.RXD[3:0]', to: 'pd.pad', bus: true, bw: 4 },
    { from: 'phy.RX_CTL', to: 'pt.pad' },
    { from: 'phy.RXC', to: 'pc.pad', kind: 'clk', dash: true },
    { from: 'pd', to: 'ibd.I' },
    { from: 'pt', to: 'ibt.I' },
    { from: 'pc', to: 'ibc.I', kind: 'clk' },
    { from: 'ibd.O', to: 'idd.D' },
    { from: 'ibt.O', to: 'idt.D' },
    { from: 'idd.Q1', to: 'mac.rxd_r' },
    { from: 'idd.Q2', to: 'mac.rxd_f' },
    { from: 'idt.Q1', to: 'mac.dv' },
    { from: 'idt.Q2', to: 'mac.er' },
  ];
  if (mmcm) {
    els.push(
      { id: 'm', t: 'mmcm', name: 'u_rgmii_rx/mmcm_inst', x: 312, y: 230, mult: 8, divclk: 1, outs: [{ pin: 'CLKOUT0', div: 8, phase: 90, clk: 'rx_clk90', label: 'rx_clk90 (90°)' }] },
      { id: 'bg', t: 'bufg', name: 'u_rgmii_rx/clk90_bufg', x: 482, y: 250, noName: true },
    );
    wires.push(
      { from: 'ibc.O', to: 'm.CLKIN1', kind: 'clk' },
      { from: 'm.CLKOUT0', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['idd.C', 'idt.C'], kind: 'clk', trunk: 24 },
    );
  } else {
    els.push({ id: 'bg', t: 'bufg', name: 'rgmii_rxc_IBUF_BUFG_inst', x: 330, y: 259, noName: true });
    wires.push(
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: ['idd.C', 'idt.C'], kind: 'clk', trunk: 30 },
    );
  }
  return { elements: els, wires };
}

XT.bank.add({
  id: 'ssin.rgmii_id', module: 'ssin', order: 5, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Шаблон DDR (`-clock_fall`, `-add_delay`) одинаков в XDC и SDC; IDDR – примитив ПЛИС.',
  title: 'Приём RGMII: PHY с внутренней задержкой',
  tags: ['set_input_delay', 'DDR', 'RGMII', 'IDDR'],
  text: `
    Микросхема физического уровня Ethernet (PHY) передаёт ПЛИС принятые данные по интерфейсу RGMII: тактовый сигнал \`rgmii_rxc\` **125 МГц**, данные \`rgmii_rxd[3:0]\` и сигнал управления \`rgmii_rx_ctl\` с удвоенной скоростью (по фронту – младшая тетрада байта и RX_DV, по спаду – старшая тетрада и RX_ER ⊕ RX_DV).

    В PHY включена **внутренняя задержка тактового сигнала** (режим RGMII-ID), поэтому данные приходят выровненными по центру: по техническому описанию PHY на выводах ПЛИС данные действительны не менее **1,2 нс до и 1,2 нс после** каждого фронта и спада RXC.

    В ПЛИС тактовый сигнал проходит через IBUF и BUFG, данные захватываются триггерами IDDR.

    **Задание.** Опишите тактовый сигнал \`rgmii_rxc\` и задержки ввода для \`rgmii_rxd[3:0]\` и \`rgmii_rx_ctl\`.
  `,
  design: ssinRgmiiDesign(false),
  figures: [
    {
      kind: 'timing', title: 'RGMII-ID: фронт и спад RXC в середине окна данных', t: [-1.5, 9.5],
      signals: [
        { name: 'rgmii_rxc', clock: { period: 8 }, arrows: 'both' },
        { name: 'rxd, rx_ctl', bus: [[1.2, 2.8, '[7:4]'], [5.2, 6.8, '[3:0]']], init: '[3:0]' },
      ],
      marks: [{ t: 0, label: 'фронт: запуск', cls: 'launch' }, { t: 4, label: 'спад: захват [7:4]', cls: 'capture' }, { t: 8, label: 'фронт', cls: 'launch' }],
      windows: [
        { row: 1, t0: -1.2, t1: 0, label: '1,2', cls: 'setup' }, { row: 1, t0: 0, t1: 1.2, label: '1,2', cls: 'hold' },
        { row: 1, t0: 2.8, t1: 4, label: '1,2', cls: 'setup' }, { row: 1, t0: 4, t1: 5.2, label: '1,2', cls: 'hold' },
      ],
      spans: [
        { row: 0, t0: 0, t1: 4, label: 'предустановка: T/2 = 4 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 2.8, label: '-max = T/2 − 1,2 = 2,8 нс', cls: 'setup' },
        { row: 1, t0: 0, t1: 1.2, label: '-min = 1,2 нс', cls: 'hold' },
      ],
      caption: 'Внутренняя задержка PHY сдвигает RXC примерно на четверть периода, и каждый фронт и спад попадает в середину окна данных шириной не менее 2,4 нс. Задержки относительно фронта описывают смену [3:0] → [7:4], которую захватит спад; относительно спада – смену [7:4] → [3:0], которую захватит следующий фронт.',
    },
  ],
  solution: `create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
set_input_delay -clock rgmii_rxc -max 2.800 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -min 1.200 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -clock_fall -max 2.800 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -clock_fall -min 1.200 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]`,
  hints: [
    'Это DDR с выравниванием по центру – та же схема расчёта, что и для АЦП с выходом LVDS DDR, только T = 8 нс.',
    '-max = T/2 − 1,2 = 2,8 нс, -min = 1,2 нс – относительно фронта и (с -clock_fall -add_delay) относительно спада. Не забудьте `rgmii_rx_ctl`.',
  ],
  explain: `
    \`\`\`
    create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
    set_input_delay -clock rgmii_rxc -max 2.800 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -min 1.200 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -clock_fall -max 2.800 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -clock_fall -min 1.200 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    \`\`\`
    **Расчёт** (шаблон UG903 для DDR с выравниванием по центру, T = 8 нс, все четыре окна по 1,2 нс):
    - -max = T/2 − 1,2 = 4 − 1,2 = **2,8 нс** – данные, сменившиеся после фронта, должны установиться за 1,2 нс до спада;
    - -min = **1,2 нс** – данные, захваченные фронтом, держатся 1,2 нс после него.

    То же – относительно спада (\`-clock_fall -add_delay\`).

    **Что получит анализ.** Предустановка «фронт → спад» и «спад → фронт»: требование 4 нс, запас до учёта задержек внутри ПЛИС 4 − 2,8 = 1,2 нс. Удержание «фронт → фронт» и «спад → спад»: требование 0 нс, запас 1,2 нс. Внутренняя задержка PHY уже поставила фронты RXC в середину окна, поэтому ПЛИС захватывает данные непосредственно – без сдвига фазы в MMCM.

    **Типичные ошибки.**
    - Формула SDR (-max = T − 1,2 = 6,8 нс): для захвата спадом это означает, что данные установятся уже после спада, – ложное нарушение предустановки.
    - Только задержки относительно фронта: данные, запускаемые спадом (старшие тетрады), остаются неограниченными.
    - Забыть \`rgmii_rx_ctl\`: сигнал RX_DV/RX_ER передаётся так же, как данные, и без задержек приём кадров может нарушиться, хотя отчёт будет чистым.
    - Нет \`-add_delay\` во второй паре: задержки относительно фронта будут стёрты.

    **Проверка в Vivado:** \`report_timing -from [get_ports {rgmii_rxd[*] rgmii_rx_ctl}] -delay_type min_max -max_paths 20\`; \`check_timing\` – нет *no_input_delay* и *partial_input_delay*.
  `,
  refs: 'UG903, шаблон Source Synchronous, Center Aligned, DDR; спецификация RGMII v2.0 (режим с внутренней задержкой)',
  tests: [
    { code: 'set T 8.0\nset dv 1.2\nset ports [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\ncreate_clock -name phy_rxc -period $T [get_ports rgmii_rxc]\nset_input_delay -clock phy_rxc -max [expr {$T/2 - $dv}] $ports\nset_input_delay -clock phy_rxc -min $dv $ports\nset_input_delay -clock phy_rxc -clock_fall -max [expr {$T/2 - $dv}] -add_delay $ports\nset_input_delay -clock phy_rxc -clock_fall -min $dv -add_delay $ports', pass: true, note: 'через переменные, другое имя тактового сигнала' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\nset_input_delay -clock rgmii_rxc -max 6.8 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -min 1.2 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -clock_fall -max 6.8 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -clock_fall -min 1.2 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: false, note: 'формула SDR: T − 1,2', expect: '-max .*6\\.800 нс – неверно' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\nset_input_delay -clock rgmii_rxc -max 2.8 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -min 1.2 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: false, note: 'нет задержек относительно спада', expect: 'относительно спада' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\nset_input_delay -clock rgmii_rxc -max 2.8 [get_ports {rgmii_rxd[*]}]\nset_input_delay -clock rgmii_rxc -min 1.2 [get_ports {rgmii_rxd[*]}]\nset_input_delay -clock rgmii_rxc -clock_fall -max 2.8 -add_delay [get_ports {rgmii_rxd[*]}]\nset_input_delay -clock rgmii_rxc -clock_fall -min 1.2 -add_delay [get_ports {rgmii_rxd[*]}]', pass: false, note: 'забыт rgmii_rx_ctl', expect: 'rgmii_rx_ctl' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssin.rgmii_noid', module: 'ssin', order: 6, level: 3, tool: 'vivado',
  lang: 'both', langNote: 'Задержки ввода общие. Сдвинутый на 90° сигнал MMCM Vivado выводит сам; в ASIC сдвинутый выход PLL пришлось бы описать командой `create_generated_clock`.',
  title: 'Приём RGMII без внутренней задержки: сдвиг MMCM на 90°',
  tags: ['set_input_delay', 'DDR', 'RGMII', 'MMCM', 'отрицательная задержка'],
  text: `
    Та же микросхема PHY, но внутренняя задержка тактового сигнала **выключена**: данные \`rgmii_rxd[3:0]\` и \`rgmii_rx_ctl\` приходят выровненными **по фронтам** RXC. По техническому описанию PHY на выводах ПЛИС данные изменяются в интервале **±0,5 нс** относительно каждого фронта и спада \`rgmii_rxc\` (125 МГц).

    Чтобы захватывать данные в середине интервала действительности, в ПЛИС тактовый сигнал проходит через MMCM, который сдвигает его на **+90°** (2 нс), и буфер BUFG; данные захватываются триггерами IDDR. Тактовый сигнал на выходе MMCM Vivado выводит автоматически под именем \`rx_clk90\`.

    **Задание.** Опишите тактовый сигнал \`rgmii_rxc\` и задержки ввода для \`rgmii_rxd[3:0]\` и \`rgmii_rx_ctl\`.
  `,
  design: ssinRgmiiDesign(true),
  figures: [
    {
      kind: 'timing', title: 'Данные по фронтам RXC, захват сдвинутым на 90° сигналом', t: [-1.5, 10.5],
      signals: [
        { name: 'rgmii_rxc (вывод)', clock: { period: 8 }, arrows: 'both', cls: 'launch' },
        { name: 'rxd, rx_ctl', bus: [[-0.5, 0.5, '[3:0]'], [3.5, 4.5, '[7:4]'], [7.5, 8.5, '[3:0]']], init: '[7:4]' },
        { name: 'rx_clk90 (захват)', clock: { period: 8, rise: 2, fall: 6 }, arrows: 'both', cls: 'capture' },
      ],
      marks: [{ t: 0, label: 'запуск ↑', cls: 'launch' }, { t: 2, label: 'захват ↑', cls: 'capture' }, { t: 4, label: 'запуск ↓', cls: 'launch' }, { t: 6, label: 'захват ↓', cls: 'capture' }],
      spans: [
        { row: 1, t0: 0, t1: 0.5, label: '-max = +0,5', cls: 'setup' },
        { row: 1, t0: -0.5, t1: 0, label: '-min = −0,5', cls: 'hold' },
        { row: 2, t0: 0, t1: 2, label: 'предустановка 2 нс', cls: 'setup' },
        { row: 2, t0: 2, t1: 4, label: 'удержание −2 нс (спад → фронт)', cls: 'hold' },
      ],
      caption: 'Данные, запущенные фронтом rgmii_rxc (0), захватывает фронт rx_clk90 (2 нс): требование к предустановке 2 нс. Данные, запущенные следующим спадом (4 нс), не должны исказить этот захват: проверка удержания «спад → фронт» с требованием 2 − 4 = −2 нс. Запасы по 1,5 нс с обеих сторон.',
    },
  ],
  solution: `create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
set_input_delay -clock rgmii_rxc -max 0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -min -0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -clock_fall -max 0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
set_input_delay -clock rgmii_rxc -clock_fall -min -0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]`,
  hints: [
    'Тактовый сигнал MMCM описывать не нужно: Vivado выведет его сам вместе со сдвигом 90°. Опишите только входной тактовый сигнал на порту.',
    'Задержки задают относительно `rgmii_rxc` – сигнала, которым PHY запускает данные. Данные выровнены по фронтам: -max = +0,5, -min = −0,5 – относительно фронта и (с -clock_fall -add_delay) относительно спада.',
  ],
  explain: `
    \`\`\`
    create_clock -name rgmii_rxc -period 8.000 [get_ports rgmii_rxc]
    set_input_delay -clock rgmii_rxc -max 0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -min -0.500 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -clock_fall -max 0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    set_input_delay -clock rgmii_rxc -clock_fall -min -0.500 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]
    \`\`\`
    **Тактовые сигналы.** Достаточно описать входной сигнал на порту. По настройкам MMCM (умножение 8, деление 8, фаза 90°) Vivado выводит \`rx_clk90\`: период 8 нс, форма {2 6}, то есть фронт через 2 нс после фронта \`rgmii_rxc\`. Задержки ввода задают относительно \`rgmii_rxc\`: именно его фронтами PHY запускает данные.

    **Задержки** (шаблон UG903 для DDR с выравниванием по фронту): данные меняются от 0,5 нс до фронта до 0,5 нс после него, поэтому -max = **+0,5 нс**, -min = **−0,5 нс** – и для фронта, и для спада.

    **Какие проверки получаются:**

    | Запуск (rgmii_rxc) → захват (rx_clk90) | Предустановка | Удержание |
    |---|---|---|
    | фронт 0 → фронт 2 | **2 нс**, запас 2 − 0,5 = 1,5 нс | −6 нс |
    | фронт 0 → спад 6 | 6 нс | **−2 нс**, запас 1,5 нс |
    | спад 4 → фронт 10 | 6 нс | **−2 нс**, запас 1,5 нс |
    | спад 4 → спад 6 | **2 нс**, запас 1,5 нс | −6 нс |

    Решающие проверки: предустановка между одноимёнными фронтами (2 нс – ровно сдвиг на 90°) и удержание между разноимёнными (−2 нс): данные, запущенные спадом в 4 нс, меняются не раньше 3,5 нс, а фронт \`rx_clk90\` в 2 нс должен успеть захватить предыдущие. Сдвиг на 90° ставит момент захвата в середину окна данных: по 1,5 нс запаса с каждой стороны до учёта задержек внутри ПЛИС.

    **Типичные ошибки.**
    - Нет пары с -clock_fall: данные, запускаемые спадом, не анализируются.
    - \`create_clock\` на выходе MMCM: появляется независимый первичный тактовый сигнал, связь с \`rgmii_rxc\` теряется, и пути от портов к IDDR становятся междоменными без общего источника.
    - Задержки относительно \`rx_clk90\`: опорный момент сдвигается на 2 нс, и анализ теряет смысл (предустановка станет 8 нс вместо 2).
    - Формулы для выравнивания по центру (-max = T/2 − …): они предполагают, что данные устанавливаются задолго до спада, и требования окажутся вымышленными.

    **Проверка в Vivado:** \`report_clocks\` – \`rx_clk90\` с формой {2.000 6.000}; \`report_timing -from [get_ports {rgmii_rxd[*]}] -delay_type min_max\` – требование к предустановке 2.000 нс (*rx_clk90 rise@2.000ns − rgmii_rxc rise@0.000ns*), к удержанию −2.000 нс.
  `,
  refs: 'UG903, шаблон Source Synchronous, Edge Aligned, DDR (с MMCM/PLL); UG472, сдвиг фазы MMCM',
  tests: [
    { code: 'set skew 0.5\ncreate_clock -name rgmii_rxc -period 8.0 [get_ports rgmii_rxc]\nset_input_delay -clock [get_clocks rgmii_rxc] -max $skew [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock [get_clocks rgmii_rxc] -min [expr {-$skew}] [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock [get_clocks rgmii_rxc] -max $skew -clock_fall -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock [get_clocks rgmii_rxc] -min [expr {-$skew}] -clock_fall -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: true, note: 'через переменную' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\nset_input_delay -clock rgmii_rxc -max 0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -min -0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: false, note: 'нет пары с -clock_fall', expect: 'относительно спада' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\ncreate_clock -name rx_clk90 -period 8 -waveform {2 6} [get_pins u_rgmii_rx/mmcm_inst/CLKOUT0]\nset_input_delay -clock rgmii_rxc -max 0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -min -0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -clock_fall -max 0.5 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rgmii_rxc -clock_fall -min -0.5 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: false, note: 'create_clock на выходе MMCM', expect: 'производным' },
    { code: 'create_clock -name rgmii_rxc -period 8 [get_ports rgmii_rxc]\nset_input_delay -clock rx_clk90 -max 0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rx_clk90 -min -0.5 [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rx_clk90 -clock_fall -max 0.5 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]\nset_input_delay -clock rx_clk90 -clock_fall -min -0.5 -add_delay [get_ports {rgmii_rxd[*] rgmii_rx_ctl}]', pass: false, note: 'задержки относительно сдвинутого сигнала', expect: 'неверный опорный тактовый сигнал' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'ssin.fix_ddr', module: 'ssin', order: 7, level: 2, tool: 'vivado',
  lang: 'both', langNote: 'Ошибки со знаком `-min` и забытым `-add_delay` одинаково возможны в XDC и SDC.',
  title: 'Найдите ошибки: ограничения LVDS DDR',
  tags: ['set_input_delay', 'DDR', '-add_delay', 'поиск ошибок'],
  text: `
    Для АЦП с выходом LVDS DDR из задачи [[q:ssin.ddr_center|«АЦП с выходом LVDS DDR»]] коллега написал ограничения – они уже в редакторе. Параметры прежние: DCO 250 МГц, данные действительны не менее 0,6 нс до и 0,6 нс после каждого фронта и спада.

    После реализации Vivado сообщает о нарушениях удержания на входах \`adc_d_p[*]\`, а \`check_timing\` – о частично заданных задержках ввода (*partial_input_delay*).

    **Задание.** Найдите и исправьте ошибки в ограничениях.
  `,
  design: SSIN_DDR_DESIGN,
  figures: [Object.assign({}, SSIN_DDR_EYE, { title: 'Правильная модель: окна действительности DDR' })],
  starter: `create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -min -0.600 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]`,
  solution: `create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]`,
  hints: [
    'Проверьте знаки: данные выровнены по центру, окно действительности охватывает фронт, поэтому самое раннее изменение после фронта положительно.',
    'Команда без -add_delay заменяет уже заданную задержку того же вида (-max или -min) на порту, даже если та задана относительно другого фронта. Какая задержка исчезла после строки 4?',
    'Исправления: в строке 3 -min 0.600 вместо -0.600, в строку 4 добавить -add_delay.',
  ],
  explain: `
    \`\`\`
    create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
    set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]
    set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]
    \`\`\`
    **Ошибка 1 – знак -min относительно фронта.** Для выравнивания по центру -min = dv_are = +0,6 нс: данные, захваченные фронтом, держатся 0,6 нс после него. Значение −0,6 описывает интерфейс, выровненный по фронту, и делает проверку удержания на 1,2 нс строже реальной – отсюда сообщения о нарушениях удержания. Vivado стал бы их «исправлять» задержками в трассировке, ухудшая предустановку.

    **Ошибка 2 – нет -add_delay в строке 4.** Команда с -clock_fall -max без -add_delay заменила задержку -max, заданную в строке 2 относительно фронта. У портов осталась только -min относительно фронта (отсюда *partial_input_delay*), и проверка предустановки для данных, запускаемых фронтом и захватываемых спадом, вообще не выполняется – самая жёсткая проверка интерфейса пропала без сообщения об ошибке. В строке 5 -add_delay есть, поэтому -min относительно фронта уцелела.

    **Правило:** если на порту больше одной задержки (фронт и спад, несколько тактовых сигналов), каждая команда после первой для того же вида (-max или -min) пишется с -add_delay. Надёжнее ставить -add_delay во всех командах с -clock_fall.

    **Проверка в Vivado:** \`report_timing -rise_from [get_ports {adc_d_p[*]}] -delay_type min_max\` должен показать предустановку «фронт → спад» с требованием 2 нс; \`check_timing\` – без *partial_input_delay*.
  `,
  refs: 'UG903, раздел о set_input_delay и опции -add_delay',
  tests: [
    { code: `create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]
set_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -min -0.600 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -max 1.400 [get_ports {adc_d_p[*]}]
set_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]`, pass: false, note: 'исходный текст без исправлений', expect: ['значение -max перезаписано', 'ошибка в знаке'] },
    { code: 'create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 1.400 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]', pass: false, note: 'исправлен только знак', expect: 'значение -max перезаписано' },
    { code: 'create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min -0.600 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 1.400 -add_delay [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.600 -add_delay [get_ports {adc_d_p[*]}]', pass: false, note: 'исправлен только -add_delay', expect: 'ошибка в знаке' },
    { code: 'create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -max 1.400 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min 0.600 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -max 1.400 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.600 [get_ports {adc_d_p[*]}]', pass: false, note: '-add_delay убран из обеих команд со спадом', expect: 'перезаписана' },
    { code: 'create_clock -name adc_dco -period 4.000 [get_ports adc_dco_p]\nset_input_delay -clock adc_dco -clock_fall -max 1.4 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -clock_fall -min 0.6 [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -max 1.4 -add_delay [get_ports {adc_d_p[*]}]\nset_input_delay -clock adc_dco -min 0.6 -add_delay [get_ports {adc_d_p[*]}]', pass: true, note: 'сначала спад, затем фронт с -add_delay' },
  ],
});
