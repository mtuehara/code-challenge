const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

const testDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';

test('a conexão da suíte aponta para o banco anuncios_test', async () => {
  const db = new Client({ connectionString: testDatabaseUrl });
  try {
    await db.connect();
    const result = await db.query('SELECT current_database() AS name');
    assert.equal(result.rows[0].name, 'anuncios_test');
  } finally {
    await db.end();
  }
});

test('GET /health retorna 200 com status ok', async () => {
  process.env.DATABASE_URL = testDatabaseUrl;
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(new URL('/health', await app.getUrl()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await app.close();
  }
});
