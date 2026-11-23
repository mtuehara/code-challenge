import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface CreateAdInput {
  title: string;
  description: string;
  price: number;
  category: string;
  images: string[];
}

@Entity('advertisements')
export class Ad {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('text')
  title!: string;

  @Column('text')
  description!: string;

  @Column('numeric', {
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  price!: number;

  @Column('text')
  category!: string;

  @Column('jsonb')
  images!: string[];

  @Column('text')
  status!: 'approved';

  @Column('text', { nullable: true })
  rejectionReason!: string | null;

  @Column('timestamptz')
  createdAt!: Date;
}
