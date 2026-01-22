export interface TaxSplitInput {
  amountBase: number;
  vatRate: number;
  irpfRate: number;
}

export interface TaxSplitResult {
  vatAmount: number;
  irpfAmount: number;
  total: number;
}

export function calculateSplit({
  amountBase,
  vatRate,
  irpfRate,
}: TaxSplitInput): TaxSplitResult {
  const vatAmount = (amountBase * vatRate) / 100;
  const irpfAmount = (amountBase * irpfRate) / 100;
  const total = amountBase + vatAmount - irpfAmount;

  return { vatAmount, irpfAmount, total };
}
