import { BaseError } from './base';

export class ModerationUnavailableError extends BaseError {
  readonly code = 'moderation_unavailable';
  constructor(message: string, readonly retryAfter?: string, options?: ErrorOptions) { super(message, options); }
}
