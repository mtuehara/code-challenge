const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

const testDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';

async function startApprovalServer(receivedRequests) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    receivedRequests.push({ method: req.method, path: req.url, body });
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ status: 'approved' }));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

test('POST /ads cria um aprovado e GET /ads/{id} o recupera após reiniciar a API', async () => {
  const adInput = {
    title: 'Bicicleta urbana',
    description: 'Bicicleta usada em bom estado.',
    price: 800.25,
    category: 'esportes',
    images: ['https://example.org/bicicleta.jpg'],
  };
  const moderationRequests = [];
  const db = new Client({ connectionString: testDatabaseUrl });

  let moderation;
  let app;
  let createdAdId;
  try {
    // Dado um banco de testes e um serviço externo que aprova o anúncio.
    await db.connect();
    const database = await db.query('SELECT current_database() AS name');
    assert.equal(database.rows[0].name, 'anuncios_test');

    moderation = await startApprovalServer(moderationRequests);
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.MODERATION_URL = `http://127.0.0.1:${moderation.address().port}`;
    app = await createApp();
    await app.listen(0, '127.0.0.1');

    // Quando o cliente cria o anúncio.
    const creation = await fetch(new URL('/ads', await app.getUrl()), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(adInput),
    });

    // Então recebe o recurso aprovado e o endereço para consultá-lo.
    assert.equal(creation.status, 201);
    const createdAd = await creation.json();
    const { id, createdAt, ...adData } = createdAd;
    assert.match(id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    createdAdId = id;
    assert.ok(Number.isFinite(Date.parse(createdAt)));
    assert.deepEqual(adData, {
      ...adInput,
      status: 'approved',
      rejectionReason: null,
    });
    const detailPath = creation.headers.get('location');
    assert.equal(detailPath, `/ads/${id}`);

    // O serviço externo recebe apenas os campos definidos no contrato dele.
    assert.equal(moderationRequests.length, 1);
    const [request] = moderationRequests;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/moderation/check');
    assert.deepEqual(JSON.parse(request.body), {
      title: adInput.title,
      description: adInput.description,
      price: adInput.price,
      category: adInput.category,
    });

    // Após o reinício, o GET recupera o mesmo anúncio sem moderar de novo.
    await app.close();
    app = undefined;
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    const detail = await fetch(new URL(detailPath, await app.getUrl()));
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), createdAd);
    assert.equal(moderationRequests.length, 1);
  } finally {
    await app?.close();
    if (moderation) await new Promise(resolve => moderation.close(resolve));
    if (createdAdId) {
      await db.query('DELETE FROM advertisements WHERE id = $1', [createdAdId]);
    }
    await db.end();
  }
});
