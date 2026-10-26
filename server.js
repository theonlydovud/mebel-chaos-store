const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');

const app = express();
app.use(express.json());

// Files the chaos button is allowed to break.
const BREAKABLE = [
  'data/store.json',
  'data/categories.json',
  'data/products.json',
  'lib/format.js',
  'lib/pricing.js',
  'lib/catalog.js',
  'views/index.html',
  'views/app.js',
];

// Literal paths so Vercel's file tracer bundles every file.
const FILE_PATHS = {
  'data/store.json': path.join(__dirname, 'data', 'store.json'),
  'data/categories.json': path.join(__dirname, 'data', 'categories.json'),
  'data/products.json': path.join(__dirname, 'data', 'products.json'),
  'lib/format.js': path.join(__dirname, 'lib', 'format.js'),
  'lib/pricing.js': path.join(__dirname, 'lib', 'pricing.js'),
  'lib/catalog.js': path.join(__dirname, 'lib', 'catalog.js'),
  'views/index.html': path.join(__dirname, 'views', 'index.html'),
  'views/app.js': path.join(__dirname, 'views', 'app.js'),
};

// Server modules are re-required on every call so a broken file shows up without a restart.
function clearLibCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}lib${path.sep}`)) delete require.cache[key];
  }
}

const LIB_LOADERS = {
  'lib/format.js': () => require('./lib/format'),
  'lib/pricing.js': () => require('./lib/pricing'),
  'lib/catalog.js': () => require('./lib/catalog'),
};

function loadCatalog() {
  clearLibCache();
  return require('./lib/catalog');
}

function checkFile(file) {
  const content = fs.readFileSync(FILE_PATHS[file], 'utf8');
  if (file.endsWith('.json')) {
    JSON.parse(content);
  } else if (file.startsWith('lib/')) {
    clearLibCache();
    LIB_LOADERS[file]();
  } else if (file.endsWith('.js')) {
    new vm.Script(content, { filename: file });
  } else if (file.endsWith('.html')) {
    if (!content.includes('data-store-ok')) throw new Error('Разметка страницы повреждена');
  }
}

function runHealthChecks() {
  const checks = BREAKABLE.map((file) => {
    try {
      checkFile(file);
      return { file, ok: true };
    } catch (err) {
      return { file, ok: false, error: String(err.message || err).split('\n')[0] };
    }
  });
  return { ok: checks.every((c) => c.ok), checks };
}

function corrupt(file, content) {
  const stamp = new Date().toISOString();
  if (file.endsWith('.json')) {
    return `💥 CORRUPTED BY CHAOS BUTTON ${stamp} 💥\n${content}`;
  }
  if (file.startsWith('lib/')) {
    return `throw new Error('💥 Файл ${file} сломан кнопкой хаоса (${stamp})');\n${content}`;
  }
  if (file.endsWith('.js')) {
    return `💥💥💥 CHAOS ${stamp} (((\n${content}`;
  }
  return content
    .replace('data-store-ok', 'data-store-broken')
    .replace('<main', `<!-- 💥 CHAOS ${stamp} 💥 <main`);
}

function githubRepo() {
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`;
  }
  return 'theonlydovud/mebel-chaos-store';
}

async function breakViaGithub(file) {
  const repo = githubRepo();
  const branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/${file}`;
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'mebel-chaos-store',
  };

  const current = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (!current.ok) throw new Error(`GitHub GET ${file}: ${current.status} ${await current.text()}`);
  const meta = await current.json();
  const content = Buffer.from(meta.content, 'base64').toString('utf8');

  const update = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `chaos: break ${file}`,
      content: Buffer.from(corrupt(file, content), 'utf8').toString('base64'),
      sha: meta.sha,
      branch,
    }),
  });
  if (!update.ok) throw new Error(`GitHub PUT ${file}: ${update.status} ${await update.text()}`);
  const result = await update.json();
  return { mode: 'github', repo, branch, commit: result.commit && result.commit.html_url };
}

function breakLocally(file) {
  const target = FILE_PATHS[file];
  fs.writeFileSync(target, corrupt(file, fs.readFileSync(target, 'utf8')));
  return { mode: 'local' };
}

app.get('/api/health', (req, res) => {
  const health = runHealthChecks();
  res.status(health.ok ? 200 : 503).json({
    status: health.ok ? 'ok' : 'broken',
    time: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    checks: health.checks,
  });
});

app.get('/api/store', (req, res) => {
  res.json(loadCatalog().getStore());
});

app.get('/api/products', (req, res) => {
  res.json(loadCatalog().getCatalog());
});

app.post('/api/chaos', async (req, res) => {
  const healthy = runHealthChecks().checks.filter((c) => c.ok).map((c) => c.file);
  if (healthy.length === 0) {
    return res.status(409).json({ error: 'Всё уже сломано. Пора чинить!' });
  }
  const file = healthy[Math.floor(Math.random() * healthy.length)];
  try {
    const result = process.env.GITHUB_TOKEN ? await breakViaGithub(file) : breakLocally(file);
    res.json({ broken: file, ...result });
  } catch (err) {
    const readOnly = err.code === 'EROFS' || err.code === 'EACCES';
    res.status(500).json({
      error: readOnly
        ? 'Файловая система только для чтения. Добавьте переменную окружения GITHUB_TOKEN, чтобы ломать файлы через GitHub.'
        : String(err.message || err),
      file,
    });
  }
});

app.get('/app.js', (req, res) => {
  res.type('application/javascript').send(fs.readFileSync(path.join(__dirname, 'views', 'app.js'), 'utf8'));
});

app.get('/styles.css', (req, res) => {
  res.type('text/css').send(fs.readFileSync(path.join(__dirname, 'views', 'styles.css'), 'utf8'));
});

app.get('/', (req, res) => {
  res.type('html').send(fs.readFileSync(path.join(__dirname, 'views', 'index.html'), 'utf8'));
});

// Express errors (e.g. a broken lib file) come back as JSON so the page can show them.
app.use((err, req, res, next) => {
  res.status(500).json({ error: String(err.message || err) });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Mebel store on http://localhost:${port}`));
}

module.exports = app;
