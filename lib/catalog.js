throw new Error('💥 Файл lib/catalog.js сломан кнопкой хаоса (2026-10-26T15:27:09.635Z)');
const fs = require('fs');
const path = require('path');
const { priceView } = require('./pricing');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getStore() {
  return readJson(path.join(__dirname, '..', 'data', 'store.json'));
}

function getCatalog() {
  const categories = readJson(path.join(__dirname, '..', 'data', 'categories.json'));
  const products = readJson(path.join(__dirname, '..', 'data', 'products.json'));
  const titles = Object.fromEntries(categories.map((c) => [c.id, c.title]));
  return {
    categories,
    products: products.map((p) => ({ ...p, categoryTitle: titles[p.category] || 'Разное', ...priceView(p) })),
  };
}

module.exports = { getStore, getCatalog };
