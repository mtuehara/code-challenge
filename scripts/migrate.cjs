'use strict';

const { connectDatabase } = require('../dist/infra/db/database');

async function main() {
  const dataSource = await connectDatabase(process.env.DATABASE_URL, { migrationsRun: true });
  try {
    console.log('Migrations aplicadas com sucesso.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
