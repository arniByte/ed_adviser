/**
 * Русское склонение по числу: plural(1, ['кейс', 'кейса', 'кейсов']) → «кейс»,
 * 3 → «кейса», 11 → «кейсов», 21 → «кейс».
 */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const tens = n % 100
  const units = n % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}

export const CASES: [string, string, string] = ['кейс', 'кейса', 'кейсов']
