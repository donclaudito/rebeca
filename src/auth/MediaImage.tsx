/**
 * Imagem autenticada — a consequência prática de exigir identidade até para servir arquivo.
 *
 * **O problema que este componente resolve, medido antes de ser resolvido:** a arte gerada é servida
 * por `GET /api/media/file?…`, e desde o `ADR-014` essa rota exige `Authorization: Bearer …`. Uma tag
 * `<img src="/api/media/file?…">` **não tem como** mandar cabeçalho — o navegador faz a requisição
 * sozinho. As três prévias do app (Revisão, opções geradas e Mídia gerada) quebrariam em silêncio:
 * imagem quebrada, sem erro, sem log, sem pista.
 *
 * As saídas possíveis eram três: (a) abrir exceção de autenticação nessa rota — inaceitável, é o
 * caminho que entrega a arte de um canal a quem tem o endereço; (b) cookie de sessão — reabriria o
 * CSRF que o desenho com header não tem, e o ADR decidiu header; (c) buscar com `fetch`, virar
 * `blob:` e exibir. É a terceira.
 *
 * O `URL.revokeObjectURL` no desmonte **não** é detalhe: cada blob vivo segura os bytes na memória da
 * aba até a página ser fechada. Numa tela com 13 ativos, esquecer isso é vazamento de dezenas de
 * megabytes por navegação.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/primitives';
import { authHeaders, getAccessToken } from './token';

interface BlobState {
  readonly url: string | null;
  readonly failed: boolean;
}

/**
 * Busca a URL protegida e devolve uma URL `blob:` local.
 *
 * Sem sessão devolve falha em vez de tentar: um pedido anônimo só produziria 401 e um erro de console
 * que não diz nada a quem está olhando a tela.
 */
export function useAuthenticatedBlobUrl(src: string | null): BlobState {
  const [state, setState] = useState<BlobState>({ url: null, failed: false });

  useEffect(() => {
    if (src === null || getAccessToken() === null) {
      setState({ url: null, failed: src !== null });
      return;
    }

    let vivo = true;
    let criada: string | null = null;
    setState({ url: null, failed: false });

    void (async () => {
      try {
        const response = await fetch(src, { headers: { ...authHeaders() }, cache: 'no-store' });
        if (!response.ok) {
          if (vivo) setState({ url: null, failed: true });
          return;
        }

        /*
         * **O tipo do conteúdo é conferido, e não só o status** — defeito 2 do `QA-014`.
         *
         * `response.ok` sozinho aceitava qualquer coisa com status 200. O caso que este projeto já
         * viveu: o rewrite de SPA devolvendo o `index.html` (quando a função da rota não existe no
         * deploy, ou quando o servidor é anterior à rota). O HTML virava `blob:` e ia para a tag
         * `<img>`: imagem quebrada **sem nenhuma mensagem** — exatamente o sintoma silencioso que este
         * componente existe para eliminar. Os dois clientes da camada (`src/auth/client.ts`,
         * `src/media/client.ts`) já conferem `text/html`; aqui faltava a mesma checagem.
         */
        const tipo = response.headers.get('content-type') ?? '';
        if (!tipo.toLowerCase().startsWith('image/')) {
          if (vivo) setState({ url: null, failed: true });
          return;
        }

        const blob = await response.blob();
        if (!vivo) return;

        try {
          criada = URL.createObjectURL(blob);
        } catch {
          // Ambiente que não implementa `createObjectURL` (jsdom, por exemplo): a tela mostra o
          // espaço reservado. Devolver a URL protegida no `src` da imagem daria 401 e uma imagem
          // quebrada sem explicação — pior que o espaço reservado honesto.
          setState({ url: null, failed: true });
          return;
        }

        if (!vivo) {
          URL.revokeObjectURL(criada);
          return;
        }
        setState({ url: criada, failed: false });
      } catch {
        if (vivo) setState({ url: null, failed: true });
      }
    })();

    return () => {
      vivo = false;
      if (criada !== null) URL.revokeObjectURL(criada);
    };
  }, [src]);

  return state;
}

interface MediaImageProps {
  /** Endereço da API de mídia (`mediaFileUrl(...)`). */
  readonly src: string;
  readonly alt: string;
  readonly className?: string;
  readonly loading?: 'lazy' | 'eager';
}

/**
 * Renderiza a arte, ou o espaço dela.
 *
 * Os três estados são visivelmente distintos de propósito: carregando é o espaço reservado (o layout
 * não pula), falha diz que **não foi possível carregar** com rótulo acessível, e sucesso é a imagem.
 * Um `alt` otimista no lugar da imagem que falhou seria a mesma mentira que a tela de Revisão já
 * contou uma vez, quando dizia "roteiro, cenas e montagem prontos" sem existir um arquivo de vídeo.
 */
export function MediaImage({ src, alt, className, loading = 'lazy' }: MediaImageProps) {
  const { url, failed } = useAuthenticatedBlobUrl(src);

  if (failed) {
    return (
      <span
        role="img"
        aria-label={`${alt} — não foi possível carregar a imagem`}
        className={cn(className, 'grid place-items-center text-[11px] text-ink-3 px-2 text-center')}
      >
        não foi possível carregar esta imagem
      </span>
    );
  }

  if (url === null) {
    return <span aria-hidden="true" className={cn(className, 'ams-skel')} />;
  }

  return <img src={url} alt={alt} loading={loading} className={className} />;
}
