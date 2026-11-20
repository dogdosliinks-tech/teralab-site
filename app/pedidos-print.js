(function(root){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
function cards(rows){
 return rows.map(row=>{
  const meta=TeraPedidos.decode(row.obs),p=TeraPedidos.payment(row),date=/^\d{4}-\d{2}-\d{2}$/.test(row.data)?row.data.split('-').reverse().join('/'):row.data;
  const state=(title,value)=>`<span>${value===true?'☑':'☐'} ${title}${value==null?' (a conferir)':''}</span>`;
  return `<article class="pedido-ticket"><header><strong>TERALAB</strong><span>Pedido ${escape(String(row.id||'').slice(-8))}</span></header><h2>${escape(row.cliente||'Cliente não informado')}</h2><p class="pedido-ticket-desc">${escape(row.descricao||'Descrição não informada')}</p><p>Quantidade: <strong>${escape(row.quantidade)}</strong> · Registro: ${escape(date)}</p><div class="pedido-ticket-values"><p>Total <strong>${brl(p.total)}</strong></p><p>Recebido <strong>${brl(p.received)}</strong></p><p>Falta pagar <strong>${brl(p.due)}</strong></p></div><div class="pedido-ticket-checks">${state('Pronto',meta?.pronto)}${state('Entregue',meta?.entregue)}${state(p.partial?'Pagamento parcial':'Pago',p.partial||p.due===0)}</div><div class="pedido-ticket-write">Entregue em: ____/____/______<br>Observações: __________________________<br>______________________________________</div></article>`;
 }).join('');
}
root.TeraPedidosPrint=Object.freeze({cards});
})(typeof globalThis==='object'?globalThis:this);
