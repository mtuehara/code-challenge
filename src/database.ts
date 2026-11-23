import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { Ad } from './ads/ad.entity';

class CreateAdvertisements1795449600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE advertisements (
        id uuid PRIMARY KEY,
        title text NOT NULL,
        description text NOT NULL,
        price numeric NOT NULL CHECK (price > 0),
        category text NOT NULL,
        images jsonb NOT NULL,
        status text NOT NULL CHECK (status = 'approved'),
        "rejectionReason" text,
        "createdAt" timestamptz NOT NULL
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE advertisements');
  }
}

export async function connectDatabase(): Promise<DataSource> {
  const database = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgres://anuncios:local_dev@127.0.0.1:5432/anuncios',
    entities: [Ad],
    migrations: [CreateAdvertisements1795449600000],
    migrationsTableName: 'advertisement_migrations',
    migrationsRun: true,
    synchronize: false,
  });
  return database.initialize();
}
