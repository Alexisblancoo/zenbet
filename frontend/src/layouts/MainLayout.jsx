import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import MobileDock from './components/MobileDock';
import ConsentNotice from '@/components/common/ConsentNotice';
import { useBetSlip } from '@/context/betSlipState';

export default function MainLayout() {
  const { selections } = useBetSlip();
  const hasSelections = selections.length > 0;
  const bottomPadding = hasSelections
    ? 'pb-[calc(136px+env(safe-area-inset-bottom))]'
    : 'pb-[calc(64px+env(safe-area-inset-bottom))]';

  return (
    <div
      className={`min-h-screen bg-obsidian-void text-slate-100 flex flex-col font-sans selection:bg-crimson selection:text-white ${bottomPadding} min-[1400px]:pb-0`}
    >
      {/* Header Fijo */}
      <Header />

      {/* Cuerpo principal con Sidebar y Contenido de rutas */}
      <div className='flex-1 flex w-full max-w-[1920px] mx-auto'>
        <Sidebar />
        <main className='flex-1 min-w-0 flex flex-col bg-obsidian-void'>
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <Footer />

      {/* Accesos rápidos en pantallas pequeñas */}
      <MobileDock />

      {/* Banner flotante de consentimiento legal */}
      <ConsentNotice />
    </div>
  );
}
