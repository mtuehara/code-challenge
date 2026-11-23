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

class AddRejectedStatus1795536000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE advertisements DROP CONSTRAINT advertisements_status_check');
    await queryRunner.query(`
      ALTER TABLE advertisements
      ADD CONSTRAINT advertisements_status_check CHECK (status IN ('approved', 'rejected'))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // O rollback só é seguro se não houver anúncios com status rejected.
    await queryRunner.query('ALTER TABLE advertisements DROP CONSTRAINT advertisements_status_check');
    await queryRunner.query(`
      ALTER TABLE advertisements
      ADD CONSTRAINT advertisements_status_check CHECK (status = 'approved')
    `);
  }
}

export async function connectDatabase(): Promise<DataSource> {
  const database = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgres://anuncios:local_dev@127.0.0.1:5432/anuncios',
    entities: [Ad],
    migrations: [CreateAdvertisements1795449600000, AddRejectedStatus1795536000000],
    migrationsTableName: 'advertisement_migrations',
    migrationsRun: true,
    synchronize: false,
  });
  return database.initialize();
}
