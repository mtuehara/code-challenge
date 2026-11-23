import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details = result.error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Dados inválidos.',
      details,
    });
  }
}
