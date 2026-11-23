'use strict';

const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../../dist/app');

const testDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';

async function connectTestDatabase() {
  const db = new Client({ connectionString: testDatabaseUrl });
  await db.connect();
  try {
    const result = await db.query('SELECT current_database() AS name');
    if (result.rows[0].name !== 'anuncios_test') {
      throw new Error(`Banco de teste inesperado: ${result.rows[0].name}`);
    }
    return db;
  } catch (error) {
    await db.end();
    throw error;
  }
}

async function startModerationServer(handle) {
  const requests = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw);
    requests.push({ method: req.method, path: req.url, input });

    const response = await handle(input);
    res.writeHead(response.status ?? 200, {
      'content-type': 'application/json',
      connection: 'close',
    });
    res.end(JSON.stringify(response.body));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  let closed = false;
  return {
    requests,
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      if (closed) return;
      closed = true;
      await new Promise(resolve => server.close(resolve));
    },
  };
}

async function startTestApi(moderationUrl) {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.MODERATION_URL = moderationUrl;

  const app = await createApp();
  await app.listen(0, '127.0.0.1');

  let closed = false;
  return {
    app,
    url: await app.getUrl(),
    close: async () => {
      if (closed) return;
      closed = true;
      await app.close();
    },
  };
}

async function postAd(baseUrl, input) {
  const response = await fetch(new URL('/ads', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return { response, body: await response.json() };
}

async function getJson(baseUrl, path) {
  const response = await fetch(new URL(path, baseUrl));
  return { response, body: await response.json() };
}

async function deleteAds(db, ids) {
  if (ids.length === 0) return;
  await db.query('DELETE FROM advertisements WHERE id = ANY($1::uuid[])', [ids]);
}

async function countAds(db) {
  const result = await db.query('SELECT count(*)::int AS count FROM advertisements');
  return result.rows[0].count;
}

module.exports = {
  testDatabaseUrl,
  connectTestDatabase,
  startModerationServer,
  startTestApi,
  postAd,
  getJson,
  deleteAds,
  countAds,
};
