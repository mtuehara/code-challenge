import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdvertisements1795449600000 implements MigrationInterface {
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
