const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  testDatabaseUrl,
  connectTestDatabase,
  startModerationServer,
  startTestApi,
  getJson,
  countAds,
} = require('./support/helpers.cjs');
const { seedDatabase } = require('../scripts/seed.cjs');

test('seed popula 57 anúncios, aparece na API e recusa a segunda execução', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  let api;

  try {
    // Sobe a API primeiro: as migrations criam a tabela antes do seed.
    api = await startTestApi(moderation.url);
    await db.query('DELETE FROM advertisements');
    assert.equal(await countAds(db), 0);

    // O seed roda em base vazia e grava os 57 anúncios.
    const inserted = await seedDatabase({ databaseUrl: testDatabaseUrl });
    assert.equal(inserted, 57);
    assert.equal(await countAds(db), 57);

    // A API observa o resultado: listagem paginada, imagens e categorias do seed.
    const all = await getJson(api.url, '/ads?pageSize=100');
    assert.equal(all.response.status, 200);
    assert.equal(all.body.total, 57);
    assert.equal(all.body.data.length, 57);
    assert.ok(all.body.data.every(ad => ad.status === 'approved' && ad.images.length > 0));
    assert.equal('priceCents' in all.body.data[0], false);

    const vehicles = await getJson(api.url, '/ads?category=veiculos');
    assert.equal(vehicles.response.status, 200);
    assert.equal(vehicles.body.total, 10);

    // A segunda execução falha e não altera os dados.
    await assert.rejects(
      () => seedDatabase({ databaseUrl: testDatabaseUrl }),
      /já tem 57 linhas/,
    );
    assert.equal(await countAds(db), 57);
    assert.equal(moderation.requests.length, 0);
  } finally {
    await db.query('DELETE FROM advertisements');
    await api?.close();
    await moderation.close();
    await db.end();
  }
});
