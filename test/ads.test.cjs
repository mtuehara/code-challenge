const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { Client } = require('pg');
const { createApp } = require('../dist/app');

process.env.DATABASE_URL = 'postgres://anuncios:local_dev@127.0.0.1:5433/anuncios_test';
const db = new Client({ connectionString: process.env.DATABASE_URL });
const ad = { title: 'Bicicleta urbana', description: 'Quadro azul', category: 'esportes', price: 800.25, images: ['https://example.org/bike.jpg'] };
let app, base, server, respond, calls;
async function start() {
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
}
function post(body) {
  return fetch(base + '/ads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
before(async () => {
  await db.connect();
  server = createServer(async (req, res) => {
    let data = '';
    for await (const chunk of req) data += chunk;
    calls.push({ path: req.url, method: req.method, body: JSON.parse(data) });
    respond(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  process.env.MODERATION_URL = 'http://127.0.0.1:' + server.address().port;
  await start();
});
beforeEach(async () => {
  calls = [];
  respond = res => res.end(JSON.stringify({ status: 'approved' }));
  if ((await db.query("SELECT to_regclass('ads') AS tbl")).rows[0].tbl) await db.query('DELETE FROM ads');
});
after(async () => {
  await app?.close();
  server?.closeAllConnections();
  server?.close();
  await db.end();
});
test('aprovado continua consultável depois de reiniciar a API', async () => {
  const res = await post(ad);
  assert.equal(res.status, 201);
  const saved = await res.json();
  assert.deepEqual(calls, [{ method: 'POST', path: '/v1/moderation/check', body: { title: ad.title, description: ad.description, category: ad.category, price: ad.price } }]);
  assert.deepEqual(saved, { ...ad, id: saved.id, createdAt: saved.createdAt, status: 'approved', rejectionReason: null });
  assert.ok(Date.parse(saved.createdAt));
  assert.equal(res.headers.get('location'), '/ads/' + saved.id);
  await app.close();
  await start();
  const detail = await fetch(base + res.headers.get('location'));
  assert.equal(detail.status, 200);
  assert.deepEqual(await detail.json(), saved);
});
test('reprovado preserva o motivo no detalhe', async () => {
  respond = res => res.end(JSON.stringify({ status: 'rejected', reason: 'price_out_of_range' }));
  const result = await post({ ...ad, price: 1 });
  assert.equal(result.status, 201);
  const saved = await result.json();
  assert.equal(saved.status, 'rejected');
  assert.equal(saved.rejectionReason, 'price_out_of_range');
  const detail = await fetch(base + result.headers.get('location'));
  assert.deepEqual(await detail.json(), saved);
});
test('entrada inválida retorna 400 antes de moderar ou salvar', async () => {
  for (const invalid of [{title:'a'.repeat(9)}, {title:'a'.repeat(101)}, {price:0}, {price:-1}, {price:1.234}, {images:[]}, {images:['arquivo']}, {description:' '}, {category:'outra'}]) {
    const res = await post({ ...ad, ...invalid });
    assert.equal(res.status, 400, JSON.stringify(invalid));
    assert.equal((await res.json()).error.code, 'validation_error');
  }
  assert.equal(calls.length, 0);
  assert.equal((await db.query('SELECT count(*) FROM ads')).rows[0].count, '0');
});
test('aceita os dois limites inclusivos do título', async () => {
  for (const size of [10, 100]) assert.equal((await post({ ...ad, title:'a'.repeat(size) })).status, 201);
});
for (const [name, reply, status, code] of [
  ['limite externo', res => { res.writeHead(429, { 'retry-after':'2' }); res.end(); }, 503, 'moderation_unavailable'],
  ['timeout', res => setTimeout(() => res.end('{"status":"approved"}'), 400), 504, 'moderation_timeout'],
  ['queda de conexão', res => res.destroy(), 503, 'moderation_unavailable'],
  ['erro do serviço', res => { res.writeHead(500); res.end(); }, 503, 'moderation_unavailable'],
  ['JSON inválido', res => res.end('{'), 502, 'moderation_protocol_error'],
  ['reprovação sem motivo', res => res.end('{"status":"rejected"}'), 502, 'moderation_protocol_error'],
]) test(name + ' não grava anúncio', async () => {
  process.env.MODERATION_TIMEOUT_MS = '200';
  try {
    respond = reply;
    const result = await post(ad);
    assert.equal(result.status, status);
    assert.equal((await result.json()).error.code, code);
    if (name === 'limite externo') assert.equal(result.headers.get('retry-after'), '2');
    assert.equal((await db.query('SELECT count(*) FROM ads')).rows[0].count, '0');
  } finally { delete process.env.MODERATION_TIMEOUT_MS; }
});
test('filtra categoria e publicação antes de ordenar, contar e paginar', async () => {
  const ids = [];
  for (const category of ['esportes','moveis','esportes','esportes']) {
    const result = await post({ ...ad, category });
    assert.equal(result.status, 201);
    ids.push((await result.json()).id);
  }
  respond = res => res.end('{"status":"rejected","reason":"price_out_of_range"}');
  assert.equal((await post({...ad, price:1})).status, 201);
  for (const [page, expected] of [[1,[ids[3],ids[2]]],[2,[ids[0]]],[3,[]]]) {
    const res = await fetch(base + '/ads?category=esportes&pageSize=2&page=' + page);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.items.map(row => row.id), expected);
    assert.deepEqual({...body,items:[]}, {page,pageSize:2,total:3,totalPages:2,items:[]});
  }
  for (const query of ['page=0','pageSize=101','category=outra']) assert.equal((await fetch(base+'/ads?'+query)).status,400);
});
test('aceita o nome do motivo observado no mock fornecido', async () => {
  respond = res => res.end('{"status":"rejected","rejection_reason":"price_out_of_range"}');
  const result = await post({...ad, price:1});
  assert.equal(result.status,201);
  assert.equal((await result.json()).rejectionReason,'price_out_of_range');
});
