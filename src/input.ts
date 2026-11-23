import { BadRequestException, PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const category = z.enum(['eletronicos','moveis','veiculos','imoveis','esportes','colecionaveis']);
export const adSchema = z.object({
  title: z.string().trim().refine(value => {
    const length = [...value].length;
    return length >= 10 && length <= 100;
  }, 'Use entre 10 e 100 caracteres.'),
  description: z.string().trim().min(1),
  price: z.number().positive().multipleOf(0.01).refine(value => Number.isSafeInteger(Math.round(value * 100))),
  category,
  images: z.array(z.url({ protocol: /^https?$/ })).min(1),
});
export type AdInput = z.infer<typeof adSchema>;
const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.int().positive());
export const listSchema = z.object({
  category: category.optional(),
  page: positiveInteger.default(1),
  pageSize: positiveInteger.pipe(z.number().max(100)).default(20),
}).refine(q => Number.isSafeInteger((q.page - 1) * q.pageSize), 'Página fora do limite.');
export type ListInput = z.infer<typeof listSchema>;
export class InputPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(input: unknown) {
    const result = this.schema.safeParse(input);
    if (result.success) return result.data;
    throw new BadRequestException({ error: { code: 'validation_error', message: 'Dados inválidos.',
      details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } });
  }
}
