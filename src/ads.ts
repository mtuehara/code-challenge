import { Body, Controller, Get, Injectable, NotFoundException, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdEntity } from './database';
import { Query } from '@nestjs/common';
import { AdInput, adSchema, InputPipe, ListInput, listSchema } from './input';
import { ModerationClient } from './moderation';

@Injectable()
export class AdsService {
  constructor(private readonly db: DataSource, private readonly moderation: ModerationClient) {}
  async create(input: AdInput) {
    const decision = await this.moderation.check(input);
    return this.db.getRepository(AdEntity).save({ ...input, ...decision });
  }
  async detail(id: string) {
    const ad = await this.db.getRepository(AdEntity).findOneBy({ id });
    if (!ad) throw new NotFoundException('Anúncio inexistente');
    return ad;
  }
  async list({ category, page, pageSize }: ListInput) {
    const [items, total] = await this.db.getRepository(AdEntity).findAndCount({
      where: { status: 'approved', category },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * pageSize, take: pageSize,
    });
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}
  @Post()
  async create(@Body(new InputPipe(adSchema)) input: AdInput, @Res({ passthrough: true }) res: { location(path: string): void }) {
    const ad = await this.ads.create(input);
    res.location('/ads/' + ad.id);
    return ad;
  }
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) { return this.ads.detail(id); }
  @Get()
  list(@Query(new InputPipe(listSchema)) query: ListInput) { return this.ads.list(query); }
}

