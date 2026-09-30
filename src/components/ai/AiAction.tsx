/**
 * `AiAction` — o componente que dá vida a uma função de IA numa tela.
 *
 * Ele resolve, num lugar só, os quatro estados que a visão de produto exige de qualquer consulta
 * (§5.3 de `docs/04-mapa-funcional.md`): carregando, vazio, erro e sucesso. E mostra sempre a
 * **procedência** do que apareceu — provedor, modelo, custo real e, quando for o caso, o aviso de que
 * aquilo é simulação.
 *
 * Duas decisões de produto estão embutidas aqui:
 *
 * 1. **A IA nunca aplica sozinha.** Quando a saída pode virar conteúdo, aparece um botão "usar na
 *    tela" que só preenche o formulário. Gravar continua exigindo o clique humano no botão de salvar
 *    — é o invariante nº 1 preservado na camada de interface, não só no servidor.
 * 2. **Simulação é dita em voz alta.** Se o app respondeu por simulação (sem chave configurada), a
 *    tarja aparece no resultado. Simulação apresentada como geração real seria mentira de produto.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Cpu, Play, Sparkles, Wand2 } from 'lucide-react';
import { getAiFunction, type AiFunctionId, type AiResult } from '@/ai/contract';
import { useAiFunction } from '@/ai/hooks';
import { AI_LIMITS } from '@/ai/limits';
import type { ChannelId } from '@/data/types';
import { Button, Card, ErrorState, IconTile, Pill, Skeleton, cn } from '@/components/ui/primitives';
import { formatUsd } from '@/lib/format';

/* =============================================================================
   Rótulos legíveis
   ============================================================================= */

/**
 * Dicionário de rótulos. As chaves da saída já nascem em pt-BR porque são vocabulário de produto;
 * o dicionário existe para os casos em que a forma de dados não é a melhor forma de leitura
 * (`porQue` → "Por quê", `valeuAPena` → "Valeu a pena?").
 */
const LABELS: Record<string, string> = {
  porQue: 'Por quê',
  valeuAPena: 'Valeu a pena?',
  comparacaoVsMediaPct: 'Comparação com a média do canal',
  roiPct: 'Retorno sobre o custo',
  custoPorMilViewsUsd: 'Custo por mil visualizações',
  margemUsd: 'Margem em dólar',
  margemPct: 'Margem em %',
  idadeAlvo: 'Faixa etária',
  faixaEtariaRecomendada: 'Faixa etária recomendada',
  ritmoSegPorCena: 'Ritmo por cena (segundos)',
  duracaoSeg: 'Duração (segundos)',
  promptImagem: 'Prompt de imagem',
  negativePrompt: 'O que evitar na imagem',
  textoNaArte: 'Texto na arte',
  sugestao: 'Sugestão da IA',
  confiancaPct: 'Confiança',
  oportunidade: 'Oportunidade',
  saturacao: 'Saturação',
  adequacaoEtaria: 'Adequação etária',
  notasConsistencia: 'Notas de consistência',
  comunidadeYoutube: 'Post na comunidade do YouTube',
  proximaSemana: 'Pauta da próxima semana',
  custoPorMilViews: 'Custo por mil visualizações',
};

function humanize(key: string): string {
  if (LABELS[key]) return LABELS[key];
  // camelCase → "Camel case", com a primeira letra maiúscula.
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Valores que a tela explica em vez de imprimir cru. */
function readValue(value: unknown, key: string): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (value === null || value === undefined) return null;
  void key;
  return null;
}

/* =============================================================================
   Renderizador do resultado
   ============================================================================= */

function ResultValue({ value, fieldKey, depth = 0 }: { value: unknown; fieldKey: string; depth?: number }) {
  const scalar = readValue(value, fieldKey);
  if (scalar !== null) {
    return <p className="text-[12.5px] text-ink-2 leading-relaxed whitespace-pre-wrap">{scalar}</p>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <p className="text-[12px] text-ink-3">Nada a mostrar aqui.</p>;
    }
    return (
      <ul className="flex flex-col gap-2">
        {value.map((item, index) => (
          <li
            key={index}
            className={cn(
              'rounded-[10px] border border-line p-2.5',
              depth === 0 ? 'bg-sunken' : 'bg-transparent',
            )}
          >
            {typeof item === 'object' && item !== null ? (
              <ObjectFields value={item as Record<string, unknown>} depth={depth + 1} />
            ) : (
              <span className="text-[12.5px] text-ink-2">{String(item)}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return <ObjectFields value={value as Record<string, unknown>} depth={depth + 1} />;
  }

  return null;
}

function ObjectFields({ value, depth }: { value: Record<string, unknown>; depth: number }) {
  return (
    <dl className="flex flex-col gap-2">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">{humanize(key)}</dt>
          <dd className="mt-0.5">
            <ResultValue value={item} fieldKey={key} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* =============================================================================
   Procedência
   ============================================================================= */

function Provenance({ result }: { result: AiResult }) {
  const spec = getAiFunction(result.functionId);
  void spec;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-line">
      {/*
        Nem o fornecedor nem o modelo aparecem aqui. `docs/04` §5 é explícito: a interface não mostra
        termo interno — o usuário vê uma ferramenta só. A exceção fica na tela de Configurações, que é
        a do operador, e mesmo lá dentro de um bloco recolhido marcado como detalhe técnico.
        O `promptId` também sai: é registro de auditoria, e o lugar dele é o livro de custos.
      */}
      <Pill tone={result.simulated ? 'warn' : 'ok'} dot={false}>
        {result.simulated ? 'simulado — sem chave configurada' : 'proposta da IA'}
      </Pill>
      {result.costSource === 'real' ? (
        <Pill tone="neutral" dot={false}>
          custo {formatUsd(result.costUsd)}
        </Pill>
      ) : (
        <Pill tone="warn" dot={false}>
          custo não verificado
        </Pill>
      )}
      {result.attempts > 1 && (
        <Pill tone="warn" dot={false}>
          {result.attempts} tentativas
        </Pill>
      )}
      {result.costRecorded === 'memoria' && (
        <Pill tone="warn" dot={false}>
          custo não durável nesta instalação
        </Pill>
      )}
      {result.costRecorded === 'nenhum' && (
        <Pill tone="neutral" dot={false}>
          sem gasto — nada lançado no livro
        </Pill>
      )}
    </div>
  );
}

/* =============================================================================
   Componente principal
   ============================================================================= */

interface AiActionProps {
  functionId: AiFunctionId;
  channelId: ChannelId;
  /** Entrada da função. Função para permitir montar na hora do clique, com o estado atual da tela. */
  input: Record<string, unknown> | (() => Record<string, unknown>);
  /** Texto do botão. Se ausente, usa o rótulo da função. */
  label?: string;
  /** Uma linha explicando ao usuário o que vai acontecer. */
  hint?: string;
  contentId?: string;
  note?: string;
  /** Preenche o formulário da tela com a saída. **Não** grava nada — quem grava é o humano. */
  onApply?: (data: unknown) => void;
  /**
   * Recebe o resultado completo quando ele chega.
   *
   * Existe para a tela reagir a um veredito **bloqueante** — o gate de canal infantil emite
   * `bloqueante: true`, e a tela de Revisão precisa travar a aprovação enquanto isso estiver de pé.
   * Sem este canal, o parecer ficaria bonito na tela e não mudaria nada, que foi exatamente a
   * crítica do `rebeca-qa`: "parecer consultivo chamado de gate".
   */
  onResult?: (result: AiResult) => void;
  applyLabel?: string;
  variant?: 'ghost' | 'primary';
  /** Renderiza já aberto (usado quando a tela quer o painel sempre visível). */
  className?: string;
}

export function AiAction({
  functionId,
  channelId,
  input,
  label,
  hint,
  contentId,
  note,
  onApply,
  onResult,
  applyLabel = 'Usar na tela',
  variant = 'ghost',
  className,
}: AiActionProps) {
  const spec = getAiFunction(functionId);
  const mutation = useAiFunction(functionId, channelId, {
    ...(contentId ? { contentId } : {}),
    ...(note ? { note } : {}),
  });
  const [applied, setApplied] = useState(false);

  // Notifica a tela quando um resultado novo chega. `useEffect` (e não `onSuccess` do mutation) para
  // funcionar igual em qualquer chamador e não depender da versão da biblioteca de consulta.
  const result = mutation.data;
  useEffect(() => {
    if (result && onResult) onResult(result);
    // `onResult` de propósito fora das dependências: a tela costuma passar uma função nova a cada
    // render, e incluí-la faria o efeito disparar em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!spec) return null;

  const run = () => {
    setApplied(false);
    const resolved = typeof input === 'function' ? input() : input;
    mutation.mutate({
      input: resolved,
      ...(contentId || note ? { options: { ...(contentId ? { contentId } : {}), ...(note ? { note } : {}) } } : {}),
    });
  };

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-start gap-3">
        <IconTile tone="violet" size="sm">
          <Wand2 size={15} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink">{spec.label}</p>
          <p className="text-[11.5px] text-ink-3 mt-0.5">{hint ?? spec.purpose}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <Button variant={variant} onClick={run} disabled={mutation.isPending}>
          <Play size={14} aria-hidden="true" />
          {mutation.isPending ? 'Gerando…' : (label ?? 'Executar')}
        </Button>
        {result && onApply && (
          <Button
            variant="primary"
            onClick={() => {
              onApply(result.data);
              setApplied(true);
            }}
          >
            <Sparkles size={14} aria-hidden="true" />
            {applied ? 'Aplicado na tela' : applyLabel}
          </Button>
        )}
      </div>

      {mutation.isPending && (
        <div className="mt-3 flex flex-col gap-2" role="status" aria-live="polite">
          <Skeleton className="h-[16px] w-2/3" />
          <Skeleton className="h-[16px] w-1/2" />
          <p className="text-[10.5px] text-ink-3">
            A geração pode levar alguns segundos. Nada é publicado enquanto você não aprovar.
          </p>
        </div>
      )}

      {mutation.isError && (
        <div className="mt-3">
          <ErrorState
            title="A IA não conseguiu responder"
            message={mutation.error.message}
            {...(mutation.error.name === 'AiError' ? {} : {})}
          />
          {/* O erro já traz mensagem em pt-BR pronta para a tela; o detalhe técnico fica em
              `detail` e não é exibido — evita poluir a interface com jargão de provedor. */}
        </div>
      )}

      {result && !mutation.isPending && (
        <div className="mt-3">
          {result.simulated && (
            <p className="flex items-start gap-1.5 text-[11px] text-warn mb-2.5" role="status">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Sem chave de provedor configurada, esta resposta é uma <strong>simulação</strong> com a
              mesma forma da real. Configure uma chave para gerar conteúdo de verdade.
            </p>
          )}
          {result.costSource === 'nao-verificado' && !result.simulated && (
            <p className="flex items-start gap-1.5 text-[11px] text-warn mb-2.5" role="status">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              O modelo em uso não está na tabela de preços com fonte. O custo desta chamada não foi
              calculado — não invente um número.
            </p>
          )}

          <div className="rounded-[12px] bg-sunken border border-line p-3 max-h-[420px] overflow-y-auto">
            <ResultValue value={result.data} fieldKey={result.functionId} />
          </div>

          <Provenance result={result} />
        </div>
      )}
    </Card>
  );
}

/* =============================================================================
   Faixa de estado do provedor
   ============================================================================= */

/** Resumo honesto do que está ligado — usado em Configurações e no topo das telas de IA. */
export function AiStatusBanner({ children }: { children?: ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2.5">
        <IconTile tone="cyan" size="sm">
          <Cpu size={14} />
        </IconTile>
        <div className="min-w-0 flex-1 text-[11.5px] text-ink-2 leading-relaxed">{children}</div>
      </div>
    </Card>
  );
}

/** Texto padrão do teto de gasto — um lugar só, para o número nunca divergir da trava real. */
export function budgetSentence(): string {
  return `Cada chamada é recusada acima de ${formatUsd(AI_LIMITS.perCallUsd)} e o dia inteiro para em ${formatUsd(
    AI_LIMITS.dailyUsd,
  )}.`;
}
