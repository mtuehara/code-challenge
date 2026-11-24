import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Ad } from './ad.entity';
import { AdResponse, ListAdsResponse, toAdResponse } from './ad.response';
import { AdsRepository } from './ads.repository';
import { CreateAdInput, ListAdsQuery } from './ad.schema';
import { toCents } from '../utils/money';
import { ModerationClient } from '../clients/moderation.client';

@Injectable()
export class AdsService {
  constructor(
    private readonly ads: AdsRepository,
    private readonly moderation: ModerationClient,
  ) {}

  async create(input: CreateAdInput): Promise<AdResponse> {
    const moderation = await this.moderation.check(input);
    const ad = this.ads.create({
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
    const saved = await this.ads.save(ad);
    return toAdResponse(saved);
  }

  async findById(id: string): Promise<AdResponse> {
    const ad = await this.ads.findById(id);
    if (!ad) throw new NotFoundException('Anúncio inexistente.');
    return toAdResponse(ad);
  }

  async list(query: ListAdsQuery): Promise<ListAdsResponse> {
    const skip = (query.page - 1) * query.pageSize;
    const [ads, total] = await this.ads.findPage({
      status: query.status ?? 'approved',
      category: query.category,
      skip,
      take: query.pageSize,
    });

    return {
      data: ads.map(toAdResponse),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
