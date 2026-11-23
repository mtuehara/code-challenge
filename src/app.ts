import 'reflect-metadata';
import { Module, OnApplicationShutdown } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdsController, AdsService } from './ads';
import { connectDatabase } from './database';
import { ModerationClient } from './moderation';
import { NestFactory } from '@nestjs/core';

@Module({ controllers: [AdsController], providers: [AdsService, ModerationClient, { provide: DataSource, useFactory: connectDatabase }] })
class AppModule implements OnApplicationShutdown {
  constructor(private readonly db: DataSource) {}
  async onApplicationShutdown() { await this.db.destroy(); }
}

export function createApp() {
  return NestFactory.create(AppModule, { logger: false });
}
