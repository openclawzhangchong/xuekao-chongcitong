# 缺陷修复：首页「🖥 课堂投屏」点击没反应（用户实测报告）

## 根因（全量绑定审计）
1. **`bigBtnHome` 从未绑定 onclick** —— 模板有按钮，app.js 只绑了答题页 `bigBtn` 与成绩页 `bigBtn2`；首页按钮从第一轮起就是死的
2. 旧绑定是裸 `$().onclick`，元素缺失会中断整个启动脚本（第二轮启动崩溃同款隐患）
3. 课堂大字号样式只在 `@media (orientation:landscape) and (min-width:1024px)` 生效，普通窗口点击后变化不明显，也像没反应

## 修复
- 新增统一 `toggleBig()`：三个按钮（bigBtnHome/bigBtn/bigBtn2）共用，切换 body.big 并同步三按钮 `.on` 点亮态（点击即见反馈）
- 全部改走容错 `on(id,...)` 绑定；启动时 `loadBig()` 从 localStorage 恢复上次投屏状态
- CSS：所有视口都有可见放大（--fs 21px、预估分 72px、卡片/标题放大）；宽屏横屏继续叠加双列大字（题干 34px）
- 状态持久化 `xkc.big`，刷新不丢

## 真实浏览器回归（云端版 1200×800，IAB）
| 用例 | 结果 |
|---|---|
| 点击前 big=false / 按钮 on=false / fs=16px / hero=56px | ✓ |
| 点击后 big=true / on=true / fs=21px / hero=72px / saved=1 | ✓ |
| 刷新后 big=true 且按钮保持点亮 | ✓ |
| 再点一次关闭 big=false / saved=0 | ✓ |
| 答题页 bigBtn 点击：题干 34px、三按钮状态一致 | ✓ |

## 部署
- 重建：BUILD OK 844KB，ID 唯一 / 考纲 150 ✓
- 单测：前端 31 + Worker 20 + 班级版 36 = **87/87 全过**
- 上线：云端主站 https://xuekao.jiuyeke.cn（Worker 版本 5c14eee5…）+ here.now（01M6NYF6…）+ 桌面单文件，三端均含 toggleBig
