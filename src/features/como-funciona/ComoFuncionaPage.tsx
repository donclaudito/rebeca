import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  Brain,
  CalendarClock,
  ChartColumn,
  Clapperboard,
  CloudUpload,
  Compass,
  Eye,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Rocket,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, IconTile, Pill, SectionHead } from '@/components/ui/primitives';
import { CYCLE_LABEL, CYCLE_ORDER, HUMANS_ONLY_STAGE, cyclePosition } from '@/data/cycle';
import { useChannels } from '@/data/hooks';
import type { CycleStage, TileTone } from '@/data/types';
import type { ReactNode } from 'react';

interface Step {
  name: string;
  description: string;
  icon: ReactNode;
  tone: TileTone;
}

/**
 * Apresentação de cada etapa canônica — o que a tela diz sobre ela.
 *
 * A **ordem** e o **nome** não estão aqui: vêm de `CYCLE_ORDER`/`CYCLE_LABEL` (`@/data/cycle`), que
 * por sua vez espelham `docs/00-visao-produto.md` §3. Aqui mora só o texto e o visual.
 *
 * `Record<CycleStage, …>` é proposital: etapa nova no domínio sem texto nesta tela não compila.
 */
const ETAPA_UI: Record<CycleStage, { description: string; icon: ReactNode; tone: TileTone }> = {
  pesquisar: {
    description: 'A IA analisa tendências, palavras-chave e oportunidades do nicho.',
    icon: <Search size={18} />,
    tone: 'cyan',
  },
  planejar: {
    description: 'Define temas, roteiros, calendário e a frequência do canal.',
    icon: <FileText size={18} />,
    tone: 'blue',
  },
  criar: {
    description: 'Gera roteiro, cenas, imagens, narração, vídeo e thumbnails.',
    icon: <Clapperboard size={18} />,
    tone: 'violet',
  },
  revisar: {
    description: 'Você assiste, lê o pacote e decide o que fica.',
    icon: <Eye size={18} />,
    tone: 'amber',
  },
  aprovar: {
    description: 'Aprovação explícita e registrada. A IA nunca aprova sozinha.',
    icon: <BadgeCheck size={18} />,
    tone: 'green',
  },
  agendar: {
    description: 'O melhor dia e horário, definidos com base no que já funcionou no canal.',
    icon: <CalendarClock size={18} />,
    tone: 'teal',
  },
  publicar: {
    description: 'O sistema envia pela integração oficial, sem upload manual no YouTube Studio.',
    icon: <CloudUpload size={18} />,
    tone: 'rose',
  },
  medir: {
    description: 'Acompanha views, CTR, retenção, watch time e receita.',
    icon: <ChartColumn size={18} />,
    tone: 'cyan',
  },
  aprender: {
    description: 'Compara o que funcionou e o que você recusou.',
    icon: <Brain size={18} />,
    tone: 'violet',
  },
  melhorar: {
    description: 'A pauta da próxima semana muda com base no resultado real.',
    icon: <Target size={18} />,
    tone: 'green',
  },
};

/** As 10 etapas na ordem canônica — derivadas, nunca redigitadas. */
const PASSOS: Step[] = CYCLE_ORDER.map((stage) => ({
  name: CYCLE_LABEL[stage],
  ...ETAPA_UI[stage],
}));

const MODULOS: { name: string; description: string; icon: ReactNode; tone: TileTone }[] = [
  { name: 'Estratégia', description: 'Pesquisa de mercado e identidade do canal.', icon: <Compass size={18} />, tone: 'cyan' },
  { name: 'Personagens', description: 'Criação e consistência de personagens.', icon: <Users size={18} />, tone: 'pink' },
  { name: 'Roteiro', description: 'Roteiros com IA para vídeos e Shorts.', icon: <FileText size={18} />, tone: 'violet' },
  { name: 'Geração de vídeo', description: 'Cenas, voz, música e montagem.', icon: <Clapperboard size={18} />, tone: 'blue' },
  { name: 'Thumbnail', description: '3 a 4 opções por vídeo, escolha sua.', icon: <ImageIcon size={18} />, tone: 'rose' },
  { name: 'SEO', description: 'Título, descrição e tags otimizados.', icon: <Search size={18} />, tone: 'green' },
  { name: 'Aprovação', description: 'Você revisa e decide antes de publicar.', icon: <BadgeCheck size={18} />, tone: 'amber' },
  { name: 'Agendamento', description: 'Melhor horário definido por dados.', icon: <CalendarClock size={18} />, tone: 'teal' },
  { name: 'Upload no YouTube', description: 'Publicação automática, sem upload manual.', icon: <CloudUpload size={18} />, tone: 'rose' },
  { name: 'Analytics', description: 'Views, CTR, retenção, receita e custo.', icon: <ChartColumn size={18} />, tone: 'cyan' },
  { name: 'Aprendizado', description: 'O que funcionou volta como recomendação.', icon: <Brain size={18} />, tone: 'violet' },
];

const INTELIGENCIA: { title: string; description: string; icon: ReactNode; tone: TileTone }[] = [
  {
    title: 'Analisa a performance dos seus vídeos',
    description: 'Compara cada conteúdo com a média do próprio canal, de forma explícita.',
    icon: <ChartColumn size={18} />,
    tone: 'cyan',
  },
  {
    title: 'Estuda canais do mesmo segmento',
    description: 'Entende o que está funcionando no nicho — para criar original, não copiar.',
    icon: <Users size={18} />,
    tone: 'violet',
  },
  {
    title: 'Sugere temas com potencial',
    description: 'Usa o que já funcionou no canal para propor a próxima pauta.',
    icon: <Lightbulb size={18} />,
    tone: 'amber',
  },
  {
    title: 'Otimiza SEO',
    description: 'Títulos, descrições, tags e thumbnails pensados para ser encontrados.',
    icon: <Search size={18} />,
    tone: 'green',
  },
  {
    title: 'Aprende com aprovações e rejeições',
    description: 'O que você recusa deixa de ser priorizado nas próximas semanas.',
    icon: <Brain size={18} />,
    tone: 'pink',
  },
  {
    title: 'Busca o menor custo',
    description: 'Mesmo resultado com menos gasto de geração por vídeo.',
    icon: <Wallet size={18} />,
    tone: 'teal',
  },
];

const DORES = ['Muito tempo', 'Muitas ferramentas', 'Mais custo', 'Processo manual'];

const FERRAMENTAS_DE_HOJE = [
  'Ideia e roteiro',
  'Criação de personagens',
  'Gerar vídeo',
  'Criar thumbnail',
  'Upload no YouTube',
  'Analytics',
];

/** Como funciona — o mapa do produto dentro do próprio app (modelo 1 §2 + modelo 2 §1). */
export function ComoFuncionaPage() {
  // O canal do botão vem da lista, nunca de um id fixo no código (invariante nº 5).
  const channels = useChannels();
  const firstChannelId = channels.data?.[0]?.id;

  return (
    <>
      <PageHeader
        title="Como o app funciona"
        subtitle="Um hub inteligente para operar vários canais de YouTube com IA. A IA faz o trabalho. Você dirige e aprova."
        sample={false}
      />

      <div className="grid lg:grid-cols-12 gap-4 mb-4">
        <Card className="p-4 lg:col-span-5">
          <SectionHead step={1} title="O problema hoje" hint="cinco a dez ferramentas por canal" />
          <ul className="flex flex-wrap gap-1.5 mb-4">
            {FERRAMENTAS_DE_HOJE.map((tool, index) => (
              <li key={tool} className="flex items-center gap-1.5">
                <Pill tone="neutral" dot={false}>
                  {tool}
                </Pill>
                {index < FERRAMENTAS_DE_HOJE.length - 1 && (
                  <span className="text-ink-3 text-[11px]" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ul>
          <ul className="grid grid-cols-2 gap-2">
            {DORES.map((dor) => (
              <li key={dor} className="flex items-center gap-2 text-[12px] text-ink-2">
                <IconTile tone="rose" size="sm">
                  <Zap size={13} />
                </IconTile>
                {dor}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-3 mt-3">
            Existe IA para quase tudo. O que não existe é o processo integrado.
          </p>
        </Card>

        <Card variant="strong" className="p-4 lg:col-span-7">
          <SectionHead step={2} title="A solução" hint="o ciclo inteiro em um só lugar" />
          <p className="text-[12px] text-ink-2 mb-4">
            O AI Media Studio reúne todo o processo com IA, de forma integrada e automatizada. Cada canal
            tem sua própria estratégia, branding, calendário e aprendizado.
          </p>
          <ol className="flex flex-wrap gap-2">
            {MODULOS.map((modulo) => (
              <li key={modulo.name} className="ams-module !w-auto !p-2.5 min-w-[168px] flex-1">
                <IconTile tone={modulo.tone} size="sm">
                  {modulo.icon}
                </IconTile>
                <span className="min-w-0">
                  <span className="ams-module__title !text-[12px]">{modulo.name}</span>
                  <span className="ams-module__desc block !text-[10px]">{modulo.description}</span>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <SectionHead
          step={3}
          title="Fluxo de operação por canal"
          hint="do planejamento à otimização, em um ciclo contínuo"
        />
        <ol
          className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-10 gap-2.5"
          aria-label={`As ${PASSOS.length} etapas do ciclo`}
        >
          {PASSOS.map((passo, index) => (
            <li key={passo.name} className="ams-module !items-center">
              <IconTile tone={passo.tone} size="sm">
                {passo.icon}
              </IconTile>
              <span className="min-w-0">
                <span className="ams-module__title !text-[12px]">
                  <span className="ams-num text-ink-3">{index + 1}.</span> {passo.name}
                </span>
                <span className="ams-module__desc block !text-[10px]">{passo.description}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-ink-3 mt-3 flex items-center gap-1.5">
          <Sparkles size={13} aria-hidden="true" />
          O passo {cyclePosition(HUMANS_ONLY_STAGE)} é o único que ninguém pode fazer no seu lugar: a
          aprovação é humana.
        </p>
      </Card>

      <div className="grid lg:grid-cols-12 gap-4 mb-4">
        <Card className="p-4 lg:col-span-7">
          <SectionHead step={4} title="O que torna o app inteligente" hint="a IA trabalha ao seu lado" />
          <ul className="grid sm:grid-cols-2 gap-3">
            {INTELIGENCIA.map((item) => (
              <li key={item.title} className="flex gap-2.5">
                <IconTile tone={item.tone} size="sm">
                  {item.icon}
                </IconTile>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-ink">{item.title}</span>
                  <span className="block text-[11px] text-ink-3 mt-0.5">{item.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 lg:col-span-5">
          <SectionHead step={5} title="Resultado esperado" hint="o que muda para você" />
          <ul className="flex flex-col gap-3">
            <li className="flex gap-2.5">
              <IconTile tone="violet" size="sm">
                <Zap size={14} />
              </IconTile>
              <span>
                <span className="block text-[12px] font-semibold text-ink">Menos ferramentas</span>
                <span className="block text-[11px] text-ink-3">
                  Roteiro, imagem, vídeo, publicação, analytics e mais, num só lugar.
                </span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconTile tone="cyan" size="sm">
                <Sparkles size={14} />
              </IconTile>
              <span>
                <span className="block text-[12px] font-semibold text-ink">Mais automação</span>
                <span className="block text-[11px] text-ink-3">
                  Você foca no que realmente importa: aprovar e crescer.
                </span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <IconTile tone="green" size="sm">
                <Rocket size={14} />
              </IconTile>
              <span>
                <span className="block text-[12px] font-semibold text-ink">
                  Mais chance de alcance orgânico
                </span>
                <span className="block text-[11px] text-ink-3">
                  Conteúdo mais relevante, consistente e baseado em dados reais de performance.
                </span>
              </span>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <SectionHead step={6} title="Resumo em uma frase" />
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <IconTile tone="blue" size="lg">
            <TrendingUp size={22} />
          </IconTile>
          <div className="min-w-0">
            <p className="text-[14px] text-ink-2 leading-relaxed">
              Uma plataforma que centraliza toda a operação de canais criados com IA. Ela pesquisa
              oportunidades, planeja conteúdo, cria vídeos e identidade, prepara SEO e thumbnails, permite
              aprovação humana, publica automaticamente no YouTube, acompanha os resultados e usa esses
              dados para melhorar continuamente a estratégia de cada canal.
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-3">
              <Upload size={14} className="text-ink-3" aria-hidden="true" />
              <span className="text-[11px] text-ink-3">
                A IA cria e entrega. Você revisa e aprova. O sistema agenda e publica.
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-5 border-t border-line pt-4">
          <Link to="/portfolio" className="ams-btn">
            Ver o portfólio de canais
          </Link>
          {firstChannelId && (
            <Link to={`/c/${firstChannelId}/inicio`} className="ams-btn ams-btn--primary">
              <Sparkles size={15} aria-hidden="true" />
              Abrir o Início do canal
            </Link>
          )}
        </div>
      </Card>
    </>
  );
}
