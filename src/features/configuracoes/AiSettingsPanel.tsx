/**
 * Painel de Inteligência Artificial — segredos, endereços e escolha de modelo.
 *
 * É a parte que faz o app funcionar sem editar `.env` e reiniciar o servidor: cola-se a chave, escolhe-se
 * quem atende cada trabalho e testa-se a conexão.
 *
 * ## Decisões que estão visíveis na tela, e por quê
 *
 * 1. **A chave nunca volta do servidor.** O campo aparece vazio com a máscara como dica. Salvar com o
 *    campo vazio **preserva** a chave atual; o botão "remover" é a única forma de apagá-la. Sem essa
 *    distinção, salvar o formulário apagaria a chave que o usuário acabou de cadastrar.
 * 2. **O endereço do provedor é editável e validado.** O servidor recusa endereço interno, endereço
 *    de metadados de nuvem e credencial embutida na URL — é defesa contra SSRF, porque URL digitada
 *    pelo usuário que o servidor acessa é o vetor clássico.
 * 3. **A tela avisa quando não pode gravar.** Onde o app está publicado, o segredo vem do gerenciador
 *    de segredos: uma rota pública que aceita chave de API de qualquer visitante seria vulnerabilidade.
 * 4. **As três decisões do dono ficam aqui, com o risco escrito.** Ligar cada uma é assumir
 *    explicitamente algo que o produto não assume sozinho.
 * 5. **Nada é salvo sem clique.** O rascunho vive na tela; o botão "salvar" é ato humano (invariante
 *    nº 1, o mesmo princípio que vale para aprovar conteúdo).
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, KeyRound, Plug, RotateCcw, ShieldAlert, TriangleAlert } from 'lucide-react';
import {
  AI_TIER_LABEL,
  type AiSettingsPatch,
  type AiSettingsView,
  type AiTier,
} from '@/ai/contract';
import { useAiSettings, useSaveAiSettings, useTestProvider } from '@/ai/hooks';
import { Button, Card, ErrorState, IconTile, Pill, SectionHead, Skeleton, cn } from '@/components/ui/primitives';
import { formatUsd } from '@/lib/format';

const TIERS: AiTier[] = ['raciocinio', 'criativo', 'rapido', 'visao'];

/** Rótulo de exibição do fornecedor. Só aparece nesta tela — a do operador. */
const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  deepseek: 'DeepSeek',
  google: 'Google (Gemini)',
  openrouter: 'OpenRouter',
};

const POLICY_LABEL: Record<string, string> = {
  permitido: 'serve canal infantil',
  'restrito-menores': 'vedado para canal infantil',
  'nao-verificado': 'política não verificada',
};

interface Draft {
  /** Texto digitado no campo de chave. Vazio = "não mexi". */
  keys: Record<string, string>;
  /** Fornecedores cuja chave o usuário mandou remover. */
  removals: Record<string, boolean>;
  /** Endereço editado. Vazio = usar o padrão. */
  urls: Record<string, string>;
  models: Partial<Record<AiTier, string>>;
  functionModels: Record<string, string>;
  flags: AiSettingsView['flags'];
}

function draftFrom(settings: AiSettingsView): Draft {
  const urls: Record<string, string> = {};
  for (const provider of settings.providers) urls[provider.provider] = provider.baseUrl;

  const models: Partial<Record<AiTier, string>> = {};
  for (const tier of settings.tiers) models[tier.tier] = tier.override ?? '';

  const functionModels: Record<string, string> = {};
  for (const fn of settings.functions) functionModels[fn.functionId] = '';

  return { keys: {}, removals: {}, urls, models, functionModels, flags: settings.flags };
}

export function AiSettingsPanel() {
  const settings = useAiSettings();
  const save = useSaveAiSettings();
  const test = useTestProvider();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(draftFrom(settings.data));
  }, [settings.data]);

  const data = settings.data;

  /* --- rascunho × salvo ---------------------------------------------------- */

  const patch = useMemo<AiSettingsPatch | null>(() => {
    if (!data || !draft) return null;

    const providers: Record<string, { apiKey?: string | null; baseUrl?: string | null }> = {};
    for (const provider of data.providers) {
      const entry: { apiKey?: string | null; baseUrl?: string | null } = {};

      if (draft.removals[provider.provider] && provider.configured) {
        entry.apiKey = null;
      } else {
        const typed = (draft.keys[provider.provider] ?? '').trim();
        if (typed.length > 0) entry.apiKey = typed;
      }

      const url = (draft.urls[provider.provider] ?? '').trim();
      if (url !== provider.baseUrl) entry.baseUrl = url.length > 0 ? url : null;

      if (Object.keys(entry).length > 0) providers[provider.provider] = entry;
    }

    const models: Partial<Record<AiTier, string | null>> = {};
    for (const tier of TIERS) {
      const next = (draft.models[tier] ?? '').trim();
      const before = data.tiers.find((item) => item.tier === tier)?.override ?? '';
      if (next !== before) models[tier] = next.length > 0 ? next : null;
    }

    const functionModels: Record<string, string | null> = {};
    for (const fn of data.functions) {
      const next = (draft.functionModels[fn.functionId] ?? '').trim();
      if (next.length > 0) functionModels[fn.functionId] = next;
    }

    const flags = {
      allowUnverifiedMinorPolicy: draft.flags.allowUnverifiedMinorPolicy,
      allowUnpricedModel: draft.flags.allowUnpricedModel,
      allowNoLedger: draft.flags.allowNoLedger,
    };

    const hasFlags =
      flags.allowUnverifiedMinorPolicy !== data.flags.allowUnverifiedMinorPolicy ||
      flags.allowUnpricedModel !== data.flags.allowUnpricedModel ||
      flags.allowNoLedger !== data.flags.allowNoLedger;

    if (
      Object.keys(providers).length === 0 &&
      Object.keys(models).length === 0 &&
      Object.keys(functionModels).length === 0 &&
      !hasFlags
    ) {
      return null;
    }

    return { providers, models, functionModels, ...flags };
  }, [data, draft]);

  const submit = () => {
    if (!patch) return;
    setFeedback(null);
    save.mutate(patch, {
      onSuccess: (result) => {
        // Guarda contra resposta em forma inesperada: sem isto, um `changed` ausente derrubava o
        // manipulador com TypeError dentro do React Query, e a tela não dizia nem "salvou" nem
        // "falhou". Resposta estranha vira mensagem, não exceção silenciosa.
        const changed = Array.isArray(result?.changed) ? result.changed : [];
        setFeedback(changed.length === 0 ? 'Configuração salva.' : `Salvo: ${changed.join(' · ')}.`);
      },
      onError: (error) => setFeedback(error.message),
    });
  };

  /* --- estados da consulta ------------------------------------------------- */

  /*
   * A ORDEM destas verificações é o conserto de um defeito que o usuário sentiu na pele.
   *
   * A versão anterior testava `isLoading || !draft` **antes** de `isError`. Como o rascunho só nasce
   * quando a resposta chega, uma requisição que falha deixava `draft` nulo para sempre — e o painel
   * ficava num esqueleto de carregamento **infinito**: sem modelos, sem botão de teste funcionando e
   * sem nenhuma mensagem. Foi exatamente o relato "testei e não funcionou, e não aparecem os
   * modelos". Erro primeiro; carregamento depois.
   */
  if (settings.isError) {
    return (
      <Card className="p-4">
        <SectionHead step={5} title="Inteligência artificial" hint="chaves, endereços e escolha de modelo" />
        <ErrorState
          message={
            settings.error instanceof Error && settings.error.message
              ? settings.error.message
              : 'Não foi possível carregar a configuração de IA do servidor.'
          }
          onRetry={settings.refetch}
        />
      </Card>
    );
  }

  if (!data || !draft) {
    return (
      <Card className="p-4">
        <SectionHead step={5} title="Inteligência artificial" hint="chaves, endereços e escolha de modelo" />
        <Skeleton className="h-[220px]" />
      </Card>
    );
  }

  const readOnly = !data.writable;

  return (
    <Card className="p-4">
      <SectionHead
        step={5}
        title="Inteligência artificial"
        hint="vale para todos os canais — é configuração do app, não deste canal"
      />

      {/* --- como a configuração é guardada --------------------------------- */}
      <p className="text-[11.5px] text-ink-3 leading-relaxed">
        {readOnly ? (
          <>
            Este app está <strong>publicado</strong>, então a configuração de IA não é editável por
            aqui — uma página pública que aceita chave de API de qualquer visitante seria uma
            vulnerabilidade. Neste ambiente, configure as chaves no gerenciador de segredos do
            servidor (variáveis de ambiente: {data.providers.map((p) => p.envVar).join(', ')}).
          </>
        ) : (
          <>
            As chaves ficam <strong>no servidor</strong>, em <code className="ams-num">{data.configPath}</code>{' '}
            — arquivo fora do controle de versão e nunca enviado ao navegador. O navegador recebe
            apenas a máscara. Isto é um arquivo local, <strong>não um cofre</strong>: em produção, o
            lugar do segredo é o gerenciador de segredos.
          </>
        )}
      </p>

      {data.ledger === 'memoria' && (
        <p className="text-[11px] text-warn mt-2 flex items-start gap-1.5">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Sem registro de custo durável neste ambiente, o teto diário não tem efeito — e a geração paga
          fica recusada, a não ser que você assuma a decisão abaixo.
        </p>
      )}

      {/* --- fornecedores: chave e endereço ---------------------------------- */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold text-ink-2 mb-2">Provedores — chave e endereço</p>
        <ul className="flex flex-col gap-3">
          {data.providers.map((provider) => {
            const markedForRemoval = draft.removals[provider.provider] === true;
            const willBeConfigured = markedForRemoval
              ? false
              : provider.configured || (draft.keys[provider.provider] ?? '').trim().length > 0;

            return (
              <li
                key={provider.provider}
                className="rounded-md border border-line bg-[color:var(--ams-glass-sunken)] p-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-2 min-w-0">
                    <IconTile tone="cyan" size="sm">
                      <KeyRound size={14} />
                    </IconTile>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-ink">
                        {PROVIDER_LABEL[provider.provider] ?? provider.provider}
                      </span>
                      <span className="block text-[10.5px] ams-num text-ink-3">{provider.envVar}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <Pill tone={willBeConfigured ? 'ok' : 'neutral'} dot={false}>
                      {willBeConfigured ? 'com chave' : 'sem chave'}
                    </Pill>
                    <Pill
                      tone={provider.allowedForChildDirected ? 'ok' : 'warn'}
                      dot={false}
                    >
                      {POLICY_LABEL[provider.minorPolicy] ?? provider.minorPolicy}
                    </Pill>
                  </span>
                </div>

                <label className="block text-[10.5px] font-semibold text-ink-3 mt-2.5 mb-1" htmlFor={`key-${provider.provider}`}>
                  Chave de API
                </label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    id={`key-${provider.provider}`}
                    type="password"
                    autoComplete="off"
                    disabled={readOnly || markedForRemoval}
                    value={draft.keys[provider.provider] ?? ''}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        removals: { ...draft.removals, [provider.provider]: false },
                        keys: { ...draft.keys, [provider.provider]: event.target.value },
                      })
                    }
                    placeholder={
                      markedForRemoval
                        ? 'será removida ao salvar'
                        : provider.configured
                          ? `${provider.keyMask} (salva${provider.keySource === 'ambiente' ? ' no ambiente' : ''}) — deixe vazio para manter`
                          : 'cole a chave aqui'
                    }
                    className="flex-1 min-w-[240px] min-h-[38px] px-3 rounded-md bg-sunken border border-line text-[13px] text-ink outline-none focus:border-accent disabled:opacity-60"
                  />
                  {provider.configured && !markedForRemoval && !readOnly && (
                    <Button
                      variant="danger"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          keys: { ...draft.keys, [provider.provider]: '' },
                          removals: { ...draft.removals, [provider.provider]: true },
                        })
                      }
                    >
                      Remover
                    </Button>
                  )}
                  {markedForRemoval && !readOnly && (
                    <Button
                      onClick={() =>
                        setDraft({ ...draft, removals: { ...draft.removals, [provider.provider]: false } })
                      }
                    >
                      Desfazer
                    </Button>
                  )}
                  <Button
                    disabled={readOnly || !willBeConfigured || test.isPending}
                    onClick={() => {
                      setTestingProvider(provider.provider);
                      setFeedback(null);
                      test.mutate(provider.provider, {
                        onSettled: () => setTestingProvider(null),
                      });
                    }}
                  >
                    <Plug size={14} aria-hidden="true" />
                    {testingProvider === provider.provider && test.isPending ? 'Testando…' : 'Testar conexão'}
                  </Button>
                </div>

                <label className="block text-[10.5px] font-semibold text-ink-3 mt-2.5 mb-1" htmlFor={`url-${provider.provider}`}>
                  Endereço do provedor
                </label>
                <div className="flex gap-2 flex-wrap">
                  <input
                    id={`url-${provider.provider}`}
                    disabled={readOnly}
                    value={draft.urls[provider.provider] ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, urls: { ...draft.urls, [provider.provider]: event.target.value } })
                    }
                    placeholder={provider.defaultBaseUrl}
                    className="flex-1 min-w-[240px] min-h-[38px] px-3 rounded-md bg-sunken border border-line text-[12px] text-ink outline-none focus:border-accent disabled:opacity-60 ams-num"
                  />
                  {provider.baseUrlCustomized && !readOnly && (
                    <Button
                      onClick={() =>
                        setDraft({ ...draft, urls: { ...draft.urls, [provider.provider]: provider.defaultBaseUrl } })
                      }
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Padrão
                    </Button>
                  )}
                </div>
                {provider.baseUrlCustomized && (
                  <p className="text-[10px] text-warn mt-1">
                    Endereço alterado em relação ao oficial. Confira antes de confiar no resultado.
                  </p>
                )}

                {testingProvider === null && test.data?.provider === provider.provider && (
                  <p
                    className={cn(
                      'text-[11px] mt-2 flex items-start gap-1.5',
                      test.data.ok ? 'text-ok' : 'text-danger',
                    )}
                    role="status"
                  >
                    {test.data.ok ? (
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {test.data.message}
                      {test.data.ok && test.data.costSource === 'real' && (
                        <> Custo do teste: {formatUsd(test.data.costUsd)} (registrado no livro).</>
                      )}
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* --- modelo por nível ------------------------------------------------ */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[11px] font-semibold text-ink-2">Modelo por tipo de trabalho</p>
        <p className="text-[10.5px] text-ink-3 mt-0.5">
          Deixe em "padrão do catálogo" para o app escolher sozinho. Cada nível agrupa funções por tipo
          de trabalho — é assim que o modelo caro fica no julgamento e o barato na parte mecânica.
        </p>
        <ul className="flex flex-col gap-2.5 mt-2.5">
          {data.tiers.map((tier) => (
            <li key={tier.tier}>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <label className="text-[11.5px] font-semibold text-ink" htmlFor={`tier-${tier.tier}`}>
                  {tier.label}
                </label>
                <span className="text-[10px] text-ink-3 ams-num">em uso: {tier.resolved}</span>
              </div>
              <p className="text-[10.5px] text-ink-3 mb-1">{tier.purpose}</p>
              <select
                id={`tier-${tier.tier}`}
                disabled={readOnly}
                value={draft.models[tier.tier] ?? ''}
                onChange={(event) =>
                  setDraft({ ...draft, models: { ...draft.models, [tier.tier]: event.target.value } })
                }
                className="w-full min-h-[38px] px-3 rounded-md bg-sunken border border-line text-[12px] text-ink outline-none focus:border-accent disabled:opacity-60"
              >
                <option value="">padrão do catálogo</option>
                {data.catalog.map((option) => (
                  <option key={option.spec} value={option.spec}>
                    {PROVIDER_LABEL[option.provider] ?? option.provider} · {option.label} — US${' '}
                    {option.inputUsdPerMillion}/{option.outputUsdPerMillion} por milhão
                    {option.allowsChildChannel ? '' : ' — não serve canal infantil'}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>

      {/* --- modelo por função ---------------------------------------------- */}
      <details className="mt-4 border-t border-line pt-3">
        <summary className="text-[11px] font-semibold text-ink-2 cursor-pointer">
          Modelo por função — diferenciar cada uma ({data.functions.length} funções)
        </summary>
        <p className="text-[10.5px] text-ink-3 mt-1.5">
          Cada função já nasce no nível adequado ao trabalho dela. Aqui você vê qual modelo atende cada
          uma e pode sobrepor uma função específica.
        </p>
        <ul className="flex flex-col gap-2 mt-2.5">
          {data.functions.map((fn) => (
            <li key={fn.functionId} className="flex items-center gap-2 flex-wrap">
              <span className="min-w-[190px] flex-1">
                <span className="block text-[11.5px] text-ink">{fn.label}</span>
                <span className="block text-[10px] text-ink-3 ams-num">
                  {AI_TIER_LABEL[fn.tier]} · {fn.resolved}
                  {fn.source === 'catalogo' ? ' (padrão)' : ''}
                </span>
              </span>
              <select
                aria-label={`Modelo para ${fn.label}`}
                disabled={readOnly}
                value={draft.functionModels[fn.functionId] ?? ''}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    functionModels: { ...draft.functionModels, [fn.functionId]: event.target.value },
                  })
                }
                className="min-w-[210px] min-h-[34px] px-2 rounded-md bg-sunken border border-line text-[11px] text-ink outline-none focus:border-accent disabled:opacity-60"
              >
                <option value="">seguir o nível</option>
                {data.catalog.map((option) => (
                  <option key={option.spec} value={option.spec}>
                    {option.label}
                    {option.allowsChildChannel ? '' : ' (não serve canal infantil)'}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </details>

      {/* --- decisões do dono ----------------------------------------------- */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="text-[11px] font-semibold text-ink-2 flex items-center gap-1.5">
          <ShieldAlert size={13} aria-hidden="true" />
          Decisões que o produto não toma sozinho
        </p>
        <ul className="flex flex-col gap-3 mt-2.5">
          <FlagRow
            id="flag-menores"
            title="Permitir fornecedor de política não verificada no canal infantil"
            description="A DeepSeek tem cláusula que pode vedar conteúdo com persona de menor de 18 anos, e a leitura jurídica está pendente. Ligar é assumir esse risco. Desligado, o canal infantil cai em simulação quando nenhum fornecedor permitido está configurado."
            checked={draft.flags.allowUnverifiedMinorPolicy}
            disabled={readOnly}
            onChange={(value) =>
              setDraft({ ...draft, flags: { ...draft.flags, allowUnverifiedMinorPolicy: value } })
            }
          />
          <FlagRow
            id="flag-preco"
            title="Permitir modelo sem preço verificado"
            description="O teto de gasto é calculado a partir do preço. Sem preço na tabela não há estimativa, e a chamada sairia sem teto nenhum. Ligar é abrir mão da trava de custo por chamada."
            checked={draft.flags.allowUnpricedModel}
            disabled={readOnly}
            onChange={(value) => setDraft({ ...draft, flags: { ...draft.flags, allowUnpricedModel: value } })}
          />
          <FlagRow
            id="flag-livro"
            title="Permitir geração paga sem registro de custo durável"
            description="Onde o livro de custos não é gravável, cada processo começa com gasto zero e o teto diário não tem efeito. Ligar é aceitar que o gasto do dia não será somado."
            checked={draft.flags.allowNoLedger}
            disabled={readOnly}
            onChange={(value) => setDraft({ ...draft, flags: { ...draft.flags, allowNoLedger: value } })}
          />
        </ul>
      </div>

      {/* --- salvar ---------------------------------------------------------- */}
      <div className="flex items-center gap-2 flex-wrap mt-4 border-t border-line pt-3">
        <Button variant="primary" size="lg" disabled={readOnly || !patch || save.isPending} onClick={submit}>
          {save.isPending ? 'Salvando…' : 'Salvar configuração'}
        </Button>
        <Button
          disabled={!patch || save.isPending}
          onClick={() => {
            setDraft(draftFrom(data));
            setFeedback('Alterações descartadas.');
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
          Descartar
        </Button>
        {!patch && <span className="text-[11px] text-ink-3">Nada alterado ainda.</span>}
      </div>

      {save.isError && (
        <p className="text-[11px] text-danger mt-2" role="alert">
          {save.error.message}
        </p>
      )}
      {feedback && (
        <p className="text-[11px] text-ink-2 mt-2 border-t border-line pt-2" role="status">
          {feedback}
        </p>
      )}
      {data.updatedAt && (
        <p className="text-[10px] text-ink-3 mt-2 ams-num">
          Última alteração: {new Date(data.updatedAt).toLocaleString('pt-BR')}
        </p>
      )}
    </Card>
  );
}

function FlagRow({
  id,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 accent-[color:var(--ams-cyan)] disabled:opacity-60"
      />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[11.5px] font-semibold text-ink">{title}</span>
        <span className="block text-[10.5px] text-ink-3">{description}</span>
      </label>
    </li>
  );
}
