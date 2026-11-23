import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { AdsService } from './ads.service';
import {
  CreateAdInput,
  createAdSchema,
  ListAdsQuery,
  listAdsQuerySchema,
} from './ad.schema';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAdSchema)) input: CreateAdInput,
    @Res({ passthrough: true }) response: { location(path: string): void },
  ) {
    const ad = await this.ads.create(input);
    response.location('/ads/' + ad.id);
    return ad;
  }

  @Get()
  list(@Query(new ZodValidationPipe(listAdsQuerySchema)) query: ListAdsQuery) {
    return this.ads.list(query);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ads.findById(id);
  }
}
