import {
  cleanMerchantTitle,
  normalizeBillSignature,
  parseInstallmentMarker,
} from "./recurringBills.js";
import { isCreditAccount, isTransactionOutflow } from "./transactions.js";

export interface CardInstallmentTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  merchantName?: string | null;
  accountId: string;
  accountType?: string | null;
}

export interface CardInstallmentSeries {
  accountId: string;
  signature: string;
  title: string;
  totalInstallments: number;
  installmentAmount: number;
  /** Parcela já lançada no cartão, por número da parcela. */
  slots: Map<number, CardInstallmentTransaction>;
}

const AMOUNT_TOLERANCE_RATIO = 0.01;
const AMOUNT_TOLERANCE_MIN = 0.05;
/** A data de lançamento da parcela varia com o fechamento da fatura. */
const ORIGIN_MONTH_TOLERANCE = 1;

function monthIndex(date: string): number {
  const [y, m] = date.slice(0, 10).split("-").map(Number);
  return y! * 12 + (m! - 1);
}

function stripInstallmentMarker(text: string): string {
  return text
    .replace(/parcela\s*\d{1,2}\s*(?:\/|de)\s*\d{1,2}/gi, " ")
    .replace(/(?<!\d)\d{1,2}\s*\/\s*\d{1,2}(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function originDistance(series: WorkingSeries, originMonth: number): number {
  return Math.min(...series.originMonths.map((month) => Math.abs(month - originMonth)));
}

function amountsClose(a: number, b: number): boolean {
  const tolerance = Math.max(AMOUNT_TOLERANCE_MIN, Math.max(a, b) * AMOUNT_TOLERANCE_RATIO);
  return Math.abs(a - b) <= tolerance;
}

interface WorkingSeries extends CardInstallmentSeries {
  /** Mês da 1ª parcela implícito em cada parcela vista (as datas da Pluggy oscilam). */
  originMonths: number[];
}

/**
 * Agrupa as parcelas "n/m" do cartão em compras parceladas. Duas compras iguais no
 * mesmo dia viram duas séries, porque cada série só aceita uma parcela de cada número.
 */
export function groupCardInstallmentSeries(
  transactions: CardInstallmentTransaction[],
): CardInstallmentSeries[] {
  const series: WorkingSeries[] = [];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    if (!isCreditAccount(tx.accountType)) continue;
    if (!isTransactionOutflow(tx.amount, tx.accountType)) continue;
    const marker = parseInstallmentMarker(tx.description, tx.merchantName);
    if (!marker) continue;

    const signature = normalizeBillSignature(
      stripInstallmentMarker(tx.description),
      tx.merchantName ? stripInstallmentMarker(tx.merchantName) : null,
    );
    if (!signature) continue;

    const amount = Math.abs(tx.amount);
    const originMonth = monthIndex(tx.date) - (marker.current - 1);

    const match = series
      .filter(
        (s) =>
          s.accountId === tx.accountId &&
          s.signature === signature &&
          s.totalInstallments === marker.total &&
          !s.slots.has(marker.current) &&
          originDistance(s, originMonth) <= ORIGIN_MONTH_TOLERANCE &&
          amountsClose(s.installmentAmount, amount),
      )
      .sort((a, b) => originDistance(a, originMonth) - originDistance(b, originMonth))[0];

    if (match) {
      match.slots.set(marker.current, tx);
      match.originMonths.push(originMonth);
      match.installmentAmount = amount;
      continue;
    }

    series.push({
      accountId: tx.accountId,
      signature,
      title: cleanMerchantTitle(stripInstallmentMarker(tx.merchantName?.trim() || tx.description)),
      totalInstallments: marker.total,
      installmentAmount: amount,
      originMonths: [originMonth],
      slots: new Map([[marker.current, tx]]),
    });
  }

  return series.map(({ originMonths: _origins, ...rest }) => rest);
}
