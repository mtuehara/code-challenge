import { z } from 'zod';
import { isPriceWithTwoDecimals } from '../utils/money';

export const AD_CATEGORIES = [
  'eletronicos',
  'moveis',
  'veiculos',
  'imoveis',
  'esportes',
  'colecionaveis',
] as const;

export const AD_STATUSES = ['approved', 'rejected'] as const;

const priceSchema = z
  .number({ message: 'O preço deve ser um número.' })
  .finite({ message: 'O preço deve ser um número finito.' })
  .positive({ message: 'O preço deve ser maior que zero.' })
  .max(Number.MAX_SAFE_INTEGER / 100, { message: 'O preço excede a precisão suportada em centavos.' })
  .refine(isPriceWithTwoDecimals, {
    message: 'O preço deve ter no máximo 2 casas decimais.',
  });

export const createAdSchema = z.object({
  title: z
    .string({ message: 'O título é obrigatório.' })
    .trim()
    .min(10, { message: 'O título deve ter entre 10 e 100 caracteres.' })
    .max(100, { message: 'O título deve ter entre 10 e 100 caracteres.' }),
  description: z
    .string({ message: 'A descrição é obrigatória.' })
    .trim()
    .min(1, { message: 'A descrição é obrigatória.' }),
  price: priceSchema,
  category: z.enum(AD_CATEGORIES, { message: 'Categoria inválida.' }),
  images: z
    .array(
      z.string({ message: 'Cada imagem deve ser uma URL ou texto.' })
        .trim()
        .min(1, { message: 'Cada imagem deve ser uma URL ou texto não vazio.' }),
      { message: 'As imagens devem ser uma lista.' },
    )
    .min(1, { message: 'Envie ao menos uma imagem.' }),
});

export type CreateAdInput = z.infer<typeof createAdSchema>;

const pageSchema = z.coerce
  .number({ message: 'A página deve ser um número inteiro maior ou igual a 1.' })
  .int({ message: 'A página deve ser um número inteiro maior ou igual a 1.' })
  .min(1, { message: 'A página deve ser um número inteiro maior ou igual a 1.' })
  .default(1);

const pageSizeSchema = z.coerce
  .number({ message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.' })
  .int({ message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.' })
  .min(1, { message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.' })
  .max(100, { message: 'O tamanho da página deve ser um número inteiro entre 1 e 100.' })
  .default(20);

export const listAdsQuerySchema = z.object({
  page: pageSchema,
  pageSize: pageSizeSchema,
  category: z.enum(AD_CATEGORIES, { message: 'Categoria inválida.' }).optional(),
  status: z.enum(AD_STATUSES, { message: 'Status inválido.' }).default('approved'),
});

export type ListAdsQuery = z.infer<typeof listAdsQuerySchema>;
