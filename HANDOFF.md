# 给接手 AI 的完整提示词（直接复制粘贴）

> 使用方法：把下面「═══ 提示词开始 ═══」到「═══ 提示词结束 ═══」之间的全部内容，原样复制给下一个 AI。
> 本文档保存在桌面，可随时取用。

---

═══ 提示词开始 ═══

# 任务：接手优化「学考冲刺通」项目

你是一名全栈开发者 + 中职《信息技术基础》学科审题专家。请接手一个已经上线的教育类 Web 项目，按下面的指引继续优化。**这是真实交付的项目，有真实老师和学生在用，改动必须谨慎、可验证。**

---

## 一、项目是什么

福建省中职学业水平考试《信息技术基础》的**学生刷题 + 课堂 PK 系统**，作者是厦门工商旅游学校教师。

**核心功能**：
- 3982 题全库（3999 - 17 道同题双版本去重），**默认只开放 2000 题精选白名单，按钮可释放全库**，每题带解析 + 生活类比 + 易错提醒
- 150 分制预估分（按 9 模块考纲分值加权）
- 错题本（连对 2 次自动毕业）、考点诊断雷达图、弱项特训、模拟考组卷
- 课堂互动：随机点名、音效、多音色 TTS 朗读、1000 条带姓名表扬语 + 500 条鼓励语
- 双人课堂 PK：分屏对战、花名册（内置「25计算机01班」36 人）、排行榜
- 擂台赛：一名擂主守擂、全班轮流踢馆，打满 N 场自动结算（与双人 PK 完全隔离的另一套界面）
- 云端班级版：学生输学号+班级码，成绩同步到 Cloudflare KV
- 深色/浅色主题切换（默认浅色）

**线上地址**：
- 主站：https://xuekao.jiuyeke.cn （Cloudflare Workers + 自定义域）
- 备用：https://coral-beacon-g4jx.here.now/ （here.now 永久站）
- 仓库：https://github.com/openclawzhangchong/xuekao-chongcitong

---

## 二、环境与路径（务必先确认）

**项目根目录**：
```
C:\Users\Administrator\Desktop\信息技术基础\学考冲刺通
```

**运行环境**：Windows 10 / Node.js 24 / Python 3.14 / Git Bash

**关键目录结构**：
```
src/
  data.js          ← 题库唯一真源（3982 题，含 window.XK_QID_MIGRATE 迁移映射）
  engine.js        ← 纯逻辑引擎（判分/预估分/错题毕业/弱项诊断/组卷）
  app.js           ← 主应用界面逻辑
  style.css        ← 主站样式（变量驱动）
  theme.css        ← 主题层（浅色/深色两套 CSS 变量）★新增
  praise.js        ← 表扬语库（1000 条表扬 + 500 条鼓励）
  sfx.js           ← 音效（Web Audio 合成，无音频文件）
  build.js         ← 构建脚本（单文件 / --split 拆分版）
  data-3714.js     ← 3714 题备份
  data.orig-1238.js← 原始 1238 题备份（生成器的输入）
pk/
  src/pk-app.js    ← PK 模块逻辑（window.__PK_MOUNT 挂载）
  src/pk-markup.html ← PK 模块 HTML 片段
  src/pk-style.css ← PK 样式（变量驱动，跟随主题）
  src/pk-build.js  ← 独立 PK 单文件构建
  src/arena-app.js    ← 擂台赛逻辑（window.__ARENA_MOUNT，只读 PK 花名册，写 pk.arena.*）
  src/arena-markup.html / arena-style.css ← 擂台赛界面（id 一律 ar*，样式一律 .ar-*）
  src/arena-lines.js  ← 擂台赛播报语料（window.XKA，40 条，与 XKP 表扬语分开）
cloud/
  worker.js        ← Cloudflare Worker（API + 静态资源）
  wrangler.toml    ← 主站配置（zcstudy 账户 + KV）
  wrangler.d1.toml ← D1 备用版配置
  keys.json        ← 班级码 + 教师密钥（已 gitignore，绝不入库）
班级版服务.py       ← 局域网版服务（Python 标准库，端口 8953）
tests/             ← 7 套单测（221 项，必须全绿）+ dom-stub.js 共用 DOM 桩
            ← 另有两道机器闸门：tools/scan-defects.js（题库缺陷计数）、tools/gate-fit.js（投屏一屏实测）
tools/             ← 生成器、修正应用器与缺陷复扫闸门
docs/              ← 开发方案文档（擂台赛方案 + 落地实况与返工数字）
changelog.md     ← 更新日志（每批改动：改了什么/为什么/拿什么证明）
evidence/          ← 测试证据与截图
site/              ← 线上部署目录（index.html + data.js 拆分版）
dist/              ← 单文件构建产物
```

---

## 三、当前状态（先跑这几条确认）

```bash
cd "C:\Users\Administrator\Desktop\信息技术基础\学考冲刺通"

# 1. 七套单测必须全绿（221 项）
node tests/engine.test.js              # 期望 53 通过（第 10 节题干清洗 8 项 + 第 11 节共用纯函数 12 项 + 长选项闸门）
node tests/classroom.test.js           # 期望 19 通过
node tests/pk-pick.test.js             # 期望 11 通过（PK 选人：下拉能选中姓名）
node tests/pk-features.test.js         # 期望 48 通过（领先条/随机匹配/章节过滤/抽题随机/表扬语/清洗/一屏自适应/回首页/对战中折叠）
node tests/arena.test.js               # 期望 32 通过（A 组 7 项防混淆 + B 组 21 项状态机 + C 组 4 项投屏一屏）
node cloud/worker.test.js              # 期望 20 通过
python -I tests/test_server_logic.py   # 期望 38 通过

# 1b. 题库缺陷闸门（任一类计数上升 → 退出码 1）
node tools/scan-defects.js

# 1c. 投屏一屏闸门（无头 Edge 真渲染真题；随机题滚动率 >2% 或中位字号 <20px → 退出码 1）
node tools/gate-fit.js                 # 默认 1366×768 抽 200 题；要更狠：node tools/gate-fit.js 1366 768 400
#   量线上那一份：GATE_PAGE=https://xuekao.jiuyeke.cn/ node tools/gate-fit.js 1366 768 150

# 2. 题库规模
node -e "global.window={};eval(require('fs').readFileSync('src/data.js','utf8'));console.log(window.BANK.length)"
# 期望 3982

# 3. 构建可用
node src/build.js                      # 单文件，期望 3227KB
node src/build.js --split site/index.html   # 拆分版，期望 index 234KB + data.js 2993KB
```

**已完成的审题修正**：累计 2193 条（4 个批次 agent 审读 + gen4 核验 + v5 批 2-3 = 2095，
加 v6 重复选项 6 条、v6 补解析 70 条、v7 病态长选项 22 条），全部经 `tools/apply-v5fix.js` 质检后落库。

**四类已知缺陷的实测结论**（`node tools/scan-defects.js` 随时复算，别再引用旧数字）：

| 类别 | 旧文档 | 实测 | 现状 |
|---|---|---|---|
| 题面残留选项标记 | 53 | **0 题（已根治）** | 2026-11-07 二轮：47 题题干直接清洗改名 + 17 题同题双版本并入干净版；旧 qid 全部进 `window.XK_QID_MIGRATE`（214 条含全历史考古），读档自动迁移，学生记录零断链 |
| 重复选项 | 3 | 曾实测 **3 题**（旧「5 题」是把「1 2 3」和「123」折叠空格后的假阳性） | **已归零**：改写落库（只动 `o`/`e`，不动题干），基线 0 |
| 过短解析（<20 字） | 61 | 曾实测 70 题 | **已清零**：70 题逐题补写（新解析 70-181 字，平均 119 字），只动 `e` 字段 → qid 不变。逐条对照见 `evidence/qbank-audit/v6-explanations-review.md`，其中 17 题标了「请教师复核」 |
| 选项截断 | 22 | **不成立** | 两种启发式命中 97 / 372 题，抽样几乎全是正常干扰项；文档举的实例「最基本的系统软件是办公」其实选项完整。只出候选清单，不计入闸门 |

基线在 `evidence/defect-baseline.json`；**任何一类计数上升，`scan-defects.js` 直接退出码 1**。

---

## 四、你的任务（按优先级）

### 任务 1：清理已知题库缺陷（最高优先）

先跑扫描（或自己写扫描器），定位并修掉：
- **选项截断**：如「…最基本的系统软件是办公」（应为「办公软件」）
- **重复选项**：同题四个选项文本雷同
- **过短解析**：如只有「（注意：本题说法错误。）」
- **题面残留**：题干里混入「A. xx B. xx」选项列表

**修法**：写成 `fix-*.json` 格式后用现成应用器落库：
```bash
node tools/apply-v5fix.js fix-你的修正.json    # 支持 a/e/s/o 四种字段，带质检守卫
```
格式：
```json
[{"i": 123, "field": "a|e|s|o", "issue": "问题", "fix": "修正值"}]
```
- `o` 字段的 fix 必须是**完整选项数组的 JSON 字符串**：`"[[\"A\",\"…\"],[\"B\",\"…\"]]"`

### 任务 2：续做 AI agent 全库审读（方案 B）

**已全部完成（2026-11-07 二轮）**：i=0~1999 由子代理补审（批 0 单代理 1000 题 + 批 1 四路并发各 250 题），
384 条修正落库（329 解析 / 31 答案 / 17 选项 / 7 混合）。i≥2000 此前已应用 1093 条。
遗留弱缺陷（agents 实测记录在 evidence/qbank-audit/v5fix-1*.json 的 issue 字段与复述里）：
M7/M8 约 130 题解析主题错位、部分「以上都是」式选项、多错选项的选错误题——不误导但推不出答案，待专项。

**注意**：agent 有并发限制，**串行跑，一次 1 个**，每批 500~1000 题。曾遇 `exceed quota limit`。

### 任务 3：产品体验优化（自行判断）
- 移动端适配（当前偏 PC）
- 性能（3.1MB 单文件首次加载）
- 无障碍（键盘操作）

---

## 五、铁律（违反会破坏线上数据）

### 1. 数据真源只有一个
`src/data.js` 是唯一真源。**禁止**直接改 `dist/` 或 `site/`，必须改 `src/data.js` 后重新 build。

### 2. 题目 ID 由题干计算
ID = `djb2(m|qt|s)`，**题干参与计算**。改题干会导致学生历史作答记录对不上。
→ **尽量只改选项/解析/答案，不改题干**。

### 3. 每次写入题库必须过质检四零
1. qid 全库唯一
2. 题面全库唯一（同模块同题型）
3. 答案存在于选项中
4. 解析非空

`apply-*.js` 工具已内置质检，不合格会拒绝写入——**不要绕过它**。

### 4. 线上必须用拆分版
Cloudflare Workers 对 2.5MB+ 单文件会 **19 秒延迟且随机截断**（已踩坑）。
```bash
node src/build.js --split site/index.html   # 线上用这个
node src/build.js                            # 桌面用单文件
```
`site/index.html` 里的 `data.js?v=<时间戳>` 是 cache-busting，**不能删**。

### 5. 绝不提交密钥
`cloud/keys.json` 含班级码和教师密钥。已被 `.gitignore` 排除。
提交前务必 `git status` 检查；历史上曾泄漏过一次，已轮换密钥并重写历史。

### 6. 改完必须同步 5 处
1. `src/data.js`（真源）
2. `dist/学考冲刺通.html` + 桌面副本 `C:\Users\Administrator\Desktop\学考冲刺通.html`
3. `site/index.html` + `site/data.js`
4. 部署：CF 主站 + here.now
5. `git commit && git push`

---

## 六、部署命令

```bash
# Cloudflare 主站
cd cloud && npx wrangler deploy
# 账户：zcstudy@vip.qq.com（OAuth 已配置在 ~/.wrangler/config/default.toml）
# 自定义域：xuekao.jiuyeke.cn（jiuyeke.cn zone 在该账户）

# here.now 备用站
cd .. && node src/deploy.js site coral-beacon-g4jx
# 凭证：~/.herenow/credentials（API key）

# 班级版（局域网，教师电脑运行）
python -I "班级版服务.py"     # 端口 8953，教师页仅本机可开
```

**部署后验证**：
```bash
curl -s -m 20 https://xuekao.jiuyeke.cn/api/bank | head -c 200   # 应返回 JSON 题库
curl -s -o /dev/null -w "%{http_code}" https://xuekao.jiuyeke.cn/  # 期望 200
```

**Git push 特殊配置**：github.com 直连被 SNI 重置，走 SSH 443：
```bash
git push origin main   # remote 已配置为 git@github-xuekao:openclawzhangchong/xuekao-chongcitong.git
# ~/.ssh/config 里有 Host github-xuekao → ssh.github.com:443
```

---

## 七、关键 API 与数据结构

### 题库题目对象
```js
{
  m: 'M1',                    // 模块码 M1~M9
  kd: '考点 1 · 信息技术概念',  // 考点
  qt: '单选' | '判断' | '多选',
  s: '题干（ ）',              // 题面
  o: [['A','选项文本'], ...],  // 选项；判断题固定 [['√','正确'],['×','错误']]
  a: 'A' | 'BCD' | '√' | '×', // 答案（多选为字母串）
  e: '解析全文',
  an: '生活类比',
  t: '易错提醒',
  src: 'gen@20261106:tag:源题索引',  // 变式溯源（原题无此字段）
  difficulty: '基础'|'进阶'|'拔高'   // 仅 gen4 扩容题目有
}
```

### 服务端 API（Worker + 班级版同构）
| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/hello` | GET | 返回 `{mode:'class'}`，前端探测班级模式 |
| `/api/sync` | POST | `{sid, name, code, profile}` → 合并档案（逐题取 max） |
| `/api/students` | GET | 需教师密钥，返回名单 |
| `/api/bank` | GET | 返回全量题库 JSON（CORS 开放，供 PK 模块） |
| `/teacher` | GET | 教师学情页（需密钥） |
| `/teacher.csv` | GET | 成绩导出（需密钥） |

### 存储键（localStorage）
| Key | 内容 |
|---|---|
| `xkc.profile.v1` | 学生档案（answers/days/history） |
| `xkc.class.v1` | 学号+姓名+班级码 |
| `xkc.roster` | 主站随机点名名单 |
| `xkc.theme` | 主题（light/dark，默认 light） |
| `pk.roster` | PK 花名册（选人区与「🎲 随机匹配」的数据源） |
| `pk.cfg` | PK 开赛设置：题量 / 计时 / 出题章节 `mods`（点章节格**即时落盘**，无保存按钮；**字段缺失 = 不过滤**，等于章节功能上线前的行为） |
| `pk.matches` | PK 比赛记录 |
| `pk.snd` | PK 音效开关 |
| `pk.arena.v1` | 擂台赛战绩（当前擂主 / 连胜 / 场次 / 每人上场次数），**与 `pk.matches` 完全分开** |
| `pk.arena.cfg` | 擂台赛设置：题量 / 每场分钟 / 总场次 / 章节 `mods`（首次使用时继承 `pk.cfg.mods`） |
| `xkc.big` | 课堂投屏状态 |

---

## 八、工具速查

| 脚本 | 用途 | 输入要求 |
|---|---|---|
| `tools/gen-variants.js` | 原题→2 变式 | **必须 1238 题**（防递归守卫） |
| `tools/gen-more.js` | 3714→3999 | **必须 3714 题** |
| `tools/sys-fix.js` | 语义翻转+解析清洗 | 任意 |
| `tools/apply-fixes.js` | 应用 fix-*.json | 带题面映射+o 字段 |
| `tools/apply-v5fix.js` | 应用 v5fix-*.json | 支持 a/e/s/o |
| `tools/rescan-gen4.js` | 五项复扫 | — |
| `tools/gen-v7fix.js` | 生成「选项里塞整段案例」的 9 题修正集 + 复核清单 + qid 映射 | 必须 3999 题库；会拒绝改坏答案字母映射 |
| `tools/scan-defects.js` | 四类缺陷复扫 + 基线对比闸门 | `--save-baseline` 存基线，`--json` 机器可读 |
| `tools/gate-fit.js` | 无头 Edge 真渲染真题，量「投屏一屏装不装得下」 | `[宽 高 抽样数]`，默认 1366 768 200；`GATE_SCROLL_MAX` / `GATE_FS_MIN` 调线 |
| `tools/shot-arena.js` | PK 与擂台 5 张对比截图 + 布局数字 | 产物进 `evidence/arena-shots/`；`[宽 高]` 换分辨率 |
| `tools/qid-migrate.js` | 题干残留根治 + qid 全历史迁移映射（git 考古，幂等可重跑） | `node tools/qid-migrate.js`（`--map-only` 只重建映射）；产出 XK_QID_MIGRATE 写入 data.js |
| `tools/e2e-full.js` | 全站 E2E：无头 Edge 真点真答（答题/PK/擂台/持久化/教师页闸门） | `node tools/e2e-full.js [URL]`，缺省本地拆分版；可传 `http://127.0.0.1:8953/`（班级版多测 6 项）或线上站（只冒烟不写云端数据）；`E2E_VIEWPORT=390x844` / `E2E_OUT=目录` 调视口与产物目录；退出码即验收 |

**注意**：生成器有防递归守卫（输入题数不对会报错），这是保护机制，**不要移除**。

---

## 八⅞¾、课堂互动名单种子（2026-11-07 夜）

- 课堂互动点名名单（xkc.roster）**缺省自动填充 PK 内置花名册**（25计算机01班 36 人）：
  数据源 = `window.XK_DEFAULT_ROSTER`（pk-app 顶层常量，单一数据源）
- 种子条件：`xkc.roster` 键**不存在**（首次运行）；「清空名单」写入空列表后不再覆盖
- 陷阱记录：种子回调可能跑在页面解析中（readyState=loading，pk-app 未加载）——
  必须重试等待 XK_DEFAULT_ROSTER 就绪；改 loadRoster 别动这个重试循环

## 八⅞½、客户端模式 + 排行榜页（2026-11-07 晚）

- 启动器窗口 URL 带 `?client=1` → 底部 tab 换六项课堂组（含 🏆排行榜页：班级擂王/
  今日/周擂主/月擂主/本周胜榜/总榜，实时聚合）；PK/擂台对战中 tab 仍隐藏
- 「输入学号」弹窗保留现状（用户拍板）；备课夹/课堂互动 = 首页卡片的 class-hook
  双渲染复用（改其一记得两处一致）
- 陷阱记录：renderTabs 重绘 tab 会丢徽章元素——refreshBadges 已空安全，别回退；
  timeline 链尾不得接 forEach（返回 undefined）

## 八⅞、Windows 客户端（2026-11-07 傍晚交付）

- **产物**：`dist-client/学考冲刺通课堂版-免安装.zip` + `学考冲刺通安装包.exe`（各 19.8MB）
- **重新打包**：`node tools/build-client.js`（自动：site 构建 + logo + 内嵌 Python + csc 编译）
- **客户端结构**：内嵌 Python 3.14 跑班级版服务（本地数据库/music 歌单）+ Edge 应用窗口
- **已知**：exe 未签名（SmartScreen 提示点仍要运行）；pythonw 下日志已做 None 守卫
  （Handler.log_message），改服务端注意保持
- 计划与验收：`docs/Windows客户端升级计划-20261107.md`

## 八¾、课堂增强（2026-11-07 下午，教师场景定制）

上课禁带手机、单班、教师机+投影。已交付：
- **备课夹**：首页面板勾题（模块/题型/关键词过滤+分页），PK/擂台开赛设置「④ 题源」
  选「📋 备课夹顺序」→ 按勾选顺序出题、两侧同序（讲完就打）
- **舞台键盘**：左侧 A–F+回车、右侧 1–6+空格；「🔀 换一题」双方同步跳过
- **首页荣誉榜**：PK 获胜 Top10 + 周擂主（跨周守擂延续）；数据在课堂数据本地库
- **本地数据库**：PK/擂台/备课夹数据经 CSYNC 同步到班级版服务 `data/classroom.json`
  （.bak 滚动备份），浏览器清缓存可自动恢复；file:// 单文件模式退回纯 localStorage
- **PK 背景音乐**：教师自备 mp3/wav 放班级版服务 `music/` 文件夹即永久生效
  （/api/music + /music/<文件>）；或设置里临时选本地文件夹；TTS 自动压低
- **KV 备份**：`node tools/kv-backup.js`（`--restore <文件>` 恢复）
计划与验收明细：`docs/课堂增强计划-20261107.md`

## 八½、题库审读修复手册（复用入口）

**下次修题/扩容核验/定期巡检，直接照 `docs/题库审读修复手册.md` 跑**——那是三轮全库实战
（488 条修正、零删除、零断链）沉淀的运行手册：10 步全流程命令、3 个可直接复制的代理提示词模板
（审读/专项修复/疑难核验）、7 个工具速查、10 条实战教训、交付前验收清单。
快照生成已固化为一行命令：`node tools/gen-audit-chunks.js [起] [终] [每块] [输出目录]`。

## 九、工作方式要求

1. **每次改题库后必须**：跑 7 套单测 → build → 抽样人工复核 → 部署 → 验证线上
2. **不确定的改动**：先小范围试（改 5 题看效果），确认无误再全量
3. **遇到 bug**：先复现 → 定位根因 → 修 → 回归测试，不要猜
4. **不要重写整个项目**：这是已上线的成熟项目，增量优化
5. **保持代码风格**：现有代码是 ES5 风格（`var` + `function`），无框架无构建工具链，保持一致
6. **报告要诚实**：改了什么、验证了什么、还有什么没做，如实说明

---

## 十、已完成的工作（不要重做）

- ✅ **全站 E2E 工具与四套环境实测全绿**（2026-11-07 凌晨，ZCode）：file:// 27/27、班级版 33/33、
  线上双站各 27/27、移动端 390×844 27/27；键盘无障碍（三处选项 Tab+回车可作答）、
  窄屏投屏 2 列修复、首屏加载提示、favicon 消音、启动块去重 —— 明细见 `changelog.md` 与
  `evidence/交接-20261107-ZCode.md`
- ✅ 题库从 1238 扩容到 3999（变式生成 + 选择题扩容）
- ✅ 4 个批次 AI 审题修正 2095 条
- ✅ PK 模块开发并合并进主程序
- ✅ 统一主题系统（浅色默认/深色可切）
- ✅ 内置默认班级 25计算机01班（36 人）
- ✅ 题库地址预置（无需用户填写）
- ✅ **v7 病态长选项修正 9 题**：选项里被生成器塞进整段案例（最长 126 字/项，四个选项只差结尾几字）。
  案例移进题干、选项只留区分点；1581/1583 顺带修掉「两个选项都算错」的命题缺陷。
  全库最长选项 126 → 76 字，≥80 字的题 9 → 0；**代价：8 题 qid 变了（3991/3999 不变）**，
  旧→新映射在 `evidence/qbank-audit/v7-longopts-qidmap.json`。复核清单 `v7-longopts-review.md`。
- ✅ **对战中折叠「选人」那一行**（`body.pk-running`）：开赛后那两个下拉改了也不生效，白占一行；
  折叠后 PK 顶栏 226→173px、面板 508→**561px**、随机题中位字号 21→**23px（基准值）**。收尾/重置必须还原（3 条断言）。
- ✅ 投屏一屏终态实测（`node tools/gate-fit.js 1366 768 400`）：随机 400 题 PK 与擂台**需滚动 0 题**，
  全库最长 20 题也**需滚动 0 题**（返工前 85% / 100%）。
- ✅ 新增 `changelog.md`（每批改动写「改了什么 / 为什么 / 拿什么证明」）。
- ✅ 云端班级版（Cloudflare KV）+ 局域网版 + here.now 备用站
- ✅ 7 套单测 221 项全绿（含擂台赛 32 项）
- ✅ PK 选人下拉可正常选中姓名（含无编号学生）
- ✅ PK 抽题改为真随机（此前每局固定做题库前 N 题，学生打两轮就背完了）
- ✅ PK 新增：领先条居中放大 / 🎲 随机匹配+上台播报 / 开赛设置里「③ 出题章节」/ 答对答错带姓名表扬语
- ✅ PK 投屏布局：PK 页签全宽（不再被 `.app` 的 760px 锁住）、两侧各占一半、中间 2px 分割线、
  字号按可用高度自适应（**下限 16px**，仍塞不下才该侧滚动）；窄屏回退成整页滚动，避免顶栏挤没题面
- ✅ 题干残留 64 题（全在 M3）改为渲染层剥离 `XK.cleanStem` —— data.js 未改、qid 不变、学生记录不断链
- ✅ 3 题重复选项 + 2 题答非所问/纯模板解析已改写落库；四类缺陷计数进入 `scan-defects.js` 基线闸门
- ✅ PK 独立版（pk/dist/双人PK答题.html）修好：`${pkMarkup}` 此前从未被替换、且没人调用
  `__PK_MOUNT()`，界面既缺又不动；pk-build.js 已加占位符/界面/挂载三道守卫
- ✅ 设置弹窗的「默认题量/默认计时」不再与开赛面板撞 id（此前改了不生效）
- ✅ 构建产物不再混入模板残留文本（build.js 已加残留守卫）
- ✅ README 含 9 张页面截图
- ✅ **擂台赛（一人守擂 · 全班轮流踢馆）已落地**，方案见 `docs/擂台赛-开发方案.md`：
  与双人 PK 硬隔离（id 全 `ar*`、样式全 `.ar-*`、独立存储 `pk.arena.*`、独立语料 `XKA`），
  配色/版式/图标/播报口吻都不同，防混淆由 `tests/arena.test.js` A 组 6 项闸门盯着。
  首页 🥊 入口进擂台；打满 N 场自动结算（最终擂主 + 战绩表 + 没上过台名单）。
- ✅ 擂台赛候选袋保证「一屏之内不重复同一个人」：名单不足时宁可少给并提示，
  也不会让擂主出现在自己踢自己的馆里（`tests/arena.test.js` B18/B19/B20，旧代码这 3 项全红）。
- ✅ **修掉「一屏自适应缩了个寂寞」**：面板里选项内边距/ABCD 圆片/姓名分数/提交按钮原先是固定 px，
  不跟 `--pkfs`/`--arfs` 走 → 1366×768 投屏上随机 200 题有 170 题（85%）顶到 16px 下限还得滚动。
  全部改成 `calc(var(--*) * k)` 后：PK 中位 21px、擂台 22px，随机题需滚动 0.3% / 0%。
  闸门 = `tools/gate-fit.js`（浏览器实测）+ CSS 结构断言（`pk-features` 2 条 + `arena` A7）。
- ✅ **修掉底部页签压住内容**：`.tabs` 是 fixed，投屏模式下压在 PK 两侧「选择答案后提交」上半截、
  并切掉擂台候选卡片下沿。宽屏（≥901px）的 PK/擂台模式整条隐藏页签，退出改走顶栏「🏠 首页」
  （独立版没有宿主钩子，按钮自动隐藏）。手机上页签照旧。
- ✅ 擂台打完一场后右席撤成「虚位以待」并清分数/题型行，避免「擂主 vs 擂主」同名错觉（B21）。
- ✅ 云端班级版的「输入学号」自动弹窗不再盖住课堂屏：`pk-mode`/`arena-mode`/`big` 下不弹（本地 file:// 不是班级模式，
  只有线上才复现得到）；学生端首页行为一字未改。闸门 = `tests/arena.test.js` C4。

---

## 十一、交接检查清单

接手后请先做这 5 件事，确认环境正常：

```bash
cd "C:\Users\Administrator\Desktop\信息技术基础\学考冲刺通"

# ① 单测全绿
node tests/engine.test.js && node tests/classroom.test.js && node tests/pk-pick.test.js && node tests/pk-features.test.js && node tests/arena.test.js && node cloud/worker.test.js

# ② 构建成功
node src/build.js

# ③ 线上可访问
curl -s -o /dev/null -w "%{http_code}\n" https://xuekao.jiuyeke.cn/

# ④ git 干净
git status

# ⑤ 读一遍
cat README.md
```

全部正常后再开始改动。如果有异常，先把异常告诉我（或先修复环境）。

---

## 附：用户背景

- 福建省厦门工商旅游学校中职教师，教《信息技术基础》学考辅导
- 班级：25计算机01班（36 人）
- 已有资产：自编教材三册、1238 题原始题库、周测组卷网站、OMR 阅卷助手
- 使用场景：教室投屏上课（PK 对战）、学生课后手机刷题、学考备考
- 偏好：单文件双击即用、不上云优先、真实证据交付、不要花架子

═══ 提示词结束 ═══

---

## 使用说明

1. **完整复制**上面「提示词开始」到「提示词结束」之间的所有内容
2. 粘贴给下一个 AI（Claude / GPT / Kimi / 通义 等都可以）
3. 如果那个 AI 有文件访问权限，它会自己读代码；如果没有，它需要你把 `src/data.js` 等关键文件贴给它
4. 配套文档：同目录下的 `题库质量攻坚方案_A+B.md`（更详细的题库清理方案）

---

## 十二、默认题量闸门（2026-11-09 追加，接手必读）

- **四档题量（2026-11-10 起）**：默认 **1000 基础档**，教师可切 **2000 高级档 / 3000 终极档 / 3982 全库档**；三档白名单严格嵌套 `1000 ⊂ 2000 ⊂ 3000`，升档不丢做过的题。`src/data.js` 仍是 3982 题唯一真源，一题未删、题干未改，qid 不变；别再用「删题」思路精简题库，AI 只准产出白名单清单，不准写 `data.js`。
- 链路：`docs/白名单-{1000,2000,3000}题.json`（qid + 下标，可审计）→ `tools/build-whitelist.js` 生成 `src/whitelist-data.js`（`XK_TIER_INDEX` 三档下标 + `XK_DEFAULT_TIER='1000'`，保留 `XK_BANK_INDEX` 兼容）→ `src/bank-gate.js` 把 `window.BANK` 指向当前档视图，全库存 `window.BANK_ALL` → 所有业务模块自动生效。开关 `xkc.bank.tier=1000|2000|3000|full`（默认 1000），兼容旧 `xkc.bank.release=1`，URL `?tier=` / `?full=1` 兜底；按钮属性 `data-bank-tier`，容器 `data-bank-gate`。**按钮位置（21:38 修订，防误点）**：首页底部「教师选项 · 题量范围」卡片（学习档案下面）、PK 设置弹窗内；顶栏一律不放，`tests/bank-gate.test.js` 有回归断言盯着。版本常量在 `src/bank-gate.js` 的 `XK_APP_VER`（当前 `v1.1`），首页副标题 / 页脚 / PK 设置标题都显示。
- `site/data.js` 末尾有 `window.XK_TIER_INDEX=`（三档）与 `window.XK_DEFAULT_TIER='1000'` 行；`cloud/worker.js` 与 `班级版服务.py` 的 `/api/bank` 默认返回 1000 题，`?tier=2000|3000` 切档、`?full=1`（或 `tier=full`）返回全库；旧 `XK_BANK_INDEX` 行保留兼容。**改 data.js 时别把 `window.BANK=` 那一行改成表达式**，服务端是按行 `JSON.parse` 的，`tests/qid-migrate.test.js` 盯着这个契约。
- 配额依据：`docs/考点目录.json`（9 模块 58 考点）、`docs/题库精简配额-2000题.json/.csv` 与 `-1000题/-3000题.json`。86 道跨考点综合卷不进任何白名单档，只在全库档出现，另作模拟卷题源。
- 新增闸门 `node tests/bank-gate.test.js`（22 项，含三档嵌套与四档切换）；全量回归 270 项 + `tools/scan-defects.js`。重建顺序：`node tools/build-whitelist.js` → `node src/build.js` → `node src/build.js --split site/index.html` → `node pk/src/pk-build.js` → `node tools/build-client.js --skip-build`。
- **发布**：tag / Release `client-v1.1`（2026-11-09，指向 `9ab6840`）为 Latest，含 4 个客户端资产；旧 `client-v1.0` 保留为历史归档并加取代提示。README 的 `/releases/latest` 会自动指向 v1.1。
- 客户端 zip / exe 已重建；2026-11-09 晚三处云端均已部署：CF 主站（KV）、D1 备用（zcvoice）、here.now 备用站。线上验证主站 `/api/bank` 默认 2000 / `?full=1` 3982、双站真浏览器 `BANK=2000`、按钮就位；D1 部署成功但国内 `workers.dev` 不可达（已知问题，主站与 here.now 正常）。代码已提交推送，`.workbuddy/` 已加入 `.gitignore`（本地会话数据不入库）。

## 十三、教师修正题目（2026-11-10 晚，接手必读）

- 答题页题号旁「✏️ 修正本题」→ `#qeditMask` 模态框：先输教师密码（只放哈希常量 `PWD_HASH`，不放明文），解锁后改题干 / 选项 / 正确答案（多选可多勾）/ 解析；保存即刷新当前题，可「恢复原题」「导出 / 导入修正」。
- 核心在 `src/question-override.js`（`window.XK_QOVER`）：按**原 qid** 存 `localStorage['xkc.qoverrides.v1']`，运行时就地合并到 `BANK_ALL` 原对象；`src/engine.js` 的 `qidOf` 优先返回题目上的 `_origQid`，所以**改题干不改 qid**，学生档案 / 错题本 / 备课夹零断链。`src/data.js` 一字未改，题库不需要重建。
- 脚本顺序（别打乱）：engine → data(+whitelist) → bank-gate → **question-override** → app → pk-app → arena-app；`pk/src/pk-build.js` 与 `template.html` 也接了同一层。`XK_BANK_GATE.guard` 末尾调用 `XK_QOVER.applyTo`，远程拉取的题库同样应用修正。
- 限制：修正**只存本机**，不同设备 / 不同站点不共享，靠导出导入 JSON 迁移；前端密码只防误触（F12 可绕过），且密码是手机号，建议换成普通口令。若要全班生效，需要另做服务端修正同步接口（带真鉴权），目前没做。
- 测试：`node tests/question-override.test.js`（14 项）+ 全量 284 项；重建与部署照第十二节流程。

## 十四、教师删除题目（2026-11-10 夜，接手必读）

- 答题页「🗑 删除本题」→ `#qdelMask`：**每次打开都要重输教师密码**，解锁后显示题目预览 + 二次确认；弹窗下方「已删除题目」清单可逐条「↩ 恢复」，另有导出 / 导入清单。
- 核心在 `src/question-override.js` 的 `window.XK_QDEL`：按**原 qid** 存 `localStorage['xkc.qdeleted.v1']`，`filter()` 只过滤题池视图。**绝对不要 splice `window.BANK_ALL`**——`XK_TIER_INDEX` 三档白名单存的是 BANK_ALL 的下标，动一下全档错位。原对象仍留在全库，真源一题不删、qid 不变、可恢复。
- `src/bank-gate.js` 三个配套改动：`bankOf()` 末尾 `XK_QDEL.filter(base)`；`apply()` **就地同步 `window.BANK` 数组内容**（`cur.length=0` + push），因为 `app.js` / `pk-app.js` 启动时缓存了这个引用，换引用会让它们继续用旧题池；`full` 档返回 `BANK_ALL.slice()` 保证 `BANK !== BANK_ALL`。`guard()` 顺序是「先 `XK_QOVER.applyTo` 挂 `_origQid`，再 `XK_QDEL.filter`」，远程题库也生效。
- 删除后 `app.js` 把当前题从 `S.list` / `S.answers` 一起 splice（索引对齐），立即跳到下一题；列表空了返回首页。
- 限制：只存本机，不同步其它设备 / 云端；前端密码只防误触（F12 可绕过），密码是手机号，建议换普通口令。
- 测试：`node tests/question-delete.test.js`（17 项）+ 全量 301 项；重建与部署照第十二节流程。

## 十五、题库逐题审阅工具（2026-11-10 夜）

- 起因：题库里混入 AI 拼出的坏题（典型 `M8-1g17mx0`：选项把另一题题干＋答案揉成一句、带【拔高】、问「错误的是」却把正确陈述设为答案）。老师要逐题截屏给别的 AI 判定删除。
- 文件：`docs/题目逐题审阅.html` 是**生成产物**（2.46 MB，内嵌全库 3982 题精简字段，离线可用）；源在 `tools/review-template.html` + `tools/build-review.js`，题库更新后跑 `node tools/build-review.js` 重生成。提示词唯一来源是 `docs/AI审题提示词.md`，生成时会内嵌进 HTML 供「📋 复制提示词」按钮使用，**改提示词后必须重新生成 HTML**。
- 页面：一屏一题 + 全局编号 `#0001 / 3982` + qid + 模块/考点/题型；`←/→` 翻题、`D` 标记删除、`P` 纯净截屏（隐藏工具栏但保留编号与答案）、`A` 显隐答案、`J` 跳号；筛选模块/题型/qid/「只看可疑题」。标记存 `localStorage['xkc.review.marked.v1']`，刷新不丢。
- 预检只做文本形态：`批次/难度标签` 97 题、`题干套话混入选项` 562 题，合计 617 题（15.5%）。答案对错、知识性错误交给审查 AI，别把「选项短」「有 {}」这类正常题特征也加进预检，否则误报淹没真问题。
- 闭环：AI 结果粘进「📥 粘贴 AI 结果」→ 提取 `DELETE` 的 qid（兼容 JSON 数组 / 单对象 / ```json 围栏 / 逐行对象 / 纯文本行，忽略题库里不存在的 qid）→「⬇ 导出删除清单」输出 `{v:1, count, items:{qid:{s,m,at}}}` → 主程序删除弹窗「⬇ 导入清单」导入（`XK_QDEL.importText`），本机隐藏、可逐条恢复。**AI 全程不碰 `src/data.js`、不写文件、不执行删除。**
- 本次只是新增工具，**没有动题库、没有重建前端产物、没有部署云端、没有重打客户端**。

## 十六、质检规则单一真源与 AI 分工（2026-11-10 夜，接手必读）

- **判定规则只有一份**：`tools/quality-rules.js`，导出 `classify(q, ctx)` 返回 `{state:'DELETE'|'CLEAN'|'KEEP', rules, reason, clean, dup}`。`tools/quality-gate.js`（只读质检器）与 `tools/build-review.js`（审阅页生成器）都 require 它。**任何人不要在这两个脚本里另写正则**——规则一漂移，工具结论就会互相打架，这正是老师反复让 AI 查题失败的根因。
- 三态必须分清：`DELETE`＝结构性损坏（排除出候选白名单，**绝不物理删题**）；`CLEAN`＝格式瑕疵，洗掉即可用，**不删题**；`KEEP`＝正常。**题干**带【拔高】是 CLEAN（R3），**选项**带标签＋拼接句才是 DELETE（R1）。早期把两者混为一谈会误删好题。
- 关键事实：29 道可剥离「下列…的是X」模板前缀的题，**100% 洗完后选项集与库内已有正常题完全相同**（R8），删掉零知识点损失，不要费劲清洗。程序判不了的事实错误 / 答案逻辑冲突一律 `REVIEW`，不许写成硬规则。
- 分工（别反了）：**程序全检** 3982 题（秒级、零漂移、可复现）→ **AI 按模板聚类产出可编码规则 + 反例**（`docs/AI质检规则提示词.md` v2）→ **人/双模型抽检**规则命中样本后才进闸门。抽检本质是语义判断，是人的活；让程序抽检等于浪费它 100% 覆盖的优势，让 AI 逐题全检等于浪费它最贵的语义能力。`docs/AI审题提示词.md`（v1 逐题判定）只用于复核少量待复核题。
- 只读报告 `docs/题库质检报告.json`（`node tools/quality-gate.js` 生成）：三态计数 `DELETE 596 / CLEAN 39 / KEEP 3347`（R1~R9）、规则命中、按 `src` 批次污染率（gen 20.3% / gen4 26.7%，正式资料 0%）、各档白名单污染数、模块配额可行性、完整 DELETE qid 清单。1000/2000 档配额够，3000 档 M5/M6/M7 受干净题容量约束（592 / 559 / 279）。
- **R9 是语义层规则**：单选题解析里明确写「因此选X / 故选X / 答案是X」但 `a` 不是 X → `DELETE`。这类题解析与答案互相打架、无法判断哪边对（59 道，全部来自 `gen` 批次）。`saidAnswer()` 只认明确措辞，取最后一处，排除「不选B」「选A则…」。
- **换池不洗库**：学生只看默认 1000 题，重配白名单即可把坏题率归零，一题不删、qid 不变、可回滚。若要根治复发，把 R1~R8 接进 `tools/scan-defects.js` 并让 `src/build.js` 硬校验「白名单不得含 DELETE 题」——**这一步尚未实施**。
- 本轮只做只读工具与文档：题库真源、白名单、三处云端、客户端均未改动。

## 十七、干净池白名单（2026-11-10 深夜，已上线）

- 白名单已从「按分值配平全库」改为「**只从 KEEP 干净池抽取**」。候选池 = `tools/quality-rules.js` 三态判定为 `KEEP` 的 3347 题；`DELETE` 596 排除；**`CLEAN` 39 也排除**（清洗会改题干/选项文本 → `qid=djb2(m|qt|s)` 变 → 学生档案断链），它们仍留在全库、可在全库档查看。另外排除 84 道跨考点综合卷（无 point_id）与 15 道跨模块错挂题（point_id 模块前缀 ≠ 题目 m，如 M7 题被标成 M8-01）。
- 生成器 `tools/build-whitelist.js` 已重写：先选 3000，2000 从 3000 的考点列表取前缀，1000 从 2000 取前缀 → 嵌套天然成立。模块配额按分值比例 + 干净题容量封顶 + 缺口按比例重分配。
- 配额现状：1000 档 `100/100/100/47/200/200/100/53/100`、2000 档 `200/200/200/93/400/400/200/107/200`（严格按分值）；3000 档 M6 579（-21）、M7 279（-21），缺口由 M1/M2/M3/M5/M8/M9 补足，偏差写在白名单 JSON 的 `module_quota_adjusted`。
- **构建硬校验**：`src/build.js` 会 require `tools/quality-rules.js`，任何档位白名单含 `DELETE` 题 → 构建直接失败。`tools/scan-defects.js` 也新增 `质检DELETE` 闸门指标（当前 **596**，上升即失败，基线已更新）。这两处是防复发的关键，**重生成白名单必须走 `node tools/build-whitelist.js`**，手改 JSON 会被构建拦下。
- 注意：`docs/题库精简配额-2000题.json` 的 `points[].quota` 字段（旧版是 `base2000` / `a`）；`tests/bank-gate.test.js` 的「86 道综合卷」断言已改为读取白名单 JSON 的 `pool` 统计（`excluded_composite` / `excluded_mislabeled`）。
- 验证：302 项单测全绿、缺陷闸门未上升、本地与线上三档题池坏题数均为 0、`/api/bank` 1000/2000/3000/3982 正常。三处云端已部署，客户端包已重打。

---

*本文档由 ZCode 于 2026-11-06 生成，基于项目当前真实状态（git commit 1c0d631）。*
