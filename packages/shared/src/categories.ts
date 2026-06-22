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

/** Traduz categoria da Pluggy para português. Retorna null se a entrada for null/undefined. */
export function translateCategory(category: string | null | undefined): string | null {
  if (category == null) return null;

  const trimmed = category.trim();
  if (!trimmed) return null;
  if (PT_VALUES.has(trimmed)) return trimmed;

  const exact = lookupTranslation(trimmed);
  if (exact) return exact;

  const withPrefixes = applyPrefixRules(trimmed);
  if (withPrefixes !== trimmed) return withPrefixes;

  return trimmed;
}
