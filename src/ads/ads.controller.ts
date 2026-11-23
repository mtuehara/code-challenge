import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { AdsService } from './ads.service';
import { CreateAdInput } from './ad.entity';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Post()
  async create(
    @Body() input: CreateAdInput,
    @Res({ passthrough: true }) response: { location(path: string): void },
  ) {
    const ad = await this.ads.create(input);
    response.location('/ads/' + ad.id);
    return ad;
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.ads.findById(id);
  }
}
