/* 交接快照写入 biji-notes 知识库：node tools/biji-handoff.js */
'use strict';
const fs = require('fs');
const path = require('path');
const TOKEN = fs.readFileSync('C:/Users/Administrator/.zcode/cli/config.json', 'utf8').match(/4c735c04[a-f0-9]+/)[0];

const content = [
  '# 学考冲刺通 题库逐题审阅 · 交接快照 2026-11-11 01:20',
  '',
  '## 已完成',
  '1. 机器预筛全库3982：真矛盾0/完全重复5/答案偏斜0/乱码0/空解析0/题干=选项0（结构层干净）',
  '2. M9考点11重灾区(200题)修复完毕：',
  '   - 50题错挂改挂M7/M8（tools/refile-m9.js，qid迁移登记进XK_QID_MIGRATE，学生记录零断链）',
  '   - 62题排除出白名单（docs/人工审阅排除.json）：重复副本/冲突冗余/tpl拼凑题，其中3题答案硬伤（M9-1e7akiq双正确选项、M9-1lv2sbn与M9-1s9t8ea答案标错）',
  '   - META.n重算同步（M7=401,M8=382,M9=332）；白名单三档重建全绿（M9 3000档pure 210，缺口-90由M2/M3/M4/M8补）',
  '   - tpl104题模板题干（【大数据核心技术】(一~三十九)）保留原样不洗——洗题干会致qid冲突（52对同干），瑕疵记录在案',
  '3. build-whitelist.js 已支持 docs/人工审阅排除.json 手动排除；验证链：单测237全绿+e2e-full全过+site重建',
  '',
  '## 第五阶段已完成（2026-11-11 05:00）',
  '- M7 401题审读：fix14（解析串题重写）+delete33（双错误项变式双解27+无解5+多解1）+uncertain7（加密完整性口径/个保法诚信口径冲突留教师）',
  '- 视觉b 60张：fix13+排除2+全库括注清理1021条',
  '- M2 337题：fix18+delete8+uncertain19归档',
  '- 白名单derive()容量感知配平修复2000档塌陷；BANK_VER统一20261111',
  '- 累计：fix185处/排除109/uncertain归档40张/桌面文件夹40张',
  '',
  '## 进行中（最后一批）',
  '- 视觉：node tools/review-batch-shot.js 全库3982张学生视角截图后台生成 → evidence/qbank-review/shot-NNNN-qid.png（审阅页已用 node tools/build-review.js 重建含改挂后数据）',
  '- 文本：6个审读子代理被并发上限(2)限制，M9/M1M3在跑，M2/M7/M4M8/M5M6待位重发；产出 agent-*.json 到 evidence/qbank-review/',
  '- 每小时巡检：cron automation-d8232122 每:25 触发，读 progress.json 续做',
  '',
  '## 下一步（按序）',
  '1. 等M9/M1M3代理返回 → 汇总fix/delete/uncertain → 应用修复（安全字段a/e/o走evidence/qbank-review/fixes.json清单）',
  '2. 重发M2/M7/M4M8/M5M6四代理（一次最多2个）',
  '3. 截图跑完后视觉审读（子代理分批看图），不确定题截图复制到 C:/Users/Administrator/Desktop/题目审阅-不确定/',
  '4. 总报告：修复数/删除数/不确定清单，更新changelog+HANDOFF，git提交推送',
  '',
  '## 铁律（用户批准的修复授权）',
  '- 小问题直接改（只动a/e/o安全字段；改s必须走迁移登记）',
  '- 大问题删除=排除出白名单（不物理删题），进 docs/人工审阅排除.json',
  '- 不确定的截图留桌面文件夹，绝不硬修',
  '- 验证闭环：任何库改动后必须 node tools/build-whitelist.js + node src/build.js --split site/index.html + 全套单测 + e2e-full',
].join('\n');

const body = JSON.stringify({
  jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: { name: 'save_kb_doc', arguments: {
    topic: '学考冲刺通-题库逐题审阅交接-20261111',
    category: '规范与索引',
    summary: '3982题逐题审阅战役的现场快照与下一步（AI闭环执行中，每小时cron巡检）',
    content,
  } },
});

fetch('https://zhangchong-biji-web.pages.dev/api/mcp/rpc', {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN, accept: 'application/json, text/event-stream' },
  body,
}).then(r => r.text()).then(t => {
  try {
    const j = JSON.parse(t);
    console.log('保存结果:', JSON.stringify(j.result || j.error).slice(0, 400));
  } catch (e) { console.log('原始响应:', t.slice(0, 400)); }
}).catch(e => console.error('FAIL:', e.message));
