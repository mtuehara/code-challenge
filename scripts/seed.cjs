'use strict';

const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');
const { toCents } = require('../dist/ads/money');

const defaultDatabaseUrl = 'postgres://anuncios:local_dev@127.0.0.1:5432/anuncios';
const seedPath = path.join(__dirname, '..', 'backend', 'api-mock', 'seed', 'ads.json');

function imagesFor(seedId) {
  // O seed fornecido não tem imagens; usamos placeholders estáveis do Picsum.
  return [`https://picsum.photos/seed/anuncio-${seedId}/640/480`];
}

async function seedDatabase({ databaseUrl = process.env.DATABASE_URL ?? defaultDatabaseUrl } = {}) {
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  if (!Array.isArray(seed.ads) || seed.ads.length === 0) {
    throw new Error('O seed não contém anúncios.');
  }

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    const existing = await db.query('SELECT count(*)::int AS count FROM advertisements');
    if (existing.rows[0].count > 0) {
      throw new Error(
        `A tabela advertisements já tem ${existing.rows[0].count} linhas. ` +
        'O seed só roda em uma base vazia.',
      );
    }

    await db.query('BEGIN');
    try {
      for (const ad of seed.ads) {
        await db.query(
          `INSERT INTO advertisements
             (id, title, description, "priceCents", category, images, status, "rejectionReason", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'approved', NULL, $7)`,
          [
            randomUUID(),
            ad.title,
            ad.description,
            toCents(ad.price),
            ad.category,
            JSON.stringify(imagesFor(ad.id)),
            ad.created_at,
          ],
        );
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    const total = await db.query('SELECT count(*)::int AS count FROM advertisements');
    return total.rows[0].count;
  } finally {
    await db.end();
  }
}

async function main() {
  const total = await seedDatabase();
  console.log(`Seed concluído: ${total} anúncios aprovados.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { seedDatabase };
