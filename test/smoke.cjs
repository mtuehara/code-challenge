// Execute com a API e o mock reais iniciados pelo Compose.
const assert = require('node:assert/strict');
const base = 'http://localhost:3000';
async function create(input) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(base+'/ads', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    if (![503, 504].includes(res.status) || attempt >= 4) return res;
    const seconds = Math.max(1, Number(res.headers.get('retry-after')) || 1);
    console.log('Falha temporária no smoke:', res.status, 'nova tentativa em', seconds, 's');
    await res.body.cancel();
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }
}
async function run() {
  for (const [price, status, reason] of [[800.25, 'approved', null], [1, 'rejected', 'price_out_of_range']]) {
    const input = { title: 'Bicicleta urbana', description: 'Quadro azul', price, category: 'esportes', images: ['https://example.org/bike.jpg'] };
    const res = await create(input);
    const saved = await res.json();
    assert.equal(res.status,201,JSON.stringify(saved));
    assert.equal(saved.status,status);
    assert.equal(saved.rejectionReason,reason);
    assert.equal(res.headers.get('location'),'/ads/'+saved.id);
    const detail = await fetch(base + res.headers.get('location'));
    assert.equal(detail.status,200);
    assert.deepEqual(await detail.json(),saved);
    const page = await fetch(base+'/ads?category=esportes&pageSize=1');
    assert.equal(page.status,200);
    assert.ok((await page.json()).items.every(item=>item.status==='approved' && item.category==='esportes'));
    console.log('POST 201, GET 200, catálogo 200:', saved.id, status, reason);
  }
}
run().catch(error=>{ console.error(error); process.exitCode=1; });
