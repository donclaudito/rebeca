import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

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
