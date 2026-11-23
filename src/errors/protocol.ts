import { BaseError } from './base';

export class ModerationProtocolError extends BaseError {
  readonly code = 'moderation_protocol_error';
}
