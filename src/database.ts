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

class AddPriceCents1795622400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE advertisements ADD COLUMN "priceCents" integer');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM advertisements WHERE price * 100 <> ROUND(price * 100)) THEN
          RAISE EXCEPTION 'Existem preços com mais de 2 casas decimais; ajuste antes da migration.';
        END IF;
      END $$;
    `);
    await queryRunner.query('UPDATE advertisements SET "priceCents" = ROUND(price * 100)::integer');
    await queryRunner.query('ALTER TABLE advertisements ALTER COLUMN "priceCents" SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE advertisements
      ADD CONSTRAINT advertisements_price_cents_check CHECK ("priceCents" > 0)
    `);
    await queryRunner.query('ALTER TABLE advertisements DROP CONSTRAINT advertisements_price_check');
    await queryRunner.query('ALTER TABLE advertisements DROP COLUMN price');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE advertisements ADD COLUMN price numeric');
    await queryRunner.query('UPDATE advertisements SET price = "priceCents"::numeric / 100');
    await queryRunner.query('ALTER TABLE advertisements ALTER COLUMN price SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE advertisements
      ADD CONSTRAINT advertisements_price_check CHECK (price > 0)
    `);
    await queryRunner.query('ALTER TABLE advertisements DROP CONSTRAINT advertisements_price_cents_check');
    await queryRunner.query('ALTER TABLE advertisements DROP COLUMN "priceCents"');
  }
}

class AddListingIndexes1795708800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX advertisements_listing_idx
      ON advertisements (status, "createdAt" DESC, id DESC)
      WHERE status = 'approved'
    `);
    await queryRunner.query(`
      CREATE INDEX advertisements_category_listing_idx
      ON advertisements (status, category, "createdAt" DESC, id DESC)
      WHERE status = 'approved'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX advertisements_category_listing_idx');
    await queryRunner.query('DROP INDEX advertisements_listing_idx');
  }
}

export async function connectDatabase(): Promise<DataSource> {
  const database = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL ?? 'postgres://anuncios:local_dev@127.0.0.1:5432/anuncios',
    entities: [Ad],
    migrations: [
      CreateAdvertisements1795449600000,
      AddRejectedStatus1795536000000,
      AddPriceCents1795622400000,
      AddListingIndexes1795708800000,
    ],
    migrationsTableName: 'advertisement_migrations',
    migrationsRun: true,
    synchronize: false,
  });
  return database.initialize();
}
