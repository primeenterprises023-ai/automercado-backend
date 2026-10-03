
/* ==========================================================================
   AutoMercado Angola — app.js
   Persistência local via localStorage (cache de anúncios/mensagens/denúncias;
   sessão/favoritos/histórico/notificações também guardados localmente).
   Os anúncios reais vêm sempre da API (ver loadCarsFromAPI) — o localStorage
   aqui é só cache/fallback, nunca a fonte principal.
   ========================================================================== */

/* ---------------------------------------------------------------------- */
/* ICONS — biblioteca Lucide (via CDN), não ícones desenhados à mão.        */
/* icon()/iconBig() mantêm a mesma assinatura de antes para não obrigar a  */
/* tocar em todos os pontos de chamada — só a implementação mudou.         */
/* ---------------------------------------------------------------------- */
const LUCIDE_MAP = {
  search:'search', heart:'heart', phone:'phone', message:'message-circle', flag:'flag',
  mapPin:'map-pin', fuel:'fuel', gauge:'gauge', shift:'settings', calendar:'calendar',
  camera:'camera', chevronLeft:'chevron-left', chevronRight:'chevron-right', chevronDown:'chevron-down',
  x:'x', menu:'menu', user:'user', users:'users', grid:'layout-dashboard', star:'star',
  check:'check', checkCircle:'circle-check', alertTriangle:'triangle-alert', shieldCheck:'shield-check',
  plus:'plus', minus:'minus', trash:'trash-2', edit:'square-pen', pause:'pause', play:'play',
  eye:'eye', eyeOff:'eye-off', upload:'upload', tag:'tag', home:'house', list:'list', bell:'bell',
  logout:'log-out', login:'log-in', arrowRight:'arrow-right', arrowLeft:'arrow-left',
  sliders:'funnel', building:'building-2', calculator:'calculator', wrench:'wrench',
  umbrella:'umbrella', clipboardCheck:'clipboard-check', truck:'truck', banknote:'banknote',
  info:'info', clock:'clock', barChart:'chart-column', megaphone:'megaphone', shieldAlert:'shield-alert',
  zap:'zap', externalLink:'external-link', copy:'copy', car:'car', steeringWheel:'car',
  engine:'gauge', engine2:'flame', doors:'door-open', palette:'palette', package:'package',
  mail:'mail', lock:'lock', idCard:'id-card', badgeCheck:'badge-check', handshake:'handshake',
  fileText:'file-text', loader:'loader-circle', image:'image', userPlus:'user-plus', send:'send',
  creditCard:'credit-card', userCheck:'user-check', mailCheck:'mail-check', ban:'ban',
};
function icon(name, cls){
  const isFilled = /Filled$/.test(name||'');
  const base = isFilled ? name.replace(/Filled$/,'') : name;
  const lucideName = LUCIDE_MAP[base] || base;
  const classes = ['ico', cls||'', isFilled?'ico-filled':''].filter(Boolean).join(' ');
  return `<i data-lucide="${lucideName}" class="${classes}"></i>`;
}
function iconBig(name, cls){ return icon(name, ((cls||'')+' ico-lg').trim()); }
function hydrateIcons(root){
  try{
    if(window.lucide && window.lucide.createIcons){
      window.lucide.createIcons({ attrs: { 'stroke-width': 1.75 }, nameAttr:'data-lucide', root: root || document });
    }
  }catch(e){ /* biblioteca de ícones indisponível — falha em silêncio, o resto da app continua a funcionar */ }
}
/* ---------------------------------------------------------------------- */
/* UTILITIES                                                               */
/* ---------------------------------------------------------------------- */
function uid(prefix){ return (prefix||'id') + '_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatKz(n){
  n = Math.round(Number(n)||0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
}
function formatNum(n){ return Math.round(Number(n)||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function formatKm(n){ return formatNum(n) + ' km'; }
function hashStr(str){
  let h = 0;
  str = String(str||'');
  for(let i=0;i<str.length;i++){ h = (h<<5) - h + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function timeAgo(iso){
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff/60000);
  if(min < 1) return 'agora mesmo';
  if(min < 60) return `há ${min} min`;
  const h = Math.floor(min/60);
  if(h < 24) return `há ${h}h`;
  const d = Math.floor(h/24);
  if(d < 30) return `há ${d} ${d===1?'dia':'dias'}`;
  const mo = Math.floor(d/30);
  if(mo < 12) return `há ${mo} ${mo===1?'mês':'meses'}`;
  return `há ${Math.floor(mo/12)} anos`;
}
function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function qs(sel, root){ return (root||document).querySelector(sel); }
function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
function initials(name){
  const parts = String(name||'?').trim().split(/\s+/);
  return ((parts[0]?.[0]||'') + (parts.length>1?parts[parts.length-1][0]:'')).toUpperCase();
}

/* ---------------------------------------------------------------------- */
/* DOMÍNIO / CONSTANTES                                                    */
/* ---------------------------------------------------------------------- */
const BRANDS = ['Toyota','Mercedes-Benz','BMW','Volkswagen','Hyundai','Kia','Nissan','Ford','Honda','Mitsubishi','Land Rover','Audi','Chevrolet','Peugeot','Renault','Mazda','Suzuki','Jeep','Volvo','Lexus','Fiat','Opel','Citroën','Isuzu','Outra'];
const FUEL_TYPES = ['Gasolina','Gasóleo','Híbrido','Elétrico','GPL'];
const TRANSMISSIONS = ['Manual','Automática'];
const BODY_TYPES = ['SUV','Sedan','Hatchback','Pick-up','Coupé','Monovolume','Carrinha/Comercial','Cabrio'];
const CONDICAO_USO = ['Novo','Usado'];
const ESTADO_VEICULO = ['Excelente','Muito bom','Bom','Razoável','Para reparar'];
const CORES = ['Branco','Preto','Prata','Cinzento','Vermelho','Azul','Castanho','Bege','Verde','Amarelo','Dourado'];
const PROVINCES = ['Luanda','Icolo e Bengo','Bengo','Benguela','Bié','Cabinda','Cuando','Cubango','Cuanza Norte','Cuanza Sul','Cunene','Huambo','Huíla','Lunda Norte','Lunda Sul','Malanje','Moxico','Moxico Leste','Namibe','Uíge','Zaire'];
const CITIES_BY_PROVINCE = {
  'Luanda': ['Luanda','Viana','Cacuaco','Cazenga','Talatona','Belas','Kilamba'],
  'Icolo e Bengo': ['Catete','Bom Jesus','Cabiri'],
  'Benguela': ['Benguela','Lobito','Catumbela','Ganda'],
  'Huíla': ['Lubango','Matala','Chibia'],
  'Huambo': ['Huambo','Caála','Bailundo'],
  'Cabinda': ['Cabinda','Cacongo','Belize'],
  'Cuanza Sul': ['Sumbe','Porto Amboim','Waku Kungo'],
  'Zaire': ['Mbanza Congo','Soyo'],
  'Namibe': ['Moçâmedes','Tômbwa'],
  'Malanje': ['Malanje','Cacuso'],
  'Uíge': ['Uíge','Negage'],
};
function citiesFor(prov){ return CITIES_BY_PROVINCE[prov] || []; }

const EQUIPMENT_LIST = ['Ar Condicionado','Direção Hidráulica','Vidros Elétricos','Trava Elétrica','Alarme','Som Original','Bluetooth','Câmera de Ré','Sensor Estacionamento','Bancos Couro','Teto Solar','Rodas Liga Leve','ABS','Airbag'];

const REPORT_REASONS = ['Preço suspeito ou enganoso','Anúncio duplicado','Veículo já vendido','Suspeita de fraude/burla','Fotos não correspondem ao carro','Conteúdo impróprio ou ofensivo','Outro motivo'];

const PHOTO_LABELS = ['Frente','Lateral direita','Traseira','Lateral esquerda','Interior','Painel','Motor','Bagageira'];
function photoSet(n){ return PHOTO_LABELS.slice(0, Math.max(3, Math.min(n, PHOTO_LABELS.length))); }

/* Um "label" é um URL de foto real (carros vindos da API) quando começa
   por http(s):// — os dados de demonstração usam antes texto simples
   ('Frente', 'Interior', etc.), que continua a cair no placeholder. */
function isPhotoUrl(label){
  return typeof label === 'string' && /^https?:\/\//i.test(label);
}
/* Mostra a foto real (<img>) quando existe; caso contrário mostra o
   placeholder neutro — tratamento sóbrio (sem gradiente, sem ilustração
   de carro), igual ao de qualquer plataforma real quando uma foto ainda
   não existe. */
function mediaPlaceholder(seed, label, size){
  if(isPhotoUrl(label)){
    return `<img class="car-media-photo" src="${escapeHtml(label)}" alt="" loading="lazy">`;
  }
  return `<div class="car-media-ph">${size==='big'?iconBig('image'):icon('image')}</div>`;
}

/* ---------------------------------------------------------------------- */
/* DADOS DE DEMONSTRAÇÃO (seed) — só é gravado se a base partilhada estiver vazia */
/* ---------------------------------------------------------------------- */
function daysAgo(n){ return new Date(Date.now() - n*86400000).toISOString(); }

function seller(id,nome,tipo,telefone,verificado,membroDesde,avaliacao){
  return { id, nome, tipo, telefone, verificado, membroDesde, avaliacao };
}
const S_JOAO = seller('s01','João Muteka','particular','+244 923 456 781',false,'2024',4.4);
const S_ANA = seller('s02','Ana Kiala','particular','+244 912 345 672',true,'2023',4.8);
const S_PRESTIGE = seller('s03','Prestige Motors Luanda','stand','+244 222 671 234',true,'2021',4.9);
const S_MIGUEL = seller('s04','Miguel dos Santos','particular','+244 934 561 233',false,'2025',4.1);
const S_ISABEL = seller('s05','Isabel Sachipengo','particular','+244 945 234 561',true,'2024',4.6);
const S_CARLOS = seller('s06','Carlos Wanga','particular','+244 923 998 112',false,'2025',3.9);
const S_FILIPE = seller('s07','Filipe Neto','particular','+244 912 887 445',false,'2024',4.3);
const S_KIANDA = seller('s08','Auto Stand Kianda','stand','+244 222 334 556',true,'2019',4.7);
const S_SARA = seller('s09','Sara Bumba','particular','+244 956 112 334',false,'2025',4.0);
const S_DOMINGOS = seller('s10','Domingos Chivukuvuku','particular','+244 923 445 667',false,'2023',4.2);
const S_GIRASSOL = seller('s11','Stand Girassol','stand','+244 222 890 112',true,'2022',4.5);
const S_TERESA = seller('s12','Teresa Kapinga','particular','+244 934 776 221',false,'2025',4.4);
const S_BENGUELA = seller('s13','Auto Center Benguela','stand','+244 272 223 445',false,'2024',4.0);
const S_EDUARDO = seller('s14','Eduardo Palanca','particular','+244 912 556 778',true,'2024',4.7);
const S_CARPREMIUM = seller('s15','CarPremium Import','stand','+244 222 445 990',true,'2020',4.8);
const S_MARTA = seller('s16','Marta Wenge','particular','+244 945 667 889',false,'2023',4.3);

let SEED_VEHICLES = [
  { id:'v01', marca:'Toyota', modelo:'Hilux', ano:2021, preco:22500000, quilometragem:68000, combustivel:'Gasóleo', cambio:'Manual', cilindrada:2.4, carroceria:'Pick-up', cor:'Branco', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:4, provincia:'Huíla', cidade:'Lubango', descricao:'Toyota Hilux Double Cabin muito bem cuidada, revisões sempre feitas na marca. Pneus novos, sem sinais de acidente, pronta para estrada e todo-o-terreno. Documentação em dia, único dono.', equipamentos:['Ar Condicionado','Direção Hidráulica','Vidros Elétricos','ABS','Airbag','Câmera de Ré'], fotos:photoSet(7), plano:'gratis', status:'ativo', vendedor:S_JOAO, visualizacoes:342, contactos:14, criadoEm:daysAgo(5) },
  { id:'v02', marca:'Toyota', modelo:'Corolla', ano:2019, preco:8900000, quilometragem:81000, combustivel:'Gasolina', cambio:'Automática', cilindrada:1.8, carroceria:'Sedan', cor:'Prata', condicaoUso:'Usado', estadoVeiculo:'Muito bom', portas:4, provincia:'Luanda', cidade:'Talatona', descricao:'Corolla económico e fiável, ideal para cidade. Ar condicionado a funcionar perfeitamente, interior conservado, banco em pano sem rasgos. Aceito troca por carro de menor valor.', equipamentos:['Ar Condicionado','Vidros Elétricos','Trava Elétrica','Bluetooth','ABS'], fotos:photoSet(6), plano:'gratis', status:'ativo', vendedor:S_ANA, visualizacoes:508, contactos:22, criadoEm:daysAgo(9) },
  { id:'v03', marca:'Mercedes-Benz', modelo:'Classe C 220d', ano:2019, preco:31500000, quilometragem:52000, combustivel:'Gasolina', cambio:'Automática', cilindrada:2.0, carroceria:'Sedan', cor:'Preto', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:4, provincia:'Luanda', cidade:'Luanda', descricao:'Mercedes-Benz Classe C em estado impecável, interior em pele, teto de correr, jantes originais em liga leve. Todas as revisões feitas em concessionário autorizado, histórico completo disponível.', equipamentos:['Ar Condicionado','Bancos Couro','Teto Solar','Rodas Liga Leve','Sensor Estacionamento','ABS','Airbag','Bluetooth'], fotos:photoSet(8), plano:'premium', status:'ativo', vendedor:S_PRESTIGE, visualizacoes:1204, contactos:47, criadoEm:daysAgo(3) },
  { id:'v04', marca:'BMW', modelo:'X5 xDrive30d', ano:2020, preco:42000000, quilometragem:44000, combustivel:'Gasolina', cambio:'Automática', cilindrada:3.0, carroceria:'SUV', cor:'Cinzento', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Luanda', descricao:'BMW X5 topo de gama, pack M Sport, bancos aquecidos e sistema de som premium. Viatura de stand com garantia de 6 meses e inspeção de 120 pontos já realizada.', equipamentos:['Ar Condicionado','Bancos Couro','Teto Solar','Rodas Liga Leve','Câmera de Ré','Sensor Estacionamento','ABS','Airbag','Bluetooth'], fotos:photoSet(8), plano:'premium', status:'ativo', vendedor:S_PRESTIGE, visualizacoes:1587, contactos:63, criadoEm:daysAgo(2) },
  { id:'v05', marca:'Hyundai', modelo:'Tucson', ano:2020, preco:13500000, quilometragem:59000, combustivel:'Gasóleo', cambio:'Automática', cilindrada:2.0, carroceria:'SUV', cor:'Branco', condicaoUso:'Usado', estadoVeiculo:'Muito bom', portas:5, provincia:'Benguela', cidade:'Benguela', descricao:'Hyundai Tucson familiar, muito espaçosa e económica. Ar condicionado dual zone, sensores de estacionamento traseiros, pneus com boa vida útil. Motivo da venda: mudança de cidade.', equipamentos:['Ar Condicionado','Vidros Elétricos','Sensor Estacionamento','Bluetooth','ABS','Airbag'], fotos:photoSet(5), plano:'gratis', status:'ativo', vendedor:S_MIGUEL, visualizacoes:276, contactos:9, criadoEm:daysAgo(14) },
  { id:'v06', marca:'Kia', modelo:'Sportage', ano:2021, preco:15200000, quilometragem:38000, combustivel:'Gasolina', cambio:'Automática', cilindrada:2.0, carroceria:'SUV', cor:'Vermelho', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Viana', descricao:'Kia Sportage praticamente nova, poucos quilómetros, ainda com cheiro a novo. Câmara de marcha atrás, ecrã multimédia com Bluetooth, jantes em liga leve originais.', equipamentos:['Ar Condicionado','Rodas Liga Leve','Câmera de Ré','Bluetooth','ABS','Airbag','Vidros Elétricos'], fotos:photoSet(7), plano:'destaque', status:'ativo', vendedor:S_ISABEL, visualizacoes:640, contactos:31, criadoEm:daysAgo(6) },
  { id:'v07', marca:'Nissan', modelo:'Qashqai', ano:2019, preco:11800000, quilometragem:71000, combustivel:'Gasolina', cambio:'Manual', cilindrada:1.6, carroceria:'SUV', cor:'Azul', condicaoUso:'Usado', estadoVeiculo:'Bom', portas:5, provincia:'Huambo', cidade:'Huambo', descricao:'Nissan Qashqai robusto e confortável, ótimo para estradas do interior. Pequenos riscos de uso normal, mecânica revista recentemente com fatura disponível.', equipamentos:['Ar Condicionado','Vidros Elétricos','ABS','Airbag'], fotos:photoSet(5), plano:'gratis', status:'ativo', vendedor:S_CARLOS, visualizacoes:189, contactos:6, criadoEm:daysAgo(20) },
  { id:'v08', marca:'Volkswagen', modelo:'Polo', ano:2018, preco:5800000, quilometragem:64000, combustivel:'Gasolina', cambio:'Manual', cilindrada:1.0, carroceria:'Hatchback', cor:'Prata', condicaoUso:'Usado', estadoVeiculo:'Bom', portas:5, provincia:'Luanda', cidade:'Cacuaco', descricao:'VW Polo económico, baixo consumo, perfeito para primeiro carro ou uso diário na cidade. Ar condicionado revisto este ano, bateria nova.', equipamentos:['Ar Condicionado','Vidros Elétricos','ABS'], fotos:photoSet(4), plano:'gratis', status:'ativo', vendedor:S_FILIPE, visualizacoes:221, contactos:11, criadoEm:daysAgo(11) },
  { id:'v09', marca:'Land Rover', modelo:'Discovery Sport', ano:2019, preco:33900000, quilometragem:49000, combustivel:'Gasóleo', cambio:'Automática', cilindrada:2.0, carroceria:'SUV', cor:'Preto', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Luanda', descricao:'Land Rover Discovery Sport em ótimo estado, 7 lugares, tração 4x4 integral. Viatura de stand com revisão geral feita e pronta a rodar, financiamento facilitado.', equipamentos:['Ar Condicionado','Bancos Couro','Teto Solar','Rodas Liga Leve','Câmera de Ré','Sensor Estacionamento','ABS','Airbag'], fotos:photoSet(8), plano:'destaque', status:'ativo', vendedor:S_KIANDA, visualizacoes:733, contactos:28, criadoEm:daysAgo(4) },
  { id:'v10', marca:'Mitsubishi', modelo:'Pajero', ano:2018, preco:14900000, quilometragem:88000, combustivel:'Gasóleo', cambio:'Manual', cilindrada:3.2, carroceria:'SUV', cor:'Cinzento', condicaoUso:'Usado', estadoVeiculo:'Bom', portas:5, provincia:'Cabinda', cidade:'Cabinda', descricao:'Mitsubishi Pajero forte e resistente, excelente para todo-o-terreno. Suspensão reforçada, pneus semi-novos, motor diesel económico e sem fugas de óleo.', equipamentos:['Ar Condicionado','Direção Hidráulica','Rodas Liga Leve','ABS','Airbag'], fotos:photoSet(6), plano:'gratis', status:'ativo', vendedor:S_SARA, visualizacoes:298, contactos:13, criadoEm:daysAgo(16) },
  { id:'v11', marca:'Honda', modelo:'Civic', ano:2017, preco:6500000, quilometragem:92000, combustivel:'Gasolina', cambio:'Manual', cilindrada:1.8, carroceria:'Sedan', cor:'Branco', condicaoUso:'Usado', estadoVeiculo:'Bom', portas:4, provincia:'Benguela', cidade:'Lobito', descricao:'Honda Civic fiável e económico, motor conhecido pela durabilidade. Interior limpo, ar condicionado gelado, pronto para uso imediato.', equipamentos:['Ar Condicionado','Vidros Elétricos','Trava Elétrica','ABS'], fotos:photoSet(5), plano:'gratis', status:'ativo', vendedor:S_DOMINGOS, visualizacoes:167, contactos:5, criadoEm:daysAgo(24) },
  { id:'v12', marca:'Ford', modelo:'Ranger', ano:2022, preco:26800000, quilometragem:31000, combustivel:'Gasóleo', cambio:'Automática', cilindrada:2.0, carroceria:'Pick-up', cor:'Cinzento', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:4, provincia:'Luanda', cidade:'Luanda', descricao:'Ford Ranger quase nova, caixa automática, tração 4x4, ideal para trabalho e lazer. Garantia de stand, revisões em dia, capota marítima incluída.', equipamentos:['Ar Condicionado','Rodas Liga Leve','Câmera de Ré','Sensor Estacionamento','Bluetooth','ABS','Airbag','Vidros Elétricos'], fotos:photoSet(8), plano:'destaque', status:'ativo', vendedor:S_KIANDA, visualizacoes:891, contactos:39, criadoEm:daysAgo(7) },
  { id:'v13', marca:'Toyota', modelo:'Land Cruiser Prado', ano:2022, preco:58000000, quilometragem:22000, combustivel:'Gasóleo', cambio:'Automática', cilindrada:2.8, carroceria:'SUV', cor:'Branco', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Luanda', descricao:'Toyota Land Cruiser Prado, o SUV mais desejado do mercado angolano. Poucos quilómetros, 7 lugares, interior em pele bege, viatura de stand com todas as garantias.', equipamentos:['Ar Condicionado','Bancos Couro','Teto Solar','Rodas Liga Leve','Câmera de Ré','Sensor Estacionamento','ABS','Airbag','Bluetooth'], fotos:photoSet(8), plano:'premium', status:'ativo', vendedor:S_PRESTIGE, visualizacoes:2033, contactos:81, criadoEm:daysAgo(1) },
  { id:'v14', marca:'Renault', modelo:'Duster', ano:2020, preco:9400000, quilometragem:57000, combustivel:'Gasóleo', cambio:'Manual', cilindrada:1.5, carroceria:'SUV', cor:'Bege', condicaoUso:'Usado', estadoVeiculo:'Muito bom', portas:5, provincia:'Huambo', cidade:'Huambo', descricao:'Renault Duster robusta e económica, ótima relação consumo/espaço. Ideal para estradas do interior, revisões sempre em dia com fatura do stand.', equipamentos:['Ar Condicionado','Direção Hidráulica','Vidros Elétricos','ABS','Airbag'], fotos:photoSet(6), plano:'gratis', status:'ativo', vendedor:S_GIRASSOL, visualizacoes:245, contactos:10, criadoEm:daysAgo(13) },
  { id:'v15', marca:'Peugeot', modelo:'208', ano:2016, preco:4200000, quilometragem:98000, combustivel:'Gasolina', cambio:'Manual', cilindrada:1.2, carroceria:'Hatchback', cor:'Vermelho', condicaoUso:'Usado', estadoVeiculo:'Razoável', portas:5, provincia:'Luanda', cidade:'Kilamba', descricao:'Peugeot 208 ideal para começar, motor pequeno e económico. Alguns riscos de uso, pneus com meia vida, mecânica em bom funcionamento geral.', equipamentos:['Ar Condicionado','Vidros Elétricos'], fotos:photoSet(4), plano:'gratis', status:'ativo', vendedor:S_TERESA, visualizacoes:132, contactos:4, criadoEm:daysAgo(19) },
  { id:'v16', marca:'Mazda', modelo:'CX-5', ano:2020, preco:16400000, quilometragem:41000, combustivel:'Gasóleo', cambio:'Automática', cilindrada:2.2, carroceria:'SUV', cor:'Cinzento', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Benguela', cidade:'Benguela', descricao:'Mazda CX-5 elegante e bem equipada, interior em muito bom estado. Anúncio aguarda aprovação da nossa equipa de moderação antes de ficar visível ao público.', equipamentos:['Ar Condicionado','Bancos Couro','Rodas Liga Leve','Câmera de Ré','Bluetooth','ABS','Airbag'], fotos:photoSet(6), plano:'gratis', status:'ativo', vendedor:S_BENGUELA, visualizacoes:0, contactos:0, criadoEm:daysAgo(0) },
  { id:'v17', marca:'Nissan', modelo:'Leaf', ano:2021, preco:12900000, quilometragem:26000, combustivel:'Elétrico', cambio:'Automática', cilindrada:null, carroceria:'Hatchback', cor:'Branco', condicaoUso:'Usado', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Talatona', descricao:'Nissan Leaf 100% elétrico, custo de utilização muito baixo, ideal para condução urbana em Luanda. Bateria com boa autonomia, carregador incluído.', equipamentos:['Ar Condicionado','Vidros Elétricos','Câmera de Ré','Bluetooth','ABS','Airbag'], fotos:photoSet(6), plano:'gratis', status:'ativo', vendedor:S_EDUARDO, visualizacoes:412, contactos:17, criadoEm:daysAgo(8) },
  { id:'v18', marca:'Toyota', modelo:'Corolla Cross Híbrido', ano:2025, preco:19900000, quilometragem:1200, combustivel:'Híbrido', cambio:'Automática', cilindrada:1.8, carroceria:'SUV', cor:'Prata', condicaoUso:'Novo', estadoVeiculo:'Excelente', portas:5, provincia:'Luanda', cidade:'Talatona', descricao:'Toyota Corolla Cross Híbrido, viatura de importação nova com garantia de fábrica. Baixíssimo consumo de combustível, tecnologia híbrida self-charging, zero acidentes.', equipamentos:['Ar Condicionado','Bancos Couro','Rodas Liga Leve','Câmera de Ré','Sensor Estacionamento','Bluetooth','ABS','Airbag'], fotos:photoSet(7), plano:'destaque', status:'ativo', vendedor:S_CARPREMIUM, visualizacoes:356, contactos:19, criadoEm:daysAgo(2) },
  { id:'v19', marca:'Opel', modelo:'Corsa', ano:2015, preco:3100000, quilometragem:112000, combustivel:'Gasolina', cambio:'Manual', cilindrada:1.2, carroceria:'Hatchback', cor:'Azul', condicaoUso:'Usado', estadoVeiculo:'Razoável', portas:5, provincia:'Luanda', cidade:'Cazenga', descricao:'Opel Corsa simples e funcional, ótimo para cidade. Carro já vendido — anúncio mantido apenas como referência histórica no perfil da vendedora.', equipamentos:['Ar Condicionado'], fotos:photoSet(3), plano:'gratis', status:'vendido', vendedor:S_MARTA, visualizacoes:501, contactos:24, criadoEm:daysAgo(40) },
];

/* ---------------------------------------------------------------------- */
/* ESTADO + PERSISTÊNCIA (localStorage)                                    */
/* ---------------------------------------------------------------------- */
const STORE_KEYS = { VEHICLES:'vehicles_db_v1', REPORTS:'reports_db_v1', MESSAGES:'messages_db_v1', SESSION:'session_v1', FAVORITES:'favorites_v1', HISTORY:'history_v1', NOTIFS:'notifications_v1', RATINGS:'ratings_db_v1' };

// Nota: usa localStorage (funciona em qualquer browser, incluindo Acode/
// Chrome/Render). O parâmetro "shared" mantém-se na assinatura só para não
// obrigar a alterar todos os pontos onde storageGet/storageSet são chamados.
async function storageGet(key, shared){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
async function storageSet(key, value, shared){
  try{ localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e){ console.error('Falha ao gravar', key, e); return false; }
}

const state = {
  vehicles: [], myVehicles: [], reports: [], messages: [], favorites: [], history: [], notifications: [], ratings: [],
  session: null,
  route: { name:'home', params:{} },
  filters: {},
  ready: false,
  storageOk: true,
};

async function loadAll(){
  const [vehicles, reports, messages, session, favorites, history, notifications, ratings] = await Promise.all([
    storageGet(STORE_KEYS.VEHICLES, true),
    storageGet(STORE_KEYS.REPORTS, true),
    storageGet(STORE_KEYS.MESSAGES, true),
    storageGet(STORE_KEYS.SESSION, false),
    storageGet(STORE_KEYS.FAVORITES, false),
    storageGet(STORE_KEYS.HISTORY, false),
    storageGet(STORE_KEYS.NOTIFS, false),
    storageGet(STORE_KEYS.RATINGS, true),
  ]);

  if(vehicles === null){
    state.vehicles = SEED_VEHICLES.slice();
    await storageSet(STORE_KEYS.VEHICLES, state.vehicles, true);
  } else state.vehicles = vehicles;

  state.reports = reports || [];
  state.messages = messages || [];
  state.session = session || null;
  state.favorites = favorites || [];
  state.history = history || [];
  state.ratings = ratings || [];

  if(notifications === null){
    state.notifications = [{ id:uid('n'), tipo:'bemvindo', titulo:'Bem-vindo ao AutoMercado Angola', texto:'Explora anúncios verificados em todo o país ou publica o teu carro em poucos minutos.', lida:false, criadoEm:new Date().toISOString(), link:null }];
    await storageSet(STORE_KEYS.NOTIFS, state.notifications, false);
  } else state.notifications = notifications;

  state.ready = true;
}

function saveVehicles(){ return storageSet(STORE_KEYS.VEHICLES, state.vehicles, true); }
function saveReports(){ return storageSet(STORE_KEYS.REPORTS, state.reports, true); }
function saveMessages(){ return storageSet(STORE_KEYS.MESSAGES, state.messages, true); }
function saveSession(){ return storageSet(STORE_KEYS.SESSION, state.session, false); }
function saveFavorites(){ return storageSet(STORE_KEYS.FAVORITES, state.favorites, false); }
function saveHistory(){ return storageSet(STORE_KEYS.HISTORY, state.history, false); }
function saveNotifications(){ return storageSet(STORE_KEYS.NOTIFS, state.notifications, false); }
function saveRatings(){ return storageSet(STORE_KEYS.RATINGS, state.ratings, true); }

function findVehicle(id){ return state.vehicles.find(v => v.id === id) || state.myVehicles.find(v => v.id === id); }
function isFavorite(id){ return state.favorites.includes(id); }
function mySellerListings(){ if(!state.session) return []; return state.myVehicles.filter(v => v.vendedor.id === state.session.id); }
function myMessages(){ if(!state.session) return []; const mine = new Set(mySellerListings().map(v=>v.id)); return state.messages.filter(m => mine.has(m.vehicleId)); }
function ratingsForSeller(sellerId){ return state.ratings.filter(r=>r.sellerId===sellerId); }
function sellerRatingSummary(seller){
  const real = ratingsForSeller(seller.id);
  if(!real.length) return { media: seller.avaliacao || 0, total: null };
  const media = real.reduce((s,r)=>s+r.nota,0) / real.length;
  return { media, total: real.length };
}

function pushNotification(n){
  state.notifications.unshift(Object.assign({ id:uid('n'), lida:false, criadoEm:new Date().toISOString() }, n));
  if(state.notifications.length > 40) state.notifications.length = 40;
  saveNotifications();
}
function notifyIfOwnListing(vehicleId, titulo, texto){
  const v = findVehicle(vehicleId);
  if(v && state.session && v.vendedor.id === state.session.id){
    pushNotification({ tipo:'anuncio', titulo, texto, link:{ name:'detail', params:{id:vehicleId} } });
  }
}

/* ---------------------------------------------------------------------- */
/* TOASTS                                                                   */
/* ---------------------------------------------------------------------- */
function showToast(msg, opts){
  opts = opts || {};
  const container = qs('#toast-container');
  if(!container) return;
  const el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' is-error' : '');
  el.innerHTML = icon(opts.error ? 'alertTriangle' : 'checkCircle') + `<span>${escapeHtml(msg)}</span>`;
  container.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('is-visible'));
  setTimeout(()=>{ el.classList.remove('is-visible'); setTimeout(()=> el.remove(), 260); }, 3200);
}

/* ---------------------------------------------------------------------- */
/* MODAL GENÉRICO                                                           */
/* ---------------------------------------------------------------------- */
function openModal(innerHtml, opts){
  opts = opts || {};
  const root = qs('#modal-root');
  root.innerHTML = `<div class="modal-overlay" id="active-modal-overlay"><div class="modal" role="dialog" aria-modal="true">${innerHtml}</div></div>`;
  requestAnimationFrame(()=> qs('#active-modal-overlay').classList.add('is-open'));
  qs('#active-modal-overlay').addEventListener('click', (e)=>{ if(e.target.id === 'active-modal-overlay') closeModal(); });
  document.addEventListener('keydown', escCloseModalOnce);
  hydrateIcons(root);
  if(opts.onOpen) opts.onOpen(root);
}
function escCloseModalOnce(e){ if(e.key === 'Escape') closeModal(); }
function closeModal(){
  const overlay = qs('#active-modal-overlay');
  if(!overlay) return;
  overlay.classList.remove('is-open');
  document.removeEventListener('keydown', escCloseModalOnce);
  setTimeout(()=>{ const root = qs('#modal-root'); if(root) root.innerHTML=''; }, 180);
}

/* Conteúdo-modelo: cobre o essencial, mas convém revisão jurídica antes de publicares. */
const LEGAL_CONTENT = {
  terms: {
    title: 'Termos de Utilização',
    body: `<p>Ao usares o AutoMercado Angola concordas em publicar apenas anúncios de veículos reais, com informação verdadeira sobre o carro (marca, modelo, ano, preço, estado e quilometragem).</p>
      <p>É proibido publicar anúncios duplicados, fotos que não pertencem ao veículo anunciado, ou conteúdo enganoso, ofensivo ou fraudulento. Anúncios que violem estas regras podem ser removidos e a conta suspensa.</p>
      <p>O AutoMercado Angola é uma plataforma de intermediação entre compradores e vendedores — não é parte em nenhuma negociação nem se responsabiliza pelo estado real dos veículos anunciados.</p>
      <p style="color:var(--text-faint);font-size:12px;margin-top:10px;">Este resumo não substitui aconselhamento jurídico — consulta um advogado para o adaptar à tua operação.</p>`
  },
  privacy: {
    title: 'Política de Privacidade',
    body: `<p>Guardamos o nome, email e telefone que forneces no registo para criares e geres a tua conta, e para os compradores poderem contactar-te sobre os teus anúncios.</p>
      <p>Os dados da tua sessão, favoritos e histórico de navegação ficam guardados apenas neste dispositivo. Não partilhamos os teus dados com terceiros para fins de publicidade.</p>
      <p>Podes pedir a eliminação da tua conta e dos teus dados a qualquer momento, na secção "A tua conta".</p>
      <p style="color:var(--text-faint);font-size:12px;margin-top:10px;">Este resumo não substitui aconselhamento jurídico — consulta um advogado para o adaptar à tua operação.</p>`
  }
};
function showLegalModal(kind){
  const content = LEGAL_CONTENT[kind] || LEGAL_CONTENT.terms;
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(content.title)}</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">${content.body}</div>`);
}

/* ---------------------------------------------------------------------- */
/* AUTENTICAÇÃO — páginas de Entrar / Criar conta / Recuperar / Verificar. */
/* Login e registo enviam a palavra-passe para a API real (ver API_URL) — */
/* o front-end não a guarda em lado nenhum, nem sequer localmente.        */
/* Recuperar palavra-passe e verificar email/telefone ainda não estão     */
/* ligados a essa API (ver renderForgotPage/sendVerifyCode mais abaixo).  */
/* ---------------------------------------------------------------------- */
function genCode(){ return String(Math.floor(1000 + Math.random()*9000)); }
const authCodes = { email:null, telefone:null, forgot:null };

function authShell(title, sub, bodyHtml, footHtml){
  return `<div class="container section-tight auth-page-wrap">
    <div class="auth-page">
      <a href="${hashFor('home',{})}" class="auth-back">${icon('arrowLeft')} Voltar ao início</a>
      <div class="auth-card">
        <h1 class="auth-title">${escapeHtml(title)}</h1>
        ${sub ? `<p class="auth-sub">${escapeHtml(sub)}</p>` : ''}
        ${bodyHtml}
      </div>
      ${footHtml ? `<p class="auth-switch">${footHtml}</p>` : ''}
    </div>
  </div>`;
}
function renderAuthPage(mode){
  if(mode==='signup') return renderSignupPage();
  if(mode==='forgot') return renderForgotPage();
  if(mode==='verify') return renderVerifyPage();
  return renderLoginPage();
}
function renderLoginPage(){
  return authShell('Entrar', 'Acede à tua conta para comprar, vender e negociar.', `
    <form id="login-form" novalidate>
      <div class="field"><label>Email</label><input type="email" name="email" required placeholder="tu@email.com" autocomplete="email"></div>
      <div class="field"><label>Palavra-passe</label>
        <div class="pw-field"><input type="password" name="password" required minlength="6" id="login-pw" autocomplete="current-password"><button type="button" class="pw-toggle" data-action="toggle-pw" data-target="login-pw">${icon('eye')}</button></div>
      </div>
      <div class="field-error" id="login-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-block">${icon('login')} Entrar</button>
    </form>
    <a href="${hashFor('forgot',{})}" class="auth-link-sm">Esqueceste-te da palavra-passe?</a>
  `, `Ainda não tens conta? <a href="${hashFor('signup',{})}">Criar conta</a>`);
}
function renderSignupPage(){
  return authShell('Criar conta', 'Gratuito. Precisas de conta para contactar vendedores, guardar favoritos e publicar anúncios.', `
    <form id="signup-form" novalidate>
      <div class="field"><label>Nome completo</label><input type="text" name="nome" required placeholder="Ex: Miguel dos Santos" autocomplete="name"></div>
      <div class="form-grid-2">
        <div class="field"><label>Email</label><input type="email" name="email" required placeholder="tu@email.com" autocomplete="email"></div>
        <div class="field"><label>Telefone</label><input type="text" name="telefone" required placeholder="+244 9XX XXX XXX" autocomplete="tel"></div>
      </div>
      <div class="form-grid-2">
        <div class="field"><label>Palavra-passe</label><input type="password" name="password" required minlength="6" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
        <div class="field"><label>Confirmar palavra-passe</label><input type="password" name="password2" required minlength="6" autocomplete="new-password"></div>
      </div>
      <div class="field">
        <label>O que pretendes fazer na plataforma?</label>
        <div class="role-select-row">
          <label class="role-option"><input type="checkbox" name="papelComprador" checked>${icon('search')}<span>Quero comprar</span></label>
          <label class="role-option"><input type="checkbox" name="papelVendedor">${icon('tag')}<span>Quero vender</span></label>
        </div>
        <span class="field-hint">Podes escolher as duas — e ativar a outra mais tarde no perfil.</span>
      </div>
      <label class="terms-row"><input type="checkbox" name="termos" required> Li e aceito os <button type="button" class="link-btn" data-action="show-terms">Termos de Utilização</button> e a <button type="button" class="link-btn" data-action="show-privacy">Política de Privacidade</button>.</label>
      <div class="field-error" id="signup-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-block">${icon('userPlus')} Criar conta</button>
    </form>
  `, `Já tens conta? <a href="${hashFor('login',{})}">Entrar</a>`);
}
function renderForgotPage(){
  return authShell('Recuperar palavra-passe', 'Introduz o email da tua conta — enviamos-te um link para definires uma nova palavra-passe.', `
    <form id="forgot-form" novalidate>
      <div class="field"><label>Email</label><input type="email" name="email" required placeholder="tu@email.com" autocomplete="email"></div>
      <div class="field-error" id="forgot-error" style="display:none;"></div>
      <div class="field-success" id="forgot-success" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-block" id="forgot-submit-btn">${icon('send')} Enviar link de recuperação</button>
    </form>
  `, `Lembraste-te? <a href="${hashFor('login',{})}">Entrar</a>`);
}
function renderResetPasswordPage(){
  const token = state.route.params.token || '';
  if(!token){
    return authShell('Nova palavra-passe', '', `
      <div class="empty-state" style="padding:22px 16px;">
        ${icon('alertTriangle')}
        <h4>Link inválido</h4>
        <p>Este link não tem um código de recuperação válido. Pede um novo abaixo.</p>
      </div>
      <a href="${hashFor('forgot',{})}" class="btn btn-primary btn-block" style="margin-top:14px;">${icon('send')} Pedir novo link</a>
    `, `Lembraste-te? <a href="${hashFor('login',{})}">Entrar</a>`);
  }
  return authShell('Definir nova palavra-passe', 'Escolhe uma palavra-passe nova para a tua conta.', `
    <form id="reset-password-form" novalidate>
      <input type="hidden" name="token" value="${escapeHtml(token)}">
      <div class="field"><label>Nova palavra-passe</label><input type="password" name="newpw" required minlength="6" placeholder="Mínimo 6 caracteres" autocomplete="new-password"></div>
      <div class="field"><label>Confirmar nova palavra-passe</label><input type="password" name="newpw2" required minlength="6" autocomplete="new-password"></div>
      <div class="field-error" id="reset-error" style="display:none;"></div>
      <button type="submit" class="btn btn-primary btn-block" id="reset-submit-btn">${icon('shieldCheck')} Guardar nova palavra-passe</button>
    </form>
  `, `Lembraste-te? <a href="${hashFor('login',{})}">Entrar</a>`);
}
function renderVerifyPage(){
  const s = state.session;
  if(!s) return authShell('Verificar conta', 'Precisas de ter sessão iniciada para verificar a tua conta.', `<a href="${hashFor('login',{})}" class="btn btn-primary btn-block">${icon('login')} Entrar</a>`, '');
  return authShell('Verificar conta', 'Confirma o teu email e telefone — dá mais confiança a quem negoceia contigo.', `
    <div class="verify-row">
      <div class="verify-row-head">${icon('mail')}<div class="verify-row-info"><b>Email</b><span>${escapeHtml(s.email||'—')}</span></div>${s.emailVerificado?`<span class="badge badge-verified">${icon('checkCircle')}Verificado</span>`:`<button type="button" class="btn btn-secondary btn-sm" data-action="send-verify" data-channel="email">Enviar código</button>`}</div>
      <div id="verify-email-box"></div>
    </div>
    <div class="verify-row">
      <div class="verify-row-head">${icon('phone')}<div class="verify-row-info"><b>Telefone</b><span>${escapeHtml(s.telefone||'—')}</span></div>${s.telefoneVerificado?`<span class="badge badge-verified">${icon('checkCircle')}Verificado</span>`:`<button type="button" class="btn btn-secondary btn-sm" data-action="send-verify" data-channel="telefone">Enviar código</button>`}</div>
      <div id="verify-telefone-box"></div>
    </div>
    <a href="${hashFor('home',{})}" class="btn btn-primary btn-block" style="margin-top:8px;">${icon('check')} Concluir por agora</a>
  `, '');
}
function sendVerifyCode(channel){
  authCodes[channel] = genCode();
  const box = qs('#verify-'+channel+'-box'); if(!box) return;
  box.innerHTML = `<div class="demo-code-hint">O teu código de verificação: <b>${authCodes[channel]}</b></div>
    <div class="verify-code-row" style="margin-top:10px;">
      <input type="text" maxlength="4" inputmode="numeric" placeholder="0000" id="verify-input-${channel}">
      <button type="button" class="btn btn-primary btn-sm" data-action="confirm-verify" data-channel="${channel}">Verificar</button>
    </div>`;
  hydrateIcons(box);
}
function confirmVerifyCode(channel){
  const val = qs('#verify-input-'+channel)?.value;
  if(val && val===authCodes[channel]){
    if(channel==='email') state.session.emailVerificado = true; else state.session.telefoneVerificado = true;
    saveSession(); showToast('Verificado com sucesso'); rerenderCurrentView();
  } else showToast('Código incorreto, tenta novamente', {error:true});
}
const API_URL = "https://automercado-backend.onrender.com/api";
// Planos de subscrição da conta. "limite" a null significa sem limite.
// O "id" tem de ser exatamente o valor gravado em users.plan no backend.
// Para acrescentar um plano novo, basta adicionar mais uma entrada aqui.
const ACCOUNT_PLANS = {
  free: {
    id: 'free', nome: 'Grátis', preco: 0, limite: 5,
    descricao: 'Para quem vende o seu carro particular',
    beneficios: ['Até 5 anúncios ativos', 'Todas as funcionalidades básicas', 'Sem mensalidade']
  },
  individual: {
    id: 'individual', nome: 'Individual', preco: 5000, limite: 10,
    descricao: 'Para quem vende carros com mais regularidade',
    beneficios: ['Até 10 anúncios ativos', 'Selo de vendedor verificado', 'Suporte prioritário por WhatsApp']
  },
  pro: {
    id: 'pro', nome: 'Vendedor Pro', preco: 15000, limite: 20,
    descricao: 'Para quem revende vários carros por mês sem ainda ser um stand',
    beneficios: ['Até 20 anúncios ativos', 'Anúncios em destaque nos resultados de pesquisa', 'Estatísticas de visualizações e contactos', 'Suporte prioritário por WhatsApp']
  },
  stand: {
    id: 'stand', nome: 'Stand', preco: 60000, limite: null,
    descricao: 'Para stands e revendedores profissionais',
    beneficios: ['Anúncios ilimitados', 'Selo de Stand verificado', 'Página de perfil do stand personalizada', 'Suporte prioritário']
  },
  concessionaria: {
    id: 'concessionaria', nome: 'Concessionária', preco: 120000, limite: null,
    descricao: 'Para stands maiores com equipas de vendas',
    beneficios: ['Tudo o que o plano Stand inclui', 'Destaque automático em todos os anúncios', 'Banner promocional na página inicial', 'Vários utilizadores para a mesma equipa', 'Relatório mensal de desempenho']
  },
  empresarial: {
    id: 'empresarial', nome: 'Empresarial', preco: 250000, limite: null,
    descricao: 'Para grandes importadoras e frotas com muitos anúncios',
    beneficios: ['Tudo o que o plano Concessionária inclui', 'Gestor de conta dedicado', 'Upload em massa de anúncios', 'Faturação personalizada', 'Banner de topo garantido em Luanda e nas principais províncias']
  }
};
const DEFAULT_PLAN = 'free';
function currentPlanInfo(){ return ACCOUNT_PLANS[(state.session && state.session.plan) || DEFAULT_PLAN] || ACCOUNT_PLANS[DEFAULT_PLAN]; }
// Todos os planos pagos (todos exceto "free") dão direito ao selo de vendedor
// verificado — é um dos benefícios anunciados na página de planos.
function isVerifiedPlan(planId){ return !!planId && planId !== 'free'; }
function bindAuthPageEvents(mode){



  // ==========================
  // LOGIN
  // ==========================

  if(mode === 'login'){

    qs('#login-form').addEventListener('submit', async (e)=>{

      e.preventDefault();

      const fd = new FormData(e.target);

      const email = (fd.get('email') || '')
        .trim()
        .toLowerCase();

      const password = fd.get('password') || '';

      const err = qs('#login-error');

      err.style.display = 'none';


      try {

        const response = await fetch(
          `${API_URL}/auth/login`,
          {
            method: 'POST',

            headers: {
              'Content-Type': 'application/json'
            },

            body: JSON.stringify({
              email: email,
              password: password
            })
          }
        );


        const data = await response.json();


        if(!response.ok){

          err.textContent =
            data.error || 'Email ou palavra-passe incorretos.';

          err.style.display = 'block';

          return;
        }


        // Guardar token JWT
        localStorage.setItem(
          'token',
          data.token
        );


        // Criar sessão do AutoMercado
        state.session = {

          id: data.user.id,

          nome: data.user.name,

          email: data.user.email,

          telefone: data.user.phone || '',

          plan: data.user.plan || 'free',

          autenticado: true,

          papeis: {
            comprador: true,
            vendedor: true
          },

          emailVerificado: false,

          telefoneVerificado: false,

          tipo: 'particular',

          verificado: false,

          membroDesde:
            new Date().getFullYear().toString(),

          avaliacao: 4.5
        };


        saveSession();


        showToast(
          'Sessão iniciada com sucesso'
        );


        completeAuthSuccess();


      } catch(error){

        console.error(error);


        err.textContent =
          'Não foi possível conectar ao servidor.';


        err.style.display = 'block';

      }

    });

  }


  // ==========================
  // REGISTO
  // ==========================

  if(mode === 'signup'){

    qs('#signup-form').addEventListener(
      'submit',
      async (e)=>{

        e.preventDefault();


        const fd = new FormData(e.target);


        const nome =
          (fd.get('nome') || '').trim();


        const email =
          (fd.get('email') || '')
          .trim()
          .toLowerCase();


        const telefone =
          (fd.get('telefone') || '').trim();


        const password =
          fd.get('password') || '';


        const password2 =
          fd.get('password2') || '';


        const err =
          qs('#signup-error');


        err.style.display = 'none';


        // VALIDAR CAMPOS

        if(!nome || !email || !telefone){

          err.textContent =
            'Preenche todos os campos.';

          err.style.display = 'block';

          return;

        }


        if(password.length < 6){

          err.textContent =
            'A palavra-passe precisa de pelo menos 6 caracteres.';

          err.style.display = 'block';

          return;

        }


        if(password !== password2){

          err.textContent =
            'As palavras-passe não coincidem.';

          err.style.display = 'block';

          return;

        }


        if(!fd.get('termos')){

          err.textContent =
            'Precisas de aceitar os termos para continuar.';

          err.style.display = 'block';

          return;

        }


        try {


          const response = await fetch(

            `${API_URL}/auth/register`,

            {

              method: 'POST',

              headers: {

                'Content-Type':
                  'application/json'

              },

              body: JSON.stringify({

                name: nome,

                email: email,

                password: password,

                phone: telefone

              })

            }

          );


          const data =
            await response.json();


          if(!response.ok){

            err.textContent =
              data.error ||
              'Não foi possível criar a conta.';


            err.style.display =
              'block';


            return;

          }


          showToast(
            'Conta criada com sucesso!'
          );


          // Ir para login

          navigate(
            'login',
            {}
          );


        } catch(error){

          console.error(error);


          err.textContent =
            'Não foi possível conectar ao servidor.';


          err.style.display =
            'block';

        }

      }

    );

  }


  // ==========================
  // RECUPERAR PASSWORD
  // ==========================

  if(mode === 'forgot'){

    qs('#forgot-form').addEventListener('submit', async (e)=>{
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = (fd.get('email') || '').trim().toLowerCase();
      const err = qs('#forgot-error');
      const ok = qs('#forgot-success');
      const btn = qs('#forgot-submit-btn');
      err.style.display = 'none';
      ok.style.display = 'none';
      btn.disabled = true;

      try {
        await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        // Mostramos sempre a mesma mensagem, quer o email exista ou não —
        // é assim que o backend responde também, para não revelar contas.
      } catch (error) {
        console.error('Erro ao pedir recuperação:', error);
        // Erro de rede não deve revelar nada nem travar o utilizador — mesma mensagem.
      }

      qs('#forgot-form').style.display = 'none';
      ok.textContent = 'Se esse email tiver conta no AutoMercado, vais receber um link para definires uma nova palavra-passe. Verifica também o spam.';
      ok.style.display = 'block';
    });

  }

}

// ==========================
// DEFINIR NOVA PASSWORD (a partir do link recebido por email)
// ==========================
function bindResetPasswordEvents(){
  const form = qs('#reset-password-form');
  if(!form) return; // página sem token válido — só mostra o estado de "link inválido"

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const token = fd.get('token');
    const newpw = fd.get('newpw') || '';
    const newpw2 = fd.get('newpw2') || '';
    const err = qs('#reset-error');
    const btn = qs('#reset-submit-btn');
    err.style.display = 'none';

    if(newpw.length < 6){
      err.textContent = 'A palavra-passe tem de ter pelo menos 6 caracteres.';
      err.style.display = 'block';
      return;
    }
    if(newpw !== newpw2){
      err.textContent = 'As duas palavras-passe não coincidem.';
      err.style.display = 'block';
      return;
    }

    btn.disabled = true;
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: newpw })
      });
      const data = await response.json().catch(()=>({}));

      if(!response.ok){
        err.textContent = data.error || 'Link inválido ou expirado. Pede um novo em "Recuperar palavra-passe".';
        err.style.display = 'block';
        btn.disabled = false;
        return;
      }

      form.style.display = 'none';
      const ok = document.createElement('div');
      ok.className = 'field-success';
      ok.textContent = 'Palavra-passe atualizada! Já podes entrar com a nova palavra-passe.';
      form.parentNode.insertBefore(ok, form.nextSibling);
      setTimeout(()=> navigate('login', {}), 1800);
    } catch (error) {
      console.error('Erro ao redefinir palavra-passe:', error);
      err.textContent = 'Não foi possível ligar ao servidor. Tenta novamente.';
      err.style.display = 'block';
      btn.disabled = false;
    }
  });
}
/* ---------------------------------------------------------------------- */
/* ROTAS                                                                     */
/* ---------------------------------------------------------------------- */
function cleanParams(obj){ const out={}; Object.keys(obj||{}).forEach(k=>{ if(obj[k]!==undefined && obj[k]!==null && obj[k]!=='') out[k]=obj[k]; }); return out; }

function hashFor(name, params){
  params = params || {};
  const qp = new URLSearchParams(cleanParams(params)).toString();
  const withQuery = (file) => file + (qp ? ('?'+qp) : '');
  if(name==='home') return 'index.html';
  if(name==='detail') return `carro.html?id=${encodeURIComponent(params.id||'')}`;
  if(name==='vendorProfile') return `vendedor.html?id=${encodeURIComponent(params.id||'')}`;
  if(name==='search') return withQuery('pesquisa.html');
  if(name==='publish') return withQuery('vender.html');
  if(name==='seller') return withQuery('painel.html');
  if(name==='buyer') return withQuery('conta.html');
  if(name==='plans') return 'planos.html';
  if(name==='login') return withQuery('entrar.html');
  if(name==='signup') return 'criar-conta.html';
  if(name==='forgot') return 'recuperar-password.html';
  if(name==='resetPassword') return withQuery('redefinir-password.html');
  if(name==='verify') return 'verificar-conta.html';
  return 'index.html';
}
// Cada página .html já sabe qual é a sua própria rota (ver o pequeno
// bloco de arranque no fim de cada ficheiro) — por isso já não é preciso
// interpretar um hash como antes; navigate() faz agora uma navegação real
// entre páginas.
function navigate(name, params){
  location.href = hashFor(name, params||{});
}
function rerenderCurrentView(){ renderRoute(); }

/* Rotas que exigem sessão autenticada — a permissão adicional de vendedor
   é verificada dentro da própria vista de "painel", não aqui (ver
   renderSeller()), porque nesse caso o utilizador já está autenticado e
   só precisa de ativar o modo vendedor, não de voltar a entrar. */
const PROTECTED_ROUTES = ['publish','seller','buyer'];
function isAuthed(){ return !!(state.session && state.session.autenticado); }
function hasUnlimitedPlan(){ return currentPlanInfo().limite === null; }

let pendingAuthAction = null;
let pendingAuthReturn = null;
function requireAuth(cb){
  if(isAuthed()){ cb(); return; }
  // Num site de várias páginas não é possível "retomar" a ação exata
  // depois de um carregamento real da página de login — por isso
  // guardamos só para onde voltar (na própria hiperligação); a pessoa
  // pode ter de repetir a ação (ex.: tocar de novo no coração de
  // favorito) depois de entrar.
  pendingAuthAction = cb;
  pendingAuthReturn = { name: state.route.name, params: state.route.params };
  navigate('login', { returnTo: hashFor(state.route.name, state.route.params) });
}
function completeAuthSuccess(){
  const cb = pendingAuthAction, ret = pendingAuthReturn;
  pendingAuthAction = null; pendingAuthReturn = null;
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if(returnTo){ location.href = returnTo; return; }
  if(ret){ navigate(ret.name, ret.params); return; }
  navigate('home', {});
  if(cb) setTimeout(cb, 0);
}

function afterNavigate(){
  window.scrollTo({ top:0, behavior:'auto' });
  closeMobileDrawer();
  if(PROTECTED_ROUTES.includes(state.route.name) && !isAuthed()){
    pendingAuthReturn = { name: state.route.name, params: state.route.params };
    state.route = { name:'login', params:{ returnTo: hashFor(pendingAuthReturn.name, pendingAuthReturn.params) } };
  }
  if(state.route.name==='detail' && state.route.params.id) registerView(state.route.params.id);
  if((state.route.name==='seller' || state.route.name==='publish') && isAuthed()) loadMyCarsFromAPI();
  renderRoute();
}

function registerView(id){
  const v = findVehicle(id);
  if(v){ v.visualizacoes = (v.visualizacoes||0) + 1; saveVehicles(); }
  state.history = [id, ...state.history.filter(x=>x!==id)].slice(0,24); saveHistory();
}

function openMobileDrawer(){ qs('#mobile-drawer').classList.add('is-open'); qs('#mobile-drawer-overlay').classList.add('is-open'); }
function closeMobileDrawer(){ const d=qs('#mobile-drawer'), o=qs('#mobile-drawer-overlay'); if(d) d.classList.remove('is-open'); if(o) o.classList.remove('is-open'); }

function updateActiveNav(){
  qsa('.nav-link[data-nav-route]').forEach(a=>{
    a.classList.toggle('is-current', a.getAttribute('data-nav-route') === state.route.name);
  });
  const favCount = qs('#nav-fav-count');
  if(favCount){ favCount.style.display = state.favorites.length ? 'flex' : 'none'; favCount.textContent = state.favorites.length; }
}

/* Preenche o slot de autenticação no cabeçalho (desktop) e no menu móvel:
   link de "Entrar" quando não há sessão, ou nome + "Sair" quando há.
   Chamada a partir de renderRoute() em todos os renders. */
function renderHeaderAuthSlot(){
  const html = isAuthed()
    ? `<a class="nav-link" data-nav-route="buyer" href="${hashFor('buyer',{tab:'perfil'})}" title="${escapeHtml(state.session.nome||'')}">${icon('user')}<span>${escapeHtml((state.session.nome||'Conta').split(' ')[0])}</span></a><button type="button" class="nav-link" data-action="logout">${icon('logout')}<span>Sair</span></button>`
    : `<a class="nav-link" data-nav-route="login" href="${hashFor('login',{})}">${icon('login')}<span>Entrar</span></a>`;
  const slot = qs('#header-auth-slot');
  if(slot){ slot.innerHTML = html; hydrateIcons(slot); }
  const drawerSlot = qs('#mobile-drawer-auth-slot');
  if(drawerSlot){ drawerSlot.innerHTML = html; hydrateIcons(drawerSlot); }
}

/* ---------------------------------------------------------------------- */
/* PESQUISA / FILTROS — lógica pura                                        */
/* ---------------------------------------------------------------------- */
function applyFilters(list, f){
  f = f || {};
  return list.filter(v=>{
    if(!f.incluirTodosEstados && v.status !== 'ativo') return false;
    if(f.q){ const q=f.q.toLowerCase(); const hay=(v.marca+' '+v.modelo+' '+v.descricao).toLowerCase(); if(!hay.includes(q)) return false; }
    if(f.marca && v.marca!==f.marca) return false;
    if(f.modelo && !v.modelo.toLowerCase().includes(String(f.modelo).toLowerCase())) return false;
    if(f.precoMin && v.preco < Number(f.precoMin)) return false;
    if(f.precoMax && v.preco > Number(f.precoMax)) return false;
    if(f.anoMin && v.ano < Number(f.anoMin)) return false;
    if(f.anoMax && v.ano > Number(f.anoMax)) return false;
    if(f.kmMax && v.quilometragem > Number(f.kmMax)) return false;
    if(f.combustivel && v.combustivel!==f.combustivel) return false;
    if(f.cambio && v.cambio!==f.cambio) return false;
    if(f.carroceria && v.carroceria!==f.carroceria) return false;
    if(f.provincia && v.provincia!==f.provincia) return false;
    if(f.cor && v.cor!==f.cor) return false;
    if(f.condicaoUso && v.condicaoUso!==f.condicaoUso) return false;
    if(f.estadoVeiculo && v.estadoVeiculo!==f.estadoVeiculo) return false;
    return true;
  });
}
function sortVehicles(list, ordenar){
  const arr = list.slice();
  if(ordenar==='preco_asc') arr.sort((a,b)=>a.preco-b.preco);
  else if(ordenar==='preco_desc') arr.sort((a,b)=>b.preco-a.preco);
  else if(ordenar==='ano_desc') arr.sort((a,b)=>b.ano-a.ano);
  else if(ordenar==='km_asc') arr.sort((a,b)=>a.quilometragem-b.quilometragem);
  else arr.sort((a,b)=> new Date(b.criadoEm)-new Date(a.criadoEm));
  return arr;
}
function isPriceSuspicious(v){
  const peers = state.vehicles.filter(x=>x.carroceria===v.carroceria && x.status==='ativo' && x.id!==v.id);
  if(peers.length < 3) return false;
  const avg = peers.reduce((s,x)=>s+x.preco,0)/peers.length;
  return v.preco < avg*0.35;
}
function brandCounts(){
  const counts = {};
  state.vehicles.filter(v=>v.status==='ativo').forEach(v=>{ counts[v.marca] = (counts[v.marca]||0)+1; });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]);
}

/* ---------------------------------------------------------------------- */
/* CARTÃO DE VEÍCULO (partilhado entre secções)                            */
/* ---------------------------------------------------------------------- */
function statusBadgeHtml(v){
  if(v.status==='vendido') return `<span class="badge badge-sold">${icon('checkCircle')} Vendido</span>`;
  if(v.status==='pendente') return `<span class="badge badge-pending">${icon('clock')} Pendente</span>`;
  if(v.status==='pausado') return `<span class="badge badge-paused">${icon('pause')} Pausado</span>`;
  if(v.status==='rejeitado') return `<span class="badge badge-rejected">${icon('x')} Rejeitado</span>`;
  return `<span class="badge badge-active">${icon('checkCircle')} Ativo</span>`;
}
function carCardHtml(v){
  const fav = isFavorite(v.id);
  return `
  <article class="car-card" data-id="${v.id}">
    <a class="car-card-media" href="${hashFor('detail',{id:v.id})}" aria-label="Ver anúncio ${escapeHtml(v.marca+' '+v.modelo)}">
      ${mediaPlaceholder(v.id, v.fotos[0])}
      <div class="car-badge-row">
      </div>
      <span class="photo-count">${icon('camera')} ${v.fotos.length}</span>
    </a>
    <button class="icon-btn fav-btn ${fav?'is-active':''}" data-action="toggle-fav" data-id="${v.id}" aria-label="Guardar anúncio" aria-pressed="${fav}">${icon(fav?'heartFilled':'heart')}</button>
    <div class="car-card-body">
      <a href="${hashFor('detail',{id:v.id})}"><h3 class="car-title">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</h3></a>
      <div class="car-loc">${icon('mapPin')}${escapeHtml(v.cidade)}, ${escapeHtml(v.provincia)}</div>
      <div class="car-chips">
        <span class="chip chip-mono">${v.ano}</span>
        <span class="chip chip-mono">${formatKm(v.quilometragem)}</span>
        <span class="chip chip-mono">${escapeHtml(v.combustivel)}</span>
        <span class="chip chip-mono">${escapeHtml(v.cambio)}</span>
      </div>
      <div class="car-price-row">
        <div class="car-price">${formatKz(v.preco)}</div>
        <div class="car-seller-mini">${icon(v.vendedor.tipo==='stand'?'building':'user')}${v.vendedor.tipo==='stand'?'Stand':'Particular'}${v.vendedor.verificado?icon('checkCircle'):''}</div>
      </div>
    </div>
  </article>`;
}
function carCardSkeletonEmpty(msg, sub){
  return `<div class="empty-state" style="grid-column:1/-1;">${icon('search')}<h4>${escapeHtml(msg||'Sem resultados')}</h4><p>${escapeHtml(sub||'Tenta ajustar os filtros de pesquisa.')}</p></div>`;
}

/* ---------------------------------------------------------------------- */
/* PERFIL PÚBLICO DO VENDEDOR — todos os anúncios ativos de uma pessoa ou
   stand, para quem quiser ver "que carros é que o fulano tem à venda".
   Não precisa de nenhuma rota nova no backend: filtra os carros que já
   estão carregados em state.vehicles pelo id do vendedor. */
/* ---------------------------------------------------------------------- */
function renderVendorProfile(sellerId){
  const cars = state.vehicles.filter(v => v.vendedor && v.vendedor.id === sellerId && v.status === 'ativo');
  const vendedor = cars.length ? cars[0].vendedor : null;

  if(!vendedor){
    return `
    <div class="container">
      <div class="page-head"><div class="breadcrumb"><a href="${hashFor('home',{})}">Início</a>${icon('chevronRight')}<span>Vendedor</span></div></div>
    </div>
    <div class="container section text-center">
      ${carCardSkeletonEmpty('Vendedor não encontrado','Este vendedor pode já não ter anúncios ativos de momento.')}
      <a href="${hashFor('search',{})}" class="btn btn-primary" style="margin-top:16px;">Ver todos os carros</a>
    </div>`;
  }

  const ratingSummary = sellerRatingSummary(vendedor);
  return `
    <div class="container">
      <div class="page-head"><div class="breadcrumb"><a href="${hashFor('home',{})}">Início</a>${icon('chevronRight')}<span>${escapeHtml(vendedor.nome)}</span></div></div>
    </div>
    <div class="container section-tight">
      <div class="seller-card">
        <div class="seller-top">
          <div class="seller-avatar">${initials(vendedor.nome)}</div>
          <div>
            <div class="seller-name-row"><span class="seller-name">${escapeHtml(vendedor.nome)}</span>${vendedor.verificado?`<span class="badge badge-verified">${icon('badgeCheck')}Verificado</span>`:''}</div>
            <div class="seller-meta">${icon(vendedor.tipo==='stand'?'building':'user')} ${vendedor.tipo==='stand'?'Stand / Concessionária':'Vendedor particular'} · Desde ${vendedor.membroDesde}</div>
            <div class="seller-stars">${Array.from({length:5}).map((_,i)=> i < Math.round(ratingSummary.media) ? icon('starFilled') : icon('star')).join('')}<span class="seller-stars-num">${ratingSummary.media.toFixed(1)}${ratingSummary.total?` (${ratingSummary.total})`:''}</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="container">
      <div class="section-head"><h2 class="section-title">${cars.length} ${cars.length===1?'anúncio ativo':'anúncios ativos'}</h2></div>
      <div class="car-grid">${cars.map(carCardHtml).join('')}</div>
    </div>`;
}

/* ---------------------------------------------------------------------- */
/* HOME                                                                      */
/* ---------------------------------------------------------------------- */
function heroQuickFilterSelects(){
  return `
    <select class="qf-select" name="marca"><option value="">Marca</option>${BRANDS.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <select class="qf-select" name="precoMax"><option value="">Preço até</option>${[3000000,6000000,10000000,15000000,25000000,40000000].map(p=>`<option value="${p}">${formatKz(p)}</option>`).join('')}</select>
    <select class="qf-select" name="provincia"><option value="">Localização</option>${PROVINCES.map(p=>`<option value="${p}">${p}</option>`).join('')}</select>
    <select class="qf-select" name="combustivel"><option value="">Combustível</option>${FUEL_TYPES.map(f=>`<option value="${f}">${f}</option>`).join('')}</select>`;
}
function renderHome(){
  const active = state.vehicles.filter(v=>v.status==='ativo');
  const recentes = sortVehicles(active, 'recentes').slice(0,6);
  const brands = brandCounts().slice(0,12);
  const provCount = new Set(active.map(v=>v.provincia)).size;

  return `
  <section class="hero zone-dark">
    <div class="hero-plate-field">${Array.from({length:10}).map((_,i)=>`<span class="hero-plate" style="top:${(i*37)%100}%; left:${(i*53+ (i%2?10:0))%100}%;">LD-${10+i*7}-AO</span>`).join('')}</div>
    <div class="hero-inner">
      <span class="hero-eyebrow">${icon('mapPin')} Feito para o mercado angolano</span>
      <h1 class="hero-title">Carros à venda em Angola, <em>de particulares e stands</em></h1>
      <p class="hero-sub">Pesquisa por marca, preço, província ou combustível. Preços sempre em Kwanza, contactos verificados, sem intermediários.</p>
      <div class="hero-ctas">
        <a class="btn btn-gold" href="${hashFor('search',{})}">${icon('search')} Comprar carro</a>
        <a class="btn btn-outline-light" href="${hashFor('publish',{})}">${icon('plus')} Vender carro</a>
      </div>
      <div class="hero-search-card">
        <form id="hero-search-form">
          <div class="hero-search-main">
            <div class="hero-search-input">${icon('search')}<input type="text" name="q" placeholder="Pesquisar por marca, modelo ou palavra-chave — ex: Toyota Hilux"></div>
            <button type="submit" class="btn btn-primary">Pesquisar</button>
          </div>
          <div class="hero-quick-filters">${heroQuickFilterSelects()}</div>
        </form>
        <div class="ticker">
          <div class="ticker-track">
            ${Array.from({length:2}).map(()=>`
              <span class="ticker-item">${icon('checkCircle')}<b>${active.length}</b> anúncios ativos</span>
              <span class="ticker-item">${icon('mapPin')}<b>${provCount}</b> províncias com anúncios</span>
              <span class="ticker-item">${icon('banknote')}100% preços em <b>Kz</b></span>
              <span class="ticker-item">${icon('shieldCheck')}Selo de <b>vendedor verificado</b></span>
              <span class="ticker-item">${icon('tag')}Para <b>particulares</b> e <b>stands</b></span>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section-tight">
    <div class="container"><div class="ad-slot">Espaço publicitário — AutoMercado Ads</div></div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head">
        <div><span class="eyebrow">Acabaram de chegar</span><h2 class="section-title">Carros mais recentes</h2><p class="section-sub">Os últimos anúncios publicados na plataforma.</p></div>
        <a class="section-link" href="${hashFor('search',{ordenar:'recentes'})}">Ver todos${icon('arrowRight')}</a>
      </div>
      <div class="car-grid">${recentes.length ? recentes.map(carCardHtml).join('') : carCardSkeletonEmpty('Ainda não há anúncios','Volta em breve ou publica o primeiro anúncio.')}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><div><span class="eyebrow">Por marca</span><h2 class="section-title">Marcas populares em Angola</h2></div></div>
      <div class="brand-grid">
        ${brands.map(([b,c])=>`<a class="brand-chip" href="${hashFor('search',{marca:b})}"><span class="brand-chip-mark">${escapeHtml(b)}</span><span class="brand-chip-count">${c} ${c===1?'anúncio':'anúncios'}</span></a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="section-head"><div><span class="eyebrow">Simples e direto</span><h2 class="section-title">Como funciona</h2></div></div>
      <div class="how-cols">
        <div class="how-col">
          <div class="how-col-head">${icon('search')}<span class="how-col-title">Para compradores</span></div>
          <div class="how-step"><span class="how-step-num">01</span><div class="how-step-body"><b>Pesquisa e filtra</b><span>Encontra por marca, preço, localização e muito mais.</span></div></div>
          <div class="how-step"><span class="how-step-num">02</span><div class="how-step-body"><b>Contacta o vendedor</b><span>Liga, envia mensagem ou pede mais fotos diretamente.</span></div></div>
          <div class="how-step"><span class="how-step-num">03</span><div class="how-step-body"><b>Vê o carro e negoceia</b><span>Combina uma visita segura antes de fechar negócio.</span></div></div>
        </div>
        <div class="how-col">
          <div class="how-col-head">${icon('tag')}<span class="how-col-title">Para vendedores</span></div>
          <div class="how-step"><span class="how-step-num">01</span><div class="how-step-body"><b>Publica o teu anúncio</b><span>Fotos, dados do carro e preço — grátis para começar.</span></div></div>
          <div class="how-step"><span class="how-step-num">02</span><div class="how-step-body"><b>Recebe contactos</b><span>Compradores interessados ligam ou enviam mensagem.</span></div></div>
          <div class="how-step"><span class="how-step-num">03</span><div class="how-step-body"><b>Vende com confiança</b><span>Marca como vendido quando fechares negócio.</span></div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section zone-dark">
    <div class="container">
      <div class="section-head"><div><span class="eyebrow">A caminho</span><h2 class="section-title">Mais do que compra e venda</h2><p class="section-sub">A plataforma já está preparada para estes serviços — alguns já podes experimentar.</p></div></div>
      <div class="roadmap-grid">
        <div class="roadmap-card is-live">${icon('calculator')}<span class="roadmap-soon" style="color:var(--teal);border-color:var(--teal);">Disponível</span><h4>Simulador de financiamento</h4><p>Calcula a prestação mensal em qualquer anúncio, com entrada e prazo ajustáveis.</p></div>
        <div class="roadmap-card">${icon('umbrella')}<span class="roadmap-soon">Brevemente</span><h4>Seguro automóvel</h4><p>Cotações de seguro para o carro que estás a comprar ou já tens.</p></div>
        <div class="roadmap-card">${icon('clipboardCheck')}<span class="roadmap-soon">Brevemente</span><h4>Inspeção veicular</h4><p>Agenda uma inspeção técnica independente antes de comprares.</p></div>
        <div class="roadmap-card">${icon('gauge')}<span class="roadmap-soon">Brevemente</span><h4>Avaliação do meu carro</h4><p>Descobre quanto vale o teu carro antes de o anunciares.</p></div>
        <div class="roadmap-card">${icon('wrench')}<span class="roadmap-soon">Brevemente</span><h4>Manutenção</h4><p>Rede de oficinas parceiras para revisões e reparações.</p></div>
        <div class="roadmap-card">${icon('truck')}<span class="roadmap-soon">Brevemente</span><h4>Transporte &amp; entrega</h4><p>Leva o carro comprado até à tua porta, em qualquer província.</p></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="cta-banner">
        <div><h3>Pronto para vender o teu carro?</h3><p>Cria a tua conta e publica o anúncio em poucos minutos.</p></div>
        <a class="btn btn-gold" href="${hashFor('publish',{})}">${icon('plus')} Publicar anúncio grátis</a>
      </div>
    </div>
  </section>`;
}
function bindHomeEvents(){
  const form = qs('#hero-search-form');
  if(form) form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    navigate('search', cleanParams(Object.fromEntries(fd.entries())));
  });
}

/* ---------------------------------------------------------------------- */
/* PESQUISA / RESULTADOS                                                    */
/* ---------------------------------------------------------------------- */
const PAGE_SIZE = 9;
function selectOptions(list, current){ return list.map(o=>`<option value="${escapeHtml(o)}" ${o===current?'selected':''}>${escapeHtml(o)}</option>`).join(''); }

function filtersFormHtml(f){
  f = f || {};
  return `
  <form id="filters-form" class="filters-form">
    <div class="filter-group-title">Marca e modelo</div>
    <div class="field"><label>Marca</label><select name="marca"><option value="">Todas as marcas</option>${selectOptions(BRANDS, f.marca)}</select></div>
    <div class="field"><label>Modelo</label><input type="text" name="modelo" value="${escapeHtml(f.modelo||'')}" placeholder="Ex: Corolla"></div>

    <div class="filter-group-title">Preço (Kz)</div>
    <div class="field-row"><input type="number" name="precoMin" value="${f.precoMin||''}" placeholder="Mínimo"><input type="number" name="precoMax" value="${f.precoMax||''}" placeholder="Máximo"></div>

    <div class="filter-group-title">Ano</div>
    <div class="field-row"><input type="number" name="anoMin" value="${f.anoMin||''}" placeholder="De"><input type="number" name="anoMax" value="${f.anoMax||''}" placeholder="Até"></div>

    <div class="filter-group-title">Quilometragem máxima</div>
    <div class="field"><input type="number" name="kmMax" value="${f.kmMax||''}" placeholder="Ex: 80000"></div>

    <div class="filter-group-title">Combustível</div>
    <div class="field"><select name="combustivel"><option value="">Todos</option>${selectOptions(FUEL_TYPES, f.combustivel)}</select></div>

    <div class="filter-group-title">Caixa de velocidades</div>
    <div class="field"><select name="cambio"><option value="">Todas</option>${selectOptions(TRANSMISSIONS, f.cambio)}</select></div>

    <div class="filter-group-title">Carroçaria</div>
    <div class="field"><select name="carroceria"><option value="">Todas</option>${selectOptions(BODY_TYPES, f.carroceria)}</select></div>

    <div class="filter-group-title">Localização</div>
    <div class="field"><select name="provincia"><option value="">Todas as províncias</option>${selectOptions(PROVINCES, f.provincia)}</select></div>

    <div class="filter-group-title">Cor</div>
    <div class="field"><select name="cor"><option value="">Todas</option>${selectOptions(CORES, f.cor)}</select></div>

    <div class="filter-group-title">Estado do veículo</div>
    <div class="field"><select name="estadoVeiculo"><option value="">Todos</option>${selectOptions(ESTADO_VEICULO, f.estadoVeiculo)}</select></div>

    <div class="filter-group-title">Novo ou usado</div>
    <div class="field chip-select-group">
      ${['','Novo','Usado'].map(c=>`<button type="button" class="chip-select ${ (f.condicaoUso||'')===c?'is-active':''}" data-condicao="${c}">${c||'Todos'}</button>`).join('')}
      <input type="hidden" name="condicaoUso" value="${escapeHtml(f.condicaoUso||'')}">
    </div>

    <div class="filters-actions">
      <button type="submit" class="btn btn-primary btn-block">Aplicar filtros</button>
      <button type="button" class="btn btn-ghost" data-action="clear-filters">Limpar</button>
    </div>
  </form>`;
}
function activeFilterPillsHtml(f){
  const labels = {
    q:v=>`“${v}”`, marca:v=>v, modelo:v=>v, precoMin:v=>`min ${formatKz(v)}`, precoMax:v=>`máx ${formatKz(v)}`,
    anoMin:v=>`desde ${v}`, anoMax:v=>`até ${v}`, kmMax:v=>`até ${formatKm(v)}`, combustivel:v=>v, cambio:v=>v,
    carroceria:v=>v, provincia:v=>v, cor:v=>v, condicaoUso:v=>v, estadoVeiculo:v=>v,
  };
  const entries = Object.entries(f).filter(([k,v])=> labels[k] && v);
  if(!entries.length) return '';
  return `<div class="active-filter-pills">${entries.map(([k,v])=>`<span class="filter-pill">${escapeHtml(labels[k](v))}<button type="button" data-action="remove-filter" data-key="${k}">${icon('x')}</button></span>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters-all">Limpar tudo</button></div>`;
}
function renderSearch(){
  const f = Object.assign({}, state.route.params);
  const pagina = Math.max(1, parseInt(f.pagina)||1);
  const filtered = sortVehicles(applyFilters(state.vehicles, f), f.ordenar);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  const pageItems = filtered.slice((pagina-1)*PAGE_SIZE, pagina*PAGE_SIZE);

  return `
  <div class="container">
    <div class="page-head">
      <div class="breadcrumb"><a href="${hashFor('home',{})}">Início</a>${icon('chevronRight')}<span>Pesquisa</span></div>
      <h1 class="page-title">${f.marca ? 'Carros ' + escapeHtml(f.marca) : 'Todos os carros'}</h1>
    </div>
  </div>
  <div class="container search-layout">
    <aside class="filters-panel" id="filters-panel">
      <div class="filters-head"><h3>${icon('sliders')} Filtros</h3><button class="icon-btn filters-close" data-action="close-filters">${icon('x')}</button></div>
      ${filtersFormHtml(f)}
    </aside>
    <div>
      ${activeFilterPillsHtml(f)}
      <div class="results-toolbar">
        <div class="results-count"><b>${total}</b> ${total===1?'carro encontrado':'carros encontrados'}</div>
        <div class="results-controls">
          <button type="button" class="btn btn-secondary btn-sm filters-toggle-btn" data-action="open-filters">${icon('sliders')} Filtros</button>
          <select class="sort-select" id="sort-select">
            ${[['relevancia','Relevância'],['recentes','Mais recentes'],['preco_asc','Preço: menor primeiro'],['preco_desc','Preço: maior primeiro'],['ano_desc','Ano: mais novo'],['km_asc','Menor quilometragem']].map(([v,l])=>`<option value="${v}" ${ (f.ordenar||'relevancia')===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="car-grid">${pageItems.length ? pageItems.map(carCardHtml).join('') : carCardSkeletonEmpty('Nenhum carro encontrado','Tenta remover alguns filtros para veres mais resultados.')}</div>
      ${totalPages>1 ? `<div class="pagination">${Array.from({length:totalPages}).map((_,i)=>`<button type="button" class="page-btn ${ (i+1)===pagina?'is-current':''}" data-action="go-page" data-page="${i+1}">${i+1}</button>`).join('')}</div>` : ''}
    </div>
  </div>
  <div class="mobile-drawer-overlay" id="filters-panel-overlay"></div>`;
}
function bindSearchEvents(){
  const form = qs('#filters-form');
  const f = Object.assign({}, state.route.params);
  if(form){
    qsa('.chip-select', form).forEach(btn=> btn.addEventListener('click', ()=>{
      qsa('.chip-select', form).forEach(b=>b.classList.remove('is-active'));
      btn.classList.add('is-active');
      qs('input[name=condicaoUso]', form).value = btn.getAttribute('data-condicao');
    }));
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form).entries());
      navigate('search', cleanParams(Object.assign({}, {q:f.q}, fd, { pagina:1, ordenar:f.ordenar })));
    });
    qs('[data-action=clear-filters]', form)?.addEventListener('click', ()=> navigate('search', cleanParams({ q:f.q })));
  }
  const sortSel = qs('#sort-select');
  if(sortSel) sortSel.addEventListener('change', ()=> navigate('search', cleanParams(Object.assign({}, f, { ordenar: sortSel.value, pagina:1 }))));
  qsa('[data-action=go-page]').forEach(b=> b.addEventListener('click', ()=> navigate('search', cleanParams(Object.assign({}, f, { pagina: b.getAttribute('data-page') })))));
  qsa('[data-action=remove-filter]').forEach(b=> b.addEventListener('click', ()=>{
    const k = b.getAttribute('data-key'); const nf = Object.assign({}, f); delete nf[k]; navigate('search', cleanParams(nf));
  }));
  qsa('[data-action=clear-filters-all]').forEach(b=> b.addEventListener('click', ()=> navigate('search', cleanParams({ q:f.q }))));
  const openBtn = qs('[data-action=open-filters]'); const panel = qs('#filters-panel'); const overlay = qs('#filters-panel-overlay');
  if(openBtn) openBtn.addEventListener('click', ()=>{ panel.classList.add('is-open'); overlay.classList.add('is-open'); });
  qs('[data-action=close-filters]')?.addEventListener('click', ()=>{ panel.classList.remove('is-open'); overlay.classList.remove('is-open'); });
  if(overlay) overlay.addEventListener('click', ()=>{ panel.classList.remove('is-open'); overlay.classList.remove('is-open'); });
}

/* engine2 / doors / palette / package já estão mapeados em LUCIDE_MAP acima */

/* ---------------------------------------------------------------------- */
/* FICHA DO CARRO                                                           */
/* ---------------------------------------------------------------------- */
let galleryIdx = 0;
function galleryMainInner(v, idx){
  const label = v.fotos[idx];
  const caption = isPhotoUrl(label) ? `Foto ${idx+1}` : label;
  return `
    ${v.fotos.length>1 ? `<button type="button" class="gallery-nav-btn prev" data-action="gallery-prev" data-id="${v.id}">${icon('chevronLeft')}</button>` : ''}
    ${mediaPlaceholder(v.id, label, 'big')}
    ${v.fotos.length>1 ? `<button type="button" class="gallery-nav-btn next" data-action="gallery-next" data-id="${v.id}">${icon('chevronRight')}</button>` : ''}
    <span class="gallery-label">${escapeHtml(caption)}</span>
    <span class="gallery-count">${idx+1} / ${v.fotos.length}</span>`;
}
function updateGallery(v, idx){
  galleryIdx = ((idx % v.fotos.length) + v.fotos.length) % v.fotos.length;
  const main = qs('#gallery-main');
  if(main){ main.innerHTML = galleryMainInner(v, galleryIdx); hydrateIcons(main); }
  qsa('.gallery-thumb').forEach(t => t.classList.toggle('is-active', Number(t.getAttribute('data-idx'))===galleryIdx));
}
function specItem(iconName, label, value){
  return `<div class="spec-item">${icon(iconName)}<div class="spec-label">${label}</div><div class="spec-value">${value}</div></div>`;
}
function detailSpecsHtml(v){
  return `<div class="spec-grid">
    ${specItem('calendar','Ano', v.ano)}
    ${specItem('gauge','Quilometragem', formatKm(v.quilometragem))}
    ${specItem('fuel','Combustível', escapeHtml(v.combustivel))}
    ${specItem('shift','Caixa', escapeHtml(v.cambio))}
    ${specItem('engine2','Cilindrada', v.cilindrada ? v.cilindrada+'L' : '—')}
    ${specItem('package','Carroçaria', escapeHtml(v.carroceria))}
    ${specItem('palette','Cor', escapeHtml(v.cor))}
    ${specItem('doors','Portas', escapeHtml(v.portas || '—'))}
    ${specItem('tag','Condição', escapeHtml(v.condicaoUso))}
    ${specItem('checkCircle','Estado', escapeHtml(v.estadoVeiculo))}
  </div>`;
}
function renderDetail(id){
  const v = findVehicle(id);
  if(v && !Array.isArray(v.fotos)) v.fotos = photoSet(4);
  if(v && !Array.isArray(v.equipamentos)) v.equipamentos = [];
  if(v && !v.vendedor) v.vendedor = { id:'', nome:'Vendedor', telefone:'', tipo:'particular', verificado:false, membroDesde:'', avaliacao:4.5 };
  if(v && v.vendedor.telefone == null) v.vendedor.telefone = '';
  if(!v) return `<div class="container section text-center">${carCardSkeletonEmpty('Anúncio não encontrado','Este anúncio pode ter sido removido ou já não está disponível.')}<a href="${hashFor('search',{})}" class="btn btn-primary" style="margin-top:16px;">Ver todos os carros</a></div>`;
  galleryIdx = 0;
  const fav = isFavorite(v.id);
  const suspicious = isPriceSuspicious(v);
  const ratingSummary = sellerRatingSummary(v.vendedor || {id:'', nome:'Vendedor', tipo:'particular', telefone:''});

  return `
  <div class="container">
    <div class="page-head">
      <div class="breadcrumb"><a href="${hashFor('home',{})}">Início</a>${icon('chevronRight')}<a href="${hashFor('search',{marca:v.marca})}">${escapeHtml(v.marca)}</a>${icon('chevronRight')}<span>${escapeHtml(v.modelo)}</span></div>
    </div>
  </div>
  <div class="container detail-layout">
    <div>
      <div class="gallery-main" id="gallery-main">${galleryMainInner(v,0)}</div>
      <div class="gallery-thumbs">
        ${v.fotos.map((label,i)=>`<button type="button" class="gallery-thumb ${i===0?'is-active':''}" data-action="gallery-set" data-id="${v.id}" data-idx="${i}" aria-label="${escapeHtml(isPhotoUrl(label)?('Foto '+(i+1)):label)}">${mediaPlaceholder(v.id,label)}</button>`).join('')}
      </div>

      <div class="detail-title-row">
        <div>
          <h1 class="detail-title">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</h1>
          <div class="detail-loc">${icon('mapPin')}${escapeHtml(v.cidade)}, ${escapeHtml(v.provincia)}</div>
          <div class="detail-badges">
            ${statusBadgeHtml(v)}
          </div>
        </div>
        <div class="detail-price-block">
          <div class="detail-price">${formatKz(v.preco)}</div>
          <small>${icon('eye')} ${formatNum(v.visualizacoes)} visualizações</small>
        </div>
      </div>

      ${suspicious ? `<div class="safety-box" style="margin-top:14px;"><h4>${icon('alertTriangle')}Preço bem abaixo da média para este tipo de carro</h4><ul><li>Confirma sempre a documentação e vê o carro pessoalmente antes de qualquer pagamento.</li></ul></div>` : ''}

      ${detailSpecsHtml(v)}

      <div class="detail-block">
        <h3>Descrição</h3>
        <p class="desc-text">${escapeHtml(v.descricao)}</p>
      </div>

      <div class="detail-block">
        <h3>Características e equipamentos</h3>
        <div class="equip-tags">${v.equipamentos.map(e=>`<span class="equip-tag">${icon('check')}${escapeHtml(e)}</span>`).join('')}</div>
      </div>

      <div class="detail-block">
        <div class="safety-box">
          <h4>${icon('shieldAlert')}Avisos contra fraude</h4>
          <ul>
            <li>Nunca transfiras dinheiro antes de ver e testar o carro pessoalmente</li>
            <li>Desconfia de preços muito abaixo do mercado</li>
            <li>Prefere encontros em locais públicos e durante o dia</li>
            <li>Denuncia qualquer comportamento suspeito</li>
          </ul>
        </div>
      </div>
    </div>

    <div>
      <div class="seller-card">
        <a class="seller-top" href="${hashFor('vendorProfile',{id:v.vendedor.id})}" style="text-decoration:none;color:inherit;">
          <div class="seller-avatar">${initials(v.vendedor.nome)}</div>
          <div>
            <div class="seller-name-row"><span class="seller-name">${escapeHtml(v.vendedor.nome)}</span>${v.vendedor.verificado?`<span class="badge badge-verified">${icon('badgeCheck')}Verificado</span>`:''}</div>
            <div class="seller-meta">${icon(v.vendedor.tipo==='stand'?'building':'user')} ${v.vendedor.tipo==='stand'?'Stand / Concessionária':'Vendedor particular'} · Desde ${v.vendedor.membroDesde}</div>
            <div class="seller-stars">${Array.from({length:5}).map((_,i)=> i < Math.round(ratingSummary.media) ? icon('starFilled') : icon('star')).join('')}<span class="seller-stars-num">${ratingSummary.media.toFixed(1)}${ratingSummary.total?` (${ratingSummary.total})`:''}</span></div>
          </div>
        </a>
        <div class="seller-actions">
          <button type="button" class="btn btn-primary btn-block" data-action="open-contact" data-id="${v.id}">${icon('phone')} Contactar vendedor</button>
          <div class="seller-actions-row2">
            <a class="btn btn-secondary" href="tel:${String(v.vendedor.telefone || '').replace(/\s+/g,'')}">${icon('phone')} Ligar</a>
            <button type="button" class="btn btn-secondary" data-action="open-message" data-id="${v.id}">${icon('message')} Mensagem</button>
          </div>
          <div class="seller-actions-row2">
            <button type="button" class="btn ${fav?'btn-primary':'btn-secondary'}" data-action="toggle-fav" data-id="${v.id}">${icon(fav?'heartFilled':'heart')} ${fav?'Guardado':'Guardar'}</button>
            <button type="button" class="btn btn-danger-ghost" data-action="open-report" data-id="${v.id}">${icon('flag')} Denunciar</button>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-action="open-rate-seller" data-id="${v.id}">${icon('star')} Avaliar vendedor</button>
        </div>
      </div>

      ${financeWidgetHtml(v)}
    </div>
  </div>`;
}
function bindDetailEvents(v){
  if(!v) return;
  computeFinance();
  ['fin-entrada','fin-prazo','fin-taxa'].forEach(id=>{
    const el = qs('#'+id); if(el) el.addEventListener('input', computeFinance);
  });
}

/* ---------------------------------------------------------------------- */
/* SIMULADOR DE FINANCIAMENTO                                               */
/* ---------------------------------------------------------------------- */
function financeWidgetHtml(v){
  const entradaDefault = Math.round(v.preco*0.2/10000)*10000;
  return `
  <div class="finance-widget" id="finance-widget" data-preco="${v.preco}">
    <div class="finance-head">${icon('calculator')}<h4>Simular financiamento</h4></div>
    <div class="finance-row">
      <div class="field mt-0"><label>Entrada (Kz)</label><input type="number" id="fin-entrada" value="${entradaDefault}" step="10000" min="0"></div>
      <div class="field mt-0"><label>Prazo</label><select id="fin-prazo">${[12,24,36,48,60,72].map(n=>`<option value="${n}" ${n===48?'selected':''}>${n} meses</option>`).join('')}</select></div>
    </div>
    <div class="field mt-0"><label>Taxa de juro anual (%)</label><input type="number" id="fin-taxa" value="14" step="0.5" min="0"></div>
    <div class="finance-result"><div class="fr-amount" id="fin-result">—</div><div class="fr-label">prestação mensal estimada</div></div>
    <p class="finance-fineprint">Simulação ilustrativa e não vinculativa. Módulo de financiamento em pré-lançamento — a taxa real depende da análise do parceiro financeiro.</p>
  </div>`;
}
function computeFinance(){
  const widget = qs('#finance-widget'); if(!widget) return;
  const preco = Number(widget.getAttribute('data-preco'))||0;
  const entradaEl = qs('#fin-entrada'), prazoEl = qs('#fin-prazo'), taxaEl = qs('#fin-taxa'), resEl = qs('#fin-result');
  if(!entradaEl||!prazoEl||!taxaEl||!resEl) return;
  const entrada = Math.min(Math.max(Number(entradaEl.value)||0,0), preco);
  const n = Number(prazoEl.value)||48;
  const taxaAnual = Math.max(Number(taxaEl.value)||0,0);
  const principal = Math.max(preco - entrada, 0);
  const r = taxaAnual/100/12;
  const prest = r>0 ? principal*r/(1-Math.pow(1+r,-n)) : principal/n;
  resEl.textContent = formatKz(prest) + '/mês';
}

/* ---------------------------------------------------------------------- */
/* MODAIS DA FICHA DO CARRO: contactar / mensagem / denunciar               */
/* ---------------------------------------------------------------------- */
// Números angolanos costumam ser escritos só com os 9 dígitos locais
// (ex.: "923 456 789"), sem o indicativo +244 — e o wa.me só abre a
// conversa certa com o número internacional completo. Esta função
// normaliza para o formato que o wa.me espera (sem "+", com indicativo).
function normalizeAngolaPhone(telefone){
  let digits = String(telefone||'').replace(/[^\d]/g,'');
  if(!digits) return '';
  if(digits.startsWith('00')) digits = digits.slice(2);
  if(digits.startsWith('244') && digits.length === 12) return digits;
  if(digits.startsWith('0') && digits.length === 10) digits = digits.slice(1);
  if(digits.length === 9) return '244' + digits;
  return digits;
}

function openContactModal(v){
  v.contactos = (v.contactos||0)+1; saveVehicles();
  notifyIfOwnListing(v.id, 'Novo contacto recebido', `Alguém pediu o contacto do teu anúncio ${v.marca} ${v.modelo}.`);
  const temTelefone = !!(v.vendedor && v.vendedor.telefone && v.vendedor.telefone.trim());
  const waNumber = temTelefone ? normalizeAngolaPhone(v.vendedor.telefone) : '';
  const waText = encodeURIComponent(`Olá! Vi o seu anúncio do ${v.marca} ${v.modelo} (${v.ano}) no AutoMercado Angola e tenho interesse.`);
  // Sem telefone guardado, um link "tel:"/"wa.me" vazio não abre uma
  // conversa — no WhatsApp abre antes o ecrã genérico de partilha. Por
  // isso, sem número, mostramos um aviso em vez destes botões.
  const contactoHtml = temTelefone
    ? `<div class="seller-phone-reveal">${icon('phone')} ${escapeHtml(v.vendedor.telefone)}</div>
      <div class="modal-actions"><a class="btn btn-primary btn-block" href="tel:+${waNumber}">${icon('phone')} Ligar agora</a></div>
      <div class="modal-actions"><a class="btn btn-secondary btn-block" target="_blank" rel="noopener" href="https://wa.me/${waNumber}?text=${waText}">${icon('message')} Abrir WhatsApp</a></div>`
    : `<div class="seller-phone-reveal">${icon('phone')} Este vendedor ainda não adicionou um número de contacto.</div>`;
  openModal(`
    <div class="modal-head"><h3>Contactar vendedor</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <a class="seller-top" href="${hashFor('vendorProfile',{id:v.vendedor.id})}" style="text-decoration:none;color:inherit;">
        <div class="seller-avatar">${initials(v.vendedor.nome)}</div>
        <div><div class="seller-name-row"><span class="seller-name">${escapeHtml(v.vendedor.nome)}</span>${v.vendedor.verificado?`<span class="badge badge-verified">${icon('checkCircle')}Verificado</span>`:''}</div><div class="seller-meta">${v.vendedor.tipo==='stand'?'Stand':'Particular'} · Membro desde ${v.vendedor.membroDesde}</div></div>
      </a>
      ${contactoHtml}
      <div class="safety-box" style="margin-top:16px;"><h4>${icon('shieldAlert')}Antes de negociar</h4><ul>
        <li>Combina encontros em locais públicos e movimentados</li>
        <li>Nunca faças pagamentos antecipados sem ver o carro</li>
        <li>Confirma a documentação antes de fechar negócio</li>
      </ul></div>
    </div>`);
}
function openMessageModal(v){
  openModal(`
    <div class="modal-head"><h3>Enviar mensagem</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">A mensagem é enviada a <b>${escapeHtml(v.vendedor.nome)}</b> sobre o ${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}.</p>
      <form id="message-form">
        <div class="field"><label>A tua mensagem</label><textarea name="texto" rows="4" required>Olá, ainda tem este ${escapeHtml(v.marca)} ${escapeHtml(v.modelo)} disponível? Gostaria de saber mais.</textarea></div>
        <button type="submit" class="btn btn-primary btn-block">${icon('message')} Enviar mensagem</button>
      </form>
    </div>`, { onOpen:(root)=>{
    qs('#message-form', root).addEventListener('submit',(e)=>{
      e.preventDefault();
      const texto = (new FormData(e.target).get('texto')||'').trim();
      if(!texto){ showToast('Escreve uma mensagem', {error:true}); return; }
      requireAuth(()=>{
        state.messages.push({ id:uid('m'), vehicleId:v.id, deNome:state.session.nome, deTelefone:state.session.telefone, texto, criadoEm:new Date().toISOString(), lida:false });
        saveMessages();
        v.contactos = (v.contactos||0)+1; saveVehicles();
        notifyIfOwnListing(v.id, 'Nova mensagem recebida', `${state.session.nome} enviou uma mensagem sobre o ${v.marca} ${v.modelo}.`);
        closeModal(); showToast('Mensagem enviada ao vendedor');
      });
    });
  }});
}
function openReportModal(v){
  openModal(`
    <div class="modal-head"><h3>Denunciar anúncio</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">Ajuda-nos a manter o AutoMercado seguro. Qual o motivo?</p>
      <form id="report-form">
        <div class="reason-list">${REPORT_REASONS.map((r,i)=>`<label class="reason-option"><input type="radio" name="motivo" value="${escapeHtml(r)}">${escapeHtml(r)}</label>`).join('')}</div>
        <div class="field" style="margin-top:14px;"><label>Detalhes (opcional)</label><textarea name="detalhe" rows="3"></textarea></div>
        <button type="submit" class="btn btn-danger-ghost btn-block" style="margin-top:6px;border:1.5px solid var(--danger);">${icon('flag')} Enviar denúncia</button>
      </form>
    </div>`, { onOpen:(root)=>{
    qs('#report-form', root).addEventListener('submit',(e)=>{
      e.preventDefault();
      const motivo = new FormData(e.target).get('motivo');
      if(!motivo){ showToast('Escolhe um motivo', {error:true}); return; }
      state.reports.push({ id:uid('r'), vehicleId:v.id, marcaModelo:v.marca+' '+v.modelo, motivo, detalhe:new FormData(e.target).get('detalhe')||'', criadoEm:new Date().toISOString(), estado:'pendente' });
      saveReports();
      closeModal(); showToast('Denúncia enviada. Obrigado por ajudares a manter a plataforma segura.');
    });
  }});
}

function openRateSellerModal(v){
  let picked = 5;
  const starsHtml = ()=> Array.from({length:5}).map((_,i)=>
    `<button type="button" class="star-pick-btn" data-star="${i+1}">${icon(i<picked?'starFilled':'star')}</button>`
  ).join('');
  openModal(`
    <div class="modal-head"><h3>Avaliar vendedor</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">Como foi a tua experiência com <b>${escapeHtml(v.vendedor.nome)}</b>?</p>
      <div class="star-picker" id="star-picker">${starsHtml()}</div>
      <form id="rate-form" style="margin-top:14px;">
        <div class="field"><label>Comentário (opcional)</label><textarea name="comentario" rows="3" placeholder="Conta como correu a negociação..."></textarea></div>
        <button type="submit" class="btn btn-primary btn-block">${icon('send')} Enviar avaliação</button>
      </form>
    </div>`, { onOpen:(root)=>{
    const picker = qs('#star-picker', root);
    picker.addEventListener('click', (e)=>{
      const btn = e.target.closest('.star-pick-btn'); if(!btn) return;
      picked = Number(btn.getAttribute('data-star'));
      picker.innerHTML = starsHtml(); hydrateIcons(picker);
    });
    qs('#rate-form', root).addEventListener('submit',(e)=>{
      e.preventDefault();
      state.ratings.push({ id:uid('rt'), sellerId:v.vendedor.id, autorNome:state.session.nome, nota:picked, comentario:(new FormData(e.target).get('comentario')||'').trim(), criadoEm:new Date().toISOString() });
      saveRatings();
      notifyIfOwnListing(v.id, 'Recebeste uma nova avaliação', `${state.session.nome} avaliou-te com ${picked} ${picked===1?'estrela':'estrelas'}.`);
      closeModal(); showToast('Avaliação enviada, obrigado!'); rerenderCurrentView();
    });
  }});
}

/* ---------------------------------------------------------------------- */
/* PUBLICAR ANÚNCIO (formulário + pré-visualização)                        */
/* ---------------------------------------------------------------------- */
let publishDraft = null;
let publishFiles = [];
let publishMode = 'form';
let publishRouteKey = null;

function freshDraft(){
  return { marca:'', modelo:'', ano:new Date().getFullYear(), preco:'', quilometragem:'', combustivel:'', cambio:'',
    cilindrada:'', carroceria:'', cor:'', portas:4, condicaoUso:'Usado', estadoVeiculo:'Bom', provincia:'', cidade:'',
    descricao:'', equipamentos:[] };
}
function draftFromVehicle(v){
  return Object.assign(freshDraft(), { marca:v.marca, modelo:v.modelo, ano:v.ano, preco:v.preco, quilometragem:v.quilometragem,
    combustivel:v.combustivel, cambio:v.cambio, cilindrada:v.cilindrada||'', carroceria:v.carroceria, cor:v.cor, portas:v.portas,
    condicaoUso:v.condicaoUso, estadoVeiculo:v.estadoVeiculo, provincia:v.provincia, cidade:v.cidade, descricao:v.descricao,
    equipamentos:v.equipamentos.slice() });
}
function renderImagePreviewGrid(){
  return publishFiles.map((f,i)=>`<div class="image-preview"><img src="${f.url}" alt="Foto ${i+1}">${i===0?'<span class="cover-tag">Capa</span>':''}<button type="button" class="image-remove-btn" data-action="remove-photo" data-idx="${i}">${icon('x')}</button></div>`).join('');
}
function renderPublishFormWrap(isEdit){
  const d = publishDraft;
  return `<div class="container section">
    <div class="page-head"><h1 class="page-title">${isEdit?'Editar anúncio':'Publicar anúncio'}</h1><p class="page-sub">Preenche os dados do teu carro — podes pré-visualizar antes de publicar.</p></div>
    <div class="form-card" style="max-width:760px;margin-top:20px;">
    <form id="publish-form">
      <div class="form-section-title">${icon('camera')} Fotos do veículo</div>
      <div class="dropzone" id="dropzone">${icon('upload')}<p>Arrasta as fotos para aqui ou clica para escolher</p><span>JPG, PNG ou WEBP • até 5MB cada • máx. 10 fotos</span><input type="file" id="file-input" accept="image/*" multiple style="display:none;"></div>
      <div class="image-preview-grid" id="image-preview-grid">${renderImagePreviewGrid()}</div>

      <div class="form-section-title">${icon('tag')} Dados do veículo</div>
      <div class="form-grid-2">
        <div class="field"><label>Marca *</label><select name="marca" required><option value="">Seleciona</option>${selectOptions(BRANDS, d.marca)}</select></div>
        <div class="field"><label>Modelo *</label><input type="text" name="modelo" required value="${escapeHtml(d.modelo)}" placeholder="Ex: Corolla"></div>
        <div class="field"><label>Ano *</label><input type="number" name="ano" required min="1980" max="${new Date().getFullYear()+1}" value="${d.ano}"></div>
        <div class="field"><label>Preço (Kz) *</label><input type="number" name="preco" required min="1000" step="1000" value="${d.preco}" placeholder="Ex: 8500000"></div>
        <div class="field"><label>Quilometragem *</label><input type="number" name="quilometragem" required min="0" value="${d.quilometragem}" placeholder="Ex: 45000"></div>
        <div class="field"><label>Combustível *</label><select name="combustivel" required><option value="">Seleciona</option>${selectOptions(FUEL_TYPES, d.combustivel)}</select></div>
        <div class="field"><label>Caixa de velocidades *</label><select name="cambio" required><option value="">Seleciona</option>${selectOptions(TRANSMISSIONS, d.cambio)}</select></div>
        <div class="field"><label>Cor *</label><select name="cor" required><option value="">Seleciona</option>${selectOptions(CORES, d.cor)}</select></div>
      </div>

      <div class="form-section-title">${icon('sliders')} Dados opcionais</div>
      <div class="form-grid-2">
        <div class="field"><label>Cilindrada (L)</label><input type="number" name="cilindrada" step="0.1" min="0" value="${d.cilindrada}" placeholder="Ex: 2.0"></div>
        <div class="field"><label>Carroçaria</label><select name="carroceria"><option value="">Seleciona</option>${selectOptions(BODY_TYPES, d.carroceria)}</select></div>
        <div class="field"><label>Portas</label><select name="portas">${[2,3,4,5].map(n=>`<option value="${n}" ${Number(d.portas)===n?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>Novo ou usado</label><select name="condicaoUso">${selectOptions(CONDICAO_USO, d.condicaoUso)}</select></div>
        <div class="field"><label>Estado do veículo</label><select name="estadoVeiculo">${selectOptions(ESTADO_VEICULO, d.estadoVeiculo)}</select></div>
      </div>
      <div class="field"><label>Equipamentos</label><div class="chip-select-group">${EQUIPMENT_LIST.map(eq=>`<label class="chip-select"><input type="checkbox" name="equipamentos" value="${escapeHtml(eq)}" ${d.equipamentos.includes(eq)?'checked':''}>${escapeHtml(eq)}</label>`).join('')}</div></div>

      <div class="form-section-title">${icon('mapPin')} Localização e descrição</div>
      <div class="form-grid-2">
        <div class="field"><label>Província *</label><select name="provincia" id="provincia-select" required><option value="">Seleciona</option>${selectOptions(PROVINCES, d.provincia)}</select></div>
        <div class="field"><label>Cidade</label><select name="cidade" id="cidade-select">${citiesFor(d.provincia).length ? `<option value="">Seleciona</option>${citiesFor(d.provincia).map(c=>`<option value="${escapeHtml(c)}" ${c===d.cidade?'selected':''}>${escapeHtml(c)}</option>`).join('')}` : `<option value="">Seleciona a província primeiro</option>`}</select></div>
      </div>
      <div class="field"><label>Descrição *</label><textarea name="descricao" rows="5" required minlength="50" placeholder="Descreve o estado do carro, histórico, motivo da venda...">${escapeHtml(d.descricao)}</textarea><span class="field-hint">Mínimo 50 caracteres.</span></div>

      <div class="form-section-title">${icon('phone')} Contacto</div>
      <p style="font-size:13px;color:var(--text-dim);margin-bottom:4px;">${state.session ? `Os compradores vão contactar-te através de <b>${escapeHtml(state.session.nome)}</b> · ${escapeHtml(state.session.telefone)}.` : 'Vamos pedir-te um nome e telefone de contacto no próximo passo.'}</p>

      <div class="form-actions" style="margin-top:24px;"><button type="submit" class="btn btn-primary btn-block">${icon('eye')} Pré-visualizar anúncio</button></div>
    </form>
    </div>
  </div>`;
}
function previewDetailBody(d){
  const seedKey = (d.marca||'x')+(d.modelo||'y');
  const photos = publishFiles.length ? publishFiles.map((f,i)=>({label:'Foto '+(i+1), url:f.url})) : photoSet(4).map(l=>({label:l,url:null}));
  const main = photos[galleryIdx] || photos[0];
  return `
    <div class="gallery-main">${main.url ? `<img src="${main.url}" style="width:100%;height:100%;object-fit:cover;">` : mediaPlaceholder(seedKey, main.label,'big')}<span class="gallery-count">1 / ${photos.length}</span></div>
    <div class="gallery-thumbs">${photos.map((p)=>`<div class="gallery-thumb">${p.url?`<img src="${p.url}" style="width:100%;height:100%;object-fit:cover;">`:mediaPlaceholder(seedKey,p.label)}</div>`).join('')}</div>
    <div class="detail-title-row">
      <div><h1 class="detail-title">${escapeHtml(d.marca||'Marca')} ${escapeHtml(d.modelo||'Modelo')}</h1><div class="detail-loc">${icon('mapPin')}${escapeHtml(d.cidade||'Cidade')}${d.cidade?', ':''}${escapeHtml(d.provincia||'Província')}</div></div>
      <div class="detail-price-block"><div class="detail-price">${d.preco?formatKz(d.preco):'—'}</div></div>
    </div>
    ${detailSpecsHtml({ ano:d.ano, quilometragem:d.quilometragem||0, combustivel:d.combustivel||'—', cambio:d.cambio||'—', cilindrada:d.cilindrada, carroceria:d.carroceria||'—', cor:d.cor||'—', portas:d.portas, condicaoUso:d.condicaoUso, estadoVeiculo:d.estadoVeiculo })}
    <div class="detail-block"><h3>Descrição</h3><p class="desc-text">${escapeHtml(d.descricao||'—')}</p></div>
    <div class="detail-block"><h3>Equipamentos</h3><div class="equip-tags">${d.equipamentos.length?d.equipamentos.map(e=>`<span class="equip-tag">${icon('check')}${escapeHtml(e)}</span>`).join(''):'<span style="font-size:13px;color:var(--text-faint);">Nenhum selecionado</span>'}</div></div>`;
}
function renderPublishPreviewWrap(){
  galleryIdx = 0;
  const d = publishDraft;
  return `<div class="container section">
    <div class="page-head"><h1 class="page-title">Pré-visualização do anúncio</h1><p class="page-sub">É assim que os compradores vão ver o teu anúncio.</p></div>
    <div class="preview-frame" style="margin-top:16px;"><div class="preview-frame-label">${icon('eye')} MODO DE PRÉ-VISUALIZAÇÃO</div><div style="padding:0 6px 6px;">${previewDetailBody(d)}</div></div>
    <div class="form-card" style="margin-top:18px;">
      <div class="form-actions" style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn btn-secondary" data-action="publish-edit">${icon('edit')} Editar anúncio</button>
        <button type="button" class="btn btn-primary" style="flex:1;" data-action="publish-confirm">${icon('checkCircle')} Confirmar e publicar</button>
      </div>
    </div>
  </div>`;
}
function renderPublish(){
  if(!state.session || !state.session.papeis || !state.session.papeis.vendedor) return sellerActivationPromptHtml();
  const editId = state.route.params.editId;
  if(!editId && !hasUnlimitedPlan() && mySellerListings().length >= currentPlanInfo().limite) return planLimitReachedHtml();
  const routeKey = editId || 'new';
  if(routeKey !== publishRouteKey){
    publishRouteKey = routeKey;
    publishFiles.forEach(f=>{ try{ URL.revokeObjectURL(f.url); }catch(e){} });
    publishFiles = [];
    publishMode = 'form';
    publishDraft = editId ? draftFromVehicle(findVehicle(editId) || {}) : freshDraft();
  }
  return publishMode==='preview' ? renderPublishPreviewWrap() : renderPublishFormWrap(!!editId);
}
function validateDraft(d, files){
  const errs = [];
  if(!d.marca) errs.push('Escolhe a marca'); if(!d.modelo) errs.push('Indica o modelo');
  if(!d.preco || Number(d.preco)<1000) errs.push('Preço mínimo 1.000 Kz');
  if(d.quilometragem===''||Number(d.quilometragem)<0) errs.push('Indica a quilometragem');
  if(!d.combustivel) errs.push('Escolhe o combustível'); if(!d.cambio) errs.push('Escolhe a caixa de velocidades');
  if(!d.cor) errs.push('Escolhe a cor'); if(!d.provincia) errs.push('Escolhe a localização');
  if(!d.descricao || d.descricao.trim().length<50) errs.push('A descrição precisa de pelo menos 50 caracteres');
  if(!files.length) errs.push('Adiciona pelo menos uma foto');
  return errs;
}
function handleFiles(fileList){
  const files = Array.from(fileList||[]); let added=0;
  for(const file of files){
    if(publishFiles.length>=10){ showToast('Máximo de 10 fotos', {error:true}); break; }
    if(!file.type.startsWith('image/')) continue;
    if(file.size > 5*1024*1024){ showToast(`"${file.name}" excede 5MB`, {error:true}); continue; }
    publishFiles.push({ file, url:URL.createObjectURL(file) }); added++;
  }
  if(added) refreshImagePreviewGrid();
}
function refreshImagePreviewGrid(){ const g=qs('#image-preview-grid'); if(g){ g.innerHTML = renderImagePreviewGrid(); hydrateIcons(g); } }
function removePhoto(idx){ const f=publishFiles[idx]; if(f){ try{URL.revokeObjectURL(f.url);}catch(e){} } publishFiles.splice(idx,1); refreshImagePreviewGrid(); }

function bindPublishEvents(){
  if(publishMode!=='form') return;
  const form = qs('#publish-form'); if(!form) return;
  form.addEventListener('input', (e)=>{ const t=e.target; if(t.name && t.type!=='checkbox' && t.type!=='radio') publishDraft[t.name]=t.value; });
  form.addEventListener('change', (e)=>{
    const t=e.target; if(!t.name) return;
    if(t.name==='equipamentos'){ if(t.checked) publishDraft.equipamentos.push(t.value); else publishDraft.equipamentos=publishDraft.equipamentos.filter(x=>x!==t.value); return; }
    publishDraft[t.name]=t.value;
    if(t.name==='provincia'){
      publishDraft.cidade='';
      const citySel = qs('#cidade-select'); const cities = citiesFor(t.value);
      citySel.innerHTML = cities.length ? `<option value="">Seleciona</option>${cities.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}` : `<option value="">Seleciona a província primeiro</option>`;
    }
  });
  const dropzone = qs('#dropzone'), fileInput = qs('#file-input');
  dropzone.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', ()=> handleFiles(fileInput.files));
  ['dragenter','dragover'].forEach(evt=> dropzone.addEventListener(evt,(e)=>{ e.preventDefault(); dropzone.classList.add('is-dragover'); }));
  ['dragleave','drop'].forEach(evt=> dropzone.addEventListener(evt,(e)=>{ e.preventDefault(); dropzone.classList.remove('is-dragover'); }));
  dropzone.addEventListener('drop', (e)=> handleFiles(e.dataTransfer.files));
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const errs = validateDraft(publishDraft, publishFiles);
    if(errs.length){ showToast(errs[0], {error:true}); return; }
    publishMode='preview'; rerenderCurrentView(); window.scrollTo({top:0,behavior:'smooth'});
  });
}
async function confirmPublish() {
  requireAuth(async () => {

    const d = publishDraft;
    const editId = state.route.params.editId;

    if (editId) {

      const editToken = localStorage.getItem("token");

      if (!editToken) {
        showToast("Faça login novamente.", { error: true });
        return;
      }

      try {

        const response = await fetch(`${API_URL}/cars/${editId}`, {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${editToken}`
          },

          body: JSON.stringify({
            brand: d.marca,
            model: d.modelo,
            year: Number(d.ano),
            price: Number(d.preco),
            mileage: Number(d.quilometragem || 0),
            fuel: d.combustivel,
            transmission: d.cambio,
            engine_size: d.cilindrada ? Number(d.cilindrada) : null,
            body_type: d.carroceria,
            color: d.cor,
            doors: d.portas ? Number(d.portas) : null,
            usage_type: d.condicaoUso,
            condition: d.estadoVeiculo,
            equipment: d.equipamentos || [],
            province: d.provincia,
            location: d.cidade || d.provincia,
            description: (d.descricao || "").trim()
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.error("ERRO AO EDITAR CARRO:", data);
          showToast(data.error || "Erro ao atualizar o carro.", { error: true });
          return;
        }

        publishDraft = null;
        publishRouteKey = null;

        try {
          await loadCarsFromAPI();
        } catch (error) {
          console.error("Erro ao atualizar lista:", error);
        }

        showToast("Anúncio atualizado com sucesso!");
        navigate("seller", { tab: "anuncios" });

      } catch (error) {
        console.error("ERRO INTERNO AO EDITAR CARRO:", error);
        showToast("Erro ao atualizar o carro.", { error: true });
      }

      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      showToast("Faça login novamente.", { error: true });
      return;
    }

    try {

      // =========================
      // 1. CRIAR CARRO
      // =========================

      const response = await fetch(`${API_URL}/cars`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },

        body: JSON.stringify({
          brand: d.marca,
          model: d.modelo,
          year: Number(d.ano),
          price: Number(d.preco),
          mileage: Number(d.quilometragem || 0),
          fuel: d.combustivel,
          transmission: d.cambio,
          engine_size: d.cilindrada ? Number(d.cilindrada) : null,
          body_type: d.carroceria,
          color: d.cor,
          doors: d.portas ? Number(d.portas) : null,
          usage_type: d.condicaoUso,
          condition: d.estadoVeiculo,
          equipment: d.equipamentos || [],
          province: d.provincia,
          location: d.cidade || d.provincia,
          description: (d.descricao || "").trim(),
          image_url: null
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {

        console.error("ERRO AO CRIAR CARRO:", data);

        if (response.status === 402) {
          showToast(
            data.error || `Atingiste o limite de anúncios do teu plano.`,
            { error: true }
          );
          navigate("plans", {});
          return;
        }

        showToast(
          data.error || "Erro ao criar o carro.",
          { error: true }
        );

        return;
      }

      const car = data.car || data;

      if (!car.id) {
        console.error("Servidor não devolveu ID:", data);

        showToast(
          "O servidor não devolveu o ID do carro.",
          { error: true }
        );

        return;
      }

      console.log("CARRO CRIADO:", car.id);

// Enviar fotos
let uploadFailed = false;
if (publishFiles && publishFiles.length > 0) {

  try {

    const formData = new FormData();

    publishFiles.forEach((item) => {

      // Se o item tiver .file, usa o File
      const file = item.file || item;

      if (file instanceof File || file instanceof Blob) {
        formData.append("images", file);
      } else {
        console.log("FICHEIRO INVÁLIDO:", item);
      }

    });

    console.log("ENVIANDO FOTOS:", publishFiles);
    console.log("CAR ID:", car.id);

    const uploadResponse = await fetch(
      `${API_URL}/cars/${car.id}/images`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: formData
      }
    );

    const uploadText = await uploadResponse.text();

    console.log("STATUS UPLOAD:", uploadResponse.status);
    console.log("RESPOSTA UPLOAD:", uploadText);

    if (!uploadResponse.ok) {
      throw new Error(
        `Erro no upload (${uploadResponse.status}): ${uploadText}`
      );
    }

  } catch (uploadError) {

    console.error("ERRO COMPLETO UPLOAD:", uploadError);

    uploadFailed = true;

    showToast(
      "Carro publicado, mas ocorreu erro ao enviar as fotos. Podes tentar adicionar as fotos mais tarde, a editar o anúncio.",
      { error: true }
    );

  }

}

      // =========================
      // 3. ATUALIZAR LISTA
      // =========================

      publishFiles.forEach((f) => {

        try {
          if (f.url) {
            URL.revokeObjectURL(f.url);
          }
        } catch (e) {}

      });

      publishFiles = [];
      publishDraft = null;
      publishRouteKey = null;


      try {

        await loadCarsFromAPI();

      } catch (error) {

        console.error(
          "Erro ao atualizar lista:",
          error
        );

      }


      if (!uploadFailed) {
        showToast(
          "Carro publicado com sucesso!"
        );
      }


      navigate(
        "seller",
        {
          tab: "anuncios"
        }
      );


    } catch (error) {

      console.error(
        "ERRO REAL AO PUBLICAR:",
        error
      );

      showToast(
        error.message ||
        "Erro inesperado ao publicar.",
        { error: true }
      );

    }

  });
}

/* ---------------------------------------------------------------------- */
/* CONFIRMAÇÃO (substitui window.confirm, que pode ser bloqueado no iframe) */
/* ---------------------------------------------------------------------- */
function openConfirmModal(opts){
  openModal(`
    <div class="modal-head"><h3>${escapeHtml(opts.title||'Confirmar ação')}</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <p style="font-size:13.5px;color:var(--text-dim);">${escapeHtml(opts.message||'')}</p>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" style="flex:1;" data-action="close-modal">Cancelar</button>
        <button type="button" class="btn ${opts.danger?'btn-danger-ghost':'btn-primary'}" style="flex:1;${opts.danger?'border:1.5px solid var(--danger);':''}" id="confirm-modal-btn">${escapeHtml(opts.confirmLabel||'Confirmar')}</button>
      </div>
    </div>`, { onOpen:(root)=>{ qs('#confirm-modal-btn',root).addEventListener('click', ()=>{ closeModal(); if(opts.onConfirm) opts.onConfirm(); }); } });
}
function emptyStateHtml(iconName, title, sub, navName, navLabel){
  return `<div class="empty-state">${icon(iconName)}<h4>${escapeHtml(title)}</h4><p>${escapeHtml(sub)}</p>${navName?`<a class="btn btn-primary" href="${hashFor(navName,{})}">${escapeHtml(navLabel)}</a>`:''}</div>`;
}
function sellerActivationPromptHtml(){
  if(!state.session){
    return `<div class="container section-tight"><div class="empty-state">${icon('tag')}<h4>Precisas de sessão iniciada</h4><p>Entra ou cria uma conta para poderes vender carros no AutoMercado.</p><a class="btn btn-primary" href="${hashFor('login',{})}">${icon('login')} Entrar ou criar conta</a></div></div>`;
  }
  return `<div class="container section-tight"><div class="empty-state">${icon('tag')}<h4>Ativa o modo vendedor</h4><p>A tua conta ainda não tem a opção de vender ativada. Ativa para poderes publicar anúncios.</p><button type="button" class="btn btn-primary" data-action="activate-seller">${icon('tag')} Ativar modo vendedor</button></div></div>`;
}
function planLimitReachedHtml(){
  const total = mySellerListings().length;
  const plan = currentPlanInfo();
  return `<div class="container section-tight"><div class="empty-state">${icon('tag')}<h4>Atingiste o limite do plano ${escapeHtml(plan.nome)}</h4><p>O plano ${escapeHtml(plan.nome)} permite até ${plan.limite} anúncios e já tens ${total}. Apaga ou vende um anúncio existente, ou muda de plano para publicares mais carros.</p><a class="btn btn-primary" href="${hashFor('plans',{})}">${icon('tag')} Ver planos</a></div></div>`;
}
function renderPlans(){
  const current = (state.session && state.session.plan) || DEFAULT_PLAN;
  return `<div class="container section">
    <div class="page-head"><h1 class="page-title">Planos</h1><p class="page-sub">Escolhe o plano que melhor se adapta a como vendes carros no AutoMercado.</p></div>
    <div class="plan-grid" style="margin-top:20px;">${Object.values(ACCOUNT_PLANS).map(p=>`
      <div class="plan-card${p.id===current?' is-selected':''}">
        ${p.id===current?'<span class="plan-recommended">Plano atual</span>':''}
        <div class="plan-name">${escapeHtml(p.nome)}</div>
        <div class="plan-price">${p.preco?formatKz(p.preco)+'<small> / mês</small>':'Grátis'}</div>
        <p style="font-size:13px;color:var(--text-dim);margin:6px 0 0;">${escapeHtml(p.descricao)}</p>
        <ul>${p.beneficios.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>
        ${p.id===current?'':`<button type="button" class="btn btn-primary btn-block" style="margin-top:14px;" data-action="choose-plan" data-plan="${p.id}">${icon('arrowRight')} Continuar</button>`}
      </div>`).join('')}</div>
  </div>`;
}
function openPlanCheckoutModal(planId){
  const p = ACCOUNT_PLANS[planId]; if(!p) return;
  openModal(`
    <div class="modal-head"><h3>${icon('tag')} Plano ${escapeHtml(p.nome)}</h3><button class="modal-close" data-action="close-modal">${icon('x')}</button></div>
    <div class="modal-body">
      <div class="finance-result" style="margin-bottom:16px;"><div class="fr-amount">${p.preco?formatKz(p.preco):'Grátis'}</div><div class="fr-label">${p.preco?'por mês':'sem mensalidade'}</div></div>
      <ul style="margin:0 0 18px;padding-left:18px;font-size:13px;color:var(--text-dim);">${p.beneficios.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>
      <!-- PAGAMENTO: liga aqui o método de pagamento real (Multicaixa Express,
           cartão, transferência, etc.) e a chamada à API que efetivamente
           muda users.plan no backend depois do pagamento ser confirmado. -->
      <div class="empty-state" style="padding:22px 16px;">
        ${icon('creditCard')}
        <h4>Pagamento por configurar</h4>
        <p>Este é o próximo passo do fluxo — o método de pagamento para o plano ${escapeHtml(p.nome)} ainda vai ser ligado aqui.</p>
      </div>
    </div>`);
}
function dashTabsHtml(active, items, baseRoute){
  return items.map(([key,label,iconName])=>`<a class="dash-tab ${active===key?'is-active':''}" href="${hashFor(baseRoute,{tab:key})}">${icon(iconName)}<span>${label}</span></a>`).join('');
}
function accountFormHtml(){
  const s = state.session;
  if(!s) return `<div class="form-card" style="max-width:480px;"><p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">Ainda não tens sessão iniciada.</p><a class="btn btn-primary" href="${hashFor('login',{})}">${icon('login')} Entrar ou criar conta</a></div>`;
  return `<div class="form-card" style="max-width:480px;">
    <form id="account-form">
      <div class="field"><label>Nome completo</label><input type="text" name="nome" value="${escapeHtml(s.nome)}" required></div>
      <div class="field"><label>Email</label><input type="email" value="${escapeHtml(s.email||'')}" disabled></div>
      <div class="field"><label>Telefone</label><input type="text" name="telefone" value="${escapeHtml(s.telefone)}" required></div>
      <div class="field"><label>Tipo de conta (para venda)</label><div class="role-select-row">
        <label class="role-option"><input type="radio" name="tipo" value="particular" ${s.tipo!=='stand'?'checked':''}>${icon('user')}<span>Particular</span></label>
        <label class="role-option"><input type="radio" name="tipo" value="stand" ${s.tipo==='stand'?'checked':''}>${icon('building')}<span>Stand</span></label>
      </div></div>
      <div class="field"><label>Utilização da conta</label><div class="role-select-row">
        <label class="role-option"><input type="checkbox" name="papelComprador" ${s.papeis&&s.papeis.comprador?'checked':''}>${icon('search')}<span>Comprar</span></label>
        <label class="role-option"><input type="checkbox" name="papelVendedor" ${s.papeis&&s.papeis.vendedor?'checked':''}>${icon('tag')}<span>Vender</span></label>
      </div></div>
      <div class="kv-row"><span>Email</span><span>${s.emailVerificado?`<span class="badge badge-verified">${icon('checkCircle')}Verificado</span>`:'Não verificado'}</span></div>
      <div class="kv-row"><span>Telefone</span><span>${s.telefoneVerificado?`<span class="badge badge-verified">${icon('checkCircle')}Verificado</span>`:'Não verificado'}</span></div>
      ${(!s.emailVerificado||!s.telefoneVerificado)?`<a href="${hashFor('verify',{})}" class="btn btn-secondary btn-block" style="margin-top:10px;">${icon('shieldCheck')} Verificar conta</a>`:''}
      <button type="submit" class="btn btn-primary btn-block" style="margin-top:14px;">Guardar alterações</button>
    </form>
    <div class="divider-or">ou</div>
    <button type="button" class="btn btn-danger-ghost btn-block" data-action="clear-profile">${icon('trash')} Apagar conta</button>
  </div>`;
}
function bindAccountForm(){
  const f = qs('#account-form');
  if(f) f.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const papeis = { comprador: fd.get('papelComprador')==='on', vendedor: fd.get('papelVendedor')==='on' };
    if(!papeis.comprador && !papeis.vendedor){ showToast('Escolhe pelo menos uma opção: comprar ou vender', {error:true}); return; }

    const nome = (fd.get('nome') || '').trim();
    const telefone = (fd.get('telefone') || '').trim();

    // Grava nome e telefone no servidor (tabela users) — é o mesmo
    // telefone que os compradores passam a usar para contactar esta
    // conta quando ela vende um carro. Tipo de conta e papéis ainda só
    // existem localmente: o backend não tem essas colunas.
    const token = localStorage.getItem('token');

    if(token){
      try{
        const response = await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: nome, phone: telefone })
        });

        const data = await response.json().catch(()=>({}));

        if(!response.ok){
          showToast(data.error || 'Não foi possível guardar no servidor', {error:true});
          return;
        }
      }catch(error){
        console.error('Erro ao atualizar perfil:', error);
        showToast('Não foi possível conectar ao servidor', {error:true});
        return;
      }
    }

    state.session = Object.assign({}, state.session, { nome, telefone, tipo:fd.get('tipo'), papeis });
    saveSession(); showToast('Dados atualizados'); rerenderCurrentView();
  });
}

/* ---------------------------------------------------------------------- */
/* PAINEL DO VENDEDOR                                                        */
/* ---------------------------------------------------------------------- */
function sellerStatItems(){
  const mine = mySellerListings();
  return [
    { label:'Anúncios ativos', value: mine.filter(v=>v.status==='ativo').length },
    { label:'Visualizações totais', value: formatNum(mine.reduce((s,v)=>s+(v.visualizacoes||0),0)) },
    { label:'Contactos recebidos', value: formatNum(mine.reduce((s,v)=>s+(v.contactos||0),0)) },
    { label:'Carros vendidos', value: mine.filter(v=>v.status==='vendido').length },
  ];
}
function listingRowActionsHtml(v){
  const b = [];
  b.push(`<a class="icon-btn" href="${hashFor('detail',{id:v.id})}" title="Ver anúncio">${icon('eye')}</a>`);
  if(v.status!=='vendido') b.push(`<button class="icon-btn" data-action="edit-listing" data-id="${v.id}" title="Editar">${icon('edit')}</button>`);
  if(v.status==='ativo') b.push(`<button class="icon-btn" data-action="pause-listing" data-id="${v.id}" title="Pausar">${icon('pause')}</button>`);
  if(v.status==='pausado') b.push(`<button class="icon-btn" data-action="resume-listing" data-id="${v.id}" title="Retomar">${icon('play')}</button>`);
  if(v.status==='ativo'||v.status==='pausado') b.push(`<button class="icon-btn" data-action="sold-listing" data-id="${v.id}" title="Marcar como vendido">${icon('checkCircle')}</button>`);
  b.push(`<button class="icon-btn" data-action="delete-listing" data-id="${v.id}" title="Apagar">${icon('trash')}</button>`);
  return b.join('');
}
function listingRowHtml(v){
  return `<div class="listing-row">
    <a class="listing-thumb" href="${hashFor('detail',{id:v.id})}">${mediaPlaceholder(v.id, v.fotos[0])}</a>
    <div class="listing-info"><div class="li-title">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</div><div class="li-meta">${v.ano} · ${escapeHtml(v.cidade)} · ${formatKz(v.preco)}</div>${statusBadgeHtml(v)}</div>
    <div class="listing-stats"><div><b>${formatNum(v.visualizacoes)}</b>vistas</div><div><b>${formatNum(v.contactos)}</b>contactos</div></div>
    <div class="row-actions">${listingRowActionsHtml(v)}</div>
  </div>`;
}
function messageItemHtml(m){
  const v = findVehicle(m.vehicleId);
  return `<div class="message-item">
    <div class="message-item-head"><b>${escapeHtml(m.deNome)}</b><span>${timeAgo(m.criadoEm)}</span></div>
    <p>${escapeHtml(m.texto)}</p>
    ${v?`<a class="car-ref" href="${hashFor('detail',{id:v.id})}">${icon('arrowRight')} ${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</a>`:''}
    ${m.deTelefone?`<div style="margin-top:8px;"><a class="btn btn-secondary btn-sm" href="tel:${escapeHtml(m.deTelefone.replace(/\s+/g,''))}">${icon('phone')} Responder · ${escapeHtml(m.deTelefone)}</a></div>`:''}
  </div>`;
}
function renderSeller(){
  if(!state.session || !state.session.papeis || !state.session.papeis.vendedor) return sellerActivationPromptHtml();
  const tab = state.route.params.tab || 'anuncios';
  const mine = mySellerListings();
  const tabs = [['anuncios','Meus anúncios','list'],['mensagens','Mensagens','message'],['estatisticas','Estatísticas','barChart'],['dados','Dados da conta','user']];
  let panel = '';
  if(tab==='mensagens'){
    const msgs = myMessages().slice().sort((a,b)=> new Date(b.criadoEm)-new Date(a.criadoEm));
    panel = `<div class="dash-panel-head"><h2>Mensagens recebidas</h2></div>${msgs.length?msgs.map(messageItemHtml).join(''):emptyStateHtml('bell','Sem mensagens ainda','As mensagens de compradores interessados vão aparecer aqui.')}`;
  } else if(tab==='estatisticas'){
    const top = mine.slice().sort((a,b)=>(b.visualizacoes||0)-(a.visualizacoes||0)).slice(0,6);
    const maxV = Math.max(1, ...top.map(v=>v.visualizacoes||0));
    panel = `<div class="dash-panel-head"><h2>Estatísticas</h2></div>
      <div class="stat-strip">${sellerStatItems().map(s=>`<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('')}</div>
      <div class="admin-panel"><h3>${icon('barChart')}Visualizações por anúncio</h3>${top.length?`<div class="bar-chart">${top.map(v=>`<div class="bar-row"><span class="bar-name">${escapeHtml(v.marca+' '+v.modelo)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4,(v.visualizacoes||0)/maxV*100)}%;"></div></div><span class="bar-val">${formatNum(v.visualizacoes||0)}</span></div>`).join('')}</div>`:'<p style="font-size:13px;color:var(--text-dim);">Publica um anúncio para veres estatísticas.</p>'}</div>`;
  } else if(tab==='dados'){
    panel = `<div class="dash-panel-head"><h2>Dados da conta</h2></div>${accountFormHtml()}`;
  } else {
    panel = `<div class="dash-panel-head"><h2>Meus anúncios</h2><a class="btn btn-primary btn-sm" href="${hashFor('publish',{})}">${icon('plus')} Novo anúncio</a></div>
      <div class="stat-strip">${sellerStatItems().map(s=>`<div class="stat-item"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join('')}</div>
      ${mine.length ? mine.map(listingRowHtml).join('') : emptyStateHtml('tag','Ainda não tens anúncios','Publica o teu primeiro carro e chega a milhares de compradores.','publish','Publicar anúncio')}`;
  }
  return `<div class="container dash-layout">
    <aside class="dash-side">${state.session?`<div class="dash-user"><div class="seller-avatar" style="width:38px;height:38px;font-size:13.5px;">${initials(state.session.nome)}</div><div><div style="font-weight:800;font-size:13.5px;display:flex;align-items:center;gap:5px;">${escapeHtml(state.session.nome)}${isVerifiedPlan(state.session.plan)?`<span class="badge badge-verified" style="padding:1px 6px;">${icon('badgeCheck')}</span>`:''}</div><div style="font-size:11.5px;color:var(--text-faint);">${state.session.tipo==='stand'?'Stand':'Particular'} · ${escapeHtml(currentPlanInfo().nome)}</div></div></div>`:''}${dashTabsHtml(tab,tabs,'seller')}</aside>
    <div>${panel}</div>
  </div>`;
}
function bindSellerEvents(){ bindAccountForm(); }

/* ---------------------------------------------------------------------- */
/* CONTA DO COMPRADOR                                                        */
/* ---------------------------------------------------------------------- */
function historyItemHtml(v){
  return `<div class="listing-row">
    <a class="listing-thumb" href="${hashFor('detail',{id:v.id})}">${mediaPlaceholder(v.id,v.fotos[0])}</a>
    <div class="listing-info"><a href="${hashFor('detail',{id:v.id})}"><div class="li-title">${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</div></a><div class="li-meta">${v.ano} · ${formatKz(v.preco)}</div></div>
    <div class="row-actions"><button class="icon-btn ${isFavorite(v.id)?'is-active':''}" data-action="toggle-fav" data-id="${v.id}" title="Guardar">${icon(isFavorite(v.id)?'heartFilled':'heart')}</button><button class="icon-btn" data-action="remove-history" data-id="${v.id}" title="Remover do histórico">${icon('x')}</button></div>
  </div>`;
}
function notifItemHtml(n){
  const iconMap = { anuncio:'tag', bemvindo:'star' };
  return `<div class="notif-item ${!n.lida?'is-unread':''}" ${n.link?`data-action="open-notif" data-route="${n.link.name}" data-id="${n.link.params.id||''}" data-tab="${n.link.params.tab||''}" data-nid="${n.id}" style="cursor:pointer;"`:''}>
    <div class="notif-icon">${icon(iconMap[n.tipo]||'bell')}</div>
    <div class="notif-body"><b>${escapeHtml(n.titulo)}</b><p>${escapeHtml(n.texto)}</p><time>${timeAgo(n.criadoEm)}</time></div>
  </div>`;
}
function renderBuyer(){
  const tab = state.route.params.tab || 'favoritos';
  const tabs = [['favoritos','Favoritos','heart'],['historico','Histórico','clock'],['notificacoes','Notificações','bell'],['perfil','Perfil','user']];
  let panel = '';
  if(tab==='historico'){
    const items = state.history.map(findVehicle).filter(Boolean);
    panel = `<div class="dash-panel-head"><h2>Histórico de vistos</h2></div>${items.length?items.map(historyItemHtml).join(''):emptyStateHtml('clock','Ainda sem histórico','Os carros que vires vão aparecer aqui.','search','Explorar carros')}`;
  } else if(tab==='notificacoes'){
    const items = state.notifications;
    panel = `<div class="dash-panel-head"><h2>Notificações</h2>${items.some(n=>!n.lida)?`<button class="btn btn-ghost btn-sm" data-action="mark-all-read">Marcar todas como lidas</button>`:''}</div>${items.length?items.map(notifItemHtml).join(''):emptyStateHtml('bell','Sem notificações','Vamos avisar-te sobre mensagens e atualizações dos teus anúncios.')}`;
  } else if(tab==='perfil'){
    panel = `<div class="dash-panel-head"><h2>O meu perfil</h2></div>${accountFormHtml()}`;
  } else {
    const items = state.favorites.map(findVehicle).filter(Boolean);
    panel = `<div class="dash-panel-head"><h2>Anúncios favoritos</h2></div>${items.length?`<div class="fav-grid">${items.map(carCardHtml).join('')}</div>`:emptyStateHtml('heart','Ainda sem favoritos','Guarda os carros que gostares para os encontrares aqui.','search','Explorar carros')}`;
  }
  return `<div class="container dash-layout">
    <aside class="dash-side">${state.session?`<div class="dash-user"><div class="seller-avatar" style="width:38px;height:38px;font-size:13.5px;">${initials(state.session.nome)}</div><div><div style="font-weight:800;font-size:13.5px;">${escapeHtml(state.session.nome)}</div><div style="font-size:11.5px;color:var(--text-faint);">Comprador</div></div></div>`:''}${dashTabsHtml(tab,tabs,'buyer')}</aside>
    <div>${panel}</div>
  </div>`;
}
function bindBuyerEvents(){ bindAccountForm(); }

/* ---------------------------------------------------------------------- */
/* AÇÕES: anúncios / conta / notificações                                   */
/* ---------------------------------------------------------------------- */
/* Pedido autenticado genérico para as ações reais de anúncios (pausar,
   reativar, vender, apagar). Não é usado pelo login/registo/publicação/
   upload de fotos, que já funcionavam e mantêm o próprio fetch. */
async function apiFetch(path, options={}){
  const token = localStorage.getItem('token');
  const headers = Object.assign({}, options.headers||{});
  if(token) headers['Authorization'] = `Bearer ${token}`;
  if(options.body && !(options.body instanceof FormData) && !headers['Content-Type']){
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_URL}${path}`, Object.assign({}, options, { headers }));
  const data = await response.json().catch(()=>({}));
  if(!response.ok){ throw new Error(data.error || `Erro ${response.status}`); }
  return data;
}
/* Recarrega a lista pública e "Meus anúncios" a partir da API real, para que
   a página principal, o painel do vendedor e os contadores fiquem sempre
   sincronizados com o backend depois de qualquer ação. */
async function refreshCarLists(){
  await Promise.all([loadCarsFromAPI(), loadMyCarsFromAPI()]);
}
async function pauseListing(id){
  try{
    await apiFetch(`/cars/${id}/status`, { method:'PATCH', body: JSON.stringify({ status:'paused' }) });
    await refreshCarLists();
    showToast('Anúncio pausado');
  }catch(error){
    console.error('Erro ao pausar anúncio:', error);
    showToast(error.message || 'Não foi possível pausar o anúncio.', { error:true });
  }
}
async function resumeListing(id){
  try{
    await apiFetch(`/cars/${id}/status`, { method:'PATCH', body: JSON.stringify({ status:'approved' }) });
    await refreshCarLists();
    showToast('Anúncio reativado');
  }catch(error){
    console.error('Erro ao reativar anúncio:', error);
    showToast(error.message || 'Não foi possível reativar o anúncio.', { error:true });
  }
}
async function markSold(id){
  try{
    await apiFetch(`/cars/${id}/status`, { method:'PATCH', body: JSON.stringify({ status:'sold' }) });
    await refreshCarLists();
    showToast('Anúncio marcado como vendido');
  }catch(error){
    console.error('Erro ao marcar anúncio como vendido:', error);
    showToast(error.message || 'Não foi possível marcar o anúncio como vendido.', { error:true });
  }
}
function deleteListing(id){
  const v = findVehicle(id); if(!v) return;
  openConfirmModal({ title:'Apagar anúncio', message:`Tens a certeza que queres apagar "${v.marca} ${v.modelo}"? Esta ação não pode ser desfeita.`, confirmLabel:'Apagar', danger:true, onConfirm: async ()=>{
    try{
      await apiFetch(`/cars/${id}`, { method:'DELETE' });
      state.favorites = state.favorites.filter(x=>x!==id); saveFavorites();
      await refreshCarLists();
      showToast('Anúncio apagado');
    }catch(error){
      console.error('Erro ao apagar anúncio:', error);
      showToast(error.message || 'Não foi possível apagar o anúncio.', { error:true });
    }
  }});
}
function clearProfile(){
  openConfirmModal({ title:'Apagar conta', message:'Isto termina a sessão e apaga os teus dados de conta guardados neste dispositivo (nome, contactos, verificações). Os anúncios já publicados continuam no marketplace. Esta ação não pode ser desfeita.', confirmLabel:'Apagar conta', danger:true, onConfirm:()=>{
    state.session=null; saveSession(); showToast('Conta apagada deste dispositivo'); navigate('home',{});
  }});
}
function logout(){
  localStorage.removeItem('token');
  state.session = null;
  saveSession();
  showToast('Sessão terminada');
  navigate('home', {});
}
function activateSeller(){
  if(!state.session) return;
  state.session.papeis = Object.assign({}, state.session.papeis, { vendedor: true });
  saveSession();
  showToast('Modo vendedor ativado');
  rerenderCurrentView();
}
function toggleFavorite(id){
  if(state.favorites.includes(id)){ state.favorites = state.favorites.filter(x=>x!==id); showToast('Removido dos favoritos'); }
  else { state.favorites = [...state.favorites, id]; showToast('Adicionado aos favoritos'); }
  saveFavorites(); updateActiveNav(); rerenderCurrentView();
}
function removeFromHistory(id){ state.history = state.history.filter(x=>x!==id); saveHistory(); rerenderCurrentView(); }
function markAllNotifsRead(){ state.notifications.forEach(n=>n.lida=true); saveNotifications(); rerenderCurrentView(); }
function openNotif(route, id, tab, nid){
  const n = state.notifications.find(x=>x.id===nid); if(n){ n.lida=true; saveNotifications(); }
  navigate(route, id?{id}:(tab?{tab}:{}));
}

/* ---------------------------------------------------------------------- */
/* ROTEAMENTO: despacho para a view certa                                   */
/* ---------------------------------------------------------------------- */
const ROUTE_TITLES = {
  home: 'AutoMercado Angola — Compra e Venda de Carros',
  search: 'Procurar Carros — AutoMercado Angola',
  publish: 'Vender um Carro — AutoMercado Angola',
  seller: 'Painel do Vendedor — AutoMercado Angola',
  buyer: 'A Minha Conta — AutoMercado Angola',
  plans: 'Planos e Preços — AutoMercado Angola',
  login: 'Entrar — AutoMercado Angola',
  signup: 'Criar Conta — AutoMercado Angola',
  forgot: 'Recuperar Password — AutoMercado Angola',
  resetPassword: 'Nova Palavra-passe — AutoMercado Angola',
  verify: 'Verificar Conta — AutoMercado Angola'
};
function renderRoute(){
  const root = qs('#view-root'); if(!root) return;
  const name = state.route.name;
  if(name==='search'){ root.innerHTML = renderSearch(); bindSearchEvents(); }
  else if(name==='detail'){ root.innerHTML = renderDetail(state.route.params.id); bindDetailEvents(findVehicle(state.route.params.id)); }
  else if(name==='vendorProfile'){ root.innerHTML = renderVendorProfile(state.route.params.id); }
  else if(name==='publish'){ root.innerHTML = renderPublish(); bindPublishEvents(); }
  else if(name==='seller'){ root.innerHTML = renderSeller(); bindSellerEvents(); }
  else if(name==='buyer'){ root.innerHTML = renderBuyer(); bindBuyerEvents(); }
  else if(name==='plans'){ root.innerHTML = renderPlans(); }
  else if(name==='login'){ root.innerHTML = renderAuthPage('login'); bindAuthPageEvents('login'); }
  else if(name==='signup'){ root.innerHTML = renderAuthPage('signup'); bindAuthPageEvents('signup'); }
  else if(name==='forgot'){ root.innerHTML = renderAuthPage('forgot'); bindAuthPageEvents('forgot'); }
  else if(name==='resetPassword'){ root.innerHTML = renderResetPasswordPage(); bindResetPasswordEvents(); }
  else if(name==='verify'){ root.innerHTML = renderAuthPage('verify'); bindAuthPageEvents('verify'); }
  else { root.innerHTML = renderHome(); bindHomeEvents(); }
  if(name==='detail'){
    const v = findVehicle(state.route.params.id);
    document.title = v ? `${v.marca} ${v.modelo} (${v.ano}) — AutoMercado Angola` : 'Anúncio não encontrado — AutoMercado Angola';
  } else if(name==='vendorProfile'){
    const carroDoVendedor = state.vehicles.find(v => v.vendedor && v.vendedor.id === state.route.params.id);
    document.title = carroDoVendedor ? `${carroDoVendedor.vendedor.nome} — AutoMercado Angola` : 'Vendedor — AutoMercado Angola';
  } else {
    document.title = ROUTE_TITLES[name] || ROUTE_TITLES.home;
  }
  updateActiveNav();
  renderHeaderAuthSlot();
  hydrateIcons(root);
}

/* ---------------------------------------------------------------------- */
/* DELEGAÇÃO GLOBAL DE EVENTOS (data-action)                                */
/* ---------------------------------------------------------------------- */
function globalClickHandler(e){
  const t = e.target.closest('[data-action]');
  if(!t) return;
  const action = t.getAttribute('data-action');
  const id = t.getAttribute('data-id');
  switch(action){
    case 'close-modal': closeModal(); break;
    case 'toggle-fav': if(id) requireAuth(()=> toggleFavorite(id)); break;
    case 'open-contact': { const v=findVehicle(id); if(v) requireAuth(()=> openContactModal(v)); break; }
    case 'open-message': { const v=findVehicle(id); if(v) requireAuth(()=> openMessageModal(v)); break; }
    case 'open-report': { const v=findVehicle(id); if(v) openReportModal(v); break; }
    case 'open-rate-seller': { const v=findVehicle(id); if(v) requireAuth(()=> openRateSellerModal(v)); break; }
    case 'gallery-prev': { const v=findVehicle(id); if(v) updateGallery(v, galleryIdx-1); break; }
    case 'gallery-next': { const v=findVehicle(id); if(v) updateGallery(v, galleryIdx+1); break; }
    case 'gallery-set': { const v=findVehicle(id); if(v) updateGallery(v, Number(t.getAttribute('data-idx'))); break; }
    case 'remove-photo': removePhoto(Number(t.getAttribute('data-idx'))); break;
    case 'publish-edit': publishMode='form'; rerenderCurrentView(); window.scrollTo({top:0,behavior:'smooth'}); break;
    case 'publish-confirm': confirmPublish(); break;
    case 'edit-listing': navigate('publish', { editId:id }); break;
    case 'pause-listing': pauseListing(id); break;
    case 'resume-listing': resumeListing(id); break;
    case 'sold-listing': markSold(id); break;
    case 'delete-listing': deleteListing(id); break;
    case 'activate-seller': activateSeller(); break;
    case 'send-verify': sendVerifyCode(t.getAttribute('data-channel')); break;
    case 'confirm-verify': confirmVerifyCode(t.getAttribute('data-channel')); break;
    case 'toggle-pw': { const inp=qs('#'+t.getAttribute('data-target')); if(inp) inp.type = inp.type==='password'?'text':'password'; break; }
    case 'logout': logout(); break;
    case 'show-terms': showLegalModal('terms'); break;
    case 'show-privacy': showLegalModal('privacy'); break;
    case 'clear-profile': clearProfile(); break;
    case 'mark-all-read': markAllNotifsRead(); break;
    case 'remove-history': removeFromHistory(id); break;
    case 'open-notif': openNotif(t.getAttribute('data-route'), t.getAttribute('data-id')||null, t.getAttribute('data-tab')||null, t.getAttribute('data-nid')); break;
    case 'choose-plan': openPlanCheckoutModal(t.getAttribute('data-plan')); break;
  }
}

/* ---------------------------------------------------------------------- */
/* UI GLOBAL: cabeçalho, menu móvel, pesquisa                                */
/* ---------------------------------------------------------------------- */
function bindGlobalUIEvents(){
  document.addEventListener('click', globalClickHandler);
  qs('#burger-btn')?.addEventListener('click', openMobileDrawer);
  qs('#mobile-drawer-overlay')?.addEventListener('click', closeMobileDrawer);
  qs('#mobile-drawer-close')?.addEventListener('click', closeMobileDrawer);
  const headerForm = qs('#header-search-form');
  if(headerForm) headerForm.addEventListener('submit', (e)=>{ e.preventDefault(); navigate('search', cleanParams({ q: new FormData(headerForm).get('q') })); });
  const mobileForm = qs('#mobile-search-form');
  if(mobileForm) mobileForm.addEventListener('submit', (e)=>{ e.preventDefault(); navigate('search', cleanParams({ q: new FormData(mobileForm).get('q') })); });
}

/* ---------------------------------------------------------------------- */
/* ARRANQUE E API                                                        */
/* ---------------------------------------------------------------------- */

// A API usa um vocabulário de status diferente do frontend (que já tinha
// os seus próprios estados: ativo/pausado/vendido/pendente/rejeitado).
// Esta função traduz um para o outro, para que toda a lógica existente
// (página principal, pesquisa, contadores, botões de pausar/vender) que
// já verifica v.status==='ativo' continue a funcionar com carros reais.
function mapApiStatus(status) {
  const map = {
    approved: 'ativo',
    active: 'ativo',
    ativo: 'ativo',
    pending: 'pendente',
    pendente: 'pendente',
    rejected: 'rejeitado',
    rejeitado: 'rejeitado',
    sold: 'vendido',
    vendido: 'vendido',
    paused: 'pausado',
    pausado: 'pausado'
  };
  // Os carros são aprovados imediatamente pelo backend, por isso qualquer
  // status desconhecido/ausente é tratado como ativo (não como pendente).
  return map[String(status || '').toLowerCase()] || 'ativo';
}

function convertApiCar(car) {
  const imagens = Array.isArray(car.images)
    ? car.images
        .map(img => img.image_url)
        .filter(Boolean)
    : [];

  if (
    imagens.length === 0 &&
    car.image_url
  ) {
    imagens.push(car.image_url);
  }

  return {
    id: car.id,
    marca: car.brand || "",
    modelo: car.model || "",
    ano: Number(car.year) || 0,
    preco: Number(car.price) || 0,
    quilometragem: Number(car.mileage) || 0,

    combustivel: car.fuel || "",
    cambio: car.transmission || "",
    cilindrada: car.engine_size != null ? Number(car.engine_size) : "",
    carroceria: car.body_type || "",
    cor: car.color || "",
    portas: car.doors != null ? Number(car.doors) : "",
    condicaoUso: car.usage_type || "",
    estadoVeiculo: car.condition || "",
    equipamentos: Array.isArray(car.equipment) ? car.equipment : [],

    provincia: car.province || car.location || "",
    cidade: car.location || "",

    descricao: car.description || "",

    fotos: imagens,

    status: mapApiStatus(car.status),

    criadoEm: car.created_at,

    // A API atual só devolve o user_id do vendedor, sem perfil completo,
    // por isso o nome continua com um valor neutro. O telefone já vem
    // preenchido (seller_phone), obtido pelo backend a partir da conta do
    // vendedor — é o que os botões de Ligar/WhatsApp na ficha do carro usam.
    // "verificado" só pode ser calculado com confiança para os carros do
    // próprio utilizador autenticado (sabemos o plano dele em state.session).
    // Para anúncios de outros vendedores isto fica false até a API de
    // listagem passar também a devolver o plano/selo de cada vendedor.
    vendedor: {
      id: car.user_id,
      nome: car.seller_name || "Vendedor",
      tipo: "particular",
      telefone: car.seller_phone || "",
      verificado: !!(state.session && car.user_id === state.session.id && isVerifiedPlan(state.session.plan)),
      membroDesde: car.created_at ? new Date(car.created_at).getFullYear() : "",
      avaliacao: 4.5
    }
  };
}
async function loadCars(){
  try{
    const response = await fetch(`${API_URL}/cars`);
    const data = await response.json().catch(()=>({}));
    if(!response.ok) return [];
    return Array.isArray(data.cars) ? data.cars : [];
  }catch(error){
    console.error('Erro ao carregar carros:',error);
    return [];
  }
}

async function loadMyCars(){
  const token = localStorage.getItem('token');
  if(!token) return [];

  try{
    const response = await fetch(`${API_URL}/cars/my/cars`,{
      headers:{'Authorization':`Bearer ${token}`}
    });
    const data = await response.json().catch(()=>({}));
    if(!response.ok) return [];
    return (data.cars || []).map(convertApiCar);
  }catch(error){
    console.error('Erro ao carregar os meus carros:',error);
    return [];
  }
}

async function loadMyCarsFromAPI(){
  const myCars = await loadMyCars();
  state.myVehicles = myCars;
  rerenderCurrentView();
  return state.myVehicles;
}

async function loadCarsFromAPI() {
  try {
    const cars = await loadCars();

    console.log("CARROS DA API:", cars);

    // A API é a fonte principal dos carros publicados: substitui sempre
    // o que estava guardado localmente (nunca deixa dados antigos do
    // localStorage sobreporem-se aos carros reais vindos do servidor).
    state.vehicles = cars.map(convertApiCar);
    saveVehicles();

    console.log(
      "VEÍCULOS CONVERTIDOS:",
      state.vehicles
    );

    rerenderCurrentView();

    return state.vehicles;

  } catch (error) {

    console.error(
      "ERRO loadCarsFromAPI:",
      error
    );

    return [];
  }
}

async function initApp(routeName, routeParams) {

  await loadAll();

  try {
    await loadCarsFromAPI();
  } catch (error) {
    console.error(
      "Erro ao carregar carros:",
      error
    );
  }

  bindGlobalUIEvents();

  hydrateIcons(document);

  state.route = { name: routeName || 'home', params: routeParams || {} };

  afterNavigate();
}
// Cada página .html chama bootPage('nome-da-rota', { ...params }) num
// pequeno bloco de arranque próprio, depois de incluir este ficheiro.
function bootPage(routeName, routeParams){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>initApp(routeName, routeParams));
  }else{
    initApp(routeName, routeParams);
  }
}


