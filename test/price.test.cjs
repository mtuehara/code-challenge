const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  connectTestDatabase,
  startModerationServer,
  startTestApi,
  postAd,
  getJson,
  deleteAds,
} = require('./support/helpers.cjs');

const baseInput = {
  title: 'Bicicleta urbana',
  description: 'Bicicleta usada em bom estado.',
  price: 800.25,
  category: 'esportes',
  images: ['https://example.org/bicicleta.jpg'],
};

test('POST /ads grava centavos no banco e devolve reais na API', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  const createdAdIds = [];
  let api;

  try {
    api = await startTestApi(moderation.url);

    // Dado o preço 800.25, quando o anúncio é criado.
    const creation = await postAd(api.url, baseInput);
    if (creation.response.status === 201) createdAdIds.push(creation.body.id);
    const createdAd = creation.body;

    // Então a resposta continua em reais e não expõe o campo interno.
    assert.equal(creation.response.status, 201);
    assert.equal(createdAd.price, 800.25);
    assert.equal(typeof createdAd.price, 'number');
    assert.equal('priceCents' in createdAd, false);

    // E o banco guarda o inteiro em centavos.
    const persisted = await db.query(
      'SELECT "priceCents" FROM advertisements WHERE id = $1',
      [createdAd.id],
    );
    assert.equal(persisted.rows[0].priceCents, '80025');

    // O detalhe também devolve reais.
    const detail = await getJson(api.url, `/ads/${createdAd.id}`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.price, 800.25);

    // Uma casa decimal e um centavo continuam corretos.
    const tenCents = await postAd(api.url, { ...baseInput, title: 'Anuncio de dez centavos', price: 0.1 });
    if (tenCents.response.status === 201) createdAdIds.push(tenCents.body.id);
    assert.equal(tenCents.response.status, 201);
    assert.equal(tenCents.body.price, 0.1);

    const tenCentsRow = await db.query(
      'SELECT "priceCents" FROM advertisements WHERE id = $1',
      [tenCents.body.id],
    );
    assert.equal(tenCentsRow.rows[0].priceCents, '10');

    // Mais de duas casas continuam recusadas pela validação.
    const invalid = await postAd(api.url, { ...baseInput, title: 'Preco com tres casas', price: 800.255 });
    assert.equal(invalid.response.status, 400);
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, createdAdIds);
    await db.end();
  }
});

test('POST e GET preservam o preço alto e o motivo de reprovação', async () => {
  const moderation = await startModerationServer(() => ({
    body: { status: 'rejected', reason: 'price_out_of_range' },
  }));
  const db = await connectTestDatabase();
  const ids = [];
  let api;
  try {
    api = await startTestApi(moderation.url);
    const price = 21474836.48;
    const { response, body } = await postAd(api.url, { ...baseInput, price });
    if (body.id) ids.push(body.id);
    assert.equal(response.status, 201);
    const detail = await getJson(api.url, '/ads/' + body.id);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.body.price, price);
    assert.equal(detail.body.status, 'rejected');
    assert.equal(detail.body.rejectionReason, 'price_out_of_range');
    const invalid = await postAd(api.url, { ...baseInput, price: 100000000000000 });
    if (invalid.body.id) ids.push(invalid.body.id);
    assert.equal(invalid.response.status, 400);
    assert.equal(moderation.requests.length, 1);
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, ids);
    await db.end();
  }
});
