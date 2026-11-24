const { test } = require('node:test');
const assert = require('node:assert/strict');
const { connectTestDatabase, startTestApi, getJson } = require('./support/helpers.cjs');

test('a suíte usa o banco anuncios_test', async () => {
  const db = await connectTestDatabase();
  try {
    const result = await db.query('SELECT current_database() AS name');
    assert.equal(result.rows[0].name, 'anuncios_test');
  } finally {
    await db.end();
  }
});

test('GET /health retorna 200 com status ok', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousModerationUrl = process.env.MODERATION_URL;
  let api;
  try {
    // A moderação não é usada neste teste; a URL só satisfaz a configuração do cliente.
    api = await startTestApi('http://127.0.0.1:1');

    const { response, body } = await getJson(api.url, '/health');

    assert.equal(process.env.DATABASE_URL === previousDatabaseUrl, true, 'A inicialização alterou DATABASE_URL');
    assert.equal(process.env.MODERATION_URL === previousModerationUrl, true, 'A inicialização alterou MODERATION_URL');
    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok' });
  } finally {
    await api?.close();
  }
});
