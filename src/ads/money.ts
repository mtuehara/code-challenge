const pricePattern = /^(\d+)(?:\.(\d{1,2}))?$/;

export function isPriceWithTwoDecimals(value: number): boolean {
  return pricePattern.test(String(value));
}

export function toCents(price: number): number {
  const match = pricePattern.exec(String(price));
  if (!match) {
    throw new Error('O preço deve ter no máximo 2 casas decimais.');
  }

  const cents = Number(match[1] + (match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error('O preço deve ser maior que zero e caber em centavos inteiros.');
  }
  return cents;
}

export function fromCents(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error('Centavos inválidos.');
  }
  return Number((cents / 100).toFixed(2));
}
