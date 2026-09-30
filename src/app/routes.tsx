import { Navigate, Route, Routes } from 'react-router-dom';
import { ChannelLayout, GlobalLayout } from '@/app/layouts';
import { InicioPage } from '@/features/inicio/InicioPage';
import { ConteudoPage } from '@/features/conteudo/ConteudoPage';
import { RevisaoPage } from '@/features/revisao/RevisaoPage';
import { CalendarioPage } from '@/features/calendario/CalendarioPage';
import { IdentidadePage } from '@/features/identidade/IdentidadePage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { MonetizacaoPage } from '@/features/monetizacao/MonetizacaoPage';
import { ConfiguracoesPage } from '@/features/configuracoes/ConfiguracoesPage';
import { PortfolioPage } from '@/features/portfolio/PortfolioPage';
import { ComoFuncionaPage } from '@/features/como-funciona/ComoFuncionaPage';
import { NotFoundPage } from '@/features/nao-encontrado/NotFoundPage';

/**
 * Rotas do app.
 *
 * Toda tela de canal vive sob `/c/:channelId/...` — link sem canal é bug (skill `rebeca-react` §2).
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/portfolio" replace />} />

      <Route element={<GlobalLayout />}>
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/como-funciona" element={<ComoFuncionaPage />} />
      </Route>

      <Route path="/c/:channelId" element={<ChannelLayout />}>
        <Route index element={<Navigate to="inicio" replace />} />
        <Route path="inicio" element={<InicioPage />} />
        <Route path="conteudo" element={<ConteudoPage />} />
        <Route path="revisao/:contentId" element={<RevisaoPage />} />
        <Route path="calendario" element={<CalendarioPage />} />
        <Route path="identidade" element={<IdentidadePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="monetizacao" element={<MonetizacaoPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
