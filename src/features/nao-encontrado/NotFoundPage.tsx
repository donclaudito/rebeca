import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, EmptyState } from '@/components/ui/primitives';

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Página não encontrada"
        subtitle="O endereço aberto não corresponde a nenhuma tela deste canal."
        sample={false}
      />
      <Card className="p-4">
        <EmptyState
          icon={<Compass size={22} />}
          title="Esse caminho não existe"
          description="Talvez o endereço tenha vindo sem o canal. Neste app, toda tela de canal carrega o canal na própria URL."
          action={
            <Link to="/portfolio" className="ams-btn ams-btn--primary">
              Ir para o portfólio
            </Link>
          }
        />
      </Card>
    </>
  );
}
