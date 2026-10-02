/* Модуль 8. Физические ограничения XDC (Vivado) */
XT.bank.module({
  id: 'phys', order: 80, title: '8. Физические ограничения XDC',
  about: 'Назначение выводов корпуса и стандартов ввода/вывода, дифференциальные входы и внутреннее согласование, размещение регистров в блоках ввода/вывода, параметры конфигурации, DRIVE и SLEW',
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'phys.pins', module: 'phys', order: 1, level: 1, tool: 'vivado',
  lang: 'xdc', langNote: 'Выводы корпуса и стандарты ввода/вывода задаются в XDC; в ASIC это не SDC, а описание ячеек ввода/вывода и планировка кристалла.',
  title: 'Назначение выводов и стандартов учебной платы',
  tags: ['set_property', 'PACKAGE_PIN', 'IOSTANDARD'],
  text: `
    Учебная плата с ПЛИС семейства 7: к выводам корпуса подключены генератор 100 МГц, четыре светодиода, две кнопки и преобразователь USB–UART. Таблица подключения из документации платы:

    | Порт проекта | Вывод корпуса | Подключение |
    |---|---|---|
    | \`sys_clk\` | E3 | генератор 100 МГц |
    | \`led[0]\` | H17 | светодиод 0 |
    | \`led[1]\` | K15 | светодиод 1 |
    | \`led[2]\` | J13 | светодиод 2 |
    | \`led[3]\` | N14 | светодиод 3 |
    | \`btn[0]\` | M18 | кнопка 0 |
    | \`btn[1]\` | P17 | кнопка 1 |
    | \`uart_tx\` | D4 | выход ПЛИС → вход RXD преобразователя |
    | \`uart_rx\` | C4 | выход TXD преобразователя → вход ПЛИС |

    Все эти выводы находятся в банках с напряжением питания VCCO = 3,3 В, поэтому все порты используют стандарт ввода/вывода **LVCMOS33**.

    Пока выводы не назначены, Vivado не сформирует конфигурационный файл: проверка DRC при выполнении \`write_bitstream\` остановится на портах без стандарта (NSTD-1) и без вывода корпуса (UCIO-1). Тактовый сигнал \`sys_clk\` уже описан.

    **Задание.** Назначьте каждому порту вывод корпуса (\`PACKAGE_PIN\`) и стандарт ввода/вывода (\`IOSTANDARD\`).
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: -20, y: 230, label: '100 МГц', ext: true },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'prx', t: 'in', name: 'uart_rx', x: 60, y: 33 },
      { id: 'ibr', t: 'ibuf', name: 'uart_rx_IBUF_inst', x: 148, y: 30, noName: true },
      { id: 'pbt', t: 'in', name: 'btn', w: 2, x: 60, y: 109 },
      { id: 'ibb', t: 'ibuf', name: 'btn_IBUF[%]_inst', w: 2, x: 148, y: 106, noName: true },
      { id: 'psc', t: 'in', name: 'sys_clk', x: 60, y: 239 },
      { id: 'ibc', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 148, y: 236, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 196, y: 236, noName: true },
      { id: 'rb', t: 'ff', name: 'btn_sync_reg', w: 2, x: 258, y: 102 },
      {
        id: 'core', t: 'block', name: 'u_core', title: 'логика проекта', noName: true, x: 348, y: 20, bw: 104, bh: 176,
        pins: [
          { n: 'RX', side: 'l', y: 24 }, { n: 'BTN', w: 2, side: 'l', y: 100 }, { n: 'CLK', side: 'l', y: 150, clk: true },
          { n: 'TX', d: 'out', side: 'r', y: 24 }, { n: 'LED', d: 'out', w: 4, side: 'r', y: 100 },
        ],
        timing: { seq: true, clk: 'CLK', capture: { RX: ['rise'], BTN: ['rise'] }, launch: { TX: ['rise'], LED: ['rise'] } },
      },
      { id: 'rl', t: 'ff', name: 'led_reg', w: 4, x: 472, y: 102 },
      { id: 'obt', t: 'obuf', name: 'uart_tx_OBUF_inst', x: 567, y: 30, noName: true },
      { id: 'obl', t: 'obuf', name: 'led_OBUF[%]_inst', w: 4, x: 567, y: 106, noName: true },
      { id: 'ptx', t: 'out', name: 'uart_tx', x: 639, y: 33 },
      { id: 'pled', t: 'out', name: 'led', w: 4, x: 632, y: 109 },
    ],
    wires: [
      { from: 'osc.out', to: 'psc.pad' },
      { from: 'psc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'rb.C', kind: 'clk', mx: 245, label: 'sys_clk', lx: 290, ly: 245 },
      { from: 'bg.O', to: 'core.CLK', kind: 'clk', mx: 336 },
      { from: 'bg.O', to: 'rl.C', kind: 'clk', mx: 460 },
      { from: 'prx', to: 'ibr.I' },
      { from: 'ibr.O', to: 'core.RX' },
      { from: 'pbt', to: 'ibb.I' },
      { from: 'ibb.O', to: 'rb.D' },
      { from: 'rb.Q', to: 'core.BTN' },
      { from: 'core.LED', to: 'rl.D' },
      { from: 'rl.Q', to: 'obl.I' },
      { from: 'obl.O', to: 'pled' },
      { from: 'core.TX', to: 'obt.I' },
      { from: 'obt.O', to: 'ptx' },
    ],
  },
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_property -dict {PACKAGE_PIN E3  IOSTANDARD LVCMOS33} [get_ports sys_clk]
set_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]
set_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS33} [get_ports {led[1]}]
set_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS33} [get_ports {led[2]}]
set_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {led[3]}]
set_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]
set_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]
set_property -dict {PACKAGE_PIN D4  IOSTANDARD LVCMOS33} [get_ports uart_tx]
set_property -dict {PACKAGE_PIN C4  IOSTANDARD LVCMOS33} [get_ports uart_rx]`,
  hints: [
    'Нужны два свойства порта: PACKAGE_PIN (вывод корпуса) и IOSTANDARD (стандарт ввода/вывода). Оба можно задать одной командой с -dict.',
    'Разряды шины назначают по одному: у led[0] и led[1] разные выводы. Имя разряда заключают в фигурные скобки: `[get_ports {led[0]}]`, иначе Tcl попытается выполнить `[0]` как команду.',
    'Образец: `set_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]` – и так для каждого из девяти портов.',
  ],
  explain: `
    \`\`\`
    set_property -dict {PACKAGE_PIN E3  IOSTANDARD LVCMOS33} [get_ports sys_clk]
    set_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]
    set_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS33} [get_ports {led[1]}]
    set_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS33} [get_ports {led[2]}]
    set_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {led[3]}]
    set_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]
    set_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]
    set_property -dict {PACKAGE_PIN D4  IOSTANDARD LVCMOS33} [get_ports uart_tx]
    set_property -dict {PACKAGE_PIN C4  IOSTANDARD LVCMOS33} [get_ports uart_rx]
    \`\`\`
    - **PACKAGE_PIN** – вывод корпуса, к которому подключён порт. Номер берут из схемы платы или её файла ограничений: определить его сам Vivado не может.
    - **IOSTANDARD** – стандарт ввода/вывода: уровни напряжения, пороги переключения входа, параметры выходного буфера. Стандарт должен соответствовать напряжению VCCO банка: LVCMOS33 – банкам с VCCO = 3,3 В.
    - **Разряды шины** назначаются по отдельности, у каждого свой вывод. Фигурные скобки в \`{led[0]}\` обязательны: без них Tcl воспримет \`[0]\` как подстановку команды.
    - Форма \`-dict\` задаёт несколько свойств одной командой; отдельные команды \`set_property\` для каждого свойства равноценны. Стандарт часто назначают сразу группе портов: \`set_property IOSTANDARD LVCMOS33 [get_ports {led[*] btn[*]}]\`.

    **Типичные ошибки.**
    - **LVCMOS25 в банке 3,3 В.** Vivado не знает напряжения VCCO на плате – он выводит его из стандартов портов. Если в одном банке окажутся стандарты с разным VCCO, DRC сообщит о конфликте напряжений банка (BIVC-1). Если же неверный стандарт задан всем портам банка, ошибку обнаружит только плата: пороги входов и параметры выходов будут рассчитаны на 2,5 В при фактических 3,3 В.
    - **Опечатка в имени свойства** (\`IOSTANDART\`): Vivado сообщит, что такого свойства у порта нет, и стандарт останется не назначенным – \`write_bitstream\` остановится на NSTD-1.
    - **Переставленные выводы разрядов** не обнаружат ни DRC, ни временной анализ: светодиоды просто будут загораться не в том порядке. Назначения сверяют со схемой платы.
    - **Список выводов для всей шины** (\`set_property PACKAGE_PIN {H17 K15 J13 N14} [get_ports {led[*]}]\`): каждому разряду присваивается вся строка целиком, а это не имя вывода.

    Для кнопок, светодиодов и UART на низкой скорости временны́е ограничения ввода/вывода обычно не задают (или объявляют такие пути ложными): сигналы асинхронны и синхронизируются внутри ПЛИС, как кнопки здесь регистрами \`btn_sync_reg\`.

    **Проверка в Vivado:** \`report_io\` – таблица портов с выводами, банками и стандартами; \`report_drc\` – без NSTD-1 и UCIO-1; в окне I/O Planning видно размещение портов на корпусе.
  `,
  refs: 'UG903, глава «Physical Constraints» (PACKAGE_PIN, IOSTANDARD); UG912 (описание свойств); UG471 (стандарты ввода/вывода семейства 7)',
  tests: [
    { code: 'set_property PACKAGE_PIN E3 [get_ports sys_clk]\nset_property PACKAGE_PIN H17 [get_ports {led[0]}]\nset_property PACKAGE_PIN K15 [get_ports {led[1]}]\nset_property PACKAGE_PIN J13 [get_ports {led[2]}]\nset_property PACKAGE_PIN N14 [get_ports {led[3]}]\nset_property PACKAGE_PIN M18 [get_ports {btn[0]}]\nset_property PACKAGE_PIN P17 [get_ports {btn[1]}]\nset_property PACKAGE_PIN D4 [get_ports uart_tx]\nset_property PACKAGE_PIN C4 [get_ports uart_rx]\nset_property IOSTANDARD LVCMOS33 [get_ports *]', pass: true, note: 'отдельные команды, стандарт сразу для всех портов' },
    { code: 'set_property -dict {PACKAGE_PIN E3 IOSTANDARD LVCMOS33} [get_ports sys_clk]\nset_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS25} [get_ports {led[0]}]\nset_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS25} [get_ports {led[1]}]\nset_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS25} [get_ports {led[2]}]\nset_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS25} [get_ports {led[3]}]\nset_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]\nset_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]\nset_property -dict {PACKAGE_PIN D4 IOSTANDARD LVCMOS33} [get_ports uart_tx]\nset_property -dict {PACKAGE_PIN C4 IOSTANDARD LVCMOS33} [get_ports uart_rx]', pass: false, note: 'LVCMOS25 в банке 3,3 В', expect: 'IOSTANDARD = LVCMOS25' },
    { code: 'set_property -dict {PACKAGE_PIN E3 IOSTANDART LVCMOS33} [get_ports sys_clk]\nset_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[0]}]\nset_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS33} [get_ports {led[1]}]\nset_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS33} [get_ports {led[2]}]\nset_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {led[3]}]\nset_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]\nset_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]\nset_property -dict {PACKAGE_PIN D4 IOSTANDARD LVCMOS33} [get_ports uart_tx]\nset_property -dict {PACKAGE_PIN C4 IOSTANDARD LVCMOS33} [get_ports uart_rx]', pass: false, note: 'опечатка IOSTANDART', expect: 'IOSTANDART' },
    { code: 'set_property -dict {PACKAGE_PIN E3 IOSTANDARD LVCMOS33} [get_ports sys_clk]\nset_property -dict {PACKAGE_PIN K15 IOSTANDARD LVCMOS33} [get_ports {led[0]}]\nset_property -dict {PACKAGE_PIN H17 IOSTANDARD LVCMOS33} [get_ports {led[1]}]\nset_property -dict {PACKAGE_PIN J13 IOSTANDARD LVCMOS33} [get_ports {led[2]}]\nset_property -dict {PACKAGE_PIN N14 IOSTANDARD LVCMOS33} [get_ports {led[3]}]\nset_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]\nset_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]\nset_property -dict {PACKAGE_PIN D4 IOSTANDARD LVCMOS33} [get_ports uart_tx]\nset_property -dict {PACKAGE_PIN C4 IOSTANDARD LVCMOS33} [get_ports uart_rx]', pass: false, note: 'переставлены выводы led[0] и led[1]', expect: 'PACKAGE_PIN = K15' },
    { code: 'set_property -dict {PACKAGE_PIN E3 IOSTANDARD LVCMOS33} [get_ports sys_clk]\nset_property PACKAGE_PIN {H17 K15 J13 N14} [get_ports {led[*]}]\nset_property IOSTANDARD LVCMOS33 [get_ports {led[*]}]\nset_property -dict {PACKAGE_PIN M18 IOSTANDARD LVCMOS33} [get_ports {btn[0]}]\nset_property -dict {PACKAGE_PIN P17 IOSTANDARD LVCMOS33} [get_ports {btn[1]}]\nset_property -dict {PACKAGE_PIN D4 IOSTANDARD LVCMOS33} [get_ports uart_tx]\nset_property -dict {PACKAGE_PIN C4 IOSTANDARD LVCMOS33} [get_ports uart_rx]', pass: false, note: 'список выводов для всей шины', expect: 'PACKAGE_PIN' },
    { code: 'set pins {sys_clk E3 led[0] H17 led[1] K15 led[2] J13 led[3] N14 btn[0] M18 btn[1] P17 uart_tx D4 uart_rx C4}\nset_property -dict [list PACKAGE_PIN [lindex $pins 1] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 0]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 3] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 2]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 5] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 4]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 7] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 6]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 9] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 8]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 11] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 10]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 13] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 12]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 15] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 14]]\nset_property -dict [list PACKAGE_PIN [lindex $pins 17] IOSTANDARD LVCMOS33] [get_ports [lindex $pins 16]]', pass: true, note: 'таблица в переменной, -dict из list' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'phys.lvds_in', module: 'phys', order: 2, level: 2, tool: 'vivado',
  lang: 'xdc', langNote: 'Свойства ввода/вывода ПЛИС; в ASIC стандарт и согласование определяет выбранная ячейка ввода/вывода.',
  title: 'Дифференциальный вход LVDS: стандарт и согласование',
  tags: ['set_property', 'LVDS', 'DIFF_TERM', 'IBUFDS'],
  text: `
    Опорный генератор **200 МГц** с выходом LVDS подключён к паре выводов ПЛИС, предназначенных для тактовых сигналов: P-линия – к выводу **AD12** (порт \`clk200_p\`), N-линия – к выводу **AD11** (порт \`clk200_n\`). В ПЛИС пара поступает на буфер \`IBUFDS\`, затем на \`BUFG\`. Тактовый сигнал \`clk200\` уже описан.

    Пара находится в банке **HP** (high performance) ПЛИС семейства 7, напряжение питания банка VCCO = **1,8 В**. Внешнего согласующего резистора 100 Ом между линиями пары на плате **нет**.

    **Задание.** Задайте физические ограничения входа: вывод корпуса, стандарт ввода/вывода и внутреннее согласование.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'chip', name: 'Генератор LVDS 200 МГц', x: 0, y: 30, bw: 150, bh: 96, ext: true, pins: [{ n: 'OUT+', side: 'r', y: 32 }, { n: 'OUT−', side: 'r', y: 72 }] },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС', bh: 212 },
      { id: 'pp', t: 'in', name: 'clk200_p', x: 230, y: 51 },
      { id: 'pn', t: 'in', name: 'clk200_n', x: 230, y: 91 },
      { id: 'ib', t: 'ibufds', name: 'clk200_ibufds', x: 350, y: 52 },
      { id: 'bg', t: 'bufg', name: 'clk200_bufg', x: 430, y: 57, noName: true },
      { id: 'r', t: 'ff', name: 'sample_reg', w: 16, x: 540, y: 22, nameX: 58 },
      { id: 'lg', t: 'logic', name: 'proc', w: 16, label: 'обработка', x: 660, y: 90 },
      { id: 'n1', t: 'note', x: 226, y: 140, text: 'банк HP, VCCO = 1,8 В\nрезистора 100 Ом на плате нет' },
    ],
    wires: [
      { from: 'osc.OUT+', to: 'pp.pad', label: 'AD12', lx: 181, ly: 57 },
      { from: 'osc.OUT−', to: 'pn.pad', label: 'AD11', lx: 181, ly: 97 },
      { from: 'pp', to: 'ib.I', kind: 'clk' },
      { from: 'pn', to: 'ib.IB', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk', label: 'clk200', lx: 487, ly: 66 },
      { from: 'r.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'r.D', my: -2, noSlash: true },
    ],
  },
  given: `create_clock -name clk200 -period 5.000 [get_ports clk200_p]`,
  solution: `set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]`,
  // N-порт задавать необязательно, но если задан – только так
  check: { allowProps: { clk200_n: { PACKAGE_PIN: 'AD11', IOSTANDARD: 'LVDS', DIFF_TERM: 'TRUE' } } },
  hints: [
    'Для дифференциальной пары ограничения задают на P-порту: N-вывод Vivado назначит сам.',
    'Стандарт LVDS (без суффикса) – для банков HP с VCCO = 1,8 В; LVDS_25 – для банков HR с VCCO = 2,5 В.',
    'Без внешнего резистора нужно внутреннее согласование: `DIFF_TERM TRUE`. Итог: `set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]`.',
  ],
  explain: `
    \`\`\`
    set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]
    \`\`\`
    - **Только P-порт.** Выводы дифференциальной пары жёстко связаны: каждому P-выводу соответствует свой N-вывод (здесь AD12 и AD11). Назначив \`clk200_p\` на AD12, вы однозначно определяете и место \`clk200_n\` – Vivado разместит его автоматически, а стандарт ввода/вывода относится ко всему буферу IBUFDS. Задать те же значения ещё и на N-порту можно (так поступают многие файлы ограничений плат), но тогда они обязаны совпадать.
    - **LVDS или LVDS_25.** В ПЛИС семейства 7 банки HP (VCCO до 1,8 В) поддерживают стандарт LVDS, а банки HR (VCCO до 3,3 В) – LVDS_25 при VCCO = 2,5 В. Стандарт LVDS_25 в банке HP недопустим: Vivado откажется размещать такой порт.
    - **DIFF_TERM TRUE** включает внутренний дифференциальный согласующий резистор около 100 Ом между линиями пары на входе приёмника. Линия LVDS должна быть нагружена на своё волновое сопротивление: без согласования сигнал отражается, фронты «звенят», возможны лишние переключения входа – для тактового сигнала это сбои всей схемы. В банке HP внутреннее согласование LVDS работает при VCCO = 1,8 В – условие здесь выполнено.

    **Типичные ошибки.**
    - \`IOSTANDARD LVDS_25\`: стандарт банка HR в банке HP – ошибка размещения.
    - Нет \`DIFF_TERM\`: ни DRC, ни временной анализ этого не заметят, а на плате линия останется без согласования. Если согласующий резистор установлен на плате, наоборот, \`DIFF_TERM\` включать нельзя: два резистора параллельно дадут 50 Ом.
    - P-порт на выводе AD11: это N-вывод пары, P-порт на нём разместить нельзя – Vivado сообщит об ошибке размещения.

    **Проверка в Vivado:** \`report_io\` – оба порта пары на выводах AD12 и AD11, стандарт LVDS, DIFF_TERM TRUE; окно I/O Planning показывает пару и её банк.
  `,
  refs: 'UG903, «Physical Constraints»; UG471, глава о дифференциальных стандартах (LVDS, LVDS_25, DIFF_TERM) банков HP и HR',
  tests: [
    { code: 'set_property PACKAGE_PIN AD12 [get_ports clk200_p]\nset_property IOSTANDARD LVDS [get_ports clk200_p]\nset_property DIFF_TERM TRUE [get_ports clk200_p]', pass: true, note: 'отдельные команды' },
    { code: 'set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]\nset_property -dict {PACKAGE_PIN AD11 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_n]', pass: true,  note: 'те же значения и на N-порту' },
    { code: 'set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]\nset_property -dict {PACKAGE_PIN AD10 IOSTANDARD LVDS} [get_ports clk200_n]', pass: false, note: 'N-порт на чужом выводе', expect: 'PACKAGE_PIN = AD10' },    { code: 'set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS_25 DIFF_TERM TRUE} [get_ports clk200_p]', pass: false, note: 'LVDS_25 в банке HP', expect: 'IOSTANDARD = LVDS_25' },
    { code: 'set_property -dict {PACKAGE_PIN AD12 IOSTANDARD LVDS} [get_ports clk200_p]', pass: false, note: 'нет внутреннего согласования', expect: 'DIFF_TERM' },
    { code: 'set_property -dict {PACKAGE_PIN AD11 IOSTANDARD LVDS DIFF_TERM TRUE} [get_ports clk200_p]', pass: false, note: 'P-порт на N-выводе пары', expect: 'PACKAGE_PIN = AD11' },
  ],
});

// ---------------------------------------------------------------------------
const PHYS_IOB_CELLS = `set_property IOB TRUE [get_cells {adc_d_reg[*] dac_d_reg[*]}]`;
const PHYS_IOB_PORTS = `set_property IOB TRUE [get_ports {adc_d[*] dac_d[*]}]`;
XT.bank.add({
  id: 'phys.iob', module: 'phys', order: 3, level: 2, tool: 'vivado',
  lang: 'xdc', langNote: 'Свойство `IOB` – особенность ПЛИС; в ASIC регистры у площадок размещают при планировке кристалла.',
  title: 'Регистры в блоках ввода/вывода (IOB)',
  tags: ['set_property', 'IOB'],
  text: `
    Проект принимает отсчёты 12-разрядного АЦП (\`adc_d[11:0]\`) и выдаёт отсчёты 14-разрядному ЦАП (\`dac_d[13:0]\`) на частоте 100 МГц. Сразу за входными буферами стоят регистры \`adc_d_reg[11:0]\`, а перед выходными буферами – регистры \`dac_d_reg[13:0]\`; между регистром и буфером нет логики, у выходных регистров нет других нагрузок, кроме OBUF.

    Временны́е ограничения интерфейсов (задержки ввода/вывода) заданы в другом файле ограничений, но от сборки к сборке запас по времени на выводах меняется: Vivado размещает регистры в логических ячейках внутри кристалла, и к каждому выводу ведёт трасса своей длины. Разряды одной шины получают разные задержки.

    Чтобы задержки между выводом и регистром стали минимальными, одинаковыми для всех разрядов и не зависели от размещения, регистры нужно разместить **в блоках ввода/вывода** (IOB) – в логике ввода/вывода рядом с самими выводами.

    **Задание.** Потребуйте, чтобы входные регистры \`adc_d_reg[11:0]\` и выходные регистры \`dac_d_reg[13:0]\` были размещены в блоках ввода/вывода.
  `,
  design: {
    elements: [
      { id: 'fpga', t: 'boundary', label: 'ПЛИС' },
      { id: 'iob1', t: 'boundary', label: 'IOB', cls: 'alt', x: 130, y: -12, bw: 158, bh: 152 },
      { id: 'iob2', t: 'boundary', label: 'IOB', cls: 'alt', x: 448, y: -12, bw: 160, bh: 152 },
      { id: 'pa', t: 'in', name: 'adc_d', w: 12, x: 10, y: 47, tag: 'от АЦП', tagY: 16 },
      { id: 'iba', t: 'ibuf', name: 'adc_d_IBUF[%]_inst', w: 12, x: 140, y: 44, noName: true },
      { id: 'ra', t: 'ff', name: 'adc_d_reg', w: 12, x: 205, y: 40, nameX: 26 },
      { id: 'lg', t: 'logic', name: 'u_proc/dsp', w: 14, mix: true, label: 'обработка', bw: 80, x: 330, y: 35 },
      { id: 'rd', t: 'ff', name: 'dac_d_reg', w: 14, x: 464, y: 40, nameX: 40 },
      { id: 'obd', t: 'obuf', name: 'dac_d_OBUF[%]_inst', w: 14, x: 564, y: 44, noName: true },
      { id: 'pd', t: 'out', name: 'dac_d', w: 14, x: 630, y: 47, tag: 'к ЦАП', tagY: 16 },
      { id: 'psc', t: 'in', name: 'sys_clk', x: 10, y: 169 },
      { id: 'ibc', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 88, y: 166, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 138, y: 166, noName: true },
    ],
    wires: [
      { from: 'pa', to: 'iba.I' },
      { from: 'iba.O', to: 'ra.D' },
      { from: 'ra.Q', to: 'lg.I' },
      { from: 'lg.O', to: 'rd.D' },
      { from: 'rd.Q', to: 'obd.I' },
      { from: 'obd.O', to: 'pd' },
      { from: 'psc', to: 'ibc.I', kind: 'clk' },
      { from: 'ibc.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'ra.C', kind: 'clk', mx: 190, label: 'sys_clk', lx: 310, ly: 175 },
      { from: 'bg.O', to: 'rd.C', kind: 'clk', mx: 434 },
    ],
  },
  figures: [
    {
      kind: 'timing', title: 'Задержка до вывода по разрядам', t: [-0.5, 10.5], width: 540,
      signals: [
        { name: 'sys_clk', clock: { period: 10 }, arrows: 'rise', cls: 'launch' },
        { name: 'dac_d: регистр в логике', bus: [[1.9, 3.4, 'D1']], init: 'D0' },
        { name: 'dac_d: регистр в IOB', bus: [[1.3, 1.6, 'D1']], init: 'D0' },
      ],
      marks: [{ t: 0, label: 'фронт sys_clk', cls: 'launch' }],
      spans: [
        { row: 1, t0: 1.9, t1: 3.4, label: 'разброс по разрядам', cls: 'data' },
        { row: 2, t0: 1.3, t1: 1.6, label: 'малый разброс', cls: 'data' },
      ],
      caption: 'Задержки показаны условно. Регистр в логической ячейке: к каждому выводу своя трасса, моменты смены разрядов разбросаны, и разброс меняется от сборки к сборке. Регистр в блоке ввода/вывода: задержка до вывода минимальна, одинакова для всех разрядов и не зависит от размещения.',
    },
  ],
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solutions: [
    PHYS_IOB_CELLS,
    PHYS_IOB_PORTS,
    `set_property IOB TRUE [get_ports {adc_d[*]}]\nset_property IOB TRUE [get_cells {dac_d_reg[*]}]`,
    `set_property IOB TRUE [get_cells {adc_d_reg[*]}]\nset_property IOB TRUE [get_ports {dac_d[*]}]`,
  ],
  hints: [
    'Размещение регистра в блоке ввода/вывода задаётся свойством IOB со значением TRUE.',
    'Свойство можно задать на самих регистрах (get_cells) или на портах (get_ports): тогда Vivado упакует в блок ввода/вывода регистры, подключённые к порту.',
    'Например: `set_property IOB TRUE [get_cells {adc_d_reg[*] dac_d_reg[*]}]`.',
  ],
  explain: `
    \`\`\`
    set_property IOB TRUE [get_cells {adc_d_reg[*] dac_d_reg[*]}]
    \`\`\`
    Равноценно – на портах: \`set_property IOB TRUE [get_ports {adc_d[*] dac_d[*]}]\`; свойство порта относится к регистрам, подключённым к нему (входному, выходному и регистру управления третьим состоянием). Засчитываются и смешанные варианты.

    **Зачем.** В блоке ввода/вывода ПЛИС семейства 7 есть собственные триггеры (в ILOGIC и OLOGIC) прямо у вывода. Регистр, размещённый там:
    - имеет минимальную и **фиксированную** задержку «тактовый вход – вывод» (Tco) у выходов и время предустановки/удержания относительно вывода у входов;
    - даёт **одинаковые** задержки для всех разрядов шины – перекос между разрядами минимален;
    - **не зависит от размещения и трассировки**: запас на выводах повторяется от сборки к сборке.

    Для интерфейсов с синхронизацией от источника и системно-синхронных интерфейсов окно данных составляет единицы наносекунд, и разброс трасс в 1–2 нс между разрядами может съесть весь запас. Поэтому регистры интерфейса почти всегда размещают в блоках ввода/вывода, а ограничения задержек ввода/вывода пишут в расчёте на это.

    **Условия упаковки.** Регистр должен быть подключён к буферу напрямую, без логики между ними; у выходного регистра не должно быть других нагрузок, кроме OBUF (иначе его нельзя вынести к выводу); тактовый сигнал, разрешение и сброс должны быть совместимы с ресурсами блока ввода/вывода. Если условие нарушено, Vivado выдаёт при размещении предупреждение о том, что ограничение IOB выполнить нельзя, и оставляет регистр в логике – это предупреждение нельзя пропускать.

    **Типичные ошибки.**
    - Свойство только на входных регистрах: выходы по-прежнему зависят от размещения.
    - IOB на буферах (\`adc_d_IBUF[*]_inst\`, \`dac_d_OBUF[*]_inst\`): буфер и так находится в блоке ввода/вывода, а регистр остаётся в логике.
    - Регистр с дополнительной нагрузкой (например, выход \`dac_d_reg\` идёт ещё и в логику контроля): упаковка невозможна – регистр дублируют в RTL.

    Тот же результат можно задать в исходном коде атрибутом \`(* IOB = "TRUE" *)\` на регистре.

    **Проверка в Vivado:** после размещения \`report_utilization\` показывает занятые ILOGIC и OLOGIC; свойство ячейки \`BEL\` (\`get_property BEL [get_cells {adc_d_reg[0]}]\`) указывает триггер блока ввода/вывода; в журнале размещения не должно быть предупреждений о невыполненном ограничении IOB.
  `,
  refs: 'UG903, «Physical Constraints» (IOB); UG912, свойство IOB; UG471, ресурсы ILOGIC и OLOGIC семейства 7',
  tests: [
    { code: 'set_property IOB TRUE [get_cells {adc_d_reg[*]}]', pass: false, note: 'только входные регистры', expect: 'Не задано свойство IOB' },
    { code: 'set_property IOB TRUE [get_cells {adc_d_IBUF[*]_inst dac_d_OBUF[*]_inst}]', pass: false, note: 'IOB на буферах вместо регистров', expect: 'Не задано свойство IOB' },
    { code: 'set_property IOB TRUE [get_cells {adc_d_reg[*]}]\nset_property IOB TRUE [get_cells {dac_d_reg[*]}]', pass: true, note: 'две команды' },
    { code: 'set_property IOB TRUE [get_ports {adc_d[*]}]\nset_property IOB TRUE [get_cells {dac_d_reg[*]}]', pass: true, note: 'смешанный вариант: порты и ячейки' },
    { code: 'set_property IOB 1 [get_ports -filter {NAME =~ adc_d* || NAME =~ dac_d*}]', pass: true, note: 'значение 1 и выбор портов фильтром' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'phys.config', module: 'phys', order: 4, level: 1, tool: 'vivado',
  lang: 'xdc', langNote: 'Параметры конфигурации ПЛИС есть только в Vivado.',
  title: 'Конфигурация из флеш-памяти Quad SPI',
  tags: ['set_property', 'CFGBVS', 'CONFIG_VOLTAGE', 'BITSTREAM'],
  text: `
    Плата с ПЛИС семейства 7 загружается из флеш-памяти SPI с четырёхразрядной шиной данных (Quad SPI). По схеме платы:
    - банк 0 (выводы конфигурации) питается от **3,3 В**, вывод CFGBVS соединён с VCCO_0;
    - флеш-память подключена по **четырём** линиям данных;
    - частота тактового сигнала конфигурации CCLK – **33 МГц** (допустимо для флеш-памяти и трассировки платы);
    - конфигурационный файл (битовый поток) нужно **сжимать**: он займёт меньше места во флеш-памяти и загрузится быстрее.

    Эти параметры – свойства проекта, то есть объекта \`[current_design]\`.

    **Задание.** Задайте напряжение банка конфигурации (\`CFGBVS\`, \`CONFIG_VOLTAGE\`) и параметры конфигурационного файла: ширину шины SPI, частоту CCLK и сжатие.
  `,
  design: {
    elements: [
      { id: 'osc', t: 'osc', x: 0, y: 58, label: '100 МГц', ext: true },
      { id: 'fpga', t: 'boundary', label: 'ПЛИС', x: 66, y: -22, bw: 552, bh: 300 },
      { id: 'p', t: 'in', name: 'sys_clk', x: 90, y: 67 },
      { id: 'ib', t: 'ibuf', name: 'sys_clk_IBUF_inst', x: 196, y: 64, noName: true },
      { id: 'bg', t: 'bufg', name: 'sys_clk_IBUF_BUFG_inst', x: 268, y: 64, noName: true },
      { id: 'r', t: 'ff', name: 'cnt_reg', w: 8, x: 390, y: 40, nameX: 42 },
      { id: 'inc', t: 'logic', name: 'cnt_inc', w: 8, label: '+1', x: 500, y: 112 },
      {
        id: 'cfg', t: 'chip', name: 'Банк 0: конфигурация', x: 90, y: 168, bw: 190, bh: 88, ext: true,
        pins: [{ n: 'CCLK', side: 'l', y: 34 }, { n: 'D[3:0]', side: 'l', y: 52 }, { n: 'FCS_B', side: 'l', y: 70 }],
      },
      { id: 'cn', t: 'note', x: 152, y: 198, text: 'VCCO_0 = 3,3 В\nCFGBVS → VCCO_0', box: false },
      {
        id: 'flash', t: 'chip', name: 'Флеш SPI ×4', x: -140, y: 168, bw: 112, bh: 88, ext: true,
        pins: [{ n: 'SCK', side: 'r', y: 34 }, { n: 'DQ[3:0]', side: 'r', y: 52 }, { n: 'CS#', side: 'r', y: 70 }],
      },
    ],
    wires: [
      { from: 'osc.out', to: 'p.pad' },
      { from: 'p', to: 'ib.I', kind: 'clk' },
      { from: 'ib.O', to: 'bg.I', kind: 'clk' },
      { from: 'bg.O', to: 'r.C', kind: 'clk', label: 'sys_clk', lx: 326, ly: 73 },
      { from: 'r.Q', to: 'inc.I' },
      { from: 'inc.O', to: 'r.D', my: 16 },
      { from: 'cfg.CCLK', to: 'flash.SCK', label: '33 МГц' },
      { from: 'flash.DQ[3:0]', to: 'cfg.D[3:0]', bus: true, bw: 4 },
      { from: 'cfg.FCS_B', to: 'flash.CS#' },
    ],
  },
  given: `create_clock -name sys_clk -period 10.000 [get_ports sys_clk]`,
  solution: `set_property CFGBVS VCCO [current_design]
set_property CONFIG_VOLTAGE 3.3 [current_design]
set_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]
set_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]
set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]`,
  hints: [
    'Все свойства задаются на объекте [current_design]. Напряжение банка конфигурации описывают пара свойств CFGBVS и CONFIG_VOLTAGE.',
    'CFGBVS = VCCO, если банк 0 питается от 2,5 или 3,3 В (вывод CFGBVS соединён с VCCO_0), и GND – при 1,8 В и ниже. CONFIG_VOLTAGE – само напряжение, в коде с точкой: `3.3`.',
    'Параметры битового потока: BITSTREAM.CONFIG.SPI_BUSWIDTH 4, BITSTREAM.CONFIG.CONFIGRATE 33 (в мегагерцах), BITSTREAM.GENERAL.COMPRESS TRUE.',
  ],
  explain: `
    \`\`\`
    set_property CFGBVS VCCO [current_design]
    set_property CONFIG_VOLTAGE 3.3 [current_design]
    set_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]
    set_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]
    set_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]
    \`\`\`
    - **CFGBVS и CONFIG_VOLTAGE** сообщают Vivado, как на плате питается банк конфигурации: вывод CFGBVS соединён с VCCO_0 (значение \`VCCO\`, для 2,5 и 3,3 В) или с землёй (\`GND\`, для 1,8 В и ниже), а напряжение равно 3,3 В. Сами по себе свойства ничего не переключают – их использует DRC, чтобы проверить совместимость стандартов ввода/вывода портов в банках, где находятся выводы конфигурации. Если свойства не заданы, Vivado выдаёт предупреждение DRC CFGBVS-1: напряжение конфигурации неизвестно, и такую проверку выполнить нельзя.
    - **BITSTREAM.CONFIG.SPI_BUSWIDTH 4.** ПЛИС начинает чтение флеш-памяти по одной линии, а этот параметр в заголовке битового потока переключает её на четыре линии – загрузка примерно вчетверо быстрее. Флеш-память должна поддерживать режим Quad SPI, а файл для её программирования формируют для того же интерфейса (\`write_cfgmem -interface SPIx4\`).
    - **BITSTREAM.CONFIG.CONFIGRATE 33** – частота CCLK в мегагерцах, которую ПЛИС формирует в ведущем режиме. Она ограничена флеш-памятью и платой; слишком высокая частота ведёт к ошибкам чтения.
    - **BITSTREAM.GENERAL.COMPRESS TRUE** – сжатие битового потока: особенно эффективно, если проект занимает часть кристалла.

    Часто к ним добавляют \`set_property CONFIG_MODE SPIx4 [current_design]\` – режим конфигурации, по которому Vivado резервирует многофункциональные выводы конфигурации. В этой задаче оно не обязательно.

    **Типичные ошибки.**
    - Свойства на порту или ячейке (\`[get_ports sys_clk]\`): это свойства проекта, на других объектах их нет.
    - \`CFGBVS GND\` при 3,3 В: описание противоречит плате, DRC проверяет стандарты не для того напряжения.
    - Нет \`SPI_BUSWIDTH\`: ПЛИС загрузится, но по одной линии – в несколько раз медленнее.

    **Проверка в Vivado:** \`report_property [current_design]\` или окно Edit Device Properties открытого проекта после реализации; \`report_drc\` – без CFGBVS-1.
  `,
  refs: 'UG908 (параметры конфигурационного файла); UG470, конфигурация ПЛИС семейства 7 (CFGBVS, Master SPI); UG912, свойства CFGBVS, CONFIG_VOLTAGE',
  tests: [
    { code: 'set_property -dict {CFGBVS VCCO CONFIG_VOLTAGE 3.3 BITSTREAM.CONFIG.SPI_BUSWIDTH 4 BITSTREAM.CONFIG.CONFIGRATE 33 BITSTREAM.GENERAL.COMPRESS TRUE} [current_design]', pass: true, note: 'одна команда с -dict' },
    { code: 'set_property CFGBVS GND [current_design]\nset_property CONFIG_VOLTAGE 3.3 [current_design]\nset_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]\nset_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]\nset_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]', pass: false, note: 'CFGBVS GND при 3,3 В', expect: 'CFGBVS = GND' },
    { code: 'set_property CFGBVS VCCO [current_design]\nset_property CONFIG_VOLTAGE 1.8 [current_design]\nset_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]\nset_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]\nset_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]', pass: false, note: 'неверное напряжение', expect: 'CONFIG_VOLTAGE = 1.8' },
    { code: 'set_property CFGBVS VCCO [current_design]\nset_property CONFIG_VOLTAGE 3.3 [current_design]\nset_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]\nset_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]', pass: false, note: 'нет ширины шины SPI', expect: 'SPI_BUSWIDTH' },
    { code: 'set_property CFGBVS VCCO [get_ports sys_clk]\nset_property CONFIG_VOLTAGE 3.3 [get_ports sys_clk]\nset_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 [current_design]\nset_property BITSTREAM.CONFIG.CONFIGRATE 33 [current_design]\nset_property BITSTREAM.GENERAL.COMPRESS TRUE [current_design]', pass: false, note: 'свойства проекта на порту', expect: 'неприменимо' },
    { code: 'set d [current_design]\nset_property CFGBVS VCCO $d\nset_property CONFIG_VOLTAGE 3.3 $d\nset_property BITSTREAM.CONFIG.SPI_BUSWIDTH 4 $d\nset_property BITSTREAM.CONFIG.CONFIGRATE 33 $d\nset_property BITSTREAM.GENERAL.COMPRESS true $d\nset_property CONFIG_MODE SPIx4 $d', pass: true, note: 'через переменную, значение true строчными, дополнительно CONFIG_MODE' },
  ],
});

// ---------------------------------------------------------------------------
XT.bank.add({
  id: 'phys.drive_slew', module: 'phys', order: 5, level: 1, tool: 'vivado', type: 'choice',
  lang: 'xdc', langNote: 'Свойства `DRIVE` и `SLEW` – особенность ПЛИС; в ASIC силу и крутизну выхода определяет выбор ячейки ввода/вывода из библиотеки.',
  title: 'DRIVE и SLEW для выходов LVCMOS33',
  tags: ['DRIVE', 'SLEW', 'понимание'],
  text: `
    Проект на ПЛИС семейства 7 выдаёт через выходы LVCMOS33 (банк HR, VCCO = 3,3 В):
    - \`led[7:0]\` – светодиоды через токоограничивающие резисторы, переключаются раз в десятки миллисекунд;
    - \`cfg_sck\`, \`cfg_mosi\`, \`cfg_cs_n\` – медленный последовательный интерфейс настройки внешней микросхемы (1 МГц);
    - \`dac_clk\`, \`dac_d[13:0]\` – тактовый сигнал и данные быстрого ЦАП (100 МГц), трассы короткие, временной бюджет жёсткий.

    Если ничего не задавать, Vivado назначает выходам LVCMOS33 выходной ток DRIVE 12 мА и крутизну фронтов SLEW SLOW.

    Какой набор свойств лучше всего соответствует этим требованиям?
  `,
  figures: [
    {
      kind: 'timing', title: 'Крутизна фронта (условно)', t: [0, 12], width: 520, unit: 'нс',
      signals: [
        { name: 'SLEW FAST', bit: [[2, 2.6, 1], [8, 8.6, 0]], init: 0 },
        { name: 'SLEW SLOW', bit: [[2, 4, 1], [8, 10, 0]], init: 0, unc: false },
      ],
      spans: [{ row: 0, t0: 2, t1: 2.6, label: 'короткий фронт', cls: 'data' }, { row: 1, t0: 2, t1: 4, label: 'длинный фронт', cls: 'data' }],
      caption: 'Длительности показаны условно. Крутой фронт (SLEW FAST) уменьшает задержку выходного буфера и нужен быстрым сигналам, но сильнее порождает отражения, «звон» и помехи от одновременного переключения многих выходов. Пологий фронт (SLEW SLOW) спокойнее для платы.',
    },
  ],
  options: [
    { text: 'Всем выходам SLEW FAST и наибольший ток (DRIVE 16): чем сильнее и быстрее выход, тем надёжнее.', why: 'Неверно. Крутые фронты и большой ток увеличивают отражения, «звон», перекрёстные помехи и шум от одновременного переключения – на плате это сбои соседних сигналов. Светодиодам и интерфейсу на 1 МГц скорость не нужна.' },
    { text: 'Светодиоды и медленный интерфейс: SLEW SLOW и умеренный ток (DRIVE 4–8); выходы ЦАП: SLEW FAST, ток по результатам моделирования линии (например, DRIVE 8–12).', ok: true, why: 'Верно. Там, где скорость не нужна, пологие фронты и меньший ток снижают «звон», перекрёстные помехи и помехи от одновременного переключения выходов (SSO). Быстрым выходам нужен крутой фронт: SLEW FAST сокращает время нарастания и задержку выходного буфера, сохраняя временной запас на 100 МГц.' },
    { text: 'Всем выходам SLEW SLOW: помех меньше, а на 100 МГц крутизна фронта не влияет.', why: 'Неверно. SLEW SLOW удлиняет фронт и увеличивает задержку выходного буфера; при жёстком бюджете на 100 МГц это съедает запас, а пологий фронт тактового сигнала dac_clk ухудшает его форму на входе ЦАП.' },
    { text: 'DRIVE и SLEW влияют только на потребляемую мощность и в задержках не учитываются, поэтому их можно не задавать.', why: 'Неверно. Vivado учитывает DRIVE и SLEW в задержке выходного буфера: от них зависят результаты report_timing для выходных путей, а также оценка помех одновременного переключения (report_ssn).' },
  ],
  explain: `
    \`\`\`
    set_property -dict {DRIVE 4 SLEW SLOW} [get_ports {led[*]}]
    set_property -dict {DRIVE 8 SLEW SLOW} [get_ports {cfg_sck cfg_mosi cfg_cs_n}]
    set_property SLEW FAST [get_ports {dac_clk dac_d[*]}]
    \`\`\`
    - **SLEW** задаёт крутизну фронтов выходного буфера LVCMOS: \`SLOW\` (по умолчанию) или \`FAST\`. Крутой фронт уменьшает задержку буфера и нужен быстрым интерфейсам; пологий снижает отражения и помехи.
    - **DRIVE** – выходной ток в миллиамперах (для LVCMOS33 в банках HR семейства 7: 4, 8, 12, 16; по умолчанию 12). Больший ток быстрее перезаряжает нагрузку, но увеличивает «звон» и помехи от одновременного переключения.
    - Правильные значения для быстрых линий подбирают по моделированию целостности сигналов (модели IBIS) с учётом трассы и нагрузки; для медленных сигналов разумно выбирать наименьший достаточный ток и \`SLEW SLOW\`.
    - Изменение DRIVE и SLEW меняет задержку выходного буфера, поэтому временной анализ выходов выполняют уже с окончательными значениями этих свойств.

    **Проверка в Vivado:** \`report_io\` (столбцы Drive и Slew), \`report_ssn\` – оценка помех одновременного переключения по банкам.
  `,
});
