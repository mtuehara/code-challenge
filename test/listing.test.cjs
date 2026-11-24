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
  {
    id: '00000000-0000-4000-8000-000000000005',
    title: 'Anuncio empatado mais novo',
    priceCents: 25000,
    category: 'esportes',
    status: 'approved',
    createdAt: '2026-01-02T10:00:00.000Z',
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

function adResponse(fixture) {
  return {
    id: fixture.id,
    title: fixture.title,
    description: 'Descrição do anúncio de teste.',
    price: fixture.priceCents / 100,
    category: fixture.category,
    images: ['https://example.org/teste.jpg'],
    status: fixture.status,
    rejectionReason: fixture.status === 'rejected' ? 'prohibited_item' : null,
    createdAt: fixture.createdAt,
  };
}

test('GET /ads lista aprovados com paginação, filtro e ordem determinística', async () => {
  const db = await connectTestDatabase();
  const moderation = await startModerationServer(() => ({ body: { status: 'approved' } }));
  let api;

  try {
    // Sobe o app primeiro para garantir que as migrations rodaram antes das fixtures.
    api = await startTestApi(moderation.url);
    await insertFixtures(db);

    // Sem filtro: só aprovados, mais novos primeiro; E e B empatam e desempatam por id DESC.
    const firstPage = await getJson(api.url, '/ads?page=1&pageSize=2');
    assert.equal(firstPage.response.status, 200);
    assert.deepEqual(firstPage.body, {
      data: [adResponse(fixtures[2]), adResponse(fixtures[4])],
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
    assert.equal('priceCents' in firstPage.body.data[0], false);

    const secondPage = await getJson(api.url, '/ads?page=2&pageSize=2');
    assert.equal(secondPage.response.status, 200);
    assert.deepEqual(secondPage.body.data.map(ad => ad.id), [fixtures[1].id, fixtures[0].id]);
    assert.equal(secondPage.body.total, 4);
    assert.equal(secondPage.body.totalPages, 2);

    // Com pageSize=1, o empate E/B precisa aparecer como E (005) antes de B (002).
    const tieBreakIds = [];
    for (let page = 1; page <= 4; page += 1) {
      const result = await getJson(api.url, `/ads?page=${page}&pageSize=1`);
      assert.equal(result.response.status, 200);
      tieBreakIds.push(...result.body.data.map(ad => ad.id));
    }
    assert.deepEqual(tieBreakIds, [
      fixtures[2].id,
      fixtures[4].id,
      fixtures[1].id,
      fixtures[0].id,
    ]);

    // Filtro por categoria, mantendo a mesma ordem.
    const filtered = await getJson(api.url, '/ads?category=esportes&page=1&pageSize=10');
    assert.equal(filtered.response.status, 200);
    assert.deepEqual(filtered.body.data.map(ad => ad.id), [fixtures[4].id, fixtures[1].id, fixtures[0].id]);
    assert.equal(filtered.body.total, 3);
    assert.equal(filtered.body.totalPages, 1);

    // Categoria sem resultados: totalPages 0 e lista vazia.
    const emptyCategory = await getJson(api.url, '/ads?category=colecionaveis');
    assert.equal(emptyCategory.response.status, 200);
    assert.deepEqual(emptyCategory.body.data, []);
    assert.equal(emptyCategory.body.total, 0);
    assert.equal(emptyCategory.body.totalPages, 0);

    // Status explícito: o default continua approved, mas rejected é consultável.
    const rejected = await getJson(api.url, '/ads?status=rejected');
    assert.equal(rejected.response.status, 200);
    assert.deepEqual(rejected.body.data.map(ad => ad.id), [fixtures[3].id]);
    assert.equal(rejected.body.data[0].rejectionReason, 'prohibited_item');
    assert.equal(rejected.body.total, 1);
    assert.equal(rejected.body.totalPages, 1);

    const approvedExplicit = await getJson(api.url, '/ads?status=approved');
    assert.equal(approvedExplicit.response.status, 200);
    assert.deepEqual(
      approvedExplicit.body.data.map(ad => ad.id),
      [fixtures[2].id, fixtures[4].id, fixtures[1].id, fixtures[0].id],
    );
    assert.equal(approvedExplicit.body.total, 4);

    // Padrões de paginação e limite máximo aceito.
    const defaults = await getJson(api.url, '/ads');
    assert.equal(defaults.response.status, 200);
    assert.equal(defaults.body.page, 1);
    assert.equal(defaults.body.pageSize, 20);
    assert.equal(defaults.body.total, 4);

    const maxPageSize = await getJson(api.url, '/ads?pageSize=100');
    assert.equal(maxPageSize.response.status, 200);
    assert.equal(maxPageSize.body.pageSize, 100);

    // Página além do fim devolve lista vazia, não erro.
    const beyond = await getJson(api.url, '/ads?page=3&pageSize=2');
    assert.equal(beyond.response.status, 200);
    assert.deepEqual(beyond.body.data, []);
    assert.equal(beyond.body.total, 4);

    // Queries inválidas não chegam ao banco.
    for (const [query, field] of [
      ['page=0', 'page'],
      ['page=-1', 'page'],
      ['page=abc', 'page'],
      ['page=1.5', 'page'],
      ['page=', 'page'],
      ['pageSize=0', 'pageSize'],
      ['pageSize=-1', 'pageSize'],
      ['pageSize=101', 'pageSize'],
      ['pageSize=1.5', 'pageSize'],
      ['pageSize=', 'pageSize'],
      ['category=inexistente', 'category'],
      ['category=', 'category'],
      ['status=inexistente', 'status'],
      ['status=', 'status'],
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
