import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Estado das **duas barras laterais** da casca, compartilhado entre o masthead (que tem os
 * botões) e as próprias barras.
 *
 * - **Barra esquerda (guide):** em `>=1024px` ela abre (240px) e fecha (some); abaixo disso o
 *   controle vira gaveta sobre o conteúdo.
 * - **Barra direita (painel de contexto):** a coluna lateral das telas de canal (plano da semana,
 *   decisão da revisão, indicadores). Ela só é barra a partir de `lg`/`xl` — no celular o conteúdo
 *   empilha normalmente e o botão não esconde nada, porque esconder a coluna que contém o botão de
 *   aprovar seria uma armadilha.
 *
 * Este arquivo é o **único** lugar onde esse estado mora. Nenhum dos dois carrega `channelId`:
 * a preferência de apresentação é a única coisa que pode viver no navegador (invariante nº 2 —
 * o canal ativo vive na URL).
 */

export const GUIDE_STORAGE_KEY = 'ams-barra-esquerda';
export const RIGHT_STORAGE_KEY = 'ams-barra-direita';

interface ShellState {
  /** Barra esquerda aberta no desktop. */
  guideOpen: boolean;
  /** Alterna a barra esquerda: no desktop abre/fecha, no celular abre/fecha a gaveta. */
  toggleGuide: () => void;
  /** Gaveta da barra esquerda aberta no celular. */
  drawerOpen: boolean;
  closeDrawer: () => void;
  /** Barra direita aberta. */
  rightOpen: boolean;
  toggleRight: () => void;
}

const ShellContext = createContext<ShellState | null>(null);

/** `matchMedia` não existe no jsdom; sem guarda, os testes quebrariam. */
function isDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

function readStored(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    if (value === 'aberta') return true;
    if (value === 'fechada') return false;
    return fallback;
  } catch {
    // Modo privado / storage bloqueado: abrir por padrão em vez de quebrar.
    return fallback;
  }
}

function persist(key: string, open: boolean): void {
  try {
    window.localStorage.setItem(key, open ? 'aberta' : 'fechada');
  } catch {
    // Sem storage a escolha vale só nesta sessão — não é motivo para falhar.
  }
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [guideOpen, setGuideOpen] = useState(() => readStored(GUIDE_STORAGE_KEY, true));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(() => readStored(RIGHT_STORAGE_KEY, true));

  const toggleGuide = useCallback(() => {
    if (isDesktop()) {
      setGuideOpen((value) => {
        persist(GUIDE_STORAGE_KEY, !value);
        return !value;
      });
    } else {
      setDrawerOpen((value) => !value);
    }
  }, []);

  const toggleRight = useCallback(() => {
    setRightOpen((value) => {
      persist(RIGHT_STORAGE_KEY, !value);
      return !value;
    });
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  /**
   * A barra direita é fechada por CSS (`[data-rail-right='closed']`), porque a coluna lateral é
   * escrita por cada tela, não pela casca. O atributo é aplicado em `useLayoutEffect`: ele roda
   * antes da pintura, então o painel não aparece por um frame depois de fechado.
   */
  useLayoutEffect(() => {
    document.documentElement.dataset.railRight = rightOpen ? 'open' : 'closed';
  }, [rightOpen]);

  // A gaveta do celular não pode sobreviver a um redimensionamento para desktop.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const value = useMemo(
    () => ({ guideOpen, toggleGuide, drawerOpen, closeDrawer, rightOpen, toggleRight }),
    [guideOpen, toggleGuide, drawerOpen, closeDrawer, rightOpen, toggleRight],
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell precisa estar dentro de <ShellProvider>.');
  }
  return context;
}
