import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPriceCents1795622400000 implements MigrationInterface {
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
