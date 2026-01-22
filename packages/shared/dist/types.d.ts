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
export declare function calculateSplit({ amountBase, vatRate, irpfRate, }: TaxSplitInput): TaxSplitResult;
//# sourceMappingURL=types.d.ts.map