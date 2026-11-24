import 'reflect-metadata';
import { Controller, Get, Module, OnApplicationShutdown } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { connectDatabase } from './infra/db/database';
import { AdsController } from './ads/ads.controller';
import { AdsRepository } from './ads/ads.repository';
import { AdsService } from './ads/ads.service';
import { ModerationClient } from './clients/moderation.client';

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
    AdsRepository,
  ],
})
class AppModule implements OnApplicationShutdown {
  constructor(private readonly database: DataSource) {}

  async onApplicationShutdown() {
    await this.database.destroy();
  }
}

interface AppOptions {
  databaseUrl?: string;
  moderationUrl?: string;
  timeoutMs?: number;
  backoffMs?: number;
}

export function createApp(options: AppOptions = {}) {
  return NestFactory.create({
    module: AppModule,
    providers: [
      { provide: DataSource, useFactory: () => connectDatabase(options.databaseUrl) },
      {
        provide: ModerationClient,
        useFactory: () => new ModerationClient(options.moderationUrl, options.timeoutMs, options.backoffMs),
      },
    ],
  }, { logger: false, abortOnError: false });
}
