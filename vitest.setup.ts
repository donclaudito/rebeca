import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { setAccessToken } from './src/auth/token';

/**
 * `findBy*` espera 1000ms por padrão (`asyncUtilTimeout`). Nesta máquina, o primeiro render de uma
 * tela com React 19 + jsdom passa de 1s com folga, e o resultado era uma suíte **instável**: a mesma
 * asserção passava numa rodada e falhava na seguinte, sempre com "Unable to find role=…", sem
 * nenhum defeito de produto por trás (evidência: `.rebeca/evidencias/vitest-ciclo.txt`).
 *
 * O limite sobe para 5s — continua sendo um limite. Se uma tela demorar mais que isso para aparecer,
 * o teste falha, e aí a falha é sobre o produto, não sobre a máquina.
 */
configure({ asyncUtilTimeout: 5000 });

/**
 * Sessão de teste.
 *
 * Desde o `ADR-014`, as rotas de IA e de mídia exigem identidade, e os clientes do navegador
 * **recusam** a chamada quando não há sessão — de propósito. Sem uma sessão nos testes, toda tela que
 * lê dados passaria a medir a ausência de login em vez do que ela existe para medir (o painel de
 * configuração, a revisão, a mídia gerada, o botão de IA).
 *
 * O valor aqui é **falso e local**: nenhuma chamada sai para a rede nos testes (o `fetch` é mockado
 * caso a caso), e o servidor não é consultado. A fronteira de sessão tem arquivo próprio
 * (`src/auth/__tests__/cliente.test.tsx`), que **limpa** esta sessão antes de cada caso para provar o
 * que acontece sem ela: nenhuma consulta é feita, o 401 derruba a sessão e o 403 não derruba.
 */
beforeEach(() => {
  setAccessToken('token-de-teste-da-suite');
});

