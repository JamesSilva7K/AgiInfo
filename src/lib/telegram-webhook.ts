import { addApiToken, getConfig, removeApiToken, updateConfig } from "./bot-config";

// Estado de espera conversacional do Admin Supremo
type AdminExpectation = "AWAITING_WHATSAPP" | "AWAITING_NOME" | "AWAITING_AVATAR" | "AWAITING_ANO" | "AWAITING_TOKEN_ADD" | "AWAITING_TOKEN_DEL" | null;
let currentAdminState: AdminExpectation = null;

// Processa mensagens e callbacks interativos enviados diretamente pelo Admin Supremo
export async function handleTelegramUpdate(body: any): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const adminId = process.env["TELEGRAM_ADMIN_CHAT_ID"];

  if (!token || !adminId) return false;

  const reply = async (text: string, inlineKeyboard?: any[][]) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: adminId,
          text,
          parse_mode: "HTML",
          reply_markup: inlineKeyboard ? { inline_keyboard: inlineKeyboard } : undefined,
        }),
      });
    } catch (e) {
      console.error("[Telegram Bot] Erro ao enviar mensagem:", e);
    }
  };

  const answerCallback = async (callbackQueryId: string, alertText?: string) => {
    try {
      await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: alertText,
          show_alert: Boolean(alertText),
        }),
      });
    } catch (e) {
      console.error("[Telegram Bot] Erro no answerCallbackQuery:", e);
    }
  };

  // 1. Processamento de Clique em Botões Interativos (Callback Queries)
  if (body.callback_query) {
    const cb = body.callback_query;
    const senderId = String(cb.from.id);
    const data = cb.data as string;

    if (senderId !== String(adminId)) {
      await answerCallback(cb.id, "⛔ Acesso negado! Apenas o Admin Supremo pode gerenciar o sistema.");
      return true;
    }

    await answerCallback(cb.id);

    // Navegação nos botões
    if (data === "menu_principal") {
      currentAdminState = null;
      return sendMainMenu(reply);
    }

    if (data === "btn_gerente") {
      const cfg = getConfig();
      const msg = [
        `<b>👤 GESTÃO DO PERFIL DO GERENTE & CONTATO</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<b>• Nome Atual:</b> <b>${cfg.managerName}</b>`,
        `<b>• WhatsApp Atual:</b> <code>${cfg.whatsappNumber}</code>`,
        `<b>• Foto/Avatar:</b> <code>${cfg.managerAvatarUrl}</code>`,
        `<b>• Ano de Empresa:</b> <code>${cfg.companyYears}</code>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<i>Escolha uma das ações abaixo para modificar:</i>`,
      ].join("\n");

      const keyboard = [
        [
          { text: "✏️ Alterar WhatsApp", callback_data: "act_change_whatsapp" },
          { text: "✏️ Alterar Nome", callback_data: "act_change_name" },
        ],
        [
          { text: "🖼️ Alterar Foto/Avatar", callback_data: "act_change_avatar" },
          { text: "📅 Alterar Ano", callback_data: "act_change_year" },
        ],
        [{ text: "⬅️ Voltar ao Painel", callback_data: "menu_principal" }],
      ];

      await reply(msg, keyboard);
      return true;
    }

    if (data === "btn_tokens") {
      const cfg = getConfig();
      const list = cfg.apiTokens.length > 0
        ? cfg.apiTokens.map((t, i) => `<b>${i + 1}.</b> <code>${t}</code>`).join("\n")
        : "<i>Nenhum token cadastrado no pool atualmente.</i>";

      const msg = [
        `<b>🔑 POOL DE TOKENS DA API CPF</b>`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<b>Status:</b> ${cfg.apiTokens.length > 0 ? "🟢 Operante com Rotação Ativa" : "🔴 Sem tokens cadastrados"}`,
        `<b>Total de Tokens Ativos:</b> <b>${cfg.apiTokens.length}</b>`,
        ``,
        list,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `<i>O sistema alterna automaticamente entre os tokens para não estourar a cota da Receita.</i>`,
      ].join("\n");

      const keyboard = [
        [
          { text: "➕ Adicionar Token", callback_data: "act_add_token" },
          { text: "🗑️ Remover Token", callback_data: "act_del_token" },
        ],
        [{ text: "⬅️ Voltar ao Painel", callback_data: "menu_principal" }],
      ];

      await reply(msg, keyboard);
      return true;
    }

    if (data === "act_change_whatsapp") {
      currentAdminState = "AWAITING_WHATSAPP";
      await reply(
        `⏳ <b>AGUARDANDO NOVO NÚMERO DE WHATSAPP</b>\n\n` +
        `Envie agora o novo número com DDD (ex: <code>11988887777</code> ou <code>5511988887777</code>).\n\n` +
        `💡 <i>Dica: Não se preocupe com parênteses ou traços, o sistema formata tudo automaticamente!</i>\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "act_change_name") {
      currentAdminState = "AWAITING_NOME";
      await reply(
        `⏳ <b>AGUARDANDO NOVO NOME DO GERENTE</b>\n\n` +
        `Envie o nome que deseja exibir na tela final e nas mensagens (ex: <code>Carlos Eduardo</code>).\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "act_change_avatar") {
      currentAdminState = "AWAITING_AVATAR";
      await reply(
        `⏳ <b>AGUARDANDO NOVO LINK DE FOTO/AVATAR</b>\n\n` +
        `Envie o link direto da imagem (URL terminada em .jpg, .png ou hospedada na web).\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "act_change_year") {
      currentAdminState = "AWAITING_ANO";
      await reply(
        `⏳ <b>AGUARDANDO ANO DA EMPRESA</b>\n\n` +
        `Envie o ano com 4 dígitos (ex: <code>2026</code>).\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "act_add_token") {
      currentAdminState = "AWAITING_TOKEN_ADD";
      await reply(
        `⏳ <b>AGUARDANDO NOVO TOKEN DA API CPF</b>\n\n` +
        `Envie o código do token fornecido pelo Hub do Desenvolvedor.\n\n` +
        `💡 <i>Exemplo: 220922290qQOczpuFIP398868496</i>\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "act_del_token") {
      currentAdminState = "AWAITING_TOKEN_DEL";
      await reply(
        `⏳ <b>AGUARDANDO TOKEN PARA REMOÇÃO</b>\n\n` +
        `Envie o código exato do token que você deseja desativar do pool.\n\n` +
        `❌ Para cancelar, envie <code>cancelar</code>.`,
        [[{ text: "❌ Cancelar", callback_data: "menu_principal" }]]
      );
      return true;
    }

    if (data === "btn_ajuda") {
      await reply(
        `<b>💡 GUIA DE INTELIGÊNCIA & DICAS DO SISTEMA</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Anti-Spam Ativo:</b> Toda vez que um cliente avança de etapa, a mesma mensagem no seu chat é atualizada automaticamente.\n` +
        `• <b>Reconhecimento de Lead Real:</b> O Lead Scoring verifica CPF na Receita, consistência de banco, chave PIX e clique real no WhatsApp.\n` +
        `• <b>Pool de Tokens da Receita:</b> Se você cadastrar mais de um token, o sistema faz rodízio automático entre eles sem derrubar a consulta.\n` +
        `• <b>Você tem controle total:</b> Mude o WhatsApp ou o Gerente a qualquer segundo sem precisar mexer em código!`,
        [[{ text: "⬅️ Voltar ao Painel", callback_data: "menu_principal" }]]
      );
      return true;
    }

    return true;
  }

  // 2. Processamento de Mensagens de Texto
  const message = body.message;
  if (!message || !message.text) return false;

  const senderId = String(message.chat.id);
  const rawText = message.text.trim();

  // Apenas o Admin Supremo pode interagir
  if (senderId !== String(adminId)) {
    return false;
  }

  // Se o admin pedir cancelamento de qualquer ação em andamento
  if (rawText.toLowerCase() === "cancelar" || rawText === "/cancelar") {
    currentAdminState = null;
    await reply("❌ <i>Ação cancelada com sucesso. Retornando ao menu principal...</i>");
    return sendMainMenu(reply);
  }

  // Comandos diretos de menu
  if (rawText === "/start" || rawText === "/menu" || rawText === "/painel") {
    currentAdminState = null;
    return sendMainMenu(reply);
  }

  // 3. Processamento inteligente baseado no estado de espera (AWAITING_*)
  if (currentAdminState === "AWAITING_WHATSAPP") {
    const cleanNumber = rawText.replace(/\D/g, "");
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      await reply(
        `❌ <b>ERRO: NÚMERO INVÁLIDO</b>\n\n` +
        `O número fornecido (<code>${rawText}</code>) não possui a quantidade correta de dígitos para um WhatsApp válido no Brasil.\n\n` +
        `💡 <i>Dica: Envie o número com DDD (ex: <code>11988887777</code> ou <code>5511988887777</code>) ou envie <code>cancelar</code>.</i>`
      );
      return true;
    }

    const finalNumber = cleanNumber.startsWith("55") ? cleanNumber : `55${cleanNumber}`;
    updateConfig({ whatsappNumber: finalNumber });
    currentAdminState = null;

    await reply(
      `🎉 <b>SUCESSO! NÚMERO ATUALIZADO COM SUCESSO</b>\n\n` +
      `A partir deste momento, todos os novos leads que clicarem no botão de WhatsApp serão redirecionados diretamente para:\n` +
      `📱 <b>${finalNumber}</b>\n\n` +
      `<i>O site já atualizou o link em tempo real.</i>`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  if (currentAdminState === "AWAITING_NOME") {
    if (rawText.length < 2 || rawText.length > 50) {
      await reply(
        `❌ <b>ERRO: NOME INVÁLIDO</b>\n\n` +
        `O nome do gerente deve ter entre 2 e 50 caracteres.\n\n` +
        `💡 <i>Dica: Envie o nome completo (ex: <code>Carlos Eduardo</code>) ou <code>cancelar</code>.</i>`
      );
      return true;
    }

    updateConfig({ managerName: rawText });
    currentAdminState = null;

    await reply(
      `🎉 <b>SUCESSO! NOME DO GERENTE ALTERADO</b>\n\n` +
      `Novo gerente responsável: <b>${rawText}</b>\n\n` +
      `<i>O nome foi atualizado no perfil, no cartão de crédito e na saudação automática do WhatsApp!</i>`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  if (currentAdminState === "AWAITING_AVATAR") {
    if (!rawText.startsWith("http://") && !rawText.startsWith("https://")) {
      await reply(
        `❌ <b>ERRO: LINK INVÁLIDO</b>\n\n` +
        `A URL informada não é um link web válido.\n\n` +
        `💡 <i>Dica: Certifique-se de que o link começa com <code>https://</code> e aponte para uma imagem visível na internet.</i>`
      );
      return true;
    }

    updateConfig({ managerAvatarUrl: rawText });
    currentAdminState = null;

    await reply(
      `🎉 <b>SUCESSO! FOTO/AVATAR ATUALIZADO</b>\n\n` +
      `A nova foto já está visível para os clientes na etapa do gerente!\n` +
      `🔗 <code>${rawText}</code>`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  if (currentAdminState === "AWAITING_ANO") {
    const ano = parseInt(rawText, 10);
    if (isNaN(ano) || ano < 1900 || ano > 2100) {
      await reply(
        `❌ <b>ERRO: ANO INVÁLIDO</b>\n\n` +
        `Por favor, informe um ano válido com 4 dígitos (ex: <code>2026</code>).`
      );
      return true;
    }

    updateConfig({ companyYears: ano });
    currentAdminState = null;

    await reply(
      `🎉 <b>SUCESSO! ANO DE EMPRESA ATUALIZADO</b>\n\n` +
      `Ano configurado no rodapé e diretrizes legais: <b>${ano}</b>`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  if (currentAdminState === "AWAITING_TOKEN_ADD") {
    if (rawText.length < 8) {
      await reply(
        `❌ <b>ERRO: TOKEN MUITO CURTO</b>\n\n` +
        `Os tokens do Hub do Desenvolvedor costumam ter mais de 15 caracteres alfanuméricos.\n\n` +
        `💡 <i>Confira o código enviado ou envie <code>cancelar</code>.</i>`
      );
      return true;
    }

    const tokens = addApiToken(rawText);
    currentAdminState = null;

    await reply(
      `🎉 <b>SUCESSO! NOVO TOKEN INTEGRADO AO POOL</b>\n\n` +
      `Token: <code>${rawText}</code>\n` +
      `Total de tokens em revezamento: <b>${tokens.length}</b>\n\n` +
      `<i>O sistema agora distribui as consultas de CPF entre todos os tokens disponíveis!</i>`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  if (currentAdminState === "AWAITING_TOKEN_DEL") {
    const tokens = removeApiToken(rawText);
    currentAdminState = null;

    await reply(
      `🗑️ <b>SUCESSO! TOKEN REMOVIDO DO POOL</b>\n\n` +
      `Total restante: <b>${tokens.length} tokens</b>.`,
      [[{ text: "⬅️ Voltar ao Menu", callback_data: "menu_principal" }]]
    );
    return true;
  }

  // 4. Reconhecimento Inteligente por Linguagem Natural ou Comandos Rápidos
  if (rawText.startsWith("/whatsapp ")) {
    const raw = rawText.replace("/whatsapp ", "").trim().replace(/\D/g, "");
    if (raw.length >= 10) {
      const finalNumber = raw.startsWith("55") ? raw : `55${raw}`;
      updateConfig({ whatsappNumber: finalNumber });
      await reply(`✅ <b>WhatsApp atualizado para:</b> <code>${finalNumber}</code>`);
      return true;
    }
  }

  if (rawText.startsWith("/nome ")) {
    const n = rawText.replace("/nome ", "").trim();
    if (n.length >= 2) {
      updateConfig({ managerName: n });
      await reply(`✅ <b>Nome do Gerente atualizado para:</b> <b>${n}</b>`);
      return true;
    }
  }

  if (rawText.startsWith("/add_token ")) {
    const t = rawText.replace("/add_token ", "").trim();
    const list = addApiToken(t);
    await reply(`✅ <b>Token adicionado ao pool!</b> Total: <b>${list.length}</b>`);
    return true;
  }

  // Resposta inteligente padrão caso envie texto avulso
  await reply(
    `🤖 <b>Comando não identificado.</b>\n\n` +
    `Recebi sua mensagem: "<i>${rawText}</i>".\n\n` +
    `💡 <i>Utilize os botões interativos abaixo para gerenciar todas as funções do seu sistema:</i>`,
    [
      [
        { text: "👤 Perfil & WhatsApp", callback_data: "btn_gerente" },
        { text: "🔑 Tokens da API CPF", callback_data: "btn_tokens" },
      ],
      [{ text: "📊 Menu Principal", callback_data: "menu_principal" }],
    ]
  );

  return true;
}

// Renderiza o Menu Principal com Botões Interativos
async function sendMainMenu(reply: (text: string, inlineKeyboard?: any[][]) => Promise<void>) {
  const cfg = getConfig();
  const text = [
    `<b>👑 PAINEL DE CONTROLE SUPREMO · AGIBANK</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `<b>⚙️ STATUS OPERACIONAL DO SISTEMA:</b>`,
    `• <b>Gerente Responsável:</b> <b>${cfg.managerName}</b>`,
    `• <b>WhatsApp de Recebimento:</b> <code>${cfg.whatsappNumber}</code>`,
    `• <b>Ano de Empresa:</b> <code>${cfg.companyYears}</code>`,
    `• <b>Tokens da API CPF no Pool:</b> <b>${cfg.apiTokens.length} ativos</b>`,
    `• <b>Anti-Spam de Leads:</b> 🟢 Ativo (Atualiza mesma mensagem)`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `<i>Selecione o que deseja visualizar ou alterar:</i>`,
  ].join("\n");

  const inlineKeyboard = [
    [
      { text: "👤 Gerenciar Contato & Gerente", callback_data: "btn_gerente" },
      { text: "🔑 Gerenciar Tokens CPF", callback_data: "btn_tokens" },
    ],
    [
      { text: "💡 Dicas & Inteligência do Funil", callback_data: "btn_ajuda" },
    ],
  ];

  await reply(text, inlineKeyboard);
  return true;
}

