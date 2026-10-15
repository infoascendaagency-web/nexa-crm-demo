// «E-commerce»: constructor de la tienda, inventario, pedidos y pagos, métricas y publicación en la web del cliente.
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { PageHeader, cx } from '../../components/ui';
import Tienda from './Tienda';
import Inventario from './Inventario';
import Pedidos from './Pedidos';
import Metricas from './Metricas';
import Publicar from './Publicar';

const TABS = [{ to: 'tienda', label: 'Tienda' }, { to: 'inventario', label: 'Inventario' }, { to: 'pedidos', label: 'Pedidos y pagos' }, { to: 'metricas', label: 'Métricas' }, { to: 'publicar', label: 'Publicar' }];
export default function Ecommerce() {
  return <div className="p-4 sm:p-6">
    <PageHeader title="E-commerce" sub="Arma tu tienda, controla el inventario, recibe pedidos y mide tus ventas." />
    <nav aria-label="E-commerce" className="scroll-thin mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map(t => <NavLink key={t.to} to={`/ecommerce/${t.to}`} className={({ isActive }) => cx('-mb-px shrink-0 border-b-2 px-4 py-2.5 text-[14px] font-semibold', isActive ? 'border-brand text-navy' : 'border-transparent text-slate hover:text-navy')}>{t.label}</NavLink>)}
    </nav>
    <Routes>
      <Route index element={<Navigate to="tienda" replace />} />
      <Route path="tienda" element={<Tienda />} />
      <Route path="inventario" element={<Inventario />} />
      <Route path="pedidos" element={<Pedidos />} />
      <Route path="metricas" element={<Metricas />} />
      <Route path="publicar" element={<Publicar />} />
      <Route path="*" element={<Navigate to="/ecommerce/tienda" replace />} />
    </Routes>
  </div>;
}
