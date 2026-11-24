import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere } from 'typeorm';
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

  findPage({
    status,
    category,
    skip,
    take,
  }: {
    status: 'approved' | 'rejected';
    category?: string;
    skip: number;
    take: number;
  }): Promise<[Ad[], number]> {
    const where: FindOptionsWhere<Ad> = { status };
    if (category) where.category = category;

    return this.database.getRepository(Ad).findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip,
      take,
    });
  }
}
