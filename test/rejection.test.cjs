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

function moderate(input) {
  if (input.title === 'Anuncio com whatsapp') {
    return { body: { status: 'rejected', rejection_reason: 'contact_info_not_allowed' } };
  }
  if (input.title === 'Anuncio com motivo documentado') {
    return { body: { status: 'rejected', reason: 'prohibited_item' } };
  }
  return { body: { status: 'approved' } };
}

test('POST /ads persiste reprovado com motivo e GET devolve o motivo', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(moderate);
  const createdAdIds = [];
  let api;

  try {
    // Dado que a moderação reprova e informa o motivo.
    api = await startTestApi(moderation.url);
    const rejectedInput = {
      ...baseInput,
      title: 'Anuncio com whatsapp',
      description: 'Fale comigo no whatsapp.',
    };

    // Quando o anúncio é criado.
    const creation = await postAd(api.url, rejectedInput);
    if (creation.response.status === 201) createdAdIds.push(creation.body.id);
    const createdAd = creation.body;

    // Então a API devolve 201, com status, motivo e Location.
    assert.equal(creation.response.status, 201);
    assert.equal(createdAd.status, 'rejected');
    assert.equal(createdAd.rejectionReason, 'contact_info_not_allowed');
    assert.equal(creation.response.headers.get('location'), `/ads/${createdAd.id}`);
    assert.match(createdAd.id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
    assert.equal(moderation.requests.length, 1);
    assert.deepEqual(moderation.requests[0].input, {
      title: rejectedInput.title,
      description: rejectedInput.description,
      price: rejectedInput.price,
      category: rejectedInput.category,
    });

    // E o detalhe e o banco mantêm o motivo.
    const detail = await getJson(api.url, `/ads/${createdAd.id}`);
    assert.equal(detail.response.status, 200);
    assert.deepEqual(detail.body, createdAd);

    const persisted = await db.query(
      'SELECT status, "rejectionReason" AS reason FROM advertisements WHERE id = $1',
      [createdAd.id],
    );
    assert.deepEqual(persisted.rows[0], {
      status: 'rejected',
      reason: 'contact_info_not_allowed',
    });

    // A chave documentada no API.md (`reason`) também é aceita.
    const documentedInput = { ...baseInput, title: 'Anuncio com motivo documentado' };
    const documentedCreation = await postAd(api.url, documentedInput);
    if (documentedCreation.response.status === 201) createdAdIds.push(documentedCreation.body.id);

    assert.equal(documentedCreation.response.status, 201);
    assert.equal(documentedCreation.body.status, 'rejected');
    assert.equal(documentedCreation.body.rejectionReason, 'prohibited_item');
    assert.equal(moderation.requests.length, 2);
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, createdAdIds);
    await db.end();
  }
});
