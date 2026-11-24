import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectedStatus1795536000000 implements MigrationInterface {
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
