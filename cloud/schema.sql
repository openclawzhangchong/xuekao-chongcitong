-- 学考冲刺通云端版 · D1 表结构
CREATE TABLE IF NOT EXISTS students (
  sid     TEXT PRIMARY KEY,
  name    TEXT DEFAULT '',
  profile TEXT DEFAULT '{}',
  updated INTEGER DEFAULT 0
);
