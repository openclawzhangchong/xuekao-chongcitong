/* 交接快照写入 biji-notes 知识库：node tools/biji-handoff.js */
'use strict';
const fs = require('fs');
const path = require('path');
const TOKEN = fs.readFileSync('C:/Users/Administrator/.zcode/cli/config.json', 'utf8').match(/4c735c04[a-f0-9]+/)[0];

const content = [
  '# 学考冲刺通 题库逐题审阅 · 交接快照 2026-11-11 01:20',
  '',
  '## ✅ 全库审读收官（2026-11-11 07:50）',
  '- 终报告：docs/题库逐题审阅总报告-20261111.md；progress.json stage=done',
  '- 修复621处/排除182生效(清单267含失效)/uncertain桌面49张',
  '- 六通道全落地：机器预筛+判断题511+六模块代理3218条+视觉108张+括注清理1021+M9战役',
  '- 五大系统性缺陷已定性（key落位/组合重排/双错误项/解析复制/反转句式），生成器修复建议见总报告第二节',
  '- cron巡检保留（stage=done仅一行确认）；验证链全绿237单测+53e2e',
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
