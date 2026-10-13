'use client'

import type { DefaultCellComponentProps } from 'payload'
import { formatPrice } from '@/lib/price'

export const PriceCell = ({ cellData }: DefaultCellComponentProps) =>
  typeof cellData === 'number' ? <span>{formatPrice(cellData)}</span> : null
