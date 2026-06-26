/** Mapeamento das categorias da Pluggy (inglês) para português. */
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  // Nível 1
  Income: "Renda",
  "Loans and Financing": "Empréstimos e financiamento",
  Investments: "Investimentos",
  "Same person transfer": "Transferência mesma titularidade",
  Transfers: "Transferências",
  "Third-party transfers": "Transferências para terceiros",
  "Third-party transfer": "Transferência para terceiros",
  "Legal obligations": "Obrigações legais",
  Services: "Serviços",
  Shopping: "Compras",
  Groceries: "Mercado",
  "Food and drinks": "Alimentação e bebidas",
  Travel: "Viagem",
  Donations: "Doações",
  Gambling: "Apostas e jogos",
  Taxes: "Impostos",
  "Bank fees": "Tarifas bancárias",
  Housing: "Moradia",
  Utilities: "Contas da casa",
  Healthcare: "Saúde",
  Transportation: "Transporte",
  Automotive: "Automotivo",
  Insurance: "Seguros",
  Leisure: "Lazer",
  Other: "Outros",
  Education: "Educação",
  Telecommunications: "Telecomunicações",
  "Wellness and fitness": "Bem-estar e fitness",
  Tickets: "Ingressos",
  "Digital services": "Serviços digitais",
  Financing: "Financiamento",

  // Renda
  Salary: "Salário",
  Retirement: "Aposentadoria",
  "Entrepreneurial activities": "Atividades empresariais",
  "Government aid": "Auxílio governamental",
  "Non-recurring income": "Renda não recorrente",

  // Empréstimos
  "Late payment and overdraft costs": "Custos de atraso e cheque especial",
  "Interests charged": "Juros cobrados",
  Loans: "Empréstimos",
  "Real estate financing": "Financiamento imobiliário",
  "Vehicle Financing": "Financiamento de veículo",
  "Student loan": "Empréstimo estudantil",

  // Investimentos
  "Automatic investment": "Investimento automático",
  "Fixed income": "Renda fixa",
  "Mutual funds": "Fundos de investimento",
  "Variable income": "Renda variável",
  Margin: "Margem",
  "Proceeds interests and dividends": "Juros e dividendos",
  Pension: "Previdência",

  // Transferências mesma titularidade
  "Same person transfer - Cash": "Transferência mesma titularidade - Dinheiro",
  "Same person transfer - PIX": "Transferência mesma titularidade - PIX",
  "Same person transfer - TED": "Transferência mesma titularidade - TED",

  // Transferências
  "Transfer - Bank slip (Boleto)": "Transferência - Boleto",
  "Transfer - Cash": "Transferência - Dinheiro",
  "Transfer - Check": "Transferência - Cheque",
  "Transfer - DOC": "Transferência - DOC",
  "Transfer - Foreign exchange": "Transferência - Câmbio",
  "Transfer - Internal": "Transferência - Interna",
  "Transfer - PIX": "Transferência - PIX",
  "Transfer - TED": "Transferência - TED",
  "Credit card payment": "Pagamento de cartão de crédito",

  // Transferências terceiros
  "Bank slip": "Boleto",
  "Debit card": "Cartão de débito",
  "Debt card": "Cartão de débito",
  DOC: "DOC",
  PIX: "PIX",
  TED: "TED",

  // Obrigações legais
  "Blocked balances": "Saldos bloqueados",
  Alimony: "Pensão alimentícia",

  // Telecom
  Internet: "Internet",
  Mobile: "Celular",
  TV: "TV",

  // Educação
  "Online Courses": "Cursos online",
  University: "Universidade",
  School: "Escola",
  Kindergarten: "Educação infantil",

  // Bem-estar
  "Gyms and fitness centers": "Academias",
  "Sports practice": "Prática esportiva",
  Wellness: "Bem-estar",

  // Ingressos
  "Stadiums and arenas": "Estádios e arenas",
  "Landmarks and museums": "Pontos turísticos e museus",
  "Cinema, theater and concerts": "Cinema, teatro e shows",

  // Compras
  "Online shopping": "Compras online",
  Electronics: "Eletrônicos",
  "Pet supplies and vet": "Pet shop e veterinário",
  Clothing: "Roupas",
  "Kids and toys": "Infantil e brinquedos",
  Bookstore: "Livraria",
  "Sports goods": "Artigos esportivos",
  "Office Supplies": "Material de escritório",
  Cashback: "Cashback",

  // Serviços digitais
  Gaming: "Jogos",
  "Video streaming": "Streaming de vídeo",
  "Music streaming": "Streaming de música",

  // Alimentação
  "Eating out": "Restaurantes",
  Restaurants: "Restaurantes",
  "Food delivery": "Delivery de comida",

  // Viagem
  "Airport and airlines": "Aeroporto e companhias aéreas",
  Accommodation: "Hospedagem",
  "Mileage programs": "Programas de milhagem",
  "Bus tickets": "Passagens de ônibus",

  // Apostas
  Lottery: "Loteria",
  "Online bet": "Aposta online",

  // Impostos
  "Income taxes": "Imposto de renda",
  "Taxes on investments": "Impostos sobre investimentos",
  "Tax on financial operations": "IOF",

  // Tarifas
  "Account fees": "Tarifas de conta",
  "Wire transfer fees and ATM fees": "Tarifas de transferência e caixa eletrônico",
  "Credit card fees": "Tarifas de cartão",

  // Moradia
  Rent: "Aluguel",
  Houseware: "Utilidades domésticas",
  "Urban land and building tax": "IPTU",

  // Contas
  Water: "Água",
  Electricity: "Luz",
  Gas: "Gás",

  // Saúde
  Dentist: "Dentista",
  Pharmacy: "Farmácia",
  Optometry: "Ótica",
  "Hospital clinics and labs": "Hospitais, clínicas e laboratórios",

  // Transporte
  "Taxi and ride-hailing": "Táxi e aplicativos",
  "Public transportation": "Transporte público",
  "Car rental": "Aluguel de carro",
  Bicycle: "Bicicleta",

  // Automotivo
  "Gas stations": "Postos de gasolina",
  "Gas Stations": "Postos de gasolina",
  Parking: "Estacionamento",
  "Tolls and in-vehicle payment": "Pedágios",
  "Vehicle ownership taxes and fees": "IPVA e taxas veiculares",
  "Vehicle maintenance": "Manutenção veicular",
  "Traffic tickets": "Multas de trânsito",

  // Seguros
  "Life insurance": "Seguro de vida",
  "Home Insurance": "Seguro residencial",
  "Health insurance": "Plano de saúde",
  "Vehicle insurance": "Seguro veicular",

  // Sem categoria
  "Sem categoria": "Sem categoria",
  Uncategorized: "Sem categoria",
};

const LOWER_MAP = new Map(
  Object.entries(CATEGORY_TRANSLATIONS).map(([en, pt]) => [en.toLowerCase(), pt]),
);

const PT_VALUES = new Set(Object.values(CATEGORY_TRANSLATIONS));

const PREFIX_RULES: [string, string][] = [
  ["same person transfer - ", "Transferência mesma titularidade - "],
  ["transfer - ", "Transferência - "],
  ["third-party transfer - ", "Transferência para terceiros - "],
  ["third-party transfers - ", "Transferências para terceiros - "],
];

function lookupTranslation(key: string): string | undefined {
  return CATEGORY_TRANSLATIONS[key] ?? LOWER_MAP.get(key.toLowerCase());
}

function applyPrefixRules(value: string): string {
  const lower = value.toLowerCase();
  for (const [prefix, replacement] of PREFIX_RULES) {
    if (lower.startsWith(prefix)) {
      const suffix = value.slice(prefix.length);
      const translatedSuffix = lookupTranslation(suffix) ?? suffix;
      return replacement + translatedSuffix;
    }
  }
  return value;
}

function isOutrosCategory(
  raw: string | null | undefined,
  translated: string | null,
): boolean {
  if (raw == null || !raw.trim()) return true;
  const value = translated ?? raw.trim();
  return value === "Outros" || raw.trim().toLowerCase() === "other";
}

/** Regras por descrição: quando a categoria é genérica, inferir a partir do texto. */
function applyDescriptionCategoryRules(
  category: string | null | undefined,
  translated: string | null,
  description: string | null | undefined,
): string | null {
  if (!description?.trim()) return translated;

  const text = description.toLowerCase();

  if (text.includes("realize")) return "Compras parceladas";
  if (text.includes("encargos refinanciamento")) return "Tarifas do cartão";
  if (text.includes("cursor")) return "Serviços digitais";
  if (text.includes("vaidebus")) return "Transporte";
  if (text.includes("mensalidade") && text.includes("plano do cartão")) {
    return "Tarifas bancárias";
  }
  if (text.includes("disney plus") || text.includes("youtube premium")) {
    return "Serviços digitais";
  }
  if (text.includes("igreja") || text.includes("lagoinha")) {
    return "Igreja";
  }

  if (text.includes("pix") && isOutrosCategory(category, translated)) {
    return "Transferências";
  }

  return translated;
}

/** Traduz categoria da Pluggy para português. Retorna null se a entrada for null/undefined. */
export function translateCategory(
  category: string | null | undefined,
  description?: string | null,
): string | null {
  let translated: string | null = null;

  if (category != null) {
    const trimmed = category.trim();
    if (trimmed) {
      if (PT_VALUES.has(trimmed)) {
        translated = trimmed;
      } else {
        const exact = lookupTranslation(trimmed);
        if (exact) {
          translated = exact;
        } else {
          const withPrefixes = applyPrefixRules(trimmed);
          translated = withPrefixes !== trimmed ? withPrefixes : trimmed;
        }
      }
    }
  }

  return applyDescriptionCategoryRules(category, translated, description);
}

export type CategorySource = "pluggy" | "rules" | "ai" | "user" | "cache";

/** Categorias finas em português (taxonomia Pluggy traduzida). */
export const FINE_GRAINED_CATEGORIES = [
  ...new Set(Object.values(CATEGORY_TRANSLATIONS)),
].sort() as string[];

const FINE_GRAINED_SET = new Set(FINE_GRAINED_CATEGORIES);

/** Categorias genéricas que merecem refinamento por IA. */
const GENERIC_CATEGORIES = new Set([
  "Outros",
  "Sem categoria",
  "Compras",
  "Serviços",
  "Alimentação e bebidas",
  "Transferências",
  "Lazer",
  "Viagem",
  "Educação",
  "Saúde",
  "Transporte",
  "Moradia",
  "Telecomunicações",
  "Investimentos",
  "Renda",
]);

function isGenericPluggyCategory(raw: string | null | undefined): boolean {
  if (raw == null || !raw.trim()) return true;
  const lower = raw.trim().toLowerCase();
  return (
    lower === "other" ||
    lower === "uncategorized" ||
    lower === "sem categoria" ||
    lower === "shopping" ||
    lower === "services" ||
    lower === "food and drinks"
  );
}

/** Indica se a transação deve passar por categorização com IA. */
export function needsAiCategorization(
  pluggyCategory: string | null | undefined,
  resolvedCategory: string | null | undefined,
): boolean {
  if (isGenericPluggyCategory(pluggyCategory)) return true;
  const cat = resolvedCategory?.trim();
  if (!cat || cat === "Outros" || cat === "Sem categoria") return true;
  if (GENERIC_CATEGORIES.has(cat)) return true;
  return false;
}

/** Indica se a categoria resolvida por regras é confiável o suficiente. */
export function hasHighCategoryConfidence(
  pluggyCategory: string | null | undefined,
  resolvedCategory: string | null | undefined,
): boolean {
  return !needsAiCategorization(pluggyCategory, resolvedCategory);
}

/** Categoria efetiva: override do usuário > categoria resolvida > tradução legada. */
export function resolveTransactionCategory(tx: {
  category?: string | null;
  userCategory?: string | null;
  pluggyCategory?: string | null;
  description?: string | null;
}): string | null {
  if (tx.userCategory?.trim()) return tx.userCategory.trim();
  if (tx.category?.trim()) return tx.category.trim();
  return translateCategory(tx.pluggyCategory, tx.description);
}

/** Normaliza descrição/estabelecimento para cache de categorias. */
export function normalizeCategoryPattern(
  description: string,
  merchantName?: string | null,
): string {
  const merchant = merchantName?.trim().toLowerCase();
  if (merchant) return `merchant:${merchant}`;
  const normalized = description
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\d{2}\/\d{2}/g, "")
    .slice(0, 120);
  return `desc:${normalized}`;
}

/** Garante que a categoria está na taxonomia fina; fallback para Outros. */
export function sanitizeFineGrainedCategory(category: string | null | undefined): string {
  const trimmed = category?.trim();
  if (trimmed && FINE_GRAINED_SET.has(trimmed)) return trimmed;
  return "Outros";
}

/** Classifica com regras determinísticas e indica a origem. */
export function classifyWithRules(
  pluggyCategory: string | null | undefined,
  description: string | null | undefined,
): { category: string | null; source: CategorySource } {
  const withoutDescription = translateCategory(pluggyCategory, null);
  const withDescription = translateCategory(pluggyCategory, description);
  if (withoutDescription !== withDescription) {
    return { category: withDescription, source: "rules" };
  }
  if (hasHighCategoryConfidence(pluggyCategory, withDescription)) {
    return { category: withDescription, source: "pluggy" };
  }
  return { category: withDescription, source: "rules" };
}
