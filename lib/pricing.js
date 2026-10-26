const { formatRub } = require('./format');

function finalPrice(product) {
  const discount = Number(product.discount) || 0;
  return product.price * (1 - discount / 100);
}

function priceView(product) {
  return {
    price: formatRub(finalPrice(product)),
    oldPrice: product.discount ? formatRub(product.price) : null,
    discount: product.discount || 0,
  };
}

module.exports = { finalPrice, priceView };
