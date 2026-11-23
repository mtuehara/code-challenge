import { Injectable } from '@nestjs/common';
import { AdInput } from './input';

@Injectable()
export class ModerationClient {
  async check({ title, description, price, category }: AdInput) {
    const base = process.env.MODERATION_URL ?? 'http://localhost:8787';
    const response = await fetch(new URL('/v1/moderation/check', base), {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, description, price, category }),
    });
    const result = await response.json();
    if (response.ok && result.status === 'rejected' && typeof result.reason === 'string' && result.reason.length > 0) {
      return { status: 'rejected' as const, rejectionReason: result.reason as string };
    }
    if (!response.ok || result.status !== 'approved') throw new Error('Decisão inesperada');
    return { status: 'approved' as const, rejectionReason: null };
  }
}

