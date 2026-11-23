import 'reflect-metadata';
import { Controller, Get, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { connectDatabase } from './database';
import { AdsController } from './ads/ads.controller';
import { AdsService } from './ads/ads.service';
import { ModerationClient } from './ads/moderation.client';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [HealthController, AdsController],
  providers: [
    AdsService,
    ModerationClient,
    { provide: DataSource, useFactory: connectDatabase },
  ],
})
class AppModule implements OnApplicationShutdown {
  constructor(private readonly database: DataSource) {}

  async onApplicationShutdown() {
    await this.database.destroy();
  }
}

export function createApp() {
  return NestFactory.create(AppModule, { logger: false, abortOnError: false });
}
