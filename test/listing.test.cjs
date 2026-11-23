const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  connectTestDatabase,
  startModerationServer,
  startTestApi,
  getJson,
  deleteAds,
} = require('./support/helpers.cjs');

const fixtures = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Anuncio antigo de esportes',
    priceCents: 10000,
    category: 'esportes',
    status: 'approved',
    createdAt: '2026-01-01T10:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Anuncio intermediario de esportes',
    priceCents: 20000,
    category: 'esportes',
    status: 'approved',
    createdAt: '2026-01-02T10:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Anuncio novo de moveis',
    priceCents: 30000,
    category: 'moveis',
    status: 'approved',
    createdAt: '2026-01-03T10:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    title: 'Anuncio reprovado',
    priceCents: 40000,
    category: 'esportes',
    status: 'rejected',
    createdAt: '2026-01-04T10:00:00.000Z',
  },
];

async function insertFixtures(db) {
  for (const fixture of fixtures) {
    await db.query(
      `INSERT INTO advertisements
         (id, title, description, "priceCents", category, images, status, "rejectionReason", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        fixture.id,
        fixture.title,
        'Descrição do anúncio de teste.',
        fixture.priceCents,
        fixture.category,
        JSON.stringify(['https://example.org/teste.jpg']),
        fixture.status,
        fixture.status === 'rejected' ? 'prohibited_item' : null,
        fixture.createdAt,
      ],
    );
  }
}

test('GET /ads lista aprovados com paginação, filtro e ordem determinística', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  let api;

  try {
    await insertFixtures(db);
    api = await startTestApi(moderation.url);

    // Sem filtro: só aprovados, mais novos primeiro.
    const firstPage = await getJson(api.url, '/ads?page=1&pageSize=2');
    assert.equal(firstPage.response.status, 200);
    assert.deepEqual(firstPage.body, {
      data: [
        {
          id: fixtures[2].id,
          title: fixtures[2].title,
          description: 'Descrição do anúncio de teste.',
          price: 300,
          category: 'moveis',
          images: ['https://example.org/teste.jpg'],
          status: 'approved',
          rejectionReason: null,
          createdAt: fixtures[2].createdAt,
        },
        {
          id: fixtures[1].id,
          title: fixtures[1].title,
          description: 'Descrição do anúncio de teste.',
          price: 200,
          category: 'esportes',
          images: ['https://example.org/teste.jpg'],
          status: 'approved',
          rejectionReason: null,
          createdAt: fixtures[1].createdAt,
        },
      ],
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    assert.equal('priceCents' in firstPage.body.data[0], false);

    const secondPage = await getJson(api.url, '/ads?page=2&pageSize=2');
    assert.equal(secondPage.response.status, 200);
    assert.deepEqual(secondPage.body.data.map(ad => ad.id), [fixtures[0].id]);
    assert.equal(secondPage.body.total, 3);
    assert.equal(secondPage.body.totalPages, 2);

    // Filtro por categoria, mantendo a mesma ordem.
    const filtered = await getJson(api.url, '/ads?category=esportes&page=1&pageSize=10');
    assert.equal(filtered.response.status, 200);
    assert.deepEqual(filtered.body.data.map(ad => ad.id), [fixtures[1].id, fixtures[0].id]);
    assert.equal(filtered.body.total, 2);
    assert.equal(filtered.body.totalPages, 1);

    // Padrões de paginação.
    const defaults = await getJson(api.url, '/ads');
    assert.equal(defaults.response.status, 200);
    assert.equal(defaults.body.page, 1);
    assert.equal(defaults.body.pageSize, 20);
    assert.equal(defaults.body.total, 3);

    // Página além do fim devolve lista vazia, não erro.
    const beyond = await getJson(api.url, '/ads?page=3&pageSize=2');
    assert.equal(beyond.response.status, 200);
    assert.deepEqual(beyond.body.data, []);
    assert.equal(beyond.body.total, 3);

    // Query inválida não chega ao banco.
    for (const [query, field] of [
      ['page=0', 'page'],
      ['page=abc', 'page'],
      ['pageSize=101', 'pageSize'],
      ['category=inexistente', 'category'],
    ]) {
      const invalid = await getJson(api.url, `/ads?${query}`);
      assert.equal(invalid.response.status, 400, query);
      assert.equal(invalid.body.message, 'Dados inválidos.', query);
      assert.ok(
        invalid.body.details.some(detail => detail.field === field),
        `${query}: campo ${field}`,
      );
    }

    assert.equal(moderation.requests.length, 0, 'GET /ads não deve chamar a moderação');
  } finally {
    await api?.close();
    await moderation.close();
    await deleteAds(db, fixtures.map(fixture => fixture.id));
    await db.end();
  }
});
