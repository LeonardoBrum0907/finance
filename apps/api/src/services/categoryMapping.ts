import { prisma } from "../prisma.js";
import { normalizeCategoryPattern, sanitizeFineGrainedCategory } from "@finance/shared";

export async function loadCategoryMappingMap(
  userId: string,
): Promise<Map<string, string>> {
  const rows = await prisma.categoryMapping.findMany({
    where: { userId },
    select: { pattern: true, category: true },
  });
  return new Map(rows.map((row) => [row.pattern, row.category]));
}

export async function upsertCategoryMapping(
  userId: string,
  description: string,
  category: string,
  source: "user" | "ai",
  merchantName?: string | null,
): Promise<void> {
  const pattern = normalizeCategoryPattern(description, merchantName);
  const safeCategory = sanitizeFineGrainedCategory(category);

  await prisma.categoryMapping.upsert({
    where: { userId_pattern: { userId, pattern } },
    create: {
      userId,
      pattern,
      category: safeCategory,
      source,
      hitCount: 1,
    },
    update: {
      category: safeCategory,
      source,
      hitCount: { increment: 1 },
    },
  });
}

export function lookupCategoryMapping(
  mappings: Map<string, string>,
  description: string,
  merchantName?: string | null,
): string | null {
  const merchantPattern = normalizeCategoryPattern(description, merchantName);
  const descOnlyPattern = normalizeCategoryPattern(description, null);

  return mappings.get(merchantPattern) ?? mappings.get(descOnlyPattern) ?? null;
}
