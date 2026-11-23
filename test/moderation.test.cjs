const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  connectTestDatabase,
  startModerationServer,
  startTestApi,
  postAd,
  deleteAds,
  countAds,
} = require('./support/helpers.cjs');

const baseInput = {
  title: 'Bicicleta urbana',
  description: 'Bicicleta usada em bom estado.',
  price: 800.25,
  category: 'esportes',
  images: ['https://example.org/bicicleta.jpg'],
};

function startScenarioServer() {
  const counts = new Map();
  const moderation = startModerationServer(async input => {
    const count = (counts.get(input.title) ?? 0) + 1;
    counts.set(input.title, count);

    switch (input.title) {
      case 'Retry 500 ok':
        return count === 1
          ? { status: 500, body: { error: 'internal_error' } }
          : { body: { status: 'approved' } };
      case 'Retry 429 ok':
        return count === 1
          ? { status: 429, body: { error: 'too_many_requests' }, headers: { 'Retry-After': '0' } }
          : { body: { status: 'approved' } };
      case 'Always 500 ok':
        return { status: 500, body: { error: 'internal_error' } };
      case 'Timeout ok':
        // Nunca responde: o cliente precisa estourar o timeout e desistir.
        return new Promise(() => {});
      case 'Bad Request ok':
        return { status: 400, body: { error: 'validation_error' } };
      case 'Unknown Status ok':
        return { body: { status: 'unknown' } };
      case 'Rejected ok':
        return { body: { status: 'rejected', rejection_reason: 'prohibited_item' } };
      default:
        return { body: { status: 'approved' } };
    }
  });
  return moderation;
}

test('POST /ads trata retry, 429, 5xx, timeout e 502 sem gravar em falha', async () => {
  const previousTimeout = process.env.MODERATION_TIMEOUT_MS;
  const previousBackoff = process.env.MODERATION_RETRY_BACKOFF_MS;
  process.env.MODERATION_TIMEOUT_MS = '80';
  process.env.MODERATION_RETRY_BACKOFF_MS = '10';

  const db = await connectTestDatabase();
  const moderation = await startScenarioServer();
  const createdAdIds = [];
  let api;

  try {
    api = await startTestApi(moderation.url);
    const attempts = title => moderation.requests.filter(request => request.input.title === title).length;
    const create = async title => {
      const result = await postAd(api.url, { ...baseInput, title });
      if (result.response.status === 201) createdAdIds.push(result.body.id);
      return result;
    };

    // 500 uma vez e 200 depois: a segunda tentativa cria o anúncio.
    const retried = await create('Retry 500 ok');
    assert.equal(retried.response.status, 201);
    assert.equal(retried.body.status, 'approved');
    assert.equal(attempts('Retry 500 ok'), 2);

    // 429 com Retry-After: respeita o header e tenta de novo.
    const rateLimited = await create('Retry 429 ok');
    assert.equal(rateLimited.response.status, 201);
    assert.equal(attempts('Retry 429 ok'), 2);

    // 500 em todas as tentativas: 503 com Retry-After, sem gravar.
    const unavailable = await create('Always 500 ok');
    assert.equal(unavailable.response.status, 503);
    assert.equal(unavailable.response.headers.get('retry-after'), '1');
    assert.equal(attempts('Always 500 ok'), 2);

    // Timeout em todas as tentativas: 503, sem gravar.
    const timedOut = await create('Timeout ok');
    assert.equal(timedOut.response.status, 503);
    assert.equal(timedOut.response.headers.get('retry-after'), '1');
    assert.equal(attempts('Timeout ok'), 2);

    // 400 do serviço externo é resposta inválida do contrato: 502, sem retry.
    const badRequest = await create('Bad Request ok');
    assert.equal(badRequest.response.status, 502);
    assert.equal(attempts('Bad Request ok'), 1);

    // 200 com status desconhecido também é 502, sem retry.
    const unknown = await create('Unknown Status ok');
    assert.equal(unknown.response.status, 502);
    assert.equal(attempts('Unknown Status ok'), 1);

    // Reprovação é uma resposta válida: persiste e não faz retry.
    const rejected = await create('Rejected ok');
    assert.equal(rejected.response.status, 201);
    assert.equal(rejected.body.status, 'rejected');
    assert.equal(rejected.body.rejectionReason, 'prohibited_item');
    assert.equal(attempts('Rejected ok'), 1);

    await deleteAds(db, createdAdIds);
    assert.equal(await countAds(db), 0, 'falhas não podem gravar anúncio');
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, createdAdIds);
    await db.end();
    if (previousTimeout === undefined) delete process.env.MODERATION_TIMEOUT_MS;
    else process.env.MODERATION_TIMEOUT_MS = previousTimeout;
    if (previousBackoff === undefined) delete process.env.MODERATION_RETRY_BACKOFF_MS;
    else process.env.MODERATION_RETRY_BACKOFF_MS = previousBackoff;
  }
});
