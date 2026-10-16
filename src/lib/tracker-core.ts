import { isValidCPF, onlyDigits } from "./loan";

export type FunnelStep =
  | "visit"
  | "cpf_entered"
  | "cpf_validated"
  | "perfil_selected"
  | "motivo_selected"
  | "tempo_selected"
  | "faixa_selected"
  | "diretrizes_accepted"
  | "analysis_completed"
  | "score_viewed"
  | "valor_viewed"
  | "bancos_selected"
  | "payout_entered"
  | "review_accepted"
  | "whatsapp_clicked"
  | "page_exit";

export interface LeadQualityScore {
  score: number; // 0 a 100
  isRealLead: boolean;
  tier: "DIAMANTE" | "OURO" | "PRATA" | "CURIOSO" | "BOT_SUSPEITO";
  badges: string[];
}

export interface LeadMetadata {
  leadId: string;
  cpf?: string | undefined;
  name?: string | undefined;
  phone?: string | undefined;
  birthDate?: string | undefined;
  profile?: string | undefined;
  reason?: string | undefined;
  duration?: string | undefined;
  range?: string | undefined;
  calculatedScore?: number | undefined;
  approvedAmount?: number | undefined;
  payoutMethod?: string | undefined;
  pixType?: string | undefined;
  pixKey?: string | undefined;
  bankName?: string | undefined;
  agency?: string | undefined;
  account?: string | undefined;
  otherBanks?: string[] | undefined;
  answers?: Record<string, string> | undefined;
  timeOnSiteSeconds?: number | undefined;
  deviceType?: string | undefined;
  origin?: string | undefined;
  step: FunnelStep;
  stepDetails?: string | undefined;
}

export function evaluateLeadQuality(data: Partial<LeadMetadata>): LeadQualityScore {
  let score = 0;
  const badges: string[] = [];

  // 1. Verificação de CPF autêntico
  if (data.cpf && isValidCPF(data.cpf)) {
    score += 35;
    badges.push("CPF Válido");

    if (data.name && data.name.trim().split(/\s+/).length >= 2) {
      score += 20;
      badges.push("Titular Confirmado");
    }
  }

  // 2. Telefone válido
  if (data.phone) {
    const digits = onlyDigits(data.phone);
    if (digits.length === 11 && digits[2] === "9") {
      score += 15;
      badges.push("WhatsApp Válido");
    }
  }

  // 3. Progresso do funil
  if (data.profile) score += 5;
  if (data.reason) score += 5;
  if (data.range) score += 5;
  if (data.payoutMethod) {
    score += 10;
    badges.push("Dados Bancários Informados");
  }

  if (data.step === "whatsapp_clicked") {
    score += 15;
    badges.push("Conversão WhatsApp");
  }

  let tier: LeadQualityScore["tier"] = "CURIOSO";
  if (score >= 80) tier = "DIAMANTE";
  else if (score >= 60) tier = "OURO";
  else if (score >= 40) tier = "PRATA";
  else if (score < 20) tier = "BOT_SUSPEITO";

  return {
    score: Math.min(100, score),
    isRealLead: score >= 50,
    tier,
    badges,
  };
}
