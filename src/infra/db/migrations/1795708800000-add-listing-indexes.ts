import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingIndexes1795708800000 implements MigrationInterface {
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
