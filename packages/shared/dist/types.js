export function calculateSplit({ amountBase, vatRate, irpfRate, }) {
    const vatAmount = (amountBase * vatRate) / 100;
    const irpfAmount = (amountBase * irpfRate) / 100;
    const total = amountBase + vatAmount - irpfAmount;
    return { vatAmount, irpfAmount, total };
}
