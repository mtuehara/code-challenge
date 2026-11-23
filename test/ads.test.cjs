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

const adInput = {
  title: 'Bicicleta urbana',
  description: 'Bicicleta usada em bom estado.',
  price: 800.25,
  category: 'esportes',
  images: ['https://example.org/bicicleta.jpg'],
};

test('POST /ads cria um aprovado e GET /ads/{id} o recupera após reiniciar a API', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  const createdAdIds = [];
  let api;

  try {
    // Dado um banco de testes e um serviço externo que aprova o anúncio.
    api = await startTestApi(moderation.url);

    // Quando o cliente cria o anúncio.
    const creation = await postAd(api.url, adInput);
    if (creation.response.status === 201) createdAdIds.push(creation.body.id);

    // Então recebe o recurso aprovado e o endereço para consultá-lo.
    assert.equal(creation.response.status, 201);
    const createdAd = creation.body;
    const { id, createdAt, ...adData } = createdAd;
    assert.match(id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    assert.ok(Number.isFinite(Date.parse(createdAt)));
    assert.deepEqual(adData, {
      ...adInput,
      status: 'approved',
      rejectionReason: null,
    });

    const detailPath = creation.response.headers.get('location');
    assert.equal(detailPath, `/ads/${id}`);

    // O serviço externo recebe apenas os campos definidos no contrato dele.
    assert.equal(moderation.requests.length, 1);
    const [request] = moderation.requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.path, '/v1/moderation/check');
    assert.deepEqual(request.input, {
      title: adInput.title,
      description: adInput.description,
      price: adInput.price,
      category: adInput.category,
    });

    // Após o reinício, o GET recupera o mesmo anúncio sem moderar de novo.
    await api.close();
    api = await startTestApi(moderation.url);

    const detail = await getJson(api.url, detailPath);
    assert.equal(detail.response.status, 200);
    assert.deepEqual(detail.body, createdAd);
    assert.equal(moderation.requests.length, 1);
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, createdAdIds);
    await db.end();
  }
});
