/** Grupos exibidos no gráfico de categorias do dashboard. */
export const DASHBOARD_CATEGORY_GROUPS = [
  "Alimentação",
  "Transporte",
  "Compras",
  "Assinaturas",
  "Doações",
  "Igreja",
  "Saúde e bem-estar",
  "Contas fixas",
  "Serviços",
  "Transferências",
  "Tarifas e impostos",
  "Outros",
] as const;

export type DashboardCategoryGroup = (typeof DASHBOARD_CATEGORY_GROUPS)[number];

const GROUP_BY_CATEGORY: Record<string, DashboardCategoryGroup> = {
  // Alimentação
  Restaurantes: "Alimentação",
  "Delivery de comida": "Alimentação",
  Mercado: "Alimentação",
  "Alimentação e bebidas": "Alimentação",

  // Transporte
  "Táxi e aplicativos": "Transporte",
  Transporte: "Transporte",
  "Transporte público": "Transporte",
  "Passagens de ônibus": "Transporte",
  "Multas de trânsito": "Transporte",
  Pedágios: "Transporte",
  Estacionamento: "Transporte",
  "Postos de gasolina": "Transporte",
  Automotivo: "Transporte",

  // Compras
  Roupas: "Compras",
  Compras: "Compras",
  "Compras online": "Compras",
  Eletrônicos: "Compras",
  "Artigos esportivos": "Compras",
  "Compras parceladas": "Compras",
  "Infantil e brinquedos": "Compras",
  Livraria: "Compras",
  "Material de escritório": "Compras",

  // Assinaturas
  "Serviços digitais": "Assinaturas",
  Internet: "Assinaturas",
  "Streaming de vídeo": "Assinaturas",
  "Streaming de música": "Assinaturas",
  Jogos: "Assinaturas",
  Educação: "Assinaturas",
  "Cursos online": "Assinaturas",

  // Doações
  Doações: "Doações",
  Igreja: "Igreja",

  // Saúde e bem-estar
  Farmácia: "Saúde e bem-estar",
  "Bem-estar e fitness": "Saúde e bem-estar",
  "Bem-estar": "Saúde e bem-estar",
  Academias: "Saúde e bem-estar",
  Saúde: "Saúde e bem-estar",
  Dentista: "Saúde e bem-estar",
  Ótica: "Saúde e bem-estar",
  "Hospitais, clínicas e laboratórios": "Saúde e bem-estar",

  // Contas fixas
  Telecomunicações: "Contas fixas",
  Moradia: "Contas fixas",
  Aluguel: "Contas fixas",
  "Contas da casa": "Contas fixas",
  Utilidades: "Contas fixas",
  Água: "Contas fixas",
  Luz: "Contas fixas",
  Gás: "Contas fixas",
  IPTU: "Contas fixas",
  Celular: "Contas fixas",
  TV: "Contas fixas",
  Seguros: "Contas fixas",
  "Plano de saúde": "Contas fixas",

  // Serviços
  Serviços: "Serviços",
  Lazer: "Serviços",
  Viagem: "Serviços",

  // Transferências
  Transferências: "Transferências",
  "Transferência - PIX": "Transferências",
  "Transferência - TED": "Transferências",
  "Transferência - DOC": "Transferências",
  "Transferência - Boleto": "Transferências",
  "Transferência - Dinheiro": "Transferências",
  "Transferência - Cheque": "Transferências",
  "Transferência - Câmbio": "Transferências",
  "Transferência - Interna": "Transferências",
  "Transferência mesma titularidade": "Transferências",
  "Transferências para terceiros": "Transferências",
  "Transferência para terceiros": "Transferências",
  PIX: "Transferências",
  TED: "Transferências",
  DOC: "Transferências",
  Boleto: "Transferências",

  // Tarifas e impostos
  "Tarifas bancárias": "Tarifas e impostos",
  "Tarifas do cartão": "Tarifas e impostos",
  "Tarifas de cartão": "Tarifas e impostos",
  "Tarifas de conta": "Tarifas e impostos",
  IOF: "Tarifas e impostos",
  Impostos: "Tarifas e impostos",
  "Imposto de renda": "Tarifas e impostos",
  "Custos de atraso e cheque especial": "Tarifas e impostos",
  "Juros cobrados": "Tarifas e impostos",
};

/** Agrupa categoria resolvida em um rótulo amigável para o gráfico do dashboard. */
export function groupCategoryForDashboard(
  category: string | null | undefined,
  _description?: string | null,
): DashboardCategoryGroup {
  if (!category?.trim()) return "Outros";

  const trimmed = category.trim();

  if (trimmed.startsWith("Transferência mesma titularidade")) {
    return "Transferências";
  }
  if (trimmed.startsWith("Transferência - ") || trimmed.startsWith("Transferência para terceiros")) {
    return "Transferências";
  }

  return GROUP_BY_CATEGORY[trimmed] ?? "Outros";
}
