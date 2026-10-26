const statusEl = document.getElementById('status');
const catalogEl = document.getElementById('catalog');
const chaosBtn = document.getElementById('chaos');
const resultEl = document.getElementById('chaos-result');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function getJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function loadStore() {
  try {
    const store = await getJson('/api/store');
    document.getElementById('store-name').textContent = store.name;
    document.getElementById('tagline').textContent = store.tagline;
    document.getElementById('contacts').textContent = `${store.city} · ${store.phone}`;
  } catch (err) {
    document.getElementById('contacts').textContent = `⚠️ Данные магазина недоступны: ${err.message}`;
  }
}

async function loadCatalog() {
  try {
    const { products } = await getJson('/api/products');
    statusEl.className = 'status';
    statusEl.textContent = `В наличии ${products.length} товаров`;
    catalogEl.innerHTML = products.map((p) => `
      <article class="card">
        ${p.discount ? `<span class="badge">−${p.discount}%</span>` : ''}
        <div class="emoji">${escapeHtml(p.emoji)}</div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="meta">${escapeHtml(p.categoryTitle)} · ${escapeHtml(p.material)}</div>
        <div><span class="price">${escapeHtml(p.price)}</span>${p.oldPrice ? `<span class="old">${escapeHtml(p.oldPrice)}</span>` : ''}</div>
      </article>`).join('');
  } catch (err) {
    statusEl.className = 'status error';
    statusEl.textContent = `💥 Каталог сломан: ${err.message}`;
    catalogEl.innerHTML = '';
  }
}

chaosBtn.addEventListener('click', async () => {
  chaosBtn.disabled = true;
  resultEl.hidden = false;
  resultEl.textContent = 'Выбираем жертву…';
  try {
    const data = await getJson('/api/chaos', { method: 'POST' });
    if (data.mode === 'github') {
      resultEl.innerHTML = `💥 Сломан файл <b>${escapeHtml(data.broken)}</b> — коммит в GitHub ` +
        (data.commit ? `(<a href="${escapeHtml(data.commit)}" target="_blank" rel="noopener">смотреть</a>)` : '') +
        '. Vercel пересоберёт сайт примерно через минуту. Теперь чините!';
    } else {
      resultEl.innerHTML = `💥 Сломан файл <b>${escapeHtml(data.broken)}</b> на диске. Теперь чините!`;
      loadStore();
      loadCatalog();
    }
  } catch (err) {
    resultEl.textContent = `Не получилось сломать: ${err.message}`;
  } finally {
    chaosBtn.disabled = false;
  }
});

loadStore();
loadCatalog();
