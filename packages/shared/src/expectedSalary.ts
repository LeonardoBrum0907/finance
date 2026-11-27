/** Salários lançados em até 4 dias um do outro contam como o mesmo pagamento. */
const SALARY_GROUP_DAYS = 4;

export interface SalaryEntry {
  /** AAAA-MM-DD */
  date: string;
  /** Valor positivo recebido. */
  amount: number;
  /** Descrição do lançamento, para separar o 13º do salário do mês. */
  description?: string | null;
}

const THIRTEENTH_PATTERN =
  /DECIMO\s*TERC|\b13\s*[º°OªA]?\s*(SAL|PARC)|\bSAL\w*\s*13\b|\bADIANT\w*\s*(DE\s*|DO\s*)?13\b/;

/**
 * Lançamento do 13º salário. O banco costuma categorizar como "Salário", mas ele
 * não se repete todo mês, então não entra no salário esperado.
 *
 * @example isThirteenthSalary("PAGTO 13O SALARIO") // true
 */
export function isThirteenthSalary(description: string | null | undefined): boolean {
  if (!description) return false;
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return THIRTEENTH_PATTERN.test(normalized);
}

export interface ExpectedSalary {
  /** Valor do próximo salário: o último pagamento (somando os lançamentos dele). */
  amount: number;
  /** Datas em que o salário já entrou na conta (até hoje). */
  receivedDates: string[];
}

function daysApart(a: string, b: string): number {
  return Math.abs(
    Math.round((Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`)) / 86_400_000),
  );
}

/**
 * Valor do salário esperado e as datas em que ele já entrou. O banco pode lançar
 * o salário antes, com data futura (Itaú, 25/11/2026 visto em 24/11): esse
 * lançamento dá o valor, mas não conta como recebido, porque ainda não está no
 * saldo. Antes ele contava, e o ciclo deixava o salário de fora.
 *
 * @example resolveExpectedSalary([{ date: "2026-11-25", amount: 3200 }], "2026-11-24")
 * // { amount: 3200, receivedDates: [] }
 */
export function resolveExpectedSalary(salaries: SalaryEntry[], today: string): ExpectedSalary {
  const monthly = salaries.filter((s) => !isThirteenthSalary(s.description));
  if (monthly.length === 0) return { amount: 0, receivedDates: [] };
  const sorted = [...monthly].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0]!.date;
  const amount = sorted
    .filter((s) => daysApart(s.date, latest) <= SALARY_GROUP_DAYS)
    .reduce((sum, s) => sum + s.amount, 0);
  return {
    amount: Math.round(amount * 100) / 100,
    receivedDates: sorted.filter((s) => s.date <= today).map((s) => s.date),
  };
}
