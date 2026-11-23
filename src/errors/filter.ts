import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { BaseError } from './base';
import { ModerationUnavailableError } from './unavailable';
import { ModerationTimeoutError } from './timeout';

@Catch(BaseError, HttpException)
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: BaseError | HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'error' in body && typeof body.error === 'object') {
        return res.status(error.getStatus()).json(body);
      }
      const code = error.getStatus() === 404 ? 'not_found' : 'validation_error';
      return res.status(error.getStatus()).json({ error: { code, message: error.message } });
    }
    let status = 502;
    if (error instanceof ModerationTimeoutError) status = 504;
    if (error instanceof ModerationUnavailableError) {
      status = 503;
      if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
    }
    res.status(status).json({ error: { code: error.code, message: error.message } });
  }
}
