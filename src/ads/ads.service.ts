import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Ad } from './ad.entity';
import { AdResponse, toAdResponse } from './ad.response';
import { CreateAdInput } from './ad.schema';
import { toCents } from './money';
import { ModerationClient } from './moderation.client';

@Injectable()
export class AdsService {
  constructor(
    private readonly database: DataSource,
    private readonly moderation: ModerationClient,
  ) {}

  async create(input: CreateAdInput): Promise<AdResponse> {
    const moderation = await this.moderation.check(input);
    const ad = this.database.getRepository(Ad).create({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      priceCents: toCents(input.price),
      category: input.category,
      images: input.images,
      status: moderation.status,
      rejectionReason: moderation.status === 'rejected' ? moderation.reason : null,
      createdAt: new Date(),
    });
    const saved = await this.database.getRepository(Ad).save(ad);
    return toAdResponse(saved);
  }

  async findById(id: string): Promise<AdResponse> {
    const ad = await this.database.getRepository(Ad).findOneBy({ id });
    if (!ad) throw new NotFoundException('Anúncio inexistente.');
    return toAdResponse(ad);
  }
}
