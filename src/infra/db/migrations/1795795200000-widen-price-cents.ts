import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenPriceCents1795795200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE advertisements ALTER COLUMN "priceCents" TYPE bigint');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE advertisements ALTER COLUMN "priceCents" TYPE integer');
  }
}
