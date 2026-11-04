# 安全事件处置记录 2026-11-05

**事件**：cloud/keys.json（班级码+教师密钥）被误提交到公开仓库（.gitignore 追加语句被同链前面失败的 cp 吞掉，未生效）。

**处置（检测到 3 分钟内完成）**：
1. git rm --cached + filter-branch 重写历史 + force push —— 远程/本地 blob 均移除
2. **密钥轮换**：生成新班级码与新教师密钥，wrangler secret put 更新两个 Worker（主站 KV 版 + zcvoice D1 版）
3. 验证：旧班级码 401 / 新班级码 200 / 旧教师 key 403 / 新教师 key 200
4. .gitignore 修复并验证 check-ignore 生效
5. 教训记录：复合命令中 heredoc 依赖前面 && 链，断链即静默跳过——敏感文件操作后必须 git check-ignore 验证

**残余风险**：公开仓库旧 blob 在 CF 缓存/爬虫中可能短期残留，但旧密钥已全部失效，泄漏物无有效价值。
