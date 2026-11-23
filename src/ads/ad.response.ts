import { Ad } from './ad.entity';
import { fromCents } from './money';

export interface AdResponse {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
  status: 'approved' | 'rejected';
  rejectionReason: string | null;
  createdAt: Date;
}

export function toAdResponse(ad: Ad): AdResponse {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    price: fromCents(ad.priceCents),
    category: ad.category,
    images: ad.images,
    status: ad.status,
    rejectionReason: ad.rejectionReason,
    createdAt: ad.createdAt,
  };
}
