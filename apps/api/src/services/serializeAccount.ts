export function serializeAccount(acc: {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  number: string | null;
  balance: number;
  currencyCode: string;
  creditBrand?: string | null;
  creditLevel?: string | null;
  creditLimit?: number | null;
  availableCreditLimit?: number | null;
  minimumPayment?: number | null;
  balanceCloseDate?: Date | null;
  balanceDueDate?: Date | null;
  billDueDay?: number | null;
  billCloseDay?: number | null;
  closedBillAmount?: number | null;
  closedBillDueDate?: Date | null;
  nextBillAmount?: number | null;
  nextBillDueDate?: Date | null;
  openBillAmount?: number | null;
  openBillDueDate?: Date | null;
}) {
  return {
    id: acc.id,
    name: acc.name,
    type: acc.type,
    subtype: acc.subtype,
    number: acc.number,
    balance: acc.balance,
    currencyCode: acc.currencyCode,
    creditBrand: acc.creditBrand ?? null,
    creditLevel: acc.creditLevel ?? null,
    creditLimit: acc.creditLimit ?? null,
    availableCreditLimit: acc.availableCreditLimit ?? null,
    minimumPayment: acc.minimumPayment ?? null,
    balanceCloseDate: acc.balanceCloseDate?.toISOString() ?? null,
    balanceDueDate: acc.balanceDueDate?.toISOString() ?? null,
    billDueDay: acc.billDueDay ?? null,
    billCloseDay: acc.billCloseDay ?? null,
    closedBillAmount: acc.closedBillAmount ?? null,
    closedBillDueDate: acc.closedBillDueDate?.toISOString() ?? null,
    nextBillAmount: acc.nextBillAmount ?? null,
    nextBillDueDate: acc.nextBillDueDate?.toISOString() ?? null,
    openBillAmount: acc.openBillAmount ?? null,
    openBillDueDate: acc.openBillDueDate?.toISOString() ?? null,
  };
}
