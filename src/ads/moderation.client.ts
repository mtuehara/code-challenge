import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CreateAdInput } from './ad.entity';

@Injectable()
export class ModerationClient {
  private readonly http = axios.create({
    baseURL: process.env.MODERATION_URL ?? 'http://localhost:8787',
    timeout: 3000,
  });

  async approve(input: CreateAdInput): Promise<void> {
    const { title, description, price, category } = input;
    const response = await this.http.post('/v1/moderation/check', {
      title, description, price, category,
    });
    if (response.status !== 200 || response.data?.status !== 'approved') {
      throw new Error('A moderação não confirmou a aprovação do anúncio.');
    }
  }
}
