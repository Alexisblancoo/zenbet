import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

export default function MainLayout() {
  return (
    <div className='min-h-screen bg-obsidian-void text-slate-100 flex flex-col font-sans selection:bg-crimson selection:text-white'>
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
    </div>
  );
}
