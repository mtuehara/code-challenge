import { Injectable } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { CreateAdInput } from './ad.schema';

export type ModerationResult =
  | { status: 'approved' }
  | { status: 'rejected'; reason: string | null };

export class ModerationUnavailableError extends Error {
  readonly retryAfterSeconds = 1;
}

export class ModerationProtocolError extends Error {}

const MAX_ATTEMPTS = 2;

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

@Injectable()
export class ModerationClient {
  private readonly http = axios.create({
    baseURL: process.env.MODERATION_URL ?? 'http://localhost:8787',
    timeout: Number(process.env.MODERATION_TIMEOUT_MS ?? 3000),
  });

  private readonly backoffMs = Number(process.env.MODERATION_RETRY_BACKOFF_MS ?? 200);

  async check(input: CreateAdInput): Promise<ModerationResult> {
    const { title, description, price, category } = input;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.http.post('/v1/moderation/check', {
          title, description, price, category,
        });
        return this.parseResponse(response);
      } catch (error) {
        if (!axios.isAxiosError(error)) throw error;

        const status = error.response?.status;
        if (status === 400) {
          throw new ModerationProtocolError('A moderação recusou o payload enviado.');
        }

        const retryable = status === undefined || status === 429 || status >= 500;
        if (!retryable) {
          throw new ModerationProtocolError('A moderação devolveu um status inesperado.');
        }

        if (attempt < MAX_ATTEMPTS) {
          await sleep(this.retryDelay(error, attempt));
          continue;
        }
        throw new ModerationUnavailableError('A moderação está indisponível.');
      }
    }

    throw new ModerationUnavailableError('A moderação está indisponível.');
  }

  private parseResponse(response: AxiosResponse): ModerationResult {
    if (response.status !== 200) {
      throw new ModerationProtocolError('A moderação devolveu um status inesperado.');
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
    throw new ModerationProtocolError('A moderação devolveu um status desconhecido.');
  }

  private retryDelay(error: AxiosError, attempt: number): number {
    if (error.response?.status === 429) {
      const header = error.response.headers?.['retry-after'];
      const retryAfter = Number(header);
      if (Number.isFinite(retryAfter) && retryAfter >= 0) {
        return Math.min(retryAfter * 1000, 1000);
      }
    }
    return this.backoffMs * attempt;
  }
}
