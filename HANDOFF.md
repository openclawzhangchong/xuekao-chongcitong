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
- 3999 题题库（单选 3316 / 判断 511 / 多选 172），每题带解析 + 生活类比 + 易错提醒
- 150 分制预估分（按 9 模块考纲分值加权）
- 错题本（连对 2 次自动毕业）、考点诊断雷达图、弱项特训、模拟考组卷
- 课堂互动：随机点名、音效、多音色 TTS 朗读、1000 条带姓名表扬语 + 500 条鼓励语
- 双人课堂 PK：分屏对战、花名册（内置「25计算机01班」36 人）、排行榜
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
  data.js          ← 题库唯一真源（3999 题，2.9MB）
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
cloud/
  worker.js        ← Cloudflare Worker（API + 静态资源）
  wrangler.toml    ← 主站配置（zcstudy 账户 + KV）
  wrangler.d1.toml ← D1 备用版配置
  keys.json        ← 班级码 + 教师密钥（已 gitignore，绝不入库）
班级版服务.py       ← 局域网版服务（Python 标准库，端口 8953）
tests/             ← 6 套单测（168 项，必须全绿）+ dom-stub.js 共用 DOM 桩
tools/             ← 生成器与修正应用器
evidence/          ← 测试证据与截图
site/              ← 线上部署目录（index.html + data.js 拆分版）
dist/              ← 单文件构建产物
```

---

## 三、当前状态（先跑这几条确认）

```bash
cd "C:\Users\Administrator\Desktop\信息技术基础\学考冲刺通"

# 1. 六套单测必须全绿（168 项）
node tests/engine.test.js              # 期望 40 通过（含 8 项题干清洗回归）
node tests/classroom.test.js           # 期望 19 通过
node tests/pk-pick.test.js             # 期望 11 通过（PK 选人：下拉能选中姓名）
node tests/pk-features.test.js         # 期望 40 通过（领先条/随机匹配/章节过滤/抽题随机/表扬语/清洗/一屏自适应）
node cloud/worker.test.js              # 期望 20 通过
python -I tests/test_server_logic.py   # 期望 38 通过

# 1b. 题库缺陷闸门（任一类计数上升 → 退出码 1）
node tools/scan-defects.js

# 2. 题库规模
node -e "global.window={};eval(require('fs').readFileSync('src/data.js','utf8'));console.log(window.BANK.length)"
# 期望 3999

# 3. 构建可用
node src/build.js                      # 单文件，期望 ~3.1MB
node src/build.js --split site/index.html   # 拆分版，期望 index 163KB + data.js 2.9MB
```

**已完成的审题修正**：累计 2095 条（4 个批次 agent 审读 + gen4 核验 + v5 批 2-3），全部已验证落库。

**四类已知缺陷的实测结论**（`node tools/scan-defects.js` 随时复算，别再引用旧数字）：

| 类别 | 旧文档 | 实测 | 现状 |
|---|---|---|---|
| 题面残留选项标记 | 53 | **64 题，全部在 M3** | 渲染层已由 `XK.cleanStem` 剥离（**data.js 未改，qid 不变**）；根治要改题干 → 会断学生记录，暂缓 |
| 重复选项 | 3 | **3 题**（旧「5 题」是把「1 2 3」和「123」折叠空格后的假阳性） | 已改写落库（只动 `o`/`e`，不动题干） |
| 过短解析（<20 字） | 61 | **70 题** | 未修，需逐题补写解析（AI 生成 + 教师抽样复核），单独一批 |
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

未完成的批次：
- `evidence/qbank-audit/v5-batch-0.json` + `v5-batch-1.json`（i=0~1999）
- `evidence/qbank-audit/v5-batch-2.json`（i≥2000 部分）+ `v5-batch-3.json`

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
| `pk.cfg` | PK 开赛设置：题量 / 计时 / 章节勾选 `mods`（**字段缺失 = 不过滤**，等于章节功能上线前的行为） |
| `pk.matches` | PK 比赛记录 |
| `pk.snd` | PK 音效开关 |
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
| `tools/scan-defects.js` | 四类缺陷复扫 + 基线对比闸门 | `--save-baseline` 存基线，`--json` 机器可读 |

**注意**：生成器有防递归守卫（输入题数不对会报错），这是保护机制，**不要移除**。

---

## 九、工作方式要求

1. **每次改题库后必须**：跑 6 套单测 → build → 抽样人工复核 → 部署 → 验证线上
2. **不确定的改动**：先小范围试（改 5 题看效果），确认无误再全量
3. **遇到 bug**：先复现 → 定位根因 → 修 → 回归测试，不要猜
4. **不要重写整个项目**：这是已上线的成熟项目，增量优化
5. **保持代码风格**：现有代码是 ES5 风格（`var` + `function`），无框架无构建工具链，保持一致
6. **报告要诚实**：改了什么、验证了什么、还有什么没做，如实说明

---

## 十、已完成的工作（不要重做）

- ✅ 题库从 1238 扩容到 3999（变式生成 + 选择题扩容）
- ✅ 4 个批次 AI 审题修正 2095 条
- ✅ PK 模块开发并合并进主程序
- ✅ 统一主题系统（浅色默认/深色可切）
- ✅ 内置默认班级 25计算机01班（36 人）
- ✅ 题库地址预置（无需用户填写）
- ✅ 云端班级版（Cloudflare KV）+ 局域网版 + here.now 备用站
- ✅ 6 套单测 168 项全绿
- ✅ PK 选人下拉可正常选中姓名（含无编号学生）
- ✅ PK 抽题改为真随机（此前每局固定做题库前 N 题，学生打两轮就背完了）
- ✅ PK 新增：领先条居中放大 / 🎲 随机匹配+上台播报 / 设置里章节勾选 / 答对答错带姓名表扬语
- ✅ PK 投屏布局：PK 页签全宽（不再被 `.app` 的 760px 锁住）、两侧各占一半、中间 2px 分割线、
  字号按可用高度自适应（**下限 16px**，仍塞不下才该侧滚动）；窄屏回退成整页滚动，避免顶栏挤没题面
- ✅ 题干残留 64 题（全在 M3）改为渲染层剥离 `XK.cleanStem` —— data.js 未改、qid 不变、学生记录不断链
- ✅ 3 题重复选项 + 2 题答非所问/纯模板解析已改写落库；四类缺陷计数进入 `scan-defects.js` 基线闸门
- ✅ PK 独立版（pk/dist/双人PK答题.html）修好：`${pkMarkup}` 此前从未被替换、且没人调用
  `__PK_MOUNT()`，界面既缺又不动；pk-build.js 已加占位符/界面/挂载三道守卫
- ✅ 设置弹窗的「默认题量/默认计时」不再与开赛面板撞 id（此前改了不生效）
- ✅ 构建产物不再混入模板残留文本（build.js 已加残留守卫）
- ✅ README 含 9 张页面截图

---

## 十一、交接检查清单

接手后请先做这 5 件事，确认环境正常：

```bash
cd "C:\Users\Administrator\Desktop\信息技术基础\学考冲刺通"

# ① 单测全绿
node tests/engine.test.js && node tests/classroom.test.js && node tests/pk-pick.test.js && node cloud/worker.test.js

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

*本文档由 ZCode 于 2026-11-06 生成，基于项目当前真实状态（git commit 1c0d631）。*
