/* 云端 KV 学生档案备份/恢复工具（数据安全保险）
 * ============================================================
 * 背景：云端班级版的学生作答档案只存 Cloudflare KV 一份（绑定 KV，
 *       id 见 cloud/wrangler.toml）。丢了 = 全班一学期记录清零。
 * 本工具：一键把全部 stu:* 档案拉到本地 data/backups/（目录已 gitignore，
 *         学生数据绝不入 git/笔记/截图）；--restore 可整包写回。
 *
 * 用法：
 *   node tools/kv-backup.js                     # 备份 → data/backups/kv-<时间戳>.json
 *   node tools/kv-backup.js --restore <文件>     # 把备份文件里的档案写回 KV
 *   node tools/kv-backup.js --list              # 只列出 KV 里的键（不取内容）
 * 依赖：npx wrangler（zcstudy OAuth 已配置在本机 ~/.wrangler）
 * 建议：每周跑一次备份；大改题库/部署前各跑一次。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLOUD = path.join(ROOT, 'cloud');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

function nsId() {
  const toml = fs.readFileSync(path.join(CLOUD, 'wrangler.toml'), 'utf8');
  const m = toml.match(/kv_namespaces[\s\S]*?id\s*=\s*"([^"]+)"/);
  if (!m) throw new Error('wrangler.toml 里找不到 KV namespace id');
  return m[1];
}
function wrangle(cmd) {
  return execSync('npx wrangler ' + cmd, {
    cwd: CLOUD, maxBuffer: 64 * 1024 * 1024, timeout: 120000,
    env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false' })
  }).toString();
}
function listKeys() {
  const out = wrangle('kv key list --namespace-id=' + NS + ' --remote');
  const names = JSON.parse(out).map(k => k.name).filter(n => n.indexOf('stu:') === 0);
  return names.sort();
}
const NS = nsId();

const argv = process.argv.slice(2);
const restoreIdx = argv.indexOf('--restore');

if (argv.includes('--list')) {
  console.log('KV stu:* 键（共 ' + listKeys().length + ' 个）:');
  listKeys().forEach(n => console.log('  ' + n));
  process.exit(0);
}

if (restoreIdx !== -1) {
  const file = argv[restoreIdx + 1];
  if (!file || !fs.existsSync(file)) throw new Error('用法: node tools/kv-backup.js --restore <备份文件>');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const profiles = doc.profiles || {};
  const sids = Object.keys(profiles);
  if (!sids.length) throw new Error('备份文件里没有 profiles');
  console.log('恢复 ' + sids.length + ' 个档案到 KV（namespace ' + NS.slice(0, 8) + '…）');
  let ok = 0;
  sids.forEach(sid => {
    const tmp = path.join(os.tmpdir(), 'kv-restore-' + sid + '.json');
    fs.writeFileSync(tmp, JSON.stringify(profiles[sid]));
    try {
      wrangle('kv key put --namespace-id=' + NS + ' --remote "' + sid + '" --path "' + tmp + '"');
      ok++;
    } catch (e) {
      console.error('  ✗ ' + sid + ': ' + String(e.message).slice(0, 120));
    }
  });
  console.log('恢复完成: ' + ok + '/' + sids.length);
  process.exit(ok === sids.length ? 0 : 1);
}

/* ---------- 备份 ---------- */
const names = listKeys();
console.log('KV stu:* 键: ' + names.length + ' 个，逐个拉取…');
const profiles = {};
let fail = 0;
names.forEach(n => {
  try {
    const raw = wrangle('kv key get --namespace-id=' + NS + ' --remote "' + n + '"');
    profiles[n] = JSON.parse(raw);
  } catch (e) {
    fail++;
    console.error('  ✗ ' + n + ': ' + String(e.message).slice(0, 100));
  }
});
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13);
const file = path.join(BACKUP_DIR, 'kv-' + stamp + '.json');
fs.writeFileSync(file, JSON.stringify({
  savedAt: new Date().toISOString(),
  namespace: NS,
  count: Object.keys(profiles).length,
  profiles
}, null, 1));
console.log('备份完成 → ' + path.relative(ROOT, file) + '（' + Object.keys(profiles).length + ' 档案' +
  (fail ? '，' + fail + ' 个失败' : '') + '）');
if (fail) process.exit(1);
