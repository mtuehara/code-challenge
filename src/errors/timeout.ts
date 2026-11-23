import { BaseError } from './base';

export class ModerationTimeoutError extends BaseError {
  readonly code = 'moderation_timeout';
}
