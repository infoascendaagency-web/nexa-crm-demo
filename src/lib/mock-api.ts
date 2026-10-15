// API SIMULADA para la demo: responde en memoria (y en localStorage) a las rutas de Redes sociales, E-commerce, Desarrollo e Integraciones,
// con las mismas formas que el backend real. Todo es ficticio. Se usa solo cuando VITE_MODE !== 'connected' (ver backend.ts → api()).
import { ApiError } from './backend';
import * as db from './db';
import { ME, OWNERS } from './schema';

const KEY = 'nexa-demo-mock-v1';
function fail(status: number, code: string, detail?: unknown): never { throw new ApiError(status, code, detail); }
const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const dayAgo = (d: number, hour = 12) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(hour, Math.floor((d * 7) % 60), 0, 0); return x.toISOString(); };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null));
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- imágenes ficticias (SVG en data-URI, sin red) ---------- */
const svg = (a: string, b: string, label: string, kind = 0) => {
  const shapes = [`<circle cx="270" cy="110" r="70" fill="#fff" opacity=".22"/><circle cx="130" cy="190" r="48" fill="#fff" opacity=".16"/>`, `<rect x="90" y="70" width="220" height="150" rx="14" fill="#fff" opacity=".2"/><rect x="130" y="110" width="140" height="70" rx="8" fill="#fff" opacity=".18"/>`, `<polygon points="200,50 330,230 70,230" fill="#fff" opacity=".2"/>`, `<ellipse cx="200" cy="170" rx="120" ry="60" fill="#fff" opacity=".2"/><rect x="170" y="60" width="60" height="90" rx="10" fill="#fff" opacity=".22"/>`][kind % 4];
  const s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/>${shapes}<text x="200" y="272" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#fff" opacity=".9">${label.replace(/[<&>]/g, '')}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
};

/* ---------- estado ---------- */
type Any = any; // eslint-disable-line
type State = { v: 1; seededAt: number; seq: number; social: Any; shop: Any };
let S: State | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const save = () => { clearTimeout(timer); timer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* sin almacenamiento */ } }, 250); };
const nid = () => (S!.seq += 1);
function st(): State {
  if (S) return S;
  try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw) as State; if (p?.v === 1 && Date.now() - p.seededAt < 7 * 86400000) return (S = p); } } catch { /* */ }
  S = { v: 1, seededAt: Date.now(), seq: 1000, social: seedSocial(), shop: seedShop() }; save(); return S;
}
export const resetMock = () => { try { localStorage.removeItem(KEY); } catch { /* */ } S = null; st(); };

/* =====================================================================
   E-COMMERCE · datos
   ===================================================================== */
const CATS: [string, string, string, string][] = [['Iluminación', 'Lámparas y luz cálida', '#f59f00', '#e8590c'], ['Textiles', 'Mantas, cojines y cortinas', '#7950f2', '#be4bdb'], ['Decoración', 'Detalles para cada rincón', '#12b886', '#0b7285'], ['Cocina y mesa', 'Vajilla y servir', '#fa5252', '#c2255c'], ['Plantas y macetas', 'Verde para tu casa', '#51cf66', '#2b8a3e']];
// [nombre, sección(1..5), precio, costo, stock, oferta, etiqueta, estado, sku]
const PRODS: [string, number, number, number, number, number | null, string | null, string, string][] = [
  ['Lámpara de mesa Aurora', 1, 89, 38, 14, null, 'Nuevo', 'published', 'LUZ-001'], ['Aplique de pared Luna', 1, 64, 26, 3, null, null, 'published', 'LUZ-002'], ['Guirnalda LED cálida', 1, 24, 8, 40, null, null, 'published', 'LUZ-003'],
  ['Manta tejida Nube', 2, 59, 22, 22, 47, null, 'published', 'TEX-001'], ['Fundas de cojín de lino (set de 2)', 2, 32, 11, 60, null, null, 'published', 'TEX-002'], ['Alfombra de yute 160×230', 2, 210, 95, 0, null, null, 'published', 'TEX-003'], ['Cortina de lino blanco', 2, 78, 30, 9, null, null, 'published', 'TEX-004'],
  ['Espejo redondo 60 cm', 3, 120, 52, 7, null, null, 'published', 'DEC-001'], ['Jarrón de cerámica Terra', 3, 45, 16, 18, null, null, 'published', 'DEC-002'], ['Set de 3 marcos de madera', 3, 38, 14, 25, 29, null, 'published', 'DEC-003'], ['Reloj de pared minimal', 3, 52, 20, 11, null, null, 'published', 'DEC-004'],
  ['Vajilla 16 piezas Alba', 4, 135, 62, 12, null, 'Más vendido', 'published', 'COC-001'], ['Tabla de servir de acacia', 4, 36, 13, 30, null, null, 'published', 'COC-002'], ['Set de vasos soplados (6)', 4, 42, 15, 2, null, null, 'published', 'COC-003'],
  ['Maceta de cerámica grande', 5, 34, 12, 20, null, null, 'published', 'PLA-001'], ['Soporte de macetas de bambú', 5, 48, 18, 8, null, 'Próximamente', 'draft', 'PLA-002'],
];
const CUSTOMERS = ['Valentina Mora', 'Camilo Reyes', 'Lucía Ferrer', 'Andrés Salcedo', 'Marta Quiroga', 'Julián Paredes', 'Sofía Linares', 'Diego Arango', 'Paula Ibarra', 'Mateo Cárdenas', 'Elena Robledo', 'Tomás Villar', 'Irene Solano', 'Gabriel Ocampo', 'Natalia Bravo', 'Hugo Esteves', 'Carla Montoya', 'Pablo Serrano', 'Inés Valdés', 'Rafael Quesada', 'Alicia Naranjo', 'Bruno Cifuentes', 'Daniela Pons', 'Óscar Lozano', 'Teresa Hidalgo', 'Martín Rueda', 'Clara Beltrán', 'Álvaro Mena'];
const STREETS = ['Calle de los Almendros 12', 'Av. del Mar 240', 'Paseo del Parque 7, 3.º B', 'Calle Mayor 58', 'Camino Real 91', 'Plaza del Sol 4'];

function seedShop() {
  const r = rng(77);
  const categories = CATS.map(([name, description, a, b], i) => ({ id: i + 1, name, slug: norm(name).replace(/[^a-z0-9]+/g, '-'), description, mediaId: null, imageUrl: svg(a, b, name, i), position: i, visible: true }));
  const products = PRODS.map(([name, cat, price, cost, stock, sale, badge, status, sku], i) => {
    const [, , a, b] = CATS[cat - 1];
    return { id: i + 1, sku, name, description: `${name}: diseño sencillo y materiales cuidados para el día a día. Pieza demostrativa de la tienda ficticia Casa Aurora.`, categoryId: cat, price, cost, salePrice: sale, saleStarts: null, saleEnds: null, stock, trackStock: true,
      specs: [{ k: 'Material', v: ['Cerámica', 'Lino', 'Madera', 'Vidrio', 'Metal'][i % 5] }, { k: 'Garantía', v: '2 años' }], badge, status, position: i,
      images: [{ id: i * 10 + 1, mediaId: null, url: svg(a, b, name.length > 24 ? name.slice(0, 22) + '…' : name, i), alt: name }] };
  });
  const methods: Record<string, Any> = {
    whatsapp: { enabled: true, config: { message: 'Hola, quiero hacer este pedido:' }, secrets: {} }, form: { enabled: true, config: { notifyEmail: 'pedidos@casaaurora.example' }, secrets: {} },
    transfer: { enabled: true, config: { bank: 'Banco Ejemplo', iban: 'ES00 0000 0000 0000 0000 0000', holder: 'Casa Aurora S.L.', instructions: 'Envía el comprobante por WhatsApp.' }, secrets: {} },
    cash: { enabled: false, config: { zones: 'Entrega en la ciudad' }, secrets: {} }, stripe: { enabled: false, config: {}, secrets: {} }, paypal: { enabled: false, config: {}, secrets: {} }, mercadopago: { enabled: false, config: {}, secrets: {} },
  };
  // pedidos: ~28 en los últimos 35 días
  const orders: Any[] = []; const moves: Any[] = [];
  const statuses = ['delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'shipped', 'shipped', 'confirmed', 'confirmed', 'new', 'new', 'cancelled'];
  const pay = ['whatsapp', 'whatsapp', 'form', 'transfer', 'transfer', 'cash'];
  const unitFor = (p: Any) => (p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price);
  for (let i = 0; i < 28; i++) {
    const d = 35 - Math.floor((i / 28) * 35); const status = d <= 1 ? 'new' : statuses[Math.floor(r() * statuses.length)] === 'new' && d > 6 ? 'delivered' : statuses[Math.floor(r() * statuses.length)];
    const n = 1 + Math.floor(r() * 3); const items: Any[] = []; const used = new Set<number>();
    for (let k = 0; k < n; k++) { const p = products[Math.floor(r() * products.length)]; if (used.has(p.id) || p.status !== 'published') continue; used.add(p.id); items.push({ id: orders.length * 10 + k + 1, productId: p.id, name: p.name, sku: p.sku, qty: 1 + Math.floor(r() * 2), unitPrice: unitFor(p), onSale: p.salePrice != null && p.salePrice < p.price }); }
    if (!items.length) { const p = products[0]; items.push({ id: orders.length * 10 + 1, productId: p.id, name: p.name, sku: p.sku, qty: 1, unitPrice: unitFor(p), onSale: false }); }
    const subtotal = items.reduce((s, it) => s + it.qty * products.find(p => p.id === it.productId)!.price, 0), total = items.reduce((s, it) => s + it.qty * it.unitPrice, 0), costTotal = items.reduce((s, it) => s + it.qty * products.find(p => p.id === it.productId)!.cost, 0);
    const method = pay[Math.floor(r() * pay.length)]; const name = CUSTOMERS[i % CUSTOMERS.length];
    const stockApplied = ['confirmed', 'shipped', 'delivered'].includes(status);
    const paymentStatus = status === 'delivered' ? 'paid' : status === 'cancelled' ? 'unpaid' : status === 'new' ? 'unpaid' : method === 'transfer' ? 'pending' : 'paid';
    orders.push({ id: 5000 + i, code: `CA-${1001 + i}`, status, paymentMethod: method, paymentStatus, customerName: name, customerEmail: `${norm(name).replace(/[^a-z]+/g, '.')}@correo.example`, customerPhone: `+34 600 ${pad(10 + i)} ${pad(20 + i)} 0${i % 10}`, customerAddress: STREETS[i % STREETS.length], notes: i % 6 === 0 ? 'Regalo: sin factura en el paquete, por favor.' : '', currency: 'USD', subtotal, discount: Math.round((subtotal - total) * 100) / 100, total, costTotal, contactId: null, stockApplied, createdAt: dayAgo(d, 9 + (i % 9)), items });
  }
  orders.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  // movimientos de inventario coherentes con el stock actual
  const sold: Record<number, number> = {};
  for (const o of orders) if (o.stockApplied) for (const it of o.items) sold[it.productId] = (sold[it.productId] ?? 0) + it.qty;
  const raw: Any[] = [];
  for (const p of products) raw.push({ productId: p.id, name: p.name, sku: p.sku, kind: 'in', qty: p.stock + (sold[p.id] ?? 0), reason: 'Compra inicial al proveedor', by: 'Equipo Nexa', createdAt: dayAgo(40) });
  for (const o of orders) if (o.stockApplied) for (const it of o.items) raw.push({ productId: it.productId, name: it.name, sku: it.sku, kind: 'sale', qty: -it.qty, reason: `Pedido ${o.code}`, by: null, createdAt: o.createdAt });
  raw.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const run: Record<number, number> = {};
  for (const m of raw) { run[m.productId] = (run[m.productId] ?? 0) + m.qty; moves.push({ id: moves.length + 1, ...m, stockAfter: run[m.productId] }); }
  moves.reverse();
  const settings = { slug: 'casa-aurora', name: 'Casa Aurora', tagline: 'Hogar, luz y detalles que se quedan', currency: 'USD', locale: 'es', whatsapp_number: '34600000000', order_email: 'pedidos@casaaurora.example', low_stock: 5, published: true,
    theme: { accent: '#E8590C', ribbon: '#FFD43B' }, cover: { title: 'Casa Aurora', subtitle: 'Piezas de hogar con carácter. Pide por WhatsApp o por nota de pedido.', imageMediaId: null, imageUrl: svg('#fd7e14', '#862e9c', 'Casa Aurora', 3) },
    publish: { siteUrl: 'casaaurora.example', mode: 'route', subdomain: 'tienda', path: '/tienda', provider: 'cloudflare' }, allowed_origins: ['https://casaaurora.example'], publicPageUrl: '#/ecommerce/tienda' };
  return { settings, categories, products, orders, moves, methods, seq: { cat: 100, prod: 100, order: 6000, move: moves.length + 1, media: 1 } };
}

const METHOD_DEFS: Record<string, Any> = {
  whatsapp: { label: 'Nota de pedido por WhatsApp', kind: 'offline', description: 'El cliente envía su pedido como un mensaje de WhatsApp ya redactado. Tú confirmas y cobras como prefieras.', implemented: true, docsUrl: null, configFields: [{ key: 'message', label: 'Mensaje inicial', type: 'textarea' }], secretFields: [] },
  form: { label: 'Nota de pedido por formulario / correo', kind: 'offline', description: 'El pedido llega al CRM y por correo, y el cliente se guarda como contacto.', implemented: true, docsUrl: null, configFields: [{ key: 'notifyEmail', label: 'Correo de avisos' }], secretFields: [] },
  transfer: { label: 'Transferencia bancaria', kind: 'offline', description: 'Se muestran tus datos bancarios al terminar el pedido; marcas «pagado» cuando llegue el dinero.', implemented: true, docsUrl: null, configFields: [{ key: 'bank', label: 'Banco' }, { key: 'holder', label: 'Titular' }, { key: 'iban', label: 'IBAN / cuenta' }, { key: 'instructions', label: 'Instrucciones', type: 'textarea' }], secretFields: [] },
  cash: { label: 'Pago contra entrega', kind: 'offline', description: 'El cliente paga en efectivo al recibir el pedido.', implemented: true, docsUrl: null, configFields: [{ key: 'zones', label: 'Zonas con entrega' }], secretFields: [] },
  stripe: { label: 'Tarjeta (Stripe)', kind: 'online', description: 'Cobro con tarjeta en la propia tienda.', implemented: false, docsUrl: 'https://stripe.com/docs', configFields: [{ key: 'accountLabel', label: 'Nombre de la cuenta' }], secretFields: [{ key: 'secretKey', label: 'Clave secreta' }] },
  paypal: { label: 'PayPal', kind: 'online', description: 'Cobro con cuenta PayPal o tarjeta.', implemented: false, docsUrl: 'https://developer.paypal.com', configFields: [{ key: 'accountLabel', label: 'Nombre de la cuenta' }], secretFields: [{ key: 'clientSecret', label: 'Client secret' }] },
  mercadopago: { label: 'Mercado Pago', kind: 'online', description: 'Cobro con tarjeta y medios locales de Latinoamérica.', implemented: false, docsUrl: 'https://www.mercadopago.com/developers', configFields: [], secretFields: [{ key: 'accessToken', label: 'Access token' }] },
};

/* =====================================================================
   REDES SOCIALES · datos
   ===================================================================== */
type Msg = { id: number; direction: 'in' | 'out'; author: string; body: string; status: string; isInternal: boolean; simulated: boolean; createdAt: string; error?: string };
const ACCOUNTS = [
  { id: 1, channel: 'instagram', externalId: '17841400000001', name: 'Casa Aurora', username: 'casaaurora.demo', status: 'connected', permissions: ['instagram_basic', 'instagram_manage_messages', 'instagram_manage_comments'], simulated: false },
  { id: 2, channel: 'facebook', externalId: '100000000000001', name: 'Casa Aurora', username: 'casaaurora', status: 'connected', permissions: ['pages_messaging', 'pages_manage_engagement'], simulated: false },
  { id: 3, channel: 'tiktok', externalId: 'tt_000001', name: 'Casa Aurora', username: 'casaaurora.demo', status: 'connected', permissions: ['business_messaging'], simulated: false },
  { id: 4, channel: 'whatsapp', externalId: '15550000001', name: 'Casa Aurora · tienda', username: '+34 600 000 000', status: 'connected', permissions: ['whatsapp_business_messaging'], simulated: false },
];
const ACC_NAME: Record<string, string> = { instagram: '@casaaurora.demo', facebook: 'Casa Aurora', tiktok: '@casaaurora.demo', whatsapp: 'Casa Aurora · tienda' };
const PLATS = ['instagram', 'facebook', 'tiktok', 'whatsapp'] as const;

function cannedReply(text: string, name = ''): string {
  const t = norm(text); const n = name.split(' ')[0];
  if (/precio|cuanto|cuesta|costo|valor/.test(t)) return `¡Hola${n ? ' ' + n : ''}! Los precios van desde 24 € (guirnalda LED) hasta 210 € (alfombra de yute). ¿Qué pieza te interesa? Te paso el enlace directo.`;
  if (/envio|enviar|entrega|llega/.test(t)) return 'Enviamos a toda la península en 48-72 h. Pedidos de más de 60 € con envío gratis. ¿A qué código postal sería?';
  if (/horario|abierto|tienda fisica|ubicacion|donde/.test(t)) return 'Somos tienda online con showroom en el centro: lun-sáb de 10 a 19 h. Te comparto la ubicación si quieres pasar.';
  if (/devol|cambio|garantia/.test(t)) return 'Tienes 30 días para devolverlo sin dar explicaciones y 2 años de garantía. Si algo llegó mal, mándanos una foto y lo resolvemos hoy.';
  if (/disponible|stock|queda|hay /.test(t)) return 'Déjame comprobarlo: dime qué artículo es y te confirmo existencias ahora mismo.';
  return `¡Gracias por escribirnos${n ? ', ' + n : ''}! Cuéntame qué buscas (estilo, medidas o presupuesto) y te recomiendo opciones de Casa Aurora.`;
}

function seedSocial() {
  const owners = OWNERS.slice(0, 3).map(o => o.id); const me = ME.id; const contacts = db.state().records.contacts.filter(c => !c.archived).slice(0, 40);
  const convs: Any[] = []; const msgs: Record<number, Msg[]> = {}; let mid = 1;
  const add = (platform: string, kind: 'dm' | 'comment', name: string, handle: string, minAgo: number, thread: [('in' | 'out'), string, string?, string?][], o: Any = {}) => {
    const id = convs.length + 1; let t = minAgo + thread.length * 3;
    msgs[id] = thread.map(([dir, body, author, status]) => { t -= 3; return { id: mid++, direction: dir, author: author ?? (dir === 'in' ? 'customer' : 'user'), body, status: status ?? 'sent', isInternal: false, simulated: false, createdAt: ago(Math.max(1, t)) }; });
    const c = o.contact != null ? contacts[o.contact] : null;
    convs.push({ id, kind, status: o.status ?? 'open', participantName: name, participantHandle: handle, unreadCount: o.unread ?? 0, lastMessagePreview: '', lastMessageAt: '', channel: platform, accountName: ACC_NAME[platform], contactId: c ? c.id : null,
      contactName: c ? [c.properties.firstname, c.properties.lastname].filter(Boolean).join(' ') : null, assignedOwnerId: o.owner != null ? (o.owner === 'me' ? me : owners[o.owner] ?? null) : null, aiState: o.ai ?? 'idle', simulated: false, captured: o.captured ?? {}, postId: o.post });
  };
  add('instagram', 'dm', 'Valentina Mora', '@vale.mora', 6, [['in', 'Hola! Cuánto cuesta la lámpara de mesa Aurora?'], ['out', 'ola', 'x'], ['in', '¿Y la tenéis en color negro?']], { unread: 2, ai: 'draft_ready', owner: 0, contact: 0, captured: { name: 'Valentina Mora', interest: 'Lámpara de mesa Aurora' } });
  msgs[1][1] = { ...msgs[1][1], body: '¡Hola Valentina! La lámpara de mesa Aurora cuesta 89 € y tenemos 14 unidades. ¿Quieres que te pase el enlace?', author: 'ai' };
  msgs[1].push({ id: mid++, direction: 'out', author: 'ai', body: 'Ahora mismo solo la tenemos en blanco cálido, pero el aplique Luna sí viene en negro (64 €). ¿Te interesa?', status: 'draft', isInternal: false, simulated: false, createdAt: ago(5) });
  add('instagram', 'comment', 'Camilo Reyes', '@camilo_r', 22, [['in', '¿Precio del espejo redondo? 😍'], ['out', 'Hola Camilo, 120 € el espejo de 60 cm. Te escribo por privado con el enlace 🙌', 'rule']], { post: 'reel_espejo_01', ai: 'replied' });
  add('facebook', 'dm', 'Lucía Ferrer', 'Lucía Ferrer', 41, [['in', 'Buenas tardes, ¿hacen envíos a Valencia?'], ['out', 'Hola Lucía, sí: enviamos a toda la península en 48-72 h y gratis desde 60 €.', 'ai'], ['in', 'Perfecto. Mi teléfono es +34 611 222 333 por si necesitáis llamarme']], { unread: 1, contact: 1, owner: 1, ai: 'replied', captured: { name: 'Lucía Ferrer', phone: '+34 611 222 333', interest: 'Envío a Valencia' } });
  add('whatsapp', 'dm', 'Andrés Salcedo', '+34 622 111 004', 55, [['in', 'Hola, quiero hacer un pedido: 2 fundas de cojín y una manta Nube'], ['out', '¡Hola Andrés! Te paso la nota de pedido: 2 × Fundas de cojín (32 €) + 1 × Manta Nube (47 € en oferta). Total 111 €. ¿Pagas por transferencia?'], ['in', 'Sí, transferencia. Mi correo andres.salcedo@correo.example']], { unread: 1, owner: 'me', contact: 2, captured: { name: 'Andrés Salcedo', email: 'andres.salcedo@correo.example', interest: 'Pedido: cojines + manta' } });
  add('tiktok', 'comment', 'marta.q', '@marta.q', 70, [['in', 'ya quiero ese set de vasos!! 🥂 hay envío?'], ['out', '¡Hola! Envío a toda España 🚚 Te lo cuento por DM.', 'rule']], { post: 'tt_vasos_02', ai: 'replied' });
  add('instagram', 'dm', 'Julián Paredes', '@julianp', 95, [['in', 'Tengo una consulta sobre una devolución, llegó el jarrón con una grieta 😞']], { unread: 1, ai: 'needs_human', owner: 2, captured: { name: 'Julián Paredes', notes: 'Jarrón roto en el envío' } });
  add('facebook', 'comment', 'Sofía Linares', 'Sofía Linares', 130, [['in', 'Precioso el reloj minimal, ¿hay stock?'], ['out', 'Hola Sofía, tenemos 11 unidades. Te dejo el enlace por mensaje privado 😊', 'ai']], { post: 'post_reloj_09', ai: 'replied' });
  add('whatsapp', 'dm', 'Diego Arango', '+34 633 000 120', 180, [['in', 'Buenas! ¿Tenéis la alfombra de yute?'], ['out', 'Hola Diego, ahora mismo está agotada. Repone el 28; te avisamos si quieres.'], ['in', 'Avisadme porfa']], { status: 'open', owner: 0, contact: 3, captured: { name: 'Diego Arango', interest: 'Alfombra de yute (reposición)' } });
  add('instagram', 'dm', 'Paula Ibarra', '@paula.ibarra', 240, [['in', 'Hola 🙂 ¿Hacéis descuento por comprar varias cosas?'], ['out', '¡Hola Paula! En pedidos de +3 artículos aplicamos un 10 %. ¿Qué te gustaría llevar?'], ['in', 'Una vajilla y 2 maceteros']], { contact: 4, unread: 1, ai: 'draft_ready', owner: 1 });
  msgs[9].push({ id: mid++, direction: 'out', author: 'ai', body: 'Genial: la Vajilla Alba (135 €) + 2 macetas grandes (34 € c/u) suman 203 €; con el 10 % quedan en 182,70 €. ¿Te preparo la nota de pedido?', status: 'draft', isInternal: false, simulated: false, createdAt: ago(230) });
  add('tiktok', 'dm', 'Mateo Cárdenas', '@mateo.c', 300, [['in', '¿Cuál es el horario de la tienda?'], ['out', 'Somos online con showroom: lun-sáb de 10 a 19 h 🏡', 'ai']], { ai: 'replied' });
  add('facebook', 'dm', 'Elena Robledo', 'Elena Robledo', 360, [['in', 'Me llegó el pedido CA-1008 pero falta un cojín'], ['out', 'Lo siento mucho, Elena. Ya lo revisamos con almacén y te enviamos el cojín hoy mismo sin coste.']], { status: 'closed', owner: 2, contact: 5 });
  add('whatsapp', 'dm', 'Tomás Villar', '+34 644 987 321', 420, [['in', 'Hola, ¿puedo recoger el pedido en el showroom?'], ['out', 'Claro Tomás, te avisamos cuando esté listo (24 h).']], { owner: 'me' });
  add('instagram', 'comment', 'irene_sol', '@irene_sol', 500, [['in', '¿Medidas de la cortina de lino?'], ['out', 'Hola Irene, 140 × 260 cm. Te la dejamos por DM con la guía 📏', 'rule']], { post: 'reel_cortina_04', ai: 'replied' });
  add('facebook', 'comment', 'Gabriel Ocampo', 'Gabriel Ocampo', 640, [['in', 'Esperaba más de la manta, es algo fina']], { post: 'post_manta_03', unread: 1, ai: 'needs_human' });
  add('instagram', 'dm', 'Natalia Bravo', '@nat.bravo', 800, [['in', 'Hola! Trabajo en un hotel boutique, ¿hacéis precio para volumen?'], ['out', '¡Hola Natalia! Sí, tenemos tarifa profesional. ¿Me cuentas qué piezas y cantidades?'], ['in', 'Unas 30 lámparas Aurora y 60 fundas. Mi mail: natalia@hotelbravo.example']], { unread: 1, owner: 0, contact: 6, captured: { name: 'Natalia Bravo', email: 'natalia@hotelbravo.example', interest: 'Volumen: 30 lámparas + 60 fundas' } });
  add('tiktok', 'comment', 'hugo.esteves', '@hugo.esteves', 1000, [['in', 'Pedí el espejo y llegó en 2 días, brutal 🔥']], { post: 'tt_espejo_01' });
  add('whatsapp', 'dm', 'Carla Montoya', '+34 655 112 090', 1300, [['in', '¿Aceptáis pago contra entrega?'], ['out', 'Por ahora solo transferencia y nota de pedido; el pago contra entrega lo activamos pronto.']], { contact: 7 });
  add('facebook', 'dm', 'Pablo Serrano', 'Pablo Serrano', 1700, [['in', 'Hola, ¿tenéis catálogo en PDF?'], ['out', 'Hola Pablo, aquí el catálogo actualizado: casaaurora.example/catalogo', 'ai']], { ai: 'replied', status: 'closed' });
  add('instagram', 'dm', 'Inés Valdés', '@ines.v', 2100, [['in', 'Me encantó la guirnalda LED, la quiero para una boda. ¿Hay 20 unidades?'], ['out', 'Hay 40 en stock. Para bodas hacemos 10 % por 20 o más unidades. ¿Fecha del evento?']], { owner: 1, contact: 8 });
  add('whatsapp', 'dm', 'Rafael Quesada', '+34 666 450 771', 3000, [['in', 'Gracias, todo perfecto con el pedido 🙌']], { status: 'closed' });
  for (const c of convs) { const m = msgs[c.id].filter(x => x.status !== 'draft'); const last = m[m.length - 1] ?? msgs[c.id][msgs[c.id].length - 1]; c.lastMessagePreview = last.body.slice(0, 120); c.lastMessageAt = last.createdAt; }
  const rules = [
    { id: 1, name: 'Precio por comentario', enabled: true, mode: 'fixed', channels: ['ig_comment', 'fb_comment', 'tt_comment'], accountIds: [], conditions: { keywords: ['precio', 'cuánto cuesta', 'cuanto vale'], matchAll: false, postIds: [], firstMessageOnly: false, schedule: null }, replyText: 'Hola {{nombre}} 👋 Te escribimos por privado con el precio y el enlace.', priority: 10 },
    { id: 2, name: 'Bienvenida en mensajes directos', enabled: true, mode: 'fixed', channels: ['ig_dm', 'fb_dm', 'wa_dm', 'tt_dm'], accountIds: [], conditions: { keywords: [], matchAll: false, postIds: [], firstMessageOnly: true, schedule: null }, replyText: '¡Hola {{nombre}}! Gracias por escribir a Casa Aurora 🧡 ¿En qué te ayudamos?', priority: 50 },
    { id: 3, name: 'Fuera de horario', enabled: true, mode: 'fixed', channels: [], accountIds: [], conditions: { keywords: [], matchAll: false, postIds: [], firstMessageOnly: false, schedule: { tz: 'Europe/Madrid', days: [0, 1, 2, 3, 4, 5, 6], from: '20:00', to: '09:00' } }, replyText: 'Ahora estamos fuera de horario (10-19 h). Te respondemos mañana a primera hora.', priority: 80 },
    { id: 4, name: 'Consultas de envío (borrador IA)', enabled: true, mode: 'ai_draft', channels: [], accountIds: [], conditions: { keywords: ['envío', 'envio', 'entrega', 'devolución'], matchAll: false, postIds: [], firstMessageOnly: false, schedule: null }, replyText: 'Tono cercano; menciona envío gratis desde 60 € y 30 días de devolución.', priority: 60 },
    { id: 5, name: 'Promoción de verano (pausada)', enabled: false, mode: 'off', channels: ['ig_comment'], accountIds: [], conditions: { keywords: ['oferta', 'descuento'], matchAll: false, postIds: [], firstMessageOnly: false, schedule: null }, replyText: '', priority: 120 },
  ];
  const ai = { general: { prompt: 'Somos Casa Aurora, una tienda online de hogar y decoración (iluminación, textiles, cocina y mesa, plantas). Tono cercano y cálido, frases cortas, algún emoji. Envío gratis desde 60 €, 30 días de devolución, 2 años de garantía. Nunca prometas plazos que no estén aquí ni inventes stock: si dudas, pasa la conversación a una persona. Pide siempre nombre y teléfono o correo para preparar la nota de pedido.' },
    platforms: {
      instagram: { prompt: 'Máximo 2 frases, estilo informal, 1 emoji. Si comentan «precio», responde por DM.', replyMode: 'draft', saveAsLead: true },
      facebook: { prompt: 'Más formal; ofrece el catálogo y el horario del showroom.', replyMode: 'draft', saveAsLead: true },
      tiktok: { prompt: 'Muy corto y casual. Invita a escribir por DM.', replyMode: 'off', saveAsLead: false },
      whatsapp: { prompt: 'Como un vendedor de showroom: arma la nota de pedido con artículos, cantidades y total.', replyMode: 'auto', saveAsLead: true },
    }, n8n: { appId: null as number | null, enabled: true } };
  const sources = [
    { id: 1, kind: 'drive', url: 'https://drive.google.com/drive/folders/1DemoCatalogoCasaAurora', label: 'Catálogo y precios', platforms: [], enabled: true, status: 'ok', lastSyncAt: ago(60 * 5), lastError: null, docCount: 14 },
    { id: 2, kind: 'drive', url: 'https://drive.google.com/drive/folders/1DemoPreguntasFrecuentes', label: 'Preguntas frecuentes y políticas', platforms: ['instagram', 'facebook'], enabled: true, status: 'ok', lastSyncAt: ago(60 * 5), lastError: null, docCount: 6 },
    { id: 3, kind: 'drive', url: 'https://drive.google.com/drive/folders/1DemoGuiaDeEstilo', label: 'Guía de estilo de la marca', platforms: ['tiktok'], enabled: false, status: 'pending', lastSyncAt: null, lastError: null, docCount: 0 },
  ];
  const events = [{ id: 1, conversationId: 4, status: 'queued', note: 'Enviado a n8n · flujo «Responder WhatsApp»', simulated: false, createdAt: ago(53) }, { id: 2, conversationId: 1, status: 'queued', note: 'Borrador devuelto por n8n', simulated: false, createdAt: ago(5) }, { id: 3, conversationId: 3, status: 'queued', note: 'Respuesta automática por IA', simulated: false, createdAt: ago(38) }];
  return { accounts: ACCOUNTS, convs, msgs, rules, ai, sources, events, seq: { conv: 100, msg: mid + 100, rule: 100, src: 100, ev: 100 } };
}

/* =====================================================================
   Helpers de dominio
   ===================================================================== */
const decorate = (p: Any) => {
  const shop = st().shop; const now = Date.now();
  const inWindow = (!p.saleStarts || new Date(p.saleStarts).getTime() <= now) && (!p.saleEnds || new Date(p.saleEnds).getTime() + 86400000 > now);
  const onSale = p.salePrice != null && p.salePrice < p.price && inWindow; const eff = onSale ? p.salePrice : p.price;
  const stockLevel = !p.trackStock ? 'ok' : p.stock <= 0 ? 'out' : p.stock <= shop.settings.low_stock ? 'low' : 'ok';
  return { ...clone(p), onSale, effectivePrice: eff, discountPct: onSale ? Math.round((1 - p.salePrice / p.price) * 100) : 0, stockLevel, margin: eff > 0 ? Math.round(((eff - p.cost) / eff) * 100) : 0 };
};
const catName = (id: number | null) => st().shop.categories.find((c: Any) => c.id === id)?.name ?? 'Sin sección';
const COUNTED = ['confirmed', 'shipped', 'delivered'];
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// Días antiguos (más allá de los pedidos de muestra): ventas «de fondo» deterministas para que las comparativas mensuales tengan historia.
function virtualDay(date: string) {
  const cutoff = new Date(st().seededAt - 36 * 86400000); const d = new Date(date + 'T12:00:00'); if (d >= cutoff || d < new Date(st().seededAt - 430 * 86400000)) return null;
  const h = hash(date); const orders = h % 5 === 0 ? 0 : 1 + (h % 4); const ticket = 52 + ((h >>> 5) % 70); const revenue = orders * ticket;
  return { orders, revenue, cost: Math.round(revenue * 0.52), units: orders * 2 };
}
function aggregate(from: string, to: string) {
  const days = new Map<string, Any>(); const a = new Date(from + 'T12:00:00'), b = new Date(to + 'T12:00:00');
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) { const k = isoDay(d); const v = virtualDay(k); days.set(k, { t: k, revenue: v?.revenue ?? 0, orders: v?.orders ?? 0, cost: v?.cost ?? 0, units: v?.units ?? 0 }); }
  for (const o of st().shop.orders) { if (!COUNTED.includes(o.status)) continue; const k = o.createdAt.slice(0, 10); const x = days.get(k); if (!x) continue; x.revenue += o.total; x.orders += 1; x.cost += o.costTotal; x.units += o.items.reduce((s: number, i: Any) => s + i.qty, 0); }
  const list = [...days.values()]; const sum = list.reduce((s, x) => ({ revenue: s.revenue + x.revenue, cost: s.cost + x.cost, orders: s.orders + x.orders, units: s.units + x.units }), { revenue: 0, cost: 0, orders: 0, units: 0 });
  const r2 = (n: number) => Math.round(n * 100) / 100; const profit = sum.revenue - sum.cost;
  return { list, sum: { revenue: r2(sum.revenue), cost: r2(sum.cost), profit: r2(profit), marginPct: sum.revenue ? Math.round((profit / sum.revenue) * 1000) / 10 : 0, orders: sum.orders, units: sum.units, avgTicket: sum.orders ? r2(sum.revenue / sum.orders) : 0 } };
}
const chg = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null);

function metrics(q: URLSearchParams) {
  const to = q.get('to') ?? isoDay(new Date()); const from = q.get('from') ?? isoDay(new Date(Date.now() - 29 * 86400000));
  const span = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  const pTo = new Date(new Date(from).getTime() - 86400000), pFrom = new Date(pTo.getTime() - (span - 1) * 86400000);
  const cur = aggregate(from, to), prev = aggregate(isoDay(pFrom), isoDay(pTo));
  const bucket = q.get('bucket') || (span <= 45 ? 'day' : span <= 200 ? 'week' : 'month');
  const groups = new Map<string, Any>();
  for (const x of cur.list) { const d = new Date(x.t + 'T12:00:00'); let k = x.t; if (bucket === 'week') { const w = new Date(d); w.setDate(d.getDate() - ((d.getDay() + 6) % 7)); k = isoDay(w); } else if (bucket === 'month') k = x.t.slice(0, 7); const g = groups.get(k) ?? { t: k, revenue: 0, orders: 0, cost: 0 }; g.revenue += x.revenue; g.orders += x.orders; g.cost += x.cost; groups.set(k, g); }
  const series = [...groups.values()].map(g => ({ ...g, revenue: Math.round(g.revenue), cost: Math.round(g.cost) }));
  const prods = st().shop.products as Any[]; const per = new Map<number, Any>();
  for (const o of st().shop.orders) { if (!COUNTED.includes(o.status)) continue; const k = o.createdAt.slice(0, 10); if (k < from || k > to) continue; for (const it of o.items) { const p = prods.find(x => x.id === it.productId); const r = per.get(it.productId) ?? { id: it.productId, name: it.name, sku: it.sku, units: 0, revenue: 0, profit: 0, stock: p?.stock ?? 0, rotation: 0, cat: p?.categoryId ?? null }; r.units += it.qty; r.revenue += it.qty * it.unitPrice; r.profit += it.qty * (it.unitPrice - (p?.cost ?? 0)); per.set(it.productId, r); } }
  const rows = [...per.values()].map(r => ({ ...r, revenue: Math.round(r.revenue), profit: Math.round(r.profit), rotation: Math.round((r.units / Math.max(1, r.stock + r.units)) * 100) / 100 }));
  const pub = prods.filter(p => p.status === 'published').map(p => rows.find(r => r.id === p.id) ?? { id: p.id, name: p.name, sku: p.sku, units: 0, revenue: 0, profit: 0, stock: p.stock, rotation: 0, cat: p.categoryId });
  const catAgg = new Map<string, Any>(); for (const r of rows) { const n = catName(r.cat); const c = catAgg.get(n) ?? { name: n, revenue: 0, units: 0 }; c.revenue += r.revenue; c.units += r.units; catAgg.set(n, c); }
  const now = new Date(); const monthRow = (y: number, m: number) => { const f = `${y}-${pad(m + 1)}-01`; const e = new Date(y, m + 1, 0); const l = new Date(); const end = e > l && y === l.getFullYear() && m === l.getMonth() ? l : e; const a = aggregate(f, isoDay(end)); return { month: `${y}-${pad(m + 1)}`, revenue: Math.round(a.sum.revenue), orders: a.sum.orders, profit: Math.round(a.sum.profit), avgTicket: Math.round(a.sum.avgTicket) }; };
  const months: Any[] = []; for (let i = 6; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(monthRow(d.getFullYear(), d.getMonth())); }
  const lastYear = monthRow(now.getFullYear() - 1, now.getMonth());
  const mc = { current: months[6], previous: months[5], sameMonthLastYear: lastYear, vsPrevious: chg(months[6].revenue, months[5].revenue), vsLastYear: chg(months[6].revenue, lastYear.revenue) };
  const dec = prods.map(decorate); const counts: Record<string, number> = {}; for (const o of st().shop.orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return { currency: st().shop.settings.currency, range: { from, to, bucket }, summary: cur.sum, previous: prev.sum, change: { revenue: chg(cur.sum.revenue, prev.sum.revenue), profit: chg(cur.sum.profit, prev.sum.profit), orders: chg(cur.sum.orders, prev.sum.orders), avgTicket: chg(cur.sum.avgTicket, prev.sum.avgTicket) }, series,
    top: [...rows].sort((a, b) => b.units - a.units).slice(0, 5), bottom: [...pub].sort((a, b) => a.units - b.units).slice(0, 5), slowMovers: pub.filter(r => r.stock > 0).sort((a, b) => a.rotation - b.rotation).slice(0, 4),
    categories: [...catAgg.values()].sort((a, b) => b.revenue - a.revenue), months, monthCompare: mc, inventory: { totalCost: Math.round(dec.reduce((s, p) => s + p.stock * p.cost, 0)), totalSale: Math.round(dec.reduce((s, p) => s + p.stock * p.effectivePrice, 0)), lowStock: dec.filter(p => p.trackStock && p.stockLevel !== 'ok').length }, ordersByStatus: counts };
}

function pushMove(p: Any, kind: string, qty: number, reason: string, by: string | null = `${ME.firstName} ${ME.lastName}`.trim() || 'Tú') {
  const shop = st().shop; shop.moves.unshift({ id: shop.seq.move++, productId: p.id, name: p.name, sku: p.sku, kind, qty, stockAfter: p.stock, reason, by, createdAt: new Date().toISOString() });
}
const pubMethod = (id: string) => { const m = st().shop.methods[id]; const d = METHOD_DEFS[id];
  const need = d.implemented ? d.configFields.some((f: Any) => f.type !== 'bool' && ['iban', 'bank'].includes(f.key) && !m.config[f.key]) : false;
  return { id, label: d.label, kind: d.kind, description: d.description, implemented: d.implemented, docsUrl: d.docsUrl, enabled: m.enabled, status: !d.implemented ? 'coming_soon' : need ? 'needs_setup' : 'ready', config: clone(m.config), configFields: d.configFields, secretFields: d.secretFields, secretHints: Object.fromEntries(Object.entries(m.secrets).map(([k, v]) => [k, '••••' + String(v).slice(-4)])) }; };
const orderOut = (o: Any, withItems = false) => { const { items, ...rest } = clone(o); return withItems ? { ...rest, items } : rest; };

/* ---------- tienda pública (vista previa en vivo) ---------- */
export function storePreviewHtml(): string {
  const { settings: s, categories, products } = st().shop; const accent = s.theme.accent ?? '#E8590C'; const ribbon = s.theme.ribbon ?? '#FFD43B';
  const fmt = (n: number) => new Intl.NumberFormat(s.locale, { style: 'currency', currency: s.currency }).format(n);
  const cats = (categories as Any[]).filter(c => c.visible).sort((a, b) => a.position - b.position);
  const items = (products as Any[]).filter(p => p.status === 'published').map(decorate).sort((a, b) => a.position - b.position);
  const card = (p: Any) => `<article><div class="ph"><img alt="" src="${p.images[0]?.url ?? ''}"/>${p.onSale ? `<span class="rb">OFERTA −${p.discountPct}%</span>` : ''}${p.stockLevel === 'out' ? '<span class="so">Agotado</span>' : ''}</div><h3>${p.name}</h3><div class="pr">${p.onSale ? `<b>${fmt(p.effectivePrice)}</b> <s>${fmt(p.price)}</s>` : `<b>${fmt(p.price)}</b>`}</div><button ${p.stockLevel === 'out' ? 'disabled' : ''} onclick="order(${p.id},this)">Pedir por nota de pedido</button></article>`;
  const body = (cats.length ? cats : [{ id: 0, name: 'Artículos', description: '' }]).map(c => { const list = items.filter(p => !cats.length || p.categoryId === c.id); return list.length ? `<section><h2>${c.name}</h2><p class="d">${c.description ?? ''}</p><div class="g">${list.map(card).join('')}</div></section>` : ''; }).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;font-family:Helvetica,Arial,sans-serif;color:#1d2433;background:#faf8f5}header{background:${accent};color:#fff;padding:34px 22px;background-image:url("${s.cover.imageUrl ?? ''}");background-size:cover;background-blend-mode:multiply}
header h1{margin:0;font-size:30px}header p{margin:6px 0 0;opacity:.95;max-width:520px}main{padding:18px 22px 40px}section{margin-bottom:26px}h2{margin:10px 0 0}.d{margin:2px 0 12px;color:#667}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
article{background:#fff;border:1px solid #e6e1d8;border-radius:12px;overflow:hidden;padding-bottom:12px}.ph{position:relative;aspect-ratio:4/3;background:#eee}.ph img{width:100%;height:100%;object-fit:cover}
.rb{position:absolute;left:0;top:10px;background:${ribbon};padding:3px 10px;font-weight:800;font-size:11px}.so{position:absolute;right:8px;top:8px;background:#333;color:#fff;padding:2px 8px;border-radius:99px;font-size:11px}
h3{font-size:14px;margin:10px 12px 2px}.pr{margin:0 12px 8px}.pr s{color:#889;font-size:12px}button{margin:0 12px;width:calc(100% - 24px);padding:8px;border:0;border-radius:8px;background:${accent};color:#fff;font-weight:700;cursor:pointer}button:disabled{background:#bbb;cursor:default}
#t{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#14213d;color:#fff;padding:10px 16px;border-radius:10px;display:none;font-size:13px}</style>
<header><h1>${s.name}</h1><p>${s.cover.title ? `<b>${s.cover.title}</b> · ` : ''}${s.cover.subtitle || s.tagline}</p></header><main>${body || '<p>Aún no hay artículos publicados.</p>'}</main><div id="t"></div>
<script>function order(id,b){var p=parent&&parent.__nexaDemoOrder;if(!p){return}var r=p(id);var t=document.getElementById('t');t.textContent=r?('¡Pedido '+r+' enviado! Míralo en Pedidos y pagos'):'No se pudo crear el pedido';t.style.display='block';setTimeout(function(){t.style.display='none'},3200)}</script></html>`;
}
// Desde la vista previa de la tienda: crea un pedido «nuevo» y el contacto en el CRM.
if (typeof window !== 'undefined') {
  (window as Any).__nexaDemoOrder = (productId: number) => {
    const shop = st().shop; const p = shop.products.find((x: Any) => x.id === productId); if (!p) return null;
    const name = `Cliente web ${shop.seq.order - 5999}`; const d = decorate(p); const code = `CA-${1001 + shop.orders.length}`;
    let contactId: string | null = null; try { contactId = db.createRecord('contacts', { firstname: 'Cliente', lastname: `web ${shop.seq.order - 5999}`, email: `cliente.web${shop.seq.order}@correo.example`, lead_source: 'Other', product_description: p.name }).id; } catch { /* */ }
    shop.orders.unshift({ id: shop.seq.order++, code, status: 'new', paymentMethod: 'form', paymentStatus: 'unpaid', customerName: name, customerEmail: `cliente.web${shop.seq.order}@correo.example`, customerPhone: null, customerAddress: null, notes: 'Pedido creado desde la vista previa de la tienda.', currency: shop.settings.currency, subtotal: p.price, discount: p.price - d.effectivePrice, total: d.effectivePrice, costTotal: p.cost, contactId, stockApplied: false, createdAt: new Date().toISOString(), items: [{ id: nid(), productId: p.id, name: p.name, sku: p.sku, qty: 1, unitPrice: d.effectivePrice, onSale: d.onSale }] });
    save(); return code;
  };
}

/* ---------- publicación: plan de montaje ---------- */
function publishPlan(b: Any) {
  const site = String(b.siteUrl ?? '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  if (!site) fail(400, 'site_url_required'); if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) fail(400, 'site_url_invalid');
  const mode = b.mode ?? 'route', prov = b.provider ?? 'aws'; const path = b.path || '/tienda'; const sub = b.subdomain || 'tienda';
  if (mode === 'route' && !/^\/[a-z0-9/_-]{1,60}$/i.test(path)) fail(400, 'path_invalid'); if (mode === 'subdomain' && !/^[a-z0-9-]{1,40}$/i.test(sub)) fail(400, 'subdomain_invalid');
  const origin = 'https://crm.nexa.example'; const crmPage = `${origin}/tienda/${st().shop.settings.slug}`; const host = mode === 'subdomain' ? `${sub}.${site}` : site;
  const finalUrl = mode === 'embed' ? null : mode === 'route' ? `https://${site}${path}` : `https://${host}`;
  const art: Any[] = []; const steps: string[] = []; const dns: Any[] = []; const warnings: string[] = [];
  if (mode === 'embed') { art.push({ title: 'Código para pegar en tu página', filename: 'tienda-embed.html', language: 'html', content: `<div id="nexa-store"></div>\n<script src="${origin}/embed/store.js" data-store="${st().shop.settings.slug}" async></script>` }); steps.push('Abre la página de tu sitio donde quieres la tienda.', 'Pega el código en el lugar exacto donde debe verse.', 'Guarda y publica la página. La tienda se carga dentro de ella.'); }
  else if (prov === 'aws') { art.push({ title: 'Función de CloudFront (reescritura de ruta)', filename: 'cloudfront-function.js', language: 'javascript', content: `function handler(event){\n  var r = event.request;\n  if (r.uri.indexOf('${mode === 'route' ? path : '/'}') === 0) {\n    r.headers['x-store'] = { value: '${st().shop.settings.slug}' };\n  }\n  return r;\n}` }, { title: 'Origen y comportamiento', filename: 'origen.json', language: 'json', content: JSON.stringify({ origin: new URL(origin).host, pathPattern: mode === 'route' ? `${path}*` : '*', viewerProtocolPolicy: 'redirect-to-https' }, null, 2) });
    steps.push('En CloudFront, añade el CRM como un nuevo origen.', mode === 'route' ? `Crea un comportamiento para ${path}* que apunte a ese origen.` : `Asocia el dominio ${host} a la distribución.`, 'Publica la distribución y espera a que termine el despliegue (5-10 min).'); }
  else if (prov === 'cloudflare') { art.push({ title: 'Worker de Cloudflare', filename: 'worker.js', language: 'javascript', content: `export default {\n  async fetch(req) {\n    const u = new URL(req.url);\n    u.hostname = 'crm.nexa.example';\n    u.pathname = '/tienda/${st().shop.settings.slug}' + (u.pathname.replace('${mode === 'route' ? path : ''}', '') || '/');\n    return fetch(new Request(u, req));\n  }\n}` });
    steps.push('Crea un Worker en Cloudflare y pega el código.', mode === 'route' ? `Añade la ruta ${site}${path}* al Worker.` : `Crea el registro DNS de ${host} (proxy activado).`, 'Guarda y comprueba la dirección.'); }
  else { art.push({ title: 'Configuración de nginx', filename: 'tienda.conf', language: 'nginx', content: `location ${mode === 'route' ? path : '/'} {\n  proxy_pass ${origin}/tienda/${st().shop.settings.slug};\n  proxy_set_header Host crm.nexa.example;\n  proxy_ssl_server_name on;\n}` }); steps.push('Copia el bloque en el sitio de nginx que sirve tu dominio.', 'Ejecuta nginx -t y recarga el servicio.', 'Comprueba la dirección en el navegador.'); }
  if (mode === 'subdomain') dns.push({ type: 'CNAME', name: sub, value: 'crm.nexa.example', note: 'Con proxy activado si usas Cloudflare' });
  if (!st().shop.settings.published) warnings.push('La tienda está oculta: actívala en «Estado» para que responda.');
  return { finalUrl, host: mode === 'embed' ? null : host, crmPageUrl: crmPage, steps, artifacts: art, dns, warnings };
}

/* =====================================================================
   Router
   ===================================================================== */
type Ctx = { m: string[]; q: URLSearchParams; b: Any };
const routes: [string, RegExp, (c: Ctx) => Any][] = [];
const R = (method: string, pattern: string, h: (c: Ctx) => Any) => routes.push([method, new RegExp('^' + pattern.replace(/:[a-z]+/gi, '([^/]+)') + '$'), h]);
const sh = () => st().shop; const so = () => st().social;
const intId = (v: string) => { const n = Number(v); if (!Number.isInteger(n)) fail(400, 'invalid_id'); return n; };

/* ---- E-commerce ---- */
R('GET', '/ecommerce/settings', () => clone(sh().settings));
R('PUT', '/ecommerce/settings', ({ b }) => {
  const s = sh().settings; if (b.slug !== undefined && !/^[a-z0-9-]{3,40}$/.test(b.slug)) fail(400, 'slug_taken');
  for (const k of ['name', 'tagline', 'slug', 'currency', 'whatsapp_number', 'order_email', 'low_stock', 'published']) if (b[k] !== undefined) s[k] = b[k];
  if (b.whatsapp_number && !/^\d{8,15}$/.test(String(b.whatsapp_number))) fail(400, 'invalid_whatsapp_number');
  if (b.theme) s.theme = { ...s.theme, ...b.theme }; if (b.cover) s.cover = { ...s.cover, ...b.cover }; if (b.publish) s.publish = { ...s.publish, ...b.publish }; return clone(s);
});
R('GET', '/ecommerce/categories', () => ({ results: sh().categories.slice().sort((a: Any, b: Any) => a.position - b.position).map((c: Any) => ({ ...clone(c), products: sh().products.filter((p: Any) => p.categoryId === c.id && p.status !== 'archived').length })) }));
R('POST', '/ecommerce/categories/reorder', ({ b }) => { (b.ids as number[]).forEach((id, i) => { const c = sh().categories.find((x: Any) => x.id === id); if (c) c.position = i; }); return { ok: true }; });
R('POST', '/ecommerce/categories', ({ b }) => { if (!b.name?.trim()) fail(400, 'invalid_input'); const c = { id: sh().seq.cat++, name: b.name.trim(), slug: norm(b.name).replace(/[^a-z0-9]+/g, '-'), description: b.description ?? '', mediaId: b.mediaId ?? null, imageUrl: b.imageUrl ?? null, position: sh().categories.length, visible: b.visible ?? true }; sh().categories.push(c); return { ...c, products: 0 }; });
R('PATCH', '/ecommerce/categories/:id', ({ m, b }) => { const c = sh().categories.find((x: Any) => x.id === intId(m[1])); if (!c) fail(404, 'not_found'); for (const k of ['name', 'description', 'mediaId', 'imageUrl', 'visible']) if (b[k] !== undefined) c[k] = b[k]; return clone(c); });
R('DELETE', '/ecommerce/categories/:id', ({ m }) => { const id = intId(m[1]); sh().categories = sh().categories.filter((c: Any) => c.id !== id); sh().products.forEach((p: Any) => { if (p.categoryId === id) p.categoryId = null; }); return { ok: true }; });

const prodBody = (b: Any, cur: Any = {}) => {
  const p = { ...cur }; for (const k of ['name', 'sku', 'description', 'categoryId', 'price', 'cost', 'salePrice', 'saleStarts', 'saleEnds', 'stock', 'trackStock', 'specs', 'badge', 'status']) if (b[k] !== undefined) p[k] = b[k];
  if (!p.name?.trim()) fail(400, 'invalid_input'); if (p.salePrice != null && p.salePrice >= p.price) fail(400, 'sale_price_must_be_lower'); if (p.saleStarts && p.saleEnds && p.saleEnds < p.saleStarts) fail(400, 'sale_dates_invalid');
  if (p.sku && sh().products.some((x: Any) => x.sku === p.sku && x.id !== p.id)) fail(409, 'sku_taken'); return p;
};
R('GET', '/ecommerce/products', ({ q }) => { let l: Any[] = sh().products.filter((p: Any) => p.status !== 'archived'); const c = q.get('categoryId'); if (c) l = l.filter(p => String(p.categoryId) === c); return { total: l.length, results: l.sort((a, b) => a.position - b.position).map(decorate) }; });
R('POST', '/ecommerce/products/reorder', ({ b }) => { (b.ids as number[]).forEach((id, i) => { const p = sh().products.find((x: Any) => x.id === id); if (p) p.position = i; }); return { ok: true }; });
R('POST', '/ecommerce/products/bulk', ({ b }) => {
  for (const u of b.updates ?? []) { const p = sh().products.find((x: Any) => x.id === u.id); if (!p) continue; const before = p.stock;
    for (const k of ['price', 'cost', 'salePrice', 'stock']) if (u[k] !== undefined) p[k] = u[k]; if (p.salePrice != null && p.salePrice >= p.price) fail(400, 'sale_price_must_be_lower');
    if (p.stock !== before) pushMove(p, 'adjust', p.stock - before, 'Edición masiva de inventario'); }
  return { ok: true, updated: (b.updates ?? []).length };
});
R('POST', '/ecommerce/products', ({ b }) => { const id = sh().seq.prod++; const p = prodBody(b, { id, position: sh().products.length, images: [], specs: [], stock: 0, trackStock: true, status: 'draft', price: 0, cost: 0, salePrice: null, saleStarts: null, saleEnds: null, categoryId: null, badge: null, description: '' }); sh().products.push(p); return decorate(p); });
R('PATCH', '/ecommerce/products/:id', ({ m, b }) => { const i = sh().products.findIndex((x: Any) => x.id === intId(m[1])); if (i < 0) fail(404, 'not_found'); const before = sh().products[i].stock; sh().products[i] = prodBody(b, sh().products[i]); if (sh().products[i].stock !== before) pushMove(sh().products[i], 'adjust', sh().products[i].stock - before, 'Edición del artículo'); return decorate(sh().products[i]); });
R('PUT', '/ecommerce/products/:id/images', ({ m, b }) => { const p = sh().products.find((x: Any) => x.id === intId(m[1])); if (!p) fail(404, 'not_found'); p.images = (b.images ?? []).map((im: Any, i: number) => ({ id: p.id * 10 + i + 50, mediaId: im.mediaId ?? null, url: im.url ?? sh().media?.[im.mediaId] ?? null, alt: im.alt ?? '' })); return { ok: true }; });
R('DELETE', '/ecommerce/products/:id', ({ m }) => { const p = sh().products.find((x: Any) => x.id === intId(m[1])); if (!p) fail(404, 'not_found'); p.status = 'archived'; return { ok: true }; });

R('GET', '/ecommerce/inventory/moves', ({ q }) => { const pid = q.get('productId'); return { results: clone(sh().moves.filter((x: Any) => !pid || String(x.productId) === pid).slice(0, 200)) }; });
R('POST', '/ecommerce/inventory/moves', ({ b }) => {
  const p = sh().products.find((x: Any) => x.id === b.productId); if (!p) fail(404, 'not_found'); const qty = Math.floor(Number(b.qty)); if (!Number.isFinite(qty) || qty < (b.kind === 'adjust' ? 0 : 1)) fail(400, 'invalid_qty');
  if (b.kind === 'in') { p.stock += qty; if (b.unitCost != null) p.cost = b.unitCost; pushMove(p, 'in', qty, b.reason || 'Entrada de mercancía'); }
  else if (b.kind === 'out') { if (p.stock < qty) fail(409, 'insufficient_stock'); p.stock -= qty; pushMove(p, 'out', -qty, b.reason || 'Salida'); }
  else { const d = qty - p.stock; p.stock = qty; pushMove(p, 'adjust', d, b.reason || 'Ajuste de inventario'); }
  return decorate(p);
});
R('GET', '/ecommerce/inventory', ({ q }) => {
  let l: Any[] = sh().products.filter((p: Any) => p.status !== 'archived').map(decorate); const c = q.get('categoryId'), s = norm(q.get('q') ?? '');
  if (c) l = l.filter(p => String(p.categoryId) === c); if (s) l = l.filter(p => norm(p.name + ' ' + (p.sku ?? '')).includes(s)); if (q.get('low')) l = l.filter(p => p.trackStock && p.stockLevel !== 'ok');
  const all = sh().products.filter((p: Any) => p.status !== 'archived').map(decorate).filter((p: Any) => p.trackStock); const units = all.reduce((s: number, p: Any) => s + p.stock, 0), cost = all.reduce((s: number, p: Any) => s + p.stock * p.cost, 0), sale = all.reduce((s: number, p: Any) => s + p.stock * p.effectivePrice, 0);
  return { lowStockThreshold: sh().settings.low_stock, totals: { units, totalCost: Math.round(cost * 100) / 100, totalSale: Math.round(sale * 100) / 100, potentialMargin: Math.round((sale - cost) * 100) / 100, marginPct: sale ? Math.round(((sale - cost) / sale) * 1000) / 10 : 0, items: all.length, lowStock: all.filter((p: Any) => p.stockLevel !== 'ok').length }, results: l.sort((a, b) => a.position - b.position) };
});
R('GET', '/ecommerce/payment-methods', () => ({ results: Object.keys(METHOD_DEFS).map(pubMethod) }));
R('PUT', '/ecommerce/payment-methods/:id', ({ m, b }) => { const mm = sh().methods[m[1]]; if (!mm) fail(404, 'not_found'); if (b.enabled !== undefined) mm.enabled = !!b.enabled; if (b.config) mm.config = { ...mm.config, ...b.config }; if (b.secrets) for (const [k, v] of Object.entries(b.secrets)) if (v) mm.secrets[k] = v; return pubMethod(m[1]); });
R('GET', '/ecommerce/orders', ({ q }) => {
  const counts: Record<string, number> = {}; for (const o of sh().orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  let l: Any[] = sh().orders; const s = q.get('status'), t = norm(q.get('q') ?? ''); if (s) l = l.filter(o => o.status === s); if (t) l = l.filter(o => norm(`${o.code} ${o.customerName} ${o.customerPhone ?? ''}`).includes(t));
  return { total: l.length, counts, results: l.slice(0, Number(q.get('limit') ?? 100)).map(o => orderOut(o)) };
});
R('GET', '/ecommerce/orders/:id', ({ m }) => { const o = sh().orders.find((x: Any) => x.id === intId(m[1])); if (!o) fail(404, 'not_found'); return orderOut(o, true); });
R('PATCH', '/ecommerce/orders/:id', ({ m, b }) => {
  const o = sh().orders.find((x: Any) => x.id === intId(m[1])); if (!o) fail(404, 'not_found');
  if (b.paymentStatus) { if (o.status === 'cancelled') fail(409, 'order_cancelled'); o.paymentStatus = b.paymentStatus; }
  if (b.status && b.status !== o.status) {
    if (o.status === 'cancelled') fail(409, 'order_cancelled');
    if (b.status === 'confirmed' && !o.stockApplied) { for (const it of o.items) { const p = sh().products.find((x: Any) => x.id === it.productId); if (p?.trackStock && p.stock < it.qty) fail(409, 'insufficient_stock'); }
      for (const it of o.items) { const p = sh().products.find((x: Any) => x.id === it.productId); if (p?.trackStock) { p.stock -= it.qty; pushMove(p, 'sale', -it.qty, `Pedido ${o.code}`, null); } } o.stockApplied = true; }
    if (b.status === 'cancelled' && o.stockApplied) { for (const it of o.items) { const p = sh().products.find((x: Any) => x.id === it.productId); if (p?.trackStock) { p.stock += it.qty; pushMove(p, 'return', it.qty, `Cancelación ${o.code}`, null); } } o.stockApplied = false; }
    o.status = b.status; if (b.status === 'delivered' && o.paymentMethod === 'cash') o.paymentStatus = 'paid';
  }
  return orderOut(o, true);
});
R('GET', '/ecommerce/metrics', ({ q }) => metrics(q));
R('POST', '/ecommerce/publish/plan', ({ b }) => publishPlan(b));
R('POST', '/ecommerce/publish/check', () => { const p = sh().settings.publish; const host = p.mode === 'subdomain' ? `${p.subdomain}.${p.siteUrl}` : p.siteUrl; const ok = !!sh().settings.published;
  return { host, url: `https://${host}${p.mode === 'route' ? p.path : ''}`, dns: { ok: true, cname: p.mode === 'subdomain' ? ['crm.nexa.example'] : [], a: ['203.0.113.10'], blocked: false }, http: { status: ok ? 200 : 404, ms: 143, looksLikeStore: ok }, hints: ok ? [] : ['La tienda está oculta: actívala en «Estado».'] }; });

/* ---- Redes sociales ---- */
const lastOf = (id: number) => { const m: Msg[] = so().msgs[id] ?? []; return [...m].reverse().find(x => x.status !== 'draft' && !x.isInternal) ?? m[m.length - 1]; };
const touch = (c: Any) => { const l = lastOf(c.id); if (l) { c.lastMessagePreview = l.body.slice(0, 120); c.lastMessageAt = l.createdAt; } };
const convOut = (c: Any) => { const { captured, postId, ...rest } = clone(c); return rest; };
R('GET', '/social/status', () => ({ connected: true, accounts: 4, accountsConnected: 4, metaTokenConfigured: true, metaIntegrationEnabled: true, webhookUrl: 'https://crm.nexa.example/api/v1/integrations/meta/webhook', webhookRouting: true,
  requiredPermissions: [['instagram', 'instagram_basic', 'Leer el perfil de la cuenta profesional'], ['instagram', 'instagram_manage_messages', 'Recibir y responder mensajes directos'], ['instagram', 'instagram_manage_comments', 'Leer y responder comentarios'], ['facebook', 'pages_messaging', 'Recibir y responder mensajes de Messenger'], ['facebook', 'pages_manage_engagement', 'Responder y ocultar comentarios de la Página'], ['facebook', 'pages_read_user_content', 'Leer comentarios de los usuarios'], ['ambos', 'pages_show_list', 'Listar las Páginas y su Instagram enlazado'], ['whatsapp', 'whatsapp_business_messaging', 'Enviar y recibir mensajes de WhatsApp (Cloud API)'], ['tiktok', 'TikTok Accounts + Business Messaging API', 'DM de TikTok (requiere aprobación de TikTok; no disponible en EEE/Suiza/Reino Unido)']].map(([channel, scope, why]) => ({ channel, scope, why })) }));
R('GET', '/social/accounts', () => ({ results: clone(so().accounts) }));
R('GET', '/social/conversations', ({ q }) => {
  let l: Any[] = so().convs; const p = q.get('platform'), k = q.get('kind'), s = q.get('status'), a = q.get('assigned'), t = norm(q.get('q') ?? '');
  if (p) l = l.filter(c => c.channel === p); if (k) l = l.filter(c => c.kind === k); if (s) l = l.filter(c => c.status === s);
  if (a === 'me') l = l.filter(c => c.assignedOwnerId === ME.id); else if (a === 'none') l = l.filter(c => !c.assignedOwnerId); else if (a) l = l.filter(c => c.assignedOwnerId === a);
  if (t) l = l.filter(c => norm(`${c.participantName} ${c.participantHandle ?? ''} ${c.lastMessagePreview}`).includes(t));
  l = [...l].sort((x, y) => +new Date(y.lastMessageAt) - +new Date(x.lastMessageAt)); return { total: l.length, results: l.slice(0, Number(q.get('limit') ?? 60)).map(convOut) };
});
R('DELETE', '/social/simulate', () => {
  const sim = so().convs.filter((c: Any) => c.simulated); const ids = new Set(sim.map((c: Any) => c.id)); const contacts = [...new Set(sim.map((c: Any) => c.contactId).filter(Boolean))] as string[];
  so().convs = so().convs.filter((c: Any) => !ids.has(c.id)); ids.forEach(id => delete so().msgs[id as number]); so().events = so().events.filter((e: Any) => !e.simulated);
  if (contacts.length) db.deleteRecords('contacts', contacts); return { conversations: sim.length, contactsArchived: contacts.length };
});
const conv = (id: string) => { const c = so().convs.find((x: Any) => x.id === intId(id)); if (!c) fail(404, 'not_found'); return c; };
R('GET', '/social/conversations/:id/messages', ({ m }) => { const c = conv(m[1]); return { results: clone(so().msgs[c.id] ?? []) }; });
R('GET', '/social/conversations/:id', ({ m }) => { const c = conv(m[1]); return { ...convOut(c), captured: clone(c.captured ?? {}), aiState: c.aiState }; });
R('PATCH', '/social/conversations/:id/assign', ({ m, b }) => { const c = conv(m[1]); c.assignedOwnerId = b.ownerId ?? null; return convOut(c); });
R('PATCH', '/social/conversations/:id', ({ m, b }) => { const c = conv(m[1]); if (b.markRead) c.unreadCount = 0; if (b.status) c.status = b.status; return convOut(c); });
const pushMsg = (c: Any, m: Partial<Msg>) => { const msg: Msg = { id: so().seq.msg++, direction: 'out', author: 'user', body: '', status: 'sent', isInternal: false, simulated: !!c.simulated, createdAt: new Date().toISOString(), ...m }; (so().msgs[c.id] ??= []).push(msg); touch(c); return msg; };
const logEvent = (c: Any, note: string, simulated = false) => { const n8nOn = so().ai.n8n.enabled && so().ai.n8n.appId; so().events.unshift({ id: so().seq.ev++, conversationId: c.id, status: n8nOn ? 'queued' : 'skipped', note: n8nOn ? note : 'n8n desactivado: no se envió', simulated, createdAt: new Date().toISOString() }); so().events = so().events.slice(0, 40); };
R('POST', '/social/conversations/:id/reply', ({ m, b }) => { const c = conv(m[1]); if (!String(b.body ?? '').trim()) fail(400, 'invalid_input'); pushMsg(c, { body: String(b.body).trim() }); c.unreadCount = 0; if (c.aiState === 'draft_ready' || c.aiState === 'needs_human') c.aiState = 'idle'; return { ok: true }; });
R('POST', '/social/conversations/:id/note', ({ m, b }) => { const c = conv(m[1]); pushMsg(c, { body: String(b.body ?? '').trim(), isInternal: true, author: 'note' }); touch(c); return { ok: true }; });
R('POST', '/social/conversations/:id/messages/:mid/approve', ({ m }) => { const c = conv(m[1]); const x = (so().msgs[c.id] as Msg[]).find(y => y.id === intId(m[2])); if (!x) fail(404, 'not_found'); x.status = 'sent'; x.createdAt = new Date().toISOString(); c.aiState = 'replied'; c.unreadCount = 0; touch(c); logEvent(c, 'Borrador aprobado y enviado'); return { ok: true }; });
R('POST', '/social/conversations/:id/messages/:mid/discard', ({ m }) => { const c = conv(m[1]); so().msgs[c.id] = (so().msgs[c.id] as Msg[]).filter(y => y.id !== intId(m[2])); if (!(so().msgs[c.id] as Msg[]).some(y => y.status === 'draft')) c.aiState = 'idle'; touch(c); return { ok: true }; });
R('POST', '/social/conversations/:id/link-contact', ({ m, b }) => {
  const c = conv(m[1]); if (c.contactId) return { contactId: c.contactId }; if (!b.create) fail(400, 'invalid_input');
  const cap = c.captured ?? {}; const [first, ...rest] = String(cap.name ?? c.participantName).split(' ');
  const rec = db.createRecord('contacts', { firstname: first, lastname: rest.join(' ') || null, email: cap.email ?? null, mobilephone: cap.phone ?? null, lead_source: 'Other', product_description: cap.interest ?? null });
  c.contactId = rec.id; c.contactName = db.nameOf(rec, 'contacts'); return { contactId: rec.id };
});
// reglas
const matchRule = (r: Any, channel: string, text: string, first = false) => {
  if (!r.enabled) return { ok: false, why: 'Regla desactivada' }; if (r.channels.length && !r.channels.includes(channel)) return { ok: false, why: 'No aplica a este canal' };
  const c = r.conditions; if (c.firstMessageOnly && !first) return { ok: false, why: 'Solo responde al primer mensaje' };
  if (c.keywords.length) { const t = norm(text); const hits = c.keywords.map((k: string) => t.includes(norm(k))); if (!(c.matchAll ? hits.every(Boolean) : hits.some(Boolean))) return { ok: false, why: 'Ninguna palabra clave coincide' }; }
  if (c.schedule) { const now = new Date(); const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`; const { from, to, days } = c.schedule; const inside = from <= to ? hm >= from && hm <= to : hm >= from || hm <= to; if (!days.includes(now.getDay()) || !inside) return { ok: false, why: 'Fuera del horario configurado' }; }
  return { ok: true, why: 'Coincide' };
};
const ruleBody = (b: Any, cur: Any = {}) => { const r = { ...cur }; for (const k of ['name', 'enabled', 'mode', 'channels', 'accountIds', 'conditions', 'replyText', 'priority']) if (b[k] !== undefined) r[k] = b[k]; if (!String(r.name ?? '').trim()) fail(400, 'invalid_input'); return r; };
R('GET', '/social/rules', () => ({ results: clone([...so().rules].sort((a: Any, b: Any) => a.priority - b.priority)) }));
R('POST', '/social/rules/test', ({ b }) => { const rs = [...so().rules].sort((a: Any, c: Any) => a.priority - c.priority); const results = rs.map((r: Any) => ({ id: r.id, name: r.name, ...matchRule(r, b.channel, b.text ?? '', true) })); const w = results.find(r => r.ok); return { winner: w ? { name: w.name } : null, results }; });
R('POST', '/social/rules', ({ b }) => { const r = ruleBody(b, { id: so().seq.rule++, enabled: false, mode: 'fixed', channels: [], accountIds: [], priority: 100, replyText: '' }); so().rules.push(r); return clone(r); });
R('PATCH', '/social/rules/:id', ({ m, b }) => { const i = so().rules.findIndex((x: Any) => x.id === intId(m[1])); if (i < 0) fail(404, 'not_found'); so().rules[i] = ruleBody(b, so().rules[i]); return clone(so().rules[i]); });
R('DELETE', '/social/rules/:id', ({ m }) => { so().rules = so().rules.filter((x: Any) => x.id !== intId(m[1])); return undefined; });
// IA
const n8nApps = () => db.apps().map(a => ({ id: Number(a.id), name: a.name, hasTargetUrl: !!a.targetUrl, active: true }));
R('GET', '/social/ai/settings', () => { const ai = clone(so().ai); if (ai.n8n.appId == null && n8nApps().length) { /* sin elegir */ } return { ...ai, n8nApps: n8nApps() }; });
R('PUT', '/social/ai/settings', ({ b }) => { const ai = so().ai; if (b.general?.prompt !== undefined) ai.general.prompt = String(b.general.prompt); if (b.platforms) for (const [k, v] of Object.entries(b.platforms)) ai.platforms[k] = { ...ai.platforms[k], ...(v as Any) }; if (b.n8n) ai.n8n = { ...ai.n8n, ...b.n8n }; return { ok: true }; });
const syncSources = () => { for (const s of so().sources) if (s.status === 'queued' && Date.now() - (s.queuedAt ?? 0) > 3500) { s.status = 'ok'; s.lastSyncAt = new Date().toISOString(); s.docCount = 4 + (hash(s.url) % 18); s.queuedAt = undefined; } };
R('GET', '/social/ai/sources', () => { syncSources(); return { results: clone(so().sources) }; });
R('POST', '/social/ai/sources', ({ b }) => { const url = String(b.url ?? '').trim(); if (!/^https:\/\/\S+$/.test(url)) fail(400, 'invalid_input'); if (so().sources.some((s: Any) => s.url === url)) fail(409, 'duplicate_url'); const s = { id: so().seq.src++, kind: 'drive', url, label: b.label || url, platforms: b.platforms ?? [], enabled: true, status: 'pending', lastSyncAt: null, lastError: null, docCount: 0 }; so().sources.push(s); return clone(s); });
R('PATCH', '/social/ai/sources/:id', ({ m, b }) => { const s = so().sources.find((x: Any) => x.id === intId(m[1])); if (!s) fail(404, 'not_found'); if (b.enabled !== undefined) s.enabled = !!b.enabled; if (b.label !== undefined) s.label = b.label; return clone(s); });
R('POST', '/social/ai/sources/:id/sync', ({ m }) => { const s = so().sources.find((x: Any) => x.id === intId(m[1])); if (!s) fail(404, 'not_found'); s.status = 'queued'; s.queuedAt = Date.now(); return { ok: true }; });
R('DELETE', '/social/ai/sources/:id', ({ m }) => { so().sources = so().sources.filter((x: Any) => x.id !== intId(m[1])); return undefined; });
R('GET', '/social/events', ({ q }) => ({ results: clone(so().events.slice(0, Number(q.get('limit') ?? 8))) }));
// simulador de mensajes entrantes (flujo completo: bandeja → reglas → lead → IA → n8n)
R('POST', '/social/simulate/incoming', ({ b }) => {
  const platform = b.platform as string, kind = (b.kind ?? 'dm') as 'dm' | 'comment'; if (!PLATS.includes(platform as never) || !String(b.text ?? '').trim()) fail(400, 'invalid_input');
  const name = String(b.participantName ?? 'Persona de prueba'); const text = String(b.text).trim(); const ch = `${platform === 'instagram' ? 'ig' : platform === 'facebook' ? 'fb' : platform === 'tiktok' ? 'tt' : 'wa'}_${kind}`;
  let c = so().convs.find((x: Any) => x.simulated && x.channel === platform && x.kind === kind && x.participantName === name); const duplicate = !!c; const actions: string[] = [];
  if (!c) { c = { id: so().seq.conv++, kind, status: 'open', participantName: name, participantHandle: b.handle || undefined, unreadCount: 0, lastMessagePreview: '', lastMessageAt: new Date().toISOString(), channel: platform, accountName: ACC_NAME[platform], contactId: null, contactName: null, assignedOwnerId: null, aiState: 'idle', simulated: true, captured: {} }; so().convs.push(c); }
  const first = !(so().msgs[c.id] ?? []).length; pushMsg(c, { direction: 'in', author: 'customer', body: text }); c.unreadCount += 1; actions.push('guardado en la bandeja');
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0], phone = /\+?\d[\d\s-]{7,}\d/.exec(text)?.[0]; if (email) c.captured.email = email; if (phone) c.captured.phone = phone.trim(); c.captured.name = name; c.captured.interest = text.slice(0, 80);
  const plat = so().ai.platforms[platform]; if (plat.saveAsLead && kind === 'dm') {
    if (!c.contactId) { const [f, ...r] = name.split(' '); const rec = db.createRecord('contacts', { firstname: f, lastname: r.join(' ') || null, email: email ?? null, mobilephone: c.captured.phone ?? null, lead_source: 'Other', product_description: c.captured.interest }); c.contactId = rec.id; c.contactName = db.nameOf(rec, 'contacts'); actions.push('lead creado en el CRM'); }
    else { db.updateRecord('contacts', c.contactId, { ...(email ? { email } : {}), ...(c.captured.phone ? { mobilephone: c.captured.phone } : {}) }); actions.push('lead actualizado'); }
  }
  const rule = [...so().rules].sort((x: Any, y: Any) => x.priority - y.priority).find((r: Any) => matchRule(r, ch, text, first).ok);
  if (rule && rule.mode === 'fixed' && rule.replyText) { pushMsg(c, { body: rule.replyText.replace(/\{\{nombre\}\}/g, name.split(' ')[0]), author: 'rule' }); actions.push(`respondió la regla «${rule.name}»`); }
  else if (plat.replyMode !== 'off' || (rule && rule.mode === 'ai_draft')) {
    const draft = (plat.replyMode === 'draft') || rule?.mode === 'ai_draft'; const body = cannedReply(text, name);
    c.aiState = 'awaiting_n8n'; logEvent(c, 'Mensaje enviado a n8n con prompts y conocimiento', true); actions.push('enviado a n8n');
    pushMsg(c, draft ? { body, author: 'ai', status: 'draft' } : { body, author: 'ai' }); c.aiState = draft ? 'draft_ready' : 'replied'; actions.push(draft ? 'borrador de IA listo para aprobar' : 'respondió la IA');
  }
  touch(c); return { conversationId: c.id, contactId: c.contactId ? Number(c.contactId) : null, actions, duplicate };
});

/* ---- Desarrollo ---- */
const TOOLS_CAT = [
  ['crm_list_objects', 'Lista los tipos de registro del CRM (contactos, empresas, negocios, citas…) con su recuento.', 'cualquier permiso del CRM', false, false],
  ['crm_list_properties', 'Lista las propiedades (campos) de un tipo de registro, con tipo y opciones.', 'crm.schemas.<tipo>.read o crm.objects.<tipo>.read', false, false],
  ['crm_search_records', 'Busca registros con filtros, texto y orden; devuelve una página de resultados.', 'crm.objects.<tipo>.read', false, false],
  ['crm_get_record', 'Devuelve un registro por id, con sus asociaciones.', 'crm.objects.<tipo>.read', false, false],
  ['crm_list_tasks', 'Lista tareas abiertas por propietario o por fecha de vencimiento.', 'crm.objects.tasks.read', false, false],
  ['crm_create_record', 'Crea un registro nuevo (contacto, cita, negocio…) con las propiedades indicadas.', 'crm.objects.<tipo>.write', true, false],
  ['crm_update_record', 'Actualiza propiedades de un registro existente.', 'crm.objects.<tipo>.write', true, false],
  ['crm_add_note', 'Añade una nota a un registro (visible en su historial).', 'crm.objects.notes.write + escritura en el tipo', true, false],
  ['crm_archive_record', 'Archiva (borra) un registro. Solo con permiso explícito de borrado.', 'crm.objects.<tipo>.delete (nunca incluido por defecto)', true, true],
] as const;
const toolRows = () => TOOLS_CAT.map(([name, description, needs, writes, destructive]) => ({ name, description, needs, writes, destructive, inputSchema: { type: 'object', properties: {} } }));
R('GET', '/dev/mcp/tools', () => ({ server: { name: 'nexa-crm', title: 'Nexa CRM (demo)', version: '1.0.0', protocols: ['2025-06-18', '2025-03-26'] }, tools: toolRows() }));
const findContactByPhone = (ph?: string) => { const d = String(ph ?? '').replace(/\D/g, '').slice(-9); if (!d) return null; return db.state().records.contacts.find(c => !c.archived && [c.properties.mobilephone, c.properties.phone].some(p => p && p.replace(/\D/g, '').slice(-9) === d)) ?? null; };
R('POST', '/dev/simulate', ({ b }) => {
  const p = b.payload ?? {};
  if (b.source === 'dialpad') {
    const state = String(p.state ?? ''); if (!['hangup', 'missed', 'call_ended', 'connected', 'calling'].includes(state)) return { simulated: true, source: 'dialpad', object: 'calls', note: `Evento «${state || 'sin estado'}»: no genera ninguna llamada en el CRM.`, preview: null };
    const contact = findContactByPhone(p.external_number ?? p.contact?.phone); const dur = Math.round((Number(p.duration) || 0) / 1000);
    return { simulated: true, source: 'dialpad', object: 'calls', note: 'simulación: no se guardó nada', preview: { action: 'create', contactId: contact ? Number(contact.id) : null, wouldCreateContact: !contact, properties: { hs_call_title: `${p.direction === 'inbound' ? 'Llamada de' : 'Llamada a'} ${p.contact?.name ?? p.external_number ?? 'desconocido'}`, hs_timestamp: new Date(Number(p.date_started) || Date.now()).toISOString(), hs_call_direction: p.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND', hs_call_status: state === 'missed' ? 'MISSED' : 'COMPLETED', hs_call_duration: String(dur * 1000), dialpad_call_id: String(p.call_id ?? ''), hs_call_from_number: p.internal_number ?? '', hs_call_to_number: p.external_number ?? '' }, extra: [`agente: ${p.target?.name ?? '—'}`, `oficina: ${p.target?.office_id ?? '—'}`] } };
  }
  const f: Record<string, string> = {}; for (const x of p.field_data ?? []) f[x.name] = x.values?.[0]; if (!f.full_name && !f.email && !f.phone_number) return { simulated: true, source: 'meta', object: 'contacts', error: 'El lead no trae nombre, correo ni teléfono', preview: null };
  const ex = findContactByPhone(f.phone_number); const [first, ...rest] = String(f.full_name ?? '').split(' ');
  return { simulated: true, source: 'meta', object: 'contacts', note: 'simulación: no se guardó nada', preview: { action: ex ? 'update' : 'create', existingContactId: ex ? Number(ex.id) : null, properties: { firstname: first, lastname: rest.join(' '), email: f.email ?? '', mobilephone: f.phone_number ?? '', lead_source: 'Paid Ads', meta_campaign_source: p.campaign_name ?? '', hs_object_source_label: 'INTEGRATION' }, extra: [`formulario ${p.form_id ?? '—'}`, `conjunto: ${p.adset_name ?? '—'}`, `anuncio: ${p.ad_name ?? '—'}`] } };
});
R('POST', '/dev/apps/:id/webhooks/test', ({ m, b }) => {
  const app = db.apps().find(a => a.id === m[1]); if (!app) fail(404, 'not_found'); if (!app.targetUrl) fail(400, 'no_target_url');
  const ms = 90 + (hash(app.id + Date.now()) % 220); const type = `${b.objectType}.${b.event === 'propertyChange' ? 'propertyChange' : b.event}`;
  const event = { eventId: Date.now(), subscriptionId: 1, portalId: 10000001, occurredAt: Date.now(), subscriptionType: type, attemptNumber: 0, objectId: 0, changeSource: 'TEST', ...(b.property ? { propertyName: b.property, propertyValue: 'valor-de-prueba' } : {}) };
  db.patchState(S => { S.logs.unshift({ id: `m${Date.now()}`, at: new Date().toISOString(), method: 'POST', url: new URL(app.targetUrl!).pathname, status: 200, appId: app.id }); });
  return { ok: true, status: 200, ms, event, headers: { 'X-CRM-Signature-V3': 'bm90LWEtcmVhbC1zaWduYXR1cmUtZGVtbw==', 'X-CRM-Request-Timestamp': String(Date.now()) } };
});

/* ---- Llamadas «crudas» con token de aplicación (Pruebas → clave / MCP) ---- */
export function mockHttp(method: string, url: string, headers: Record<string, string>, body?: string): { status: number; text: string } {
  const j = (status: number, o: unknown) => ({ status, text: JSON.stringify(o) });
  const tok = (headers.Authorization ?? headers.authorization ?? '').replace(/^Bearer\s+/i, '').trim(); const app = db.apps().find(a => a.token === tok);
  if (!app) return j(401, { error: 'unauthorized' }); if (app.expiresAt && new Date(app.expiresAt).getTime() < Date.now()) return j(401, { error: 'token_expired' });
  const path = url.replace(/^.*\/api\/v1/, '').split('?')[0]; const scopes = app.scopes;
  if (path === '/mcp' && method === 'POST') {
    let rpc: Any = {}; try { rpc = JSON.parse(body ?? '{}'); } catch { return j(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON no válido' } }); }
    if (rpc.method === 'initialize') return j(200, { jsonrpc: '2.0', id: rpc.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'nexa-crm', version: '1.0.0' } } });
    if (rpc.method === 'tools/list') { const canW = scopes.some(s => s.endsWith('.write')), canD = scopes.some(s => s.endsWith('.delete')), canR = scopes.some(s => s.endsWith('.read') || s === 'actions');
      return j(200, { jsonrpc: '2.0', id: rpc.id, result: { tools: toolRows().filter(t => (t.destructive ? canD : t.writes ? canW : canR)).map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) } }); }
    return j(200, { jsonrpc: '2.0', id: rpc.id ?? null, error: { code: -32601, message: `Método no soportado: ${rpc.method}` } });
  }
  const mm = /^\/objects\/([a-z_]+)$/.exec(path);
  if (mm && method === 'GET') { const t = mm[1] as keyof ReturnType<typeof db.state>['records']; if (!scopes.includes(`crm.objects.${t}.read`)) return j(403, { error: 'missing_scope', scope: `crm.objects.${t}.read` });
    const lim = Number(/limit=(\d+)/.exec(url)?.[1] ?? 10); const rows = (db.state().records[t] ?? []).filter(r => !r.archived).slice(0, lim).map(r => ({ id: r.id, properties: r.properties, createdAt: r.createdAt, updatedAt: r.updatedAt }));
    return j(200, { total: rows.length, results: rows }); }
  return j(404, { error: 'not_found' });
}

/* ---------- entrada pública ---------- */
export async function mockApi<T = Any>(method: string, path: string, body?: unknown): Promise<T> {
  const [pathname, qs] = path.split('?'); st();
  for (const [mm, re, h] of routes) { if (mm !== method) continue; const m = re.exec(pathname); if (!m) continue;
    await new Promise(r => setTimeout(r, 30 + Math.random() * 70));
    const out = h({ m, q: new URLSearchParams(qs ?? ''), b: (body ?? {}) as Any }); if (method !== 'GET') save(); return (out === undefined ? undefined : clone(out)) as T; }
  return fail(404, 'not_found', { path });
}
export async function mockMedia(file: Blob): Promise<{ id: string; url: string }> {
  const url = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(new Error('upload_failed')); fr.readAsDataURL(file); });
  const id = `m${st().shop.seq.media++}`; (st().shop.media ??= {})[id] = url.length < 600_000 ? url : ''; return { id, url };
}
