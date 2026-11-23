import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('advertisements')
export class Ad {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  title!: string;

  @Column('text')
  description!: string;

  @Column('bigint', {
    name: 'priceCents',
    transformer: {
      to: (cents: number) => cents,
      from: (cents: string) => Number(cents),
    },
  })
  priceCents!: number;

  @Column('text')
  category!: string;

  @Column('jsonb')
  images!: string[];

  @Column('text')
  status!: 'approved' | 'rejected';

  @Column('text', { nullable: true })
  rejectionReason!: string | null;

  @Column('timestamptz')
  createdAt!: Date;
}
