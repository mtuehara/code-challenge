import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Ad } from './ad.entity';

@Injectable()
export class AdsRepository {
  constructor(private readonly database: DataSource) {}

  create(data: Partial<Ad>): Ad {
    return this.database.getRepository(Ad).create(data);
  }

  save(ad: Ad): Promise<Ad> {
    return this.database.getRepository(Ad).save(ad);
  }

  findById(id: string): Promise<Ad | null> {
    return this.database.getRepository(Ad).findOneBy({ id });
  }
}
