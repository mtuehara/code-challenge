import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

@Module({})
class AppModule {}

export function createApp() {
  return NestFactory.create(AppModule, { logger: false });
}
