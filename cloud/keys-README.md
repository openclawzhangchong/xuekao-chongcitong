# 密钥文件说明

- `keys.json`（已 .gitignore）：`classCode` 学生班级码、`teacherKey` 教师密钥
- 已通过 `wrangler secret put` 写入 Worker（CLASS_CODE / TEACHER_KEY），不进代码不进仓库
- 丢失后重设：改 keys.json → 重新 `npx wrangler secret put CLASS_CODE / TEACHER_KEY`
