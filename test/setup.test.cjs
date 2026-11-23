const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

test('Nest atende HTTP e o banco isolado aceita consultas', async () => {
  const db = new Client({ connectionString: 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test' });
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const response = await fetch(new URL('/health', await app.getUrl()));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    await db.connect();
    const result = await db.query('SELECT current_database() AS name');
    assert.equal(result.rows[0].name, 'anuncios_test');
  } finally {
    await app.close();
    await db.end();
  }
});
