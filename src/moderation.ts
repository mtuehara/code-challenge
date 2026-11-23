import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AdInput } from './input';
import { BaseError } from './errors/base';
import { ModerationTimeoutError } from './errors/timeout';
import { ModerationProtocolError } from './errors/protocol';
import { ModerationUnavailableError } from './errors/unavailable';

const reason = z.string().trim().min(1);
const decision = z.union([
  z.object({ status: z.literal('approved') }),
  z.object({ status: z.literal('rejected'), reason }),
  z.object({ status: z.literal('rejected'), rejection_reason: reason }).transform(value => ({
    status: value.status, reason: value.rejection_reason,
  })),
]);

@Injectable()
export class ModerationClient {
  async check({ title, description, price, category }: AdInput) {
    const url = new URL('/v1/moderation/check', process.env.MODERATION_URL ?? 'http://localhost:8787');
    const signal = AbortSignal.timeout(Number(process.env.MODERATION_TIMEOUT_MS ?? 3000));
    try {
      const response = await fetch(url, { method: 'POST', signal, redirect: 'error',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title, description, price, category }) });
      if (response.status !== 200) {
        await response.body?.cancel();
        if (response.status === 429 || response.status >= 500) {
          const retry = response.headers.get('retry-after');
          throw new ModerationUnavailableError('Moderação indisponível.', retry && /^\d+$/.test(retry) ? retry : undefined);
        }
        throw new ModerationProtocolError('Resposta inesperada da moderação.');
      }
      const result = decision.safeParse(await response.json());
      if (!result.success) throw new ModerationProtocolError('Decisão inválida da moderação.');
      return { status: result.data.status, rejectionReason: result.data.status === 'rejected' ? result.data.reason : null };
    } catch (cause) {
      if (cause instanceof BaseError) throw cause;
      if (signal.aborted) throw new ModerationTimeoutError('Tempo limite da moderação.', { cause });
      if (cause instanceof SyntaxError) throw new ModerationProtocolError('JSON inválido da moderação.', { cause });
      throw new ModerationUnavailableError('Falha de conexão com a moderação.', undefined, { cause });
    }
  }
}
