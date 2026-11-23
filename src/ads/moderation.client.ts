import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CreateAdInput } from './ad.schema';

export type ModerationResult =
  | { status: 'approved' }
  | { status: 'rejected'; reason: string | null };

@Injectable()
export class ModerationClient {
  private readonly http = axios.create({
    baseURL: process.env.MODERATION_URL ?? 'http://localhost:8787',
    timeout: 3000,
  });

  async check(input: CreateAdInput): Promise<ModerationResult> {
    const { title, description, price, category } = input;
    const response = await this.http.post('/v1/moderation/check', {
      title, description, price, category,
    });

    if (response.status !== 200) {
      throw new Error('A moderação respondeu com status inesperado.');
    }
    if (response.data?.status === 'approved') {
      return { status: 'approved' };
    }
    if (response.data?.status === 'rejected') {
      const reason =
        typeof response.data.rejection_reason === 'string'
          ? response.data.rejection_reason
          : typeof response.data.reason === 'string'
            ? response.data.reason
            : null;
      return { status: 'rejected', reason };
    }
    throw new Error('A moderação devolveu um status desconhecido.');
  }
}
