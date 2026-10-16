import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkRateLimit } from "./security";
import {
  BANKS, DURATIONS, PIX_TYPES, PROFILES, RANGES, REASONS,
  computeAmount, computeScore, isValidAccount, isValidAgency, isValidCPF,
  isValidName, isValidPhone, isValidPix, onlyDigits, parseBirthDate,
  type Duration, type Range, type Reason,
} from "./loan";

import { lookupCpf } from "./cpf-lookup";

const keys = <T extends object>(o: T) => Object.keys(o) as [string, ...string[]];

const cpfSchema = z.object({
  cpf: z.string().refine(isValidCPF, "CPF inválido"),
});

export const checkCpfInquiry = createServerFn({ method: "POST" })
  .validator((d: { cpf: string }) => cpfSchema.parse(d))
  .handler(async ({ data }) => {
    const cleanCpf = onlyDigits(data.cpf);
    const limitCheck = checkRateLimit(`inquiry:cpf:${cleanCpf}`, {
      windowMs: 5 * 60 * 1000,
      maxRequests: 15,
    });

    if (!limitCheck.allowed) {
      throw new Error("Muitas tentativas para este documento. Aguarde alguns instantes.");
    }

    return await lookupCpf(cleanCpf);
  });

const evalSchema = z.object({
  cpf: z.string().refine(isValidCPF, "CPF inválido"),
  duration: z.enum(keys(DURATIONS)),
  range: z.enum(keys(RANGES)),
  reason: z.enum(keys(REASONS)),
});

export const evaluateInquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => evalSchema.parse(d))
  .handler(async ({ data }) => {
    const cleanCpf = onlyDigits(data.cpf);
    // Anti brute-force and anti-enumeration limit per CPF: max 10 simulations per 5 minutes
    const cpfCheck = checkRateLimit(`inquiry:eval:${cleanCpf}`, {
      windowMs: 5 * 60 * 1000,
      maxRequests: 10,
    });

    if (!cpfCheck.allowed) {
      throw new Error("Muitas consultas recentes para este CPF. Aguarde alguns instantes.");
    }

    const score = computeScore({
      cpf: data.cpf, duration: data.duration as Duration, range: data.range as Range, reason: data.reason as Reason,
    });
    return { score, amount: computeAmount(score, data.range as Range) };
  });

const submitSchema = evalSchema.extend({
  fullName: z.string().trim().refine(isValidName, "Nome inválido"),
  phone: z.string().refine(isValidPhone, "Celular inválido"),
  birthDate: z.string().refine((v) => parseBirthDate(v) !== null, "Data inválida"),
  profile: z.enum(keys(PROFILES)),
  otherBanks: z.array(z.enum(BANKS as unknown as [string, ...string[]])).max(BANKS.length),
  payout: z.discriminatedUnion("method", [
    z.object({ method: z.literal("pix"), pixType: z.enum(PIX_TYPES), pixKey: z.string().max(120) }),
    z.object({
      method: z.literal("conta"),
      bankName: z.string().trim().min(2).max(60),
      agency: z.string().refine(isValidAgency),
      account: z.string().refine(isValidAccount),
    }),
  ]).refine((p) => p.method !== "pix" || isValidPix(p.pixType, p.pixKey), "Chave PIX inválida"),
});

export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const cleanCpf = onlyDigits(data.cpf);
    // Anti-spam and anti-tampering limit for submissions: max 3 submissions per 10 minutes
    const submitCheck = checkRateLimit(`inquiry:submit:${cleanCpf}`, {
      windowMs: 10 * 60 * 1000,
      maxRequests: 3,
    });

    if (!submitCheck.allowed) {
      throw new Error("Limite de solicitações atingido para este CPF. Tente mais tarde.");
    }

    const score = computeScore({
      cpf: data.cpf, duration: data.duration as Duration, range: data.range as Range, reason: data.reason as Reason,
    });
    const amount = computeAmount(score, data.range as Range);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = data.payout;
    const { data: row, error } = await supabaseAdmin.from("loan_inquiries").insert({
      full_name: data.fullName.trim(),
      cpf: onlyDigits(data.cpf),
      phone: onlyDigits(data.phone),
      birth_date: parseBirthDate(data.birthDate)!,
      profile: data.profile,
      benefit_reason: data.reason,
      benefit_duration: data.duration,
      benefit_range: data.range,
      score,
      approved_amount: amount,
      other_banks: data.otherBanks,
      payout_method: p.method,
      pix_key_type: p.method === "pix" ? p.pixType : null,
      pix_key: p.method === "pix" ? p.pixKey.trim() : null,
      bank_name: p.method === "conta" ? p.bankName : null,
      agency: p.method === "conta" ? p.agency : null,
      account: p.method === "conta" ? p.account : null,
    }).select("id").single();
    if (error) {
      console.error("insert failed", error.message);
      throw new Error("Não foi possível registrar sua solicitação. Tente novamente.");
    }
    return { protocol: row.id.slice(0, 8).toUpperCase(), score, amount };
  });
