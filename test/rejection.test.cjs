const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

const testDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';

const baseInput = {
  title: 'Bicicleta urbana',
  description: 'Bicicleta usada em bom estado.',
  price: 800.25,
  category: 'esportes',
  images: ['https://example.org/bicicleta.jpg'],
};

function startModerationServer(receivedRequests) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    receivedRequests.push({ method: req.method, path: req.url, input });

    let response = { status: 'approved' };
    if (input.title === 'Anuncio com whatsapp') {
      response = { status: 'rejected', rejection_reason: 'contact_info_not_allowed' };
    } else if (input.title === 'Anuncio com motivo documentado') {
      response = { status: 'rejected', reason: 'prohibited_item' };
    }

    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify(response));
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('POST /ads persiste reprovado com motivo e GET devolve o motivo', async () => {
  const moderationRequests = [];
  const createdAdIds = [];
  const db = new Client({ connectionString: testDatabaseUrl });
  let moderation;
  let app;

  try {
    await db.connect();
    const database = await db.query('SELECT current_database() AS name');
    assert.equal(database.rows[0].name, 'anuncios_test');

    moderation = await startModerationServer(moderationRequests);
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.MODERATION_URL = `http://127.0.0.1:${moderation.address().port}`;
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();

    const rejectedInput = {
      ...baseInput,
      title: 'Anuncio com whatsapp',
      description: 'Fale comigo no whatsapp.',
    };
    const creation = await fetch(new URL('/ads', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rejectedInput),
    });
    const createdAd = await creation.json();
    if (creation.status === 201) createdAdIds.push(createdAd.id);

    assert.equal(creation.status, 201);
    assert.equal(createdAd.status, 'rejected');
    assert.equal(createdAd.rejectionReason, 'contact_info_not_allowed');
    assert.equal(creation.headers.get('location'), `/ads/${createdAd.id}`);
    assert.match(createdAd.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    assert.equal(moderationRequests.length, 1);
    assert.deepEqual(moderationRequests[0].input, {
      title: rejectedInput.title,
      description: rejectedInput.description,
      price: rejectedInput.price,
      category: rejectedInput.category,
    });

    const detail = await fetch(new URL(`/ads/${createdAd.id}`, baseUrl));
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), createdAd);

    const persisted = await db.query(
      'SELECT status, "rejectionReason" AS reason FROM advertisements WHERE id = $1',
      [createdAd.id],
    );
    assert.deepEqual(persisted.rows[0], {
      status: 'rejected',
      reason: 'contact_info_not_allowed',
    });

    const documentedInput = { ...baseInput, title: 'Anuncio com motivo documentado' };
    const documentedCreation = await fetch(new URL('/ads', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(documentedInput),
    });
    const documentedAd = await documentedCreation.json();
    if (documentedCreation.status === 201) createdAdIds.push(documentedAd.id);

    assert.equal(documentedCreation.status, 201);
    assert.equal(documentedAd.status, 'rejected');
    assert.equal(documentedAd.rejectionReason, 'prohibited_item');
    assert.equal(moderationRequests.length, 2);
  } finally {
    if (createdAdIds.length > 0) {
      await db.query('DELETE FROM advertisements WHERE id = ANY($1::uuid[])', [createdAdIds]);
    }
    await app?.close();
    if (moderation) await new Promise(resolve => moderation.close(resolve));
    await db.end();
  }
});
