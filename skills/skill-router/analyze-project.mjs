// skill-router — SessionStart analyzer.
// Emits a compact, project-aware skill index for Claude once per session.
// Reads the filesystem only. Never throws out. Always exits 0 so it cannot block a session.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const OUT = [];
const log = (s = '') => OUT.push(s);

function parseFrontmatter(text) {
  const out = {};
  const m = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/.exec(text);
  if (!m) return out;
  const re = /^([A-Za-z0-9_-]+):\s*(.*)$/gm;
  let mm;
  while ((mm = re.exec(m[1]))) {
    let v = mm[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[mm[1]] = v;
  }
  return out;
}

function findRoot(start) {
  const rootMarkers = ['.git', 'CLAUDE.md', 'AGENTS.md'];
  let dir = resolve(start);
  for (let i = 0; i < 40; i++) {
    if (rootMarkers.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

function collectSkills(dirs) {
  const seen = new Set();
  const skills = [];
  for (const base of dirs) {
    let entries = [];
    try { entries = readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = join(base, e.name);
      let isDir = e.isDirectory();
      if (e.isSymbolicLink()) {
        try { isDir = statSync(full).isDirectory(); } catch { isDir = false; }
      }
      if (!isDir) continue;
      let text;
      try { text = readFileSync(join(full, 'SKILL.md'), 'utf8'); } catch { continue; }
      const fm = parseFrontmatter(text);
      const name = fm.name || e.name;
      if (seen.has(name)) continue;
      seen.add(name);
      skills.push({
        name,
        description: (fm.description || '').replace(/\s+/g, ' ').trim(),
        slashOnly: /^(true|yes)$/i.test(String(fm['disable-model-invocation'] || '').trim()),
      });
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

function readStdin() {
  return new Promise((res) => {
    if (process.stdin.isTTY) return res('');
    let data = '';
    let done = false;
    const finish = () => { if (!done) { done = true; res(data); } };
    const timer = setTimeout(finish, 1500);
    try {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (c) => { data += c; if (data.length > 1e6) finish(); });
      process.stdin.on('end', () => { clearTimeout(timer); finish(); });
      process.stdin.on('error', () => { clearTimeout(timer); finish(); });
      process.stdin.resume();
    } catch {
      clearTimeout(timer);
      finish();
    }
  });
}

async function resolveCwd() {
  const env = process.env.CLAUDE_PROJECT_DIR || process.env.CLAUDE_WORKING_DIR;
  if (env && existsSync(env)) return env;
  try {
    const raw = await readStdin();
    if (raw && raw.trim()) {
      const input = JSON.parse(raw);
      if (input && typeof input.cwd === 'string' && input.cwd) return input.cwd;
    }
  } catch { /* not json / no stdin */ }
  return process.cwd();
}

async function main() {
  const cwd = await resolveCwd();
  const root = findRoot(cwd);
  const has = (p) => existsSync(join(root, p));
  const markers = [
    'CLAUDE.md', 'AGENTS.md', 'CONTEXT.md', 'CONTEXT-MAP.md',
    'docs/agents/issue-tracker.md', 'docs/agents/triage-labels.md', 'docs/agents/domain.md',
    'package.json', 'pnpm-workspace.yaml', '.git',
  ];
  const present = markers.filter(has);
  const trackerReady = has('docs/agents/issue-tracker.md');
  const triageReady = has('docs/agents/triage-labels.md');

  const skills = collectSkills([
    join(homedir(), '.claude', 'skills'),
    join(root, '.claude', 'skills'),
  ]);

  log('== skill-router · подсказки по скиллам (SessionStart) ==');
  log('');
  log(`Проект: ${root}`);
  log(`Маркеры: ${present.length ? present.join(', ') : '— нет маркеров проекта'}`);
  log(`issue-tracker настроен: ${trackerReady ? 'да' : 'нет'} · triage-labels: ${triageReady ? 'да' : 'нет'}`);
  log('');
  log(`Установленные скиллы (${skills.length}):`);
  for (const s of skills) {
    const d = s.description.length > 110 ? s.description.slice(0, 107) + '…' : s.description;
    log(`  - ${s.name}${s.slashOnly ? ' [только /слэш]' : ''} — ${d || '(без описания)'}`);
  }
  log('');
  log('Правила маршрутизации (полная логика — Skill(skill-router) при сомнении):');
  log('  1. Задача явно ложится на скилл → предложи одной строкой + причина, жди «да». Сам не запускай.');
  log('  2. Несколько кандидатов: разрыв очевиден → топ-1 + альтернатива в оговорке; близко → 2–3 варианта с ценой.');
  log('  3. Предусловие не выполнено (issue-tracker / triage-labels / скилл не установлен) → предложи setup, не основной скилл.');
  log('  4. Только предлагать, никогда не запускать сам: code-review, security-review, скиллы [только /слэш], всё что пишет во внешние системы (issue, комментарии, коммиты, пуши).');
  log('  5. Ничего не подходит → работай обычным способом, про скиллы молчи. Не притягивай скилл за уши.');
  log('  6. docx / pdf / xlsx / pptx / dataviz и подобные — не вмешивайся, их берёт штатная маршрутизация Claude.');

  process.stdout.write(OUT.join('\n') + '\n');
  process.exit(0);
}

main().catch(() => process.exit(0));
