import { useCallback, useEffect, useState } from 'react';

/**
 * Tema claro/escuro no vocabulário do YouTube: a interface abre **clara** (a cara
 * padrão do youtube.com) e o tema escuro usa os valores que o YouTube publica —
 * os códigos ficam só em `tokens.css`, que é a fonte única da cor
 * (`docs/03-design-system.md` §11).
 *
 * Por que `localStorage` aqui e não no canal: a skill `rebeca-react` proíbe guardar
 * o **canal ativo** fora da URL, porque isso vaza dado entre canais. Tema não é dado
 * de canal — nenhum conteúdo é escopado por ele —, então é a única preferência que
 * pode viver no navegador.
 */

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'ams-tema';

/** Lê o tema gravado. Devolve `null` quando não há preferência salva. */
export function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    // Modo privado / storage bloqueado: seguir sem preferência em vez de quebrar.
    return null;
  }
}

/**
 * Aplica o tema no `<html>` (`data-theme`), que é o seletor dos tokens.
 * O mesmo atributo é escrito antes da primeira pintura pelo script do `index.html`,
 * para a tela não piscar clara antes de virar escura.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function currentThemeFromDom(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentThemeFromDom(),
  );

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Sem storage o tema vale só nesta sessão — não é motivo para falhar.
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  // Mantém o DOM em sincronia se outro componente já tiver trocado o atributo.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, toggle };
}
