import {
  BadGatewayException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AdsService } from './ads.service';
import {
  CreateAdInput,
  createAdSchema,
  ListAdsQuery,
  listAdsQuerySchema,
} from './ad.schema';
import { ModerationProtocolError, ModerationUnavailableError } from '../clients/moderation.client';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createAdSchema)) input: CreateAdInput,
    @Res({ passthrough: true }) response: {
      location(path: string): void;
      setHeader(name: string, value: string): void;
    },
  ) {
    try {
      const ad = await this.ads.create(input);
      response.location('/ads/' + ad.id);
      return ad;
    } catch (error) {
      if (error instanceof ModerationUnavailableError) {
        response.setHeader('Retry-After', String(error.retryAfterSeconds));
        throw new ServiceUnavailableException('Serviço de moderação indisponível. Tente novamente.');
      }
      if (error instanceof ModerationProtocolError) {
        throw new BadGatewayException('O serviço de moderação devolveu uma resposta inválida.');
      }
      throw error;
    }
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
