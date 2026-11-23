import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Ad } from './ad.entity';
import { CreateAdInput } from './ad.schema';
import { ModerationClient } from './moderation.client';

@Injectable()
export class AdsService {
  constructor(
    private readonly database: DataSource,
    private readonly moderation: ModerationClient,
  ) {}

  async create(input: CreateAdInput): Promise<Ad> {
    await this.moderation.approve(input);
    const ad = this.database.getRepository(Ad).create({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      price: input.price,
      category: input.category,
      images: input.images,
      status: 'approved',
      rejectionReason: null,
      createdAt: new Date(),
    });
    return this.database.getRepository(Ad).save(ad);
  }

  async findById(id: string): Promise<Ad> {
    const ad = await this.database.getRepository(Ad).findOneBy({ id });
    if (!ad) throw new NotFoundException('Anúncio inexistente.');
    return ad;
  }
}
