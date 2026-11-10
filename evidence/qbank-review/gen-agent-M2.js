// Generator for agent-M2.json — M2 module knowledge review verdicts.
// Reads src/data.js via the same facade as the dump command; does NOT modify src/data.js.
global.window = {};
require('../../src/data.js');
require('../../src/engine.js');
const B = window.BANK, X = window.XK;
const fs = require('fs');

// ---- overrides: i -> verdict entry ----
// issue_type: wrong_key | multi_answer | no_valid_option | internal_contradiction
//             | stale_combo_reference | option_fragment
//             | explanation_contradicts_answer | explanation_contradicts_bank
const OV = {
  // ========== FIX: wrong key (answer direction / truth value) ==========
  2582: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: '√',
    issue: "判断题干“设置表格的行高的操作是使用‘表格工具’选项卡中的‘行高’按钮”为真命题，key=×方向错误。该操作是库内认可的有效方式：母题 i=684 把“使用‘表格工具’选项卡中的‘行高’按钮”列入正确组合(A和C)，其解析写明“也可以使用‘表格工具’选项卡精确设置数值……两种方法都正确”。现解析(插入表格)与本题无关，且尾注“本题说法错误”与事实相反，改 a 后需同步把 e 改写为：“在WPS文字中，选中行后可在‘表格工具’选项卡中设置行高，说法正确。”",
    evidence: "i=684（同一事实单选）key=D(A和C，含C=表格工具行高按钮)，解析明确两种方法都正确；同构判断 i=2526（合并单元格用表格工具）key=√。" },
  2589: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: 'B',
    issue: "“下列说法正确的是”key=D，但按整句真值唯一为真的是 B。D“对‘段落设置’对话框描述错误的是可以设置行间距”为假命题（段落对话框可以设置行间距，见 i=667 A 项为真）；B“描述错误的是可以设置字体颜色”为真命题（字体颜色在字体对话框设置，i=667 即以“可以设置字体颜色”为该题错误项答案）。属典型“按关键词落 key”（落到了母题答案位置 D）而非按整句真值。e 现断言“D……说法正确……因此选D”与事实相反，需同步改写为：“段落对话框可设置行间距、首行缩进等，不能设置字体颜色（在‘字体’对话框设置）。故‘描述错误的是可以设置字体颜色’（B）说法正确，选B；D 说法错误；A、C 说法错误。”",
    evidence: "i=667：“段落设置对话框可以设置行间距(A)”为真、“可以设置字体颜色(D)”为其错误项答案。" },
  2590: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: 'C',
    issue: "“下列说法错误的是”key=A，但 A 为真命题（段落对话框确实不能设字体颜色，“描述错误的是可以设置字体颜色”说法正确）；唯一假命题是 C“描述错误的是可以设置行间距”（行间距可以在段落对话框设置，见 i=667）。key 落错方向。e 现断言“A……说法错误……因此选A”与事实相反，需同步改写为：“段落对话框不能设置字体颜色（在字体对话框设置），A 说法正确；行间距可以在段落对话框设置，C‘描述错误的是可以设置行间距’说法错误，故选C；B、D 说法正确。”",
    evidence: "i=667：段落对话框可设行间距（A 真），“字体颜色”为其错误描述（D 为该题答案）。" },
  2591: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: 'C',
    issue: "“下列说法正确的是”key=D，但 D“不是剪贴板操作命令的是Ctrl+X”为假命题（Ctrl+X=剪切，正是剪贴板操作）；唯一真命题是 C“不是剪贴板操作命令的是Ctrl+A”（Ctrl+A 是全选，i=668 即以此命题并 key B）。e 现断言“C错误……故选D”，与事实相反，需同步改写为：“Ctrl+A 是全选命令，不属于剪贴板操作，C 说法正确，故选C；Ctrl+X 是剪切命令，属于剪贴板操作，D 说法错误；A、B 说法错误。”",
    evidence: "i=668：剪贴板操作=剪切(Ctrl+X)/复制(Ctrl+C)/粘贴(Ctrl+V)，Ctrl+A 是全选，不属于剪贴板操作（该题 key B=Ctrl+A）。" },
  2592: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: 'D',
    issue: "“下列说法错误的是”key=C，但 C“不是剪贴板操作命令的是Ctrl+A”为真命题；唯一假命题是 D“不是剪贴板操作命令的是Ctrl+X”（Ctrl+X=剪切）。与 i=2591 为同一对命题的正反变式，两题 key 都按母题答案字母落位而非按真值。e 现断言“C……说法错误……因此选C”，需同步改写为：“Ctrl+X 是剪切命令，属于剪贴板操作，D‘不是剪贴板操作命令的是Ctrl+X’说法错误，故选D；Ctrl+A 是全选，C 说法正确；A、B 说法正确。”",
    evidence: "i=668：Ctrl+X/C/V 为剪贴板操作，Ctrl+A 为全选。" },
  3748: { verdict: 'fix', issue_type: 'wrong_key', field: 'a', fix: 'B',
    issue: "“下列说法错误的是”key=D，但 D“合并单元格可以通过表格工具选项卡完成”为真命题（i=635/i=2526 同口径）；唯一假命题是 B“删除表格中的某一行或某一列的操作是双击表格中的任意单元格”（双击单元格不能删除行列）。e 为无关解析（应用样式），需同步改写为：“删除表格行/列应通过右键菜单‘删除行/列’或‘表格工具’中的‘删除’完成，双击任意单元格不能删除行列，B 说法错误，故选B；A、C、D 均为正确说法。”",
    evidence: "i=687 解析：删除行列“应通过右键菜单选择‘删除行/列’，或使用‘表格工具’中的‘删除’按钮”；i=2648 判断（右键删除行列）key=√；i=635/i=2526：表格工具合并单元格为有效操作。" },

  // ========== FIX: duplicate false statement (multi_answer) — rewrite one distractor to a verified true statement ==========
  2562: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[2]文本(C选项)',
    fix: '查找和替换文档中的文字的操作是在“编辑”菜单中选择“查找与替换”。',
    issue: "“下列说法错误的是”出现双错误项：A“查找替换用格式→段落”与 C“查找替换用页面布局→背景”均为假命题，单选不唯一。改 C 为真命题（查找替换在“编辑”菜单，见 i=653/i=2561）后 A 成为唯一错误项，key=A 不变；现有解析“其余选项说法正确”改后即自洽，无需再改。",
    evidence: "i=653/i=2561：查找和替换在“编辑”菜单中选择“查找与替换”；“页面布局→背景”为页面背景功能（i=659）。" },
  2564: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[3]文本(D选项)',
    fix: '为文档添加分栏效果的操作是在“页面布局”菜单中选择“分栏”。',
    issue: "“下列说法错误的是”双错误项：B“分栏用格式→段落”与 D“分栏用文件→页面设置”均为假命题（分栏在“页面布局”，见 i=654/i=2563）。改 D 为真命题后 B 成为唯一错误项，key=B 不变。现解析描述的是另一道变式的选项（提到新建文档、上标下标），与本题无关，需同步改写为：“分栏效果在‘页面布局’菜单中选择‘分栏’设置，B‘在格式菜单中选择段落’说法错误，故选B；A、C、D 均为正确说法。”",
    evidence: "i=654/i=2563：分栏在“页面布局”菜单中选择“分栏”；i=639-640：文件→页面设置仅含页边距/纸张等，不含分栏。" },
  2584: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[2]文本(C选项)',
    fix: '在WPS文字中，设置文档的页面背景颜色的操作是在“页面布局”菜单中选择“背景颜色”。',
    issue: "“下列说法错误的是”双错误项：A“快速打开最近文档=文件→打开浏览文件夹”与 C“快速打开最近文档=桌面双击图标”均为假命题（母题 i=664 中两者同为干扰项，唯一正确方式是最近文档列表）。改 C 为已验证真命题后 A 成为唯一错误项，key=A 不变；现有解析“其余选项说法正确”改后自洽，无需再改。",
    evidence: "i=664：快速打开最近文档 key=C“最近文档列表”，A(打开浏览)/B(Ctrl+O)/D(双击图标)均为干扰项；i=659/i=2573：背景颜色在“页面布局”菜单设置。" },
  2610: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[2]文本(C选项)',
    fix: '在WPS文字中，设置文档的页面背景颜色的操作是在“页面布局”菜单中选择“背景颜色”。',
    issue: "“下列说法错误的是”双错误项：C“行距固定值用页面设置对话框”与 D“行距固定值用字体对话框”均为假命题（固定值行距在“段落”对话框，i=677）。改 C 为真命题后 D 成为唯一错误项，key=D 不变。现解析含“因此选B”（母题残留）与 key 矛盾，需同步改写为：“固定值行距在‘段落’对话框中设置，‘字体对话框’不能设置行距，D 说法错误，故选D；A、B、C 说法正确。”",
    evidence: "i=677/i=2609：行距固定值在“段落”对话框设置；i=659：背景颜色在“页面布局”菜单设置。" },
  2634: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[0]文本(A选项)',
    fix: '在WPS文字中，为图片添加边框的操作是使用“图片工具”中的“边框”功能。',
    issue: "“下列说法错误的是”双错误项：A“图片边框=只能调整字体和字号”与 B“图片边框=直接在图片上绘制边框”均为假命题。改 A 为真命题（i=689 同文）后 B 成为唯一错误项，key=B 不变；现有解析括注“本题要求选出错误说法：‘……直接在图片上绘制边框’”改后仍准确，无需再改。",
    evidence: "i=689：为图片添加边框 key=B“使用‘图片工具’中的‘边框’功能”。" },
  2638: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[1]文本(B选项)',
    fix: '在WPS文字中，设置图片与文字之间的间距的操作是使用“图片工具”中的“文字环绕”功能调整。',
    issue: "“下列说法错误的是”双错误项：B“图文间距用段落对话框间距功能”与 C“图文间距只能通过调整图片大小间接设置”均为假命题（母题 i=691 中两者同为干扰项）。改 B 为真命题后 C 成为唯一错误项，key=C 不变；现有解析括注指认 C，改后仍准确。",
    evidence: "i=691：图文间距 key=C“使用‘图片工具’中的‘文字环绕’功能调整”，段落对话框间距/间接调整为干扰项。" },
  2644: { verdict: 'fix', issue_type: 'multi_answer', field: 'o[1]文本(B选项)',
    fix: '在WPS文字中，调整文本框的大小和位置的操作是可以通过鼠标拖动和调整对话框两种方式调整。',
    issue: "“下列说法错误的是”双错误项：A“文本框只能鼠标拖动”与 B“文本框无法调整”均为假命题（i=694：两种方式均可）。改 B 为真命题后 A 成为唯一错误项，key=A 不变；现有解析括注指认 A，改后仍准确。",
    evidence: "i=694：调整文本框大小和位置“既可以通过鼠标拖动……也可以……‘设置对象格式’对话框中精确设置”，key=B。" },

  // ========== FIX: explanation contradicts key or bank fact ==========
  2517: { verdict: 'fix', issue_type: 'explanation_contradicts_bank', field: 'e',
    fix: '在WPS文字中插入图片后默认的文字环绕方式是“嵌入型”，“四周型环绕”说法错误，故选B；A、C、D说法正确。',
    issue: "解析断言“插入的图片为浮动状态，可自由移动并调整大小，说法正确”——与库内同事实判断题 i=631（key=×：默认嵌入型、非浮动）直接矛盾，会向学生传递错误事实；且未指认本题错误项 B。按库内口径改写。" ,
    evidence: "i=631：“插入的图片是浮动状态，可以自由移动和调整大小”key=×，解析：默认嵌入型、随文本排版；i=630：默认环绕=嵌入型。" },
  2518: { verdict: 'fix', issue_type: 'explanation_contradicts_bank', field: 'e',
    fix: '在WPS文字中插入图片后默认的文字环绕方式是“嵌入型”，“紧密型环绕”说法错误，故选D；A、B、C说法正确。',
    issue: "解析同 i=2517，断言“插入的图片为浮动状态……说法正确”，与 i=631(key=×)矛盾且未指认本题错误项 D。按库内口径改写。",
    evidence: "i=631/i=630：插入图片默认“嵌入型”，非浮动。" },
  2577: { verdict: 'fix', issue_type: 'explanation_contradicts_answer', field: 'e',
    fix: '创建新文档应点击“文件”（或WPS文字）菜单中的“新建”命令，或按Ctrl+N，A说法正确，故选A；B、C、D说法错误。',
    issue: "题干“下列说法正确的是”key=A（新建文档 Ctrl+N，真命题），但解析开头写“A说法错误，故选A”，随后对 B/C/D 的评述也是另一道变式（1.5倍行距/显示比例/删除图片/粘贴）的内容，与本题四个选项完全对不上，方向性误导，需整段改写。",
    evidence: "i=661：创建新文档 key=C“文件菜单新建或按Ctrl+N”；本题 A 项与其同文。" },
  2606: { verdict: 'fix', issue_type: 'explanation_contradicts_answer', field: 'e',
    fix: '字符间距属于字体格式，在“字体”对话框中设置，C说法正确；“段落”对话框不能调整字符间距，B说法错误，故选B；A、D说法正确。',
    issue: "题干“下列说法错误的是”key=B，但解析写“因此选A”（母题 i=675 答案残留）；且解析正文只讲字体对话框设置字符间距，未指认 B。括注虽正确指认 B 的文字，但“因此选A”与之冲突，需改写。",
    evidence: "i=675：字符间距在“字体”对话框设置（该题 key=A）；本题将同一事实改为选错误项，唯一假命题为 B（字符间距用段落对话框）。" },
  2640: { verdict: 'fix', issue_type: 'explanation_contradicts_answer', field: 'e',
    fix: '在WPS文字中，用于预览打印效果、避免浪费纸张的功能是打印预览，“页面设置”不能预览打印效果，C说法错误，故选C；A、B、D说法正确。',
    issue: "题干“下列说法错误的是”key=C（预览功能是页面设置——假），但解析写“因此选B”（母题 i=692 答案残留），解析内容（图片衬于文字下方）也与本题无关，需整段改写。",
    evidence: "i=650：预览打印效果的功能是打印预览（key=A）；“页面设置”用于页边距/纸张（i=639-640），无预览功能。" },

  // ========== DELETE ==========
  2621: { verdict: 'delete', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“下列说法正确的是”结构报废：key=B 的文本“A和C”在本题字母体系下指向 A(按Ctrl+Shift+S拆分，假)+C(右键拆分，真)，组合为假命题；而 C(选中单元格后右键“拆分单元格”)与 D(使用“表格工具”中的“拆分单元格”按钮)按母题 i=683 解析均为完整有效方式，即真命题，出现双真值且 key 为假。组合项字母未随选项重排重映射，无法仅改 a 修复，建议重生成。",
    evidence: "i=683 解析：“拆分单元格可以通过右键菜单选择‘拆分单元格’，或在选中单元格后点击‘表格工具’中的‘拆分单元格’按钮”（两种方式都有效）；Ctrl+Shift+S 非拆分快捷键（i=683 将其列为干扰项）。" },
  2622: { verdict: 'delete', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“下列说法错误的是”key=D，但 D(右键拆分)是母题 i=683 认可的有效方式，为真命题，key 方向错误；唯一可评估的假命题是 B(按Ctrl+Shift+S拆分)，而 C“调整表格列宽的操作是以上都是”在本题字母体系下自指失义（“以上”=A、B，B 为假，则 C 亦不可判真），错误项不唯一，仅改 a 无法修复，建议重生成。",
    evidence: "i=683 解析确认右键拆分为有效方式（D 为真）；Ctrl+Shift+S 为干扰项（i=683）；C 项“以上都是”继承自 i=682 但引用对象已错位。" },
  2623: { verdict: 'delete', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“下列说法正确的是”结构报废：key=B 的“A和C”在本题指向 A(右键单击行选择“行高”，库内 i=684 判为无效方式)+C(表格工具行高，真)，组合为假；而 C(表格工具行高)与 D(拖动行边界)按 i=684 解析“两种方法都正确”均为真命题——双真值且 key 为假。组合项字母未随重排重映射，建议重生成。",
    evidence: "i=684：key=D(A和C=拖动行边界+表格工具行高)，解析“两种方法都正确”；右键“行高”不在有效方式之列（i=684 将其列为干扰项，i=2572 判断同口径判×）。" },
  2627: { verdict: 'delete', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“下列说法正确的是”结构报废：key=C 的“A和B”在本题指向 A(表格工具插入，真)+B(按Ctrl+I，假)，组合为假；而 A(表格工具插入)与 D(右键插入)按 i=686 解析“两种方法都正确”均为真命题——双真值且 key 为假。建议重生成。",
    evidence: "i=686：key=D(A和B=右键插入+表格工具插入)，解析“两种方法都正确”；Ctrl+I 为倾斜快捷键（i=671），非插入行列。" },
  2628: { verdict: 'delete', issue_type: 'no_valid_option', field: null, fix: null,
    issue: "“下列说法错误的是”无有效答案：A(右键插入行列，i=686 认可，真)、C(图片边框用图片工具，i=689，真)均为真命题，B(“A和B”=表格工具插入+Ctrl+I)与 D(“以上都是”)为自指失义的组合项，找不到唯一的完整假命题；且 key=A 本身为真命题，解析还自相矛盾（“A正确……故选A”却称 B/C/D 错误）。结构报废，建议重生成。",
    evidence: "i=686/i=689：A、C 所述均为库内认可的有效操作；解析原文“A正确……B错误……C错误……D错误。故选A”逻辑不成立。" },
  2629: { verdict: 'delete', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“下列说法正确的是”结构报废：key=D 的“B和C”在本题指向 B(右键删除行列，真)+C(按Delete，假)，组合为假；而 A(表格工具删除)与 B(右键删除行列)按 i=687 解析均为有效方式，即真命题——双真值且 key 为假。建议重生成。",
    evidence: "i=687：key=D(B和C=右键删除行列+表格工具删除)，解析“应通过右键菜单选择‘删除行/列’，或使用‘表格工具’中的‘删除’按钮”；按 Delete 仅删内容（i=634）。" },
  2691: { verdict: 'delete', issue_type: 'no_valid_option', field: null, fix: null,
    issue: "“下列说法错误的是”无有效答案：C(插入行列用“表格工具”中的“插入”按钮)是 i=686 认可的完整有效方式，为真命题，key=C 方向错误；D(图片边框用图片工具，i=689)亦为真；A、B(“A和C”/“A和B”)在本题字母体系下自指失义。找不到完整假命题，结构报废，建议重生成。",
    evidence: "i=686 解析“既可以右键单击表格选择‘插入’，也可以使用‘表格工具’选项卡中的‘插入’按钮，两种方法都正确”→C 为真；i=689→D 为真。" },
  3752: { verdict: 'delete', issue_type: 'no_valid_option', field: null, fix: null,
    issue: "“下列说法错误的是”四个选项全为真命题，无错误项，结构报废：A(撤销=Ctrl+Z，i=622 同文)、B(目录用引用选项卡，i=645 同文)、C(调整图片大小是基本编辑操作)、D(图片大小位置可拖动+对话框两种方式，i=688 同文)。现解析“目录在‘引用→目录’中自动生成”反而印证 B 为真。建议重生成。",
    evidence: "i=622/i=645/i=688 同文命题均 key 为正确说法；i=696（表格列宽自适应）佐证图片/表格编辑操作真实性。" },

  // ========== UNCERTAIN ==========
  673: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "题干“计算机考试→计算机考点”与选项所述“的”字对不上（句中无“的”字），命题意图无法重构；且解析“将插入点放在‘的’右边按Backspace，会删除‘的’字左边的字符”与 i=669 的语义（Backspace 删除光标左侧字符，光标在某字右边按 Backspace 即删除该字）矛盾——按 i=669 口径 A 的两种操作均为正确删除手法，key=A(不可以用)存疑。保留原答案，标记存疑。",
    evidence: "i=669：“‘Backspace’键删除光标左侧的字符……将光标移到该字右边按Backspace即可删除该字”(key=B=右边)。" },
  682: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "“调整表格列宽的操作是”key=D(以上都是)，默认 B“双击列标题”为有效方式；但变式判断 i=2667 对“调整表格列宽的操作是双击列标题”key=×，两题口径冲突。实际软件中双击列边界可自动调整列宽，但“双击列标题”的表述能否成立无法 100% 确定，保留原答案标记存疑。",
    evidence: "i=682 key=D(以上都是) vs i=2667 判断同文命题 key=×。" },
  695: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "判断“图片可以随意调整大小和位置”key=√，与 i=631（插入图片默认嵌入型、不能用鼠标随意拖动到任意位置，key=×）冲突：位置能否“随意”调整两题口径相反。保留原答案标记存疑。",
    evidence: "i=631：默认嵌入型，仅改为浮动方式后才能自由移动(key=×)；i=630：默认环绕=嵌入型。" },
  693: { verdict: 'uncertain', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“删除图片的操作是”key=B(右键删除)，但其解析自认“或者选中图片后按Delete键”可删除，则 A“使用‘删除’键”按字面亦为有效操作，单选出现双可答。A 是否按“未选中对象直接按删除键无效”口径判假无法 100% 确定，保留原答案标记存疑。",
    evidence: "i=693 解析原文：“删除图片最直接的方法是右键点击图片，选择‘删除’，或者选中图片后按Delete键。”" },
  2525: { verdict: 'uncertain', issue_type: 'multi_answer', field: null, fix: null,
    issue: "key=D(“A和C”=选中单元格+表格工具合并)成立；但 A“合并单元格的操作是使用‘表格工具’选项卡中的‘合并单元格’”的真值在库内两套口径间冲突：母题 i=635 把单独使用表格工具命令视为不完整(key 组合 D)，而判断题 i=2526 对同一陈述 key=√。若按 i=2526 口径则本题 A、D 双真，单选不唯一。保留 key=D，标记存疑。",
    evidence: "i=635（单独 C 为干扰项，key=D=A和C） vs i=2526（同一陈述判断 key=√）。" },
  2516: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（A“默认环绕=紧密型”为唯一假命题），但 B“在表格中插入行或列的操作是A和B”继承自 i=686 的组合项，本题中“B”自指本选项、“A”指向“紧密型环绕”句，无法解读，建议重新生成该干扰项。",
    evidence: "i=686 的 A/B=右键插入/表格工具插入，变式重排后未重映射字母。" },
  2560: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（C“页眉页脚用编辑菜单查找替换”为唯一假命题），但 A“合并单元格的操作是A和C”继承自 i=635 的组合项，本题中“A”自指本选项、“C”指向页眉页脚句，无法解读，建议重新生成该干扰项。",
    evidence: "i=635 的 A/C=选中单元格/表格工具合并，变式重排后未重映射字母。" },
  2619: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（A“图片边框=直接绘制”为唯一假命题），但 B/C/D 三项均为继承的组合项（“行高是A和C”“插入行列是A和B”“拆分是A和C”），本题中引用字母自指或指向无关句，无法解读，建议重新生成。",
    evidence: "组合项文本分别继承自 i=684/686/683，选项重排后未重映射字母。" },
  2624: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "key=C(“调整列宽=双击列标题”判为错误说法)依赖“双击列标题非调整列宽方法”的口径，与母题 i=682“以上都是”默认其为有效方式冲突（i=2667 判断则支持 × 口径）；且解析含“因此选D”（i=684 残留）与 key=C 矛盾。双口径无法 100% 裁定，保留 key 标记存疑，e 建议改写为：“调整列宽可通过拖动列间边界或右键‘列宽’设置，‘双击列标题’不是调整列宽的操作，C 说法错误。”",
    evidence: "i=682 key=D(以上都是，含“双击列标题”) vs i=2667 判断同文 key=×；解析“因此选D”≠key C。" },
  2641: { verdict: 'uncertain', issue_type: 'multi_answer', field: null, fix: null,
    issue: "key=A(右键删除图片，真)方向正确，但 D“使用‘删除’键”按母题 i=693 解析（“或者选中图片后按Delete键”）亦为真命题，“正确的是”存在双真值风险；按 i=693 的 key 口径 D 则为假。两口径冲突，保留 key 标记存疑。",
    evidence: "i=693 解析：“或者选中图片后按Delete键”；i=693 key=B（“删除键”为干扰项）。" },
  2642: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "“下列说法错误的是”key=A(“删除图片的操作是使用‘删除’键”)，该判法依赖 i=693 把“删除键”当干扰项的口径；但 i=693 解析明确“选中图片后按Delete键”可删除图片，则 A 按字面为真命题，本题四个选项（B 项目符号在开始选项卡、C 右键删除、D 未选中对新文本生效——均为真）可能不存在错误项。保留 key 标记存疑。",
    evidence: "i=693 解析原文与 key 口径冲突（见 i=693 条目）；B/C/D 均可交叉印证为真（i=674、i=693、i=670）。" },
  2647: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（A“拆分单元格=按Ctrl+Shift+S”为唯一可评估假命题），但 B(“拆分是A和C”)与 D(“插入行列是A和B”)为继承的组合项，本题中引用字母自指或指向无关句，无法解读，建议重新生成。",
    evidence: "组合项文本继承自 i=683/686，选项重排后未重映射字母。" },
  2667: { verdict: 'uncertain', issue_type: 'internal_contradiction', field: null, fix: null,
    issue: "判断“调整表格列宽的操作是双击列标题”key=×，与母题 i=682“以上都是”默认“双击列标题”为有效方式的口径冲突（i=682 key=D）。实际软件中双击列边界可自动调宽，但“双击列标题”表述能否算操作无法 100% 确定，保留原答案标记存疑。",
    evidence: "i=682 key=D(以上都是) vs 本题 key=×；i=2668 判断（拖动列间边界/表格属性等多种方式）key=√。" },
  2669: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（D“图片边框=直接绘制”为唯一可评估假命题），但 A/B/C 三项均为继承的组合项（“列宽是以上都是”“拆分是A和C”“插入行列是A和B”），本题中引用字母自指或指向无关句，无法解读，建议重新生成。",
    evidence: "组合项文本继承自 i=682/683/686，选项重排后未重映射字母。" },
  2674: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（A“页码用编辑菜单查找替换”为唯一假命题），但 C“调整表格列宽的操作是以上都是”为继承的组合项，本题中“以上”指向页码/页眉页脚句，无法解读，建议重新生成该干扰项。",
    evidence: "组合项文本继承自 i=682，选项重排后未重映射字母。" },
  2693: { verdict: 'uncertain', issue_type: 'multi_answer', field: null, fix: null,
    issue: "“属于表格可以执行操作”key=C(合并单元格)；但 B“调整表格列宽的操作是拖动列间边界”是i=682/2668认可的完整真命题，且“调整列宽”属于表格操作集合（i=719），按整句真值 B 亦可判“属于”，出现双可答；解析断言“B……说法错误”与 B 为真命题矛盾。保留 key=C 标记存疑（若按“只有裸词条才算成员”的出题口径则 C 唯一）。",
    evidence: "i=682/i=2668：拖动列间边界为调整列宽的有效方式；i=719：表格可执行操作含调整行高列宽；本题解析却称“其余选项说法错误”。" },
  2698: { verdict: 'uncertain', issue_type: 'stale_combo_reference', field: null, fix: null,
    issue: "key 方向正确（C“页码用文件→页面设置”为唯一假命题），但 A“删除行列的操作是B和C”为继承的组合项，本题中指向页码两句，无法解读，建议重新生成该干扰项。",
    evidence: "组合项文本继承自 i=687，选项重排后未重映射字母。" },
  3729: { verdict: 'uncertain', issue_type: 'option_fragment', field: null, fix: null,
    issue: "“下列说法正确的是”key=C“使用快捷键‘Ctrl’+‘S’。”为无主语残句（继承自 i=623 变体），不能构成完整陈述；而 B“为图片添加边框的操作是选中图片后在‘图片工具’中设置，而不是调整字体字号”是真命题（i=689），若把残句按“保存用Ctrl+S”解读则亦为真，单选不唯一。保留 key 标记存疑，建议重生成。",
    evidence: "i=689：图片边框在“图片工具”中设置（key=B）；C 项残句无主语。" },
  3745: { verdict: 'uncertain', issue_type: 'option_fragment', field: null, fix: null,
    issue: "“下列说法正确的是”key=D 为残句“‘表格工具’选项卡中的‘设计’功能。”（继承自 i=718 的选项片段），无谓语不能构成“说法”，仅因 A/B/C 三项均为假命题而按排除法成立。建议重生成 D 为完整陈述（如“调整表格边框可以使用‘表格工具’选项卡中的‘设计’功能”）。",
    evidence: "i=718：调整表格边框方式含“表格工具”选项卡中的“设计”功能（多选 ABCD）；A/B/C 分别与 i=669/621/648 矛盾为假。" },
};

// ---- build output ----
const out = [];
B.forEach((q, i) => {
  if (q.m !== 'M2') return;
  const o = OV[i];
  if (o) {
    out.push({ i, qid: X.qidOf(q), verdict: o.verdict, issue_type: o.issue_type,
      issue: o.issue, evidence: o.evidence, field: o.field, fix: o.fix });
  } else {
    out.push({ i, qid: X.qidOf(q), verdict: 'ok', issue_type: null, issue: null,
      evidence: null, field: null, fix: null });
  }
});
out.sort((a, b) => a.i - b.i);
const dst = 'C:/Users/Administrator/Desktop/信息技术基础/学考冲刺通/evidence/qbank-review/agent-M2.json';
fs.writeFileSync(dst, JSON.stringify(out, null, 1), 'utf8');
const stat = {};
out.forEach(r => { stat[r.verdict] = (stat[r.verdict] || 0) + 1; });
console.log('written', dst, 'entries=', out.length, JSON.stringify(stat));
console.log('override ids:', Object.keys(OV).map(Number).sort((a,b)=>a-b).join(','));
