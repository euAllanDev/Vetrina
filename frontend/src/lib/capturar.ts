import { PAINEL } from './painel';

/**
 * Botão de favorito "Enviar para a Vetrina".
 * Roda na página da loja (Mercado Livre, Shein…), dentro do navegador do dono: lê nome, preço, foto e links
 * e abre o painel em Afiliados com tudo preenchido. Nada é enviado sem o dono confirmar no painel.
 */
const FONTE = String.raw`(function(){
var O='__ORIGEM__';
function q(s,r){return (r||document).querySelector(s)}
function T(e){return e?e.textContent.replace(/\s+/g,' ').trim():''}
function num(t){if(t==null||t==='')return null;t=String(t).replace(/\s|R\$/g,'');if(/^\d+(\.\d+)?$/.test(t))return Number(t);var m=t.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);return m?Number(m[1].replace(/\./g,'')+'.'+((m[2]||'0')+'0').slice(0,2)):null}
function val(e){if(!e)return null;var f=q('.andes-money-amount__fraction',e);if(!f)return num(e.getAttribute('content')||e.textContent);var c=q('.andes-money-amount__cents',e);return Number(f.textContent.replace(/\./g,'')+'.'+(c?c.textContent:'00'))}
function meta(p){var m=q('meta[property="'+p+'"],meta[name="'+p+'"],meta[itemprop="'+p+'"]');return m?m.getAttribute('content'):null}
function riscado(e){for(var x=e;x&&x!==document.body;x=x.parentElement){if(/^(DEL|S)$/.test(x.tagName)||/line-through/.test(getComputedStyle(x).textDecorationLine))return true}return false}
function precos(){var L=[].slice.call(document.querySelectorAll('span,div,del,s,p,b,strong,em')).filter(function(e){if(e.children.length>3)return false;var t=T(e);if(!/^R\$\s?\d[\d.,]*$/.test(t))return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top+window.scrollY<1600});var a=null,b=null;L.forEach(function(e){var v=num(T(e));if(v==null)return;if(riscado(e)){if(b==null)b=v}else if(a==null)a=v});return [a,b]}
var h=location.hostname,u=location.href.split('#')[0],d=null;
if(/mercadoli(vre|bre)/.test(h)){
 var c=q('.poly-card--xlarge');
 if(c&&!q('h1.ui-pdp-title')){
  var a=[].slice.call(c.querySelectorAll('a')).filter(function(x){return /Ir para produto/i.test(x.innerText)})[0]||q('a',c);
  var hr=a?a.href:'';var rv=T(q('.poly-component__review-compacted',c));var mm=hr.match(/item_id(?:%3A|:)(MLB\d+)/i);
  d={loja:'mercadolivre',nome:T(q('.poly-component__title',c)),preco:val(q('.poly-price__current .andes-money-amount',c)),precoAnterior:val(q('s.andes-money-amount, .andes-money-amount--previous',c)),freteGratis:/gr[aá]tis/i.test(c.innerText),nota:num((rv.match(/\d[.,]\d/)||[''])[0].replace(',','.')),imagem:(q('img',c)||{}).src,urlProduto:hr||u,codigo:mm?mm[1]:null};
 }else{
  var im=q('.ui-pdp-gallery__figure img');
  d={loja:'mercadolivre',nome:T(q('h1.ui-pdp-title'))||meta('og:title'),preco:num(meta('price'))||val(q('.ui-pdp-price__second-line .andes-money-amount')),precoAnterior:val(q('.ui-pdp-price__original-value')),freteGratis:/gr[aá]tis/i.test(T(q('#shipping_summary, .ui-pdp-container__row--shipping-summary'))),nota:num(T(q('.ui-pdp-review__rating'))),imagem:(im&&(im.getAttribute('data-zoom')||im.src))||meta('og:image'),urlProduto:u,detalhes:T(q('.ui-pdp-description__content')).slice(0,1500)};
 }
}else{
 var p=precos();
 d={loja:h,nome:T(q('h1'))||meta('og:title')||document.title.split('|')[0],preco:num(meta('product:price:amount'))||p[0],precoAnterior:p[1],imagem:meta('og:image')||(q('main img')||{}).src,urlProduto:u};
}
if(!d||!d.nome||!d.preco){alert('Vetrina: não achei nome e preço nesta página. Abra a página do produto e tente de novo.');return}
if(d.imagem&&d.imagem.indexOf('//')===0)d.imagem='https:'+d.imagem;
if(d.imagem&&/ltwebstatic\.com/.test(d.imagem))d.imagem=d.imagem.replace(/_thumbnail_\d+x\d*/,'_thumbnail_900x');
if(d.imagem&&/mlstatic\.com/.test(d.imagem))d.imagem=d.imagem.replace(/D_Q_NP_(2X_)?/,'D_NQ_NP_2X_').replace(/-[A-Z]{1,2}(-[^\/.]*)?\.(webp|jpg|png)$/,'-F.jpg');
d.link=location.href;
var b=btoa(unescape(encodeURIComponent(JSON.stringify(d)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
window.open(O+'#/afiliados?captura='+b,'_blank');
})();`;

/** Endereço "javascript:" do favorito, apontando para este painel. */
export function linkDoFavorito(origem = window.location.origin + PAINEL) {
  return `javascript:${encodeURIComponent(FONTE.replace('__ORIGEM__', origem))}`;
}

export interface Capturado {
  loja: string; nome: string; preco: number; precoAnterior: number | null; freteGratis?: boolean; nota?: number | null;
  imagem?: string; urlProduto?: string; codigo?: string | null; detalhes?: string; link: string;
}

export function lerCaptura(b64: string | null): Capturado | null {
  if (!b64) return null;
  try {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    const d = JSON.parse(new TextDecoder().decode(bytes)) as Capturado;
    return d && d.nome && d.preco ? d : null;
  } catch {
    return null;
  }
}
