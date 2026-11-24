import { DataSource } from 'typeorm';
import { Ad } from '../../ads/ad.entity';
import { CreateAdvertisements1795449600000 } from './migrations/1795449600000-create-advertisements';
import { AddRejectedStatus1795536000000 } from './migrations/1795536000000-add-rejected-status';
import { AddPriceCents1795622400000 } from './migrations/1795622400000-add-price-cents';
import { AddListingIndexes1795708800000 } from './migrations/1795708800000-add-listing-indexes';
import { WidenPriceCents1795795200000 } from './migrations/1795795200000-widen-price-cents';

export interface DatabaseOptions {
  migrationsRun?: boolean;
}

export async function connectDatabase(
  url = process.env.DATABASE_URL ?? 'postgres://anuncios:local_dev@127.0.0.1:5432/anuncios',
  { migrationsRun = false }: DatabaseOptions = {},
): Promise<DataSource> {
  const database = new DataSource({
    type: 'postgres',
    url,
    entities: [Ad],
    migrations: [
      CreateAdvertisements1795449600000,
      AddRejectedStatus1795536000000,
      AddPriceCents1795622400000,
      AddListingIndexes1795708800000,
      WidenPriceCents1795795200000,
    ],
    migrationsTableName: 'advertisement_migrations',
    migrationsRun,
    synchronize: false,
  });
  return database.initialize();
}
