import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';

export default function PerfilLayout() {
  return (
    <div className='perfil-layout'>
      <Header />
      <div className='perfil-layout__body'>
        <Sidebar />
        <main className='perfil-layout__main'><Outlet /></main>
      </div>
      <Footer />
    </div>
  );
}
