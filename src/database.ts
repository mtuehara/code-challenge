import { DataSource, EntitySchema, MigrationInterface, QueryRunner } from 'typeorm';

import { AdInput } from './input';
interface Ad extends AdInput {
  id: string;
  createdAt: Date;
  status: 'approved' | 'rejected';
  rejectionReason: string | null;
}
export const AdEntity = new EntitySchema<Ad>({
  name: 'Ad', tableName: 'ads',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    title: { type: 'text' }, description: { type: 'text' }, category: { type: 'text' },
    images: { type: 'jsonb' },
    price: { type: 'bigint', name: 'price_cents', transformer: {
      to: (reais: number) => Math.round(reais * 100), from: (cents: string) => Number(cents) / 100
    } },
    status: { type: 'text' }, rejectionReason: { type: 'text', nullable: true, name: 'rejection_reason' },
    createdAt: { type: 'timestamptz', name: 'created_at', createDate: true },
  },
});
class CreateAds1700000000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`CREATE TABLE ads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL,
      category text NOT NULL, images jsonb NOT NULL, price_cents bigint NOT NULL CHECK (price_cents > 0),
      status text NOT NULL, rejection_reason text, created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((status = 'approved' AND rejection_reason IS NULL) OR (status = 'rejected' AND rejection_reason IS NOT NULL))
    )`);
  }
  async down(runner: QueryRunner) { await runner.query('DROP TABLE ads'); }
}
export function connectDatabase() {
  return new DataSource({ type: 'postgres', uuidExtension: 'pgcrypto', installExtensions: false,
    url: process.env.DATABASE_URL ?? 'postgres://anuncios:local_dev@localhost:5432/anuncios',
    entities: [AdEntity], migrations: [CreateAds1700000000000], migrationsRun: true,
  }).initialize();
}

