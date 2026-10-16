// Configurações Dinâmicas Gerenciadas pelo Bot do Telegram (Admin Supremo)
export interface DynamicConfig {
  whatsappNumber: string;
  managerName: string;
  managerAvatarUrl: string;
  companyYears: number;
  apiTokens: string[];
}

// Valores padrão
const activeConfig: DynamicConfig = {
  whatsappNumber: "5518982719536",
  managerName: "Lucas Cardoso",
  managerAvatarUrl: "/images/agi/manager.jpg",
  companyYears: new Date().getFullYear(),
  apiTokens: [],
};

// Inicializa tokens a partir do process.env caso existam
if (typeof process !== "undefined" && process.env) {
  const envTokens = (process.env["HUB_DEVELOPER_TOKENS"] || process.env["HUB_DEVELOPER_TOKEN"] || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (envTokens.length > 0) {
    activeConfig.apiTokens = envTokens;
  }
}

export function getConfig(): DynamicConfig {
  return { ...activeConfig };
}

export function updateConfig(partial: Partial<DynamicConfig>): DynamicConfig {
  if (partial.whatsappNumber !== undefined) activeConfig.whatsappNumber = partial.whatsappNumber;
  if (partial.managerName !== undefined) activeConfig.managerName = partial.managerName;
  if (partial.managerAvatarUrl !== undefined) activeConfig.managerAvatarUrl = partial.managerAvatarUrl;
  if (partial.companyYears !== undefined) activeConfig.companyYears = partial.companyYears;
  if (partial.apiTokens !== undefined) activeConfig.apiTokens = [...partial.apiTokens];
  return { ...activeConfig };
}

export function addApiToken(token: string): string[] {
  const clean = token.trim();
  if (clean && !activeConfig.apiTokens.includes(clean)) {
    activeConfig.apiTokens.push(clean);
  }
  return [...activeConfig.apiTokens];
}

export function removeApiToken(token: string): string[] {
  activeConfig.apiTokens = activeConfig.apiTokens.filter((t) => t !== token.trim());
  return [...activeConfig.apiTokens];
}
