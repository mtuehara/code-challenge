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

function withoutField(field) {
  const input = { ...baseInput };
  delete input[field];
  return input;
}

const withoutTitle = withoutField('title');
const withoutDescription = withoutField('description');
const withoutImages = withoutField('images');

const invalidCases = [
  ['title com 9 caracteres', { ...baseInput, title: '123456789' }, 'title'],
  ['title com 101 caracteres', { ...baseInput, title: 'x'.repeat(101) }, 'title'],
  ['title em branco', { ...baseInput, title: '   ' }, 'title'],
  ['title ausente', withoutTitle, 'title'],
  ['description em branco', { ...baseInput, description: '   ' }, 'description'],
  ['description ausente', withoutDescription, 'description'],
  ['price zero', { ...baseInput, price: 0 }, 'price'],
  ['price negativo', { ...baseInput, price: -1 }, 'price'],
  ['price como texto', { ...baseInput, price: '800.25' }, 'price'],
  ['price com 3 casas', { ...baseInput, price: 800.255 }, 'price'],
  ['images vazio', { ...baseInput, images: [] }, 'images'],
  ['images como texto', { ...baseInput, images: 'https://example.org/a.jpg' }, 'images'],
  ['images com item vazio', { ...baseInput, images: [''] }, 'images'],
  ['images ausente', withoutImages, 'images'],
  ['category inexistente', { ...baseInput, category: 'inexistente' }, 'category'],
];

test('POST /ads rejeita payload inválido com 400 sem chamar a moderação', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  const createdAdIds = [];
  let api;

  try {
    api = await startTestApi(moderation.url);

    // Dado um payload inválido, quando o cliente tenta criar, então recebe 400.
    for (const [name, input, field] of invalidCases) {
      const { response, body } = await postAd(api.url, input);
      if (response.status === 201) createdAdIds.push(body.id);

      assert.equal(response.status, 400, `${name}: status HTTP`);
      assert.equal(body.statusCode, 400, `${name}: statusCode`);
      assert.equal(body.error, 'Bad Request', `${name}: error`);
      assert.equal(body.message, 'Dados inválidos.', `${name}: message`);
      assert.ok(Array.isArray(body.details), `${name}: details`);
      assert.ok(
        body.details.some(detail => detail.field === field || detail.field.startsWith(`${field}.`)),
        `${name}: campo ${field} nos detalhes`,
      );
    }

    // A validação acontece antes da moderação e antes da persistência.
    assert.equal(moderation.requests.length, 0, 'moderação não deve ser chamada para payload inválido');
    assert.equal(await countAds(db), 0, 'nenhuma linha deve ser gravada para payload inválido');

    // O caso válido continua funcionando, com o título trimado.
    const validInput = { ...baseInput, title: '  Bicicleta urbana  ' };
    const creation = await postAd(api.url, validInput);
    if (creation.response.status === 201) createdAdIds.push(creation.body.id);

    assert.equal(creation.response.status, 201);
    assert.equal(creation.body.title, 'Bicicleta urbana');
    assert.equal(creation.body.price, 800.25);
    assert.equal(moderation.requests.length, 1);
    assert.equal(moderation.requests[0].input.title, 'Bicicleta urbana');

    const persisted = await db.query('SELECT title FROM advertisements WHERE id = $1', [creation.body.id]);
    assert.equal(persisted.rows[0].title, 'Bicicleta urbana');

    // Os limites de 10 e 100 caracteres são aceitos.
    for (const boundaryTitle of ['1234567890', 'x'.repeat(100)]) {
      const boundary = await postAd(api.url, { ...baseInput, title: boundaryTitle });
      if (boundary.response.status === 201) createdAdIds.push(boundary.body.id);
      assert.equal(boundary.response.status, 201, `title com ${boundaryTitle.length} caracteres deve ser aceito`);
      assert.equal(boundary.body.title, boundaryTitle);
    }
    assert.equal(moderation.requests.length, 3);
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, createdAdIds);
    await db.end();
  }
});
