const pedidoState={rows:[],filters:{},params:{...TeraPedidos.defaults},drafts:[]};
let pedidoEpoch=0;
const pedidoText=v=>v===true?'Sim':v===false?'Não':'A conferir';
const pedidoMeta=r=>TeraPedidos.decode(r?.obs)||{pronto:null,entregue:null,tipo:'3d',notas:r?.obs||'',custo:null};
const pedidoInput=(n,title,type,value,attrs='')=>`<label>${title}<input name="${n}" type="${type}" value="${esc(value??'')}" ${attrs}></label>`;
const pedidoSelect=(n,title,v,noLabel='Não',yesLabel='Sim')=>`<label>${title}<select name="${n}"><option value="">A conferir</option><option value="nao" ${v===false?'selected':''} >${noLabel}</option><option value="sim" ${v===true?'selected':''}>${yesLabel}</option></select></label>`;
async function renderPedidos(root){
 const epoch=++pedidoEpoch;
 root.innerHTML='<div class="section-head"><h2>Caderneta de pedidos</h2><button class="btn" id="pedido-new">Novo pedido</button></div><div class="row"><button class="btn" id="pedido-import">Conferir caderneta</button><button class="btn" id="pedido-copy">Baixar cópia</button><button class="btn" id="pedido-print" disabled>Imprimir pedidos filtrados</button><input id="pedido-file" type="file" accept="application/json,.json" hidden></div><p class="empty">Carregando…</p>';
 $('#pedido-new').onclick=()=>pedidoEditDialog(root);
 $('#pedido-import').onclick=()=>$('#pedido-file').click();
 $('#pedido-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>1000000)throw Error('Use um arquivo de até 1 MB.');const x=JSON.parse(await file.text());if(x.formato!=='teralab-caderneta-rascunho-v1'||!Array.isArray(x.pedidos)||x.pedidos.length>200)throw Error('Use o arquivo de rascunhos da caderneta.');pedidoState.drafts=x.pedidos;renderPedidoDrafts(root);}catch(e){toast(e.message);}};
 $('#pedido-copy').onclick=()=>{if(!pedidoState.rows.length)return toast('Aguarde o carregamento.');if(!confirm('Esta cópia contém clientes e valores. Baixar neste dispositivo?'))return;const b=new Blob([JSON.stringify({formato:'teralab-vendas-backup-v1',data:todayISO(),vendas:pedidoState.rows},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='teralab-pedidos-'+todayISO()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 try{const all=[];let done=false;for(let page=0;page<20;page++){const {data,error}=await sb.from('vendas').select('*').order('data',{ascending:false}).order('id',{ascending:false}).range(page*1000,page*1000+999);if(error)throw error;all.push(...data);if(data.length<1000){done=true;break;}}if(!done)throw Error('Mais de 20 mil registros. A consulta precisa de paginação adicional.');if(epoch!==pedidoEpoch||view!=='pedidos')return;pedidoState.rows=all;}catch(e){if(epoch===pedidoEpoch)root.querySelector('.empty').textContent='Não foi possível carregar: '+e.message;return;}
 root.querySelector('.empty').remove();const area=document.createElement('div');root.append(area);
 area.innerHTML='<p class="pedido-hint">Todos os meses. O pagamento é compartilhado com a tela Vendas.</p><div class="grid-cards pedido-summary"></div><div class="pedido-filters"><label>Cliente ou pedido<input type="search" name="busca" maxlength="100"></label><label>Produção<select name="pronto"><option value="">Todos</option><option value="nao">A produzir</option><option value="sim">Pronto</option><option value="conferir">A conferir</option></select></label><label>Entrega<select name="entregue"><option value="">Todos</option><option value="sim">Entregue</option><option value="nao">Não entregue</option><option value="conferir">A conferir</option></select></label><label>Pagamento<select name="pago"><option value="">Todos</option><option value="pago">Pago</option><option value="pendente">Não pago (com saldo)</option><option value="parcial">Pago parcialmente</option></select></label><button class="btn" type="button" id="pedido-limpar-filtros" hidden>Limpar filtros</button></div><p class="pedido-count" role="status"></p><div class="list pedido-list"></div>';
 const filterFields=$$('input,select',area);
 const clearFilters=$('#pedido-limpar-filtros',area);
 for(const el of filterFields){el.value=pedidoState.filters[el.name]||'';el.oninput=()=>{pedidoState.filters[el.name]=el.value;draw();};}
 clearFilters.onclick=()=>{
  pedidoState.filters={};
  filterFields.forEach(field=>{field.value='';});
  draw();
  filterFields[0].focus({preventScroll:true});
 };
 const list=$('.pedido-list',area);
 const visibleCards=new Map();

 function applyChange(row,patch,action){
  if(epoch!==pedidoEpoch||view!=='pedidos'||!area.isConnected)return;
  const index=pedidoState.rows.findIndex(entry=>entry.id===row.id);
  if(index<0)return;
  pedidoState.rows[index]={...pedidoState.rows[index],...patch};
  draw(row.id,action);
 }

 function makeCard(row){
  const card=pedidoCard(root,row,(patch,action)=>applyChange(row,patch,action));
  visibleCards.set(row.id,card);
  return card;
 }

 function draw(changedId,action){
  const rows=TeraPedidos.filter(pedidoState.rows,pedidoState.filters);
  clearFilters.hidden=!filterFields.some(field=>field.value);
  const sum=TeraPedidos.summary(rows);
  const print=$('#pedido-print',root);
  print.disabled=!rows.length;
  print.onclick=()=>pedidoPrint(rows);
  $('.pedido-summary',area).innerHTML=`<div class="stat"><span>A receber</span><strong>${money(sum.receber/100)}</strong></div><div class="stat"><span>Pago</span><strong>${money(sum.pago/100)}</strong></div><div class="stat"><span>A produzir</span><strong>${sum.produzir}</strong></div><div class="stat"><span>Prontos</span><strong>${sum.prontos}</strong></div><div class="stat"><span>Produção a conferir</span><strong>${sum.conferirProducao}</strong></div><div class="stat"><span>Entregar / conferir</span><strong>${sum.entregar}</strong></div>`;
  $('.pedido-count',area).textContent=rows.length+' pedido(s). Totais conforme os filtros.';

  const previous=visibleCards.get(changedId);
  if(previous){
   const updated=rows.find(row=>row.id===changedId);
   if(updated){
    const keepFocus=document.activeElement===document.body||previous.contains(document.activeElement);
    const card=makeCard(updated);
    previous.replaceWith(card);
    if(keepFocus&&action)card.querySelector(`[data-status-action="${action}"]`)?.focus({preventScroll:true});
   }else{
    previous.remove();
    visibleCards.delete(changedId);
   }
  }else{
   visibleCards.clear();
   list.replaceChildren(...rows.map(makeCard));
  }
  if(!rows.length)list.innerHTML='<p class="empty">Nenhum pedido nestes filtros.</p>';
 }
 draw();
}
function renderPedidoDrafts(root){++pedidoEpoch;root.innerHTML='<div class="section-head"><h2>Conferir caderneta</h2><button class="btn" id="pedido-back">Voltar</button></div><p class="pedido-hint">Confira cada anotação antes de gravar. Datas, nomes, valores e situações desconhecidos permanecem a conferir.</p><div class="list" id="pedido-drafts"></div>';$('#pedido-back').onclick=()=>renderPedidos(root);for(const d of pedidoState.drafts){const c=document.createElement('article');c.className='card';c.innerHTML=`<h3>${esc(d.cliente||'Nome a conferir')}</h3><p>${d.total==null?'Valor a conferir':money(d.total)}</p><p class="pedido-hint">${esc(d.obs||'Descrição e situações a conferir.')}</p><button class="btn" ${d.importado?'disabled':''}>${d.importado?'Salvo':'Conferir e importar'}</button>`;c.querySelector('button').onclick=()=>renderPedidoForm(root,null,d);$('#pedido-drafts').append(c);}}
function renderPedidoForm(root,row=null,draft=null,options={}){
 if(!options.onCancel)++pedidoEpoch;
 const meta=pedidoMeta(row),cost=meta.custo,params=cost?.params||pedidoState.params;
 const x=draft||{cliente:row?.cliente||'',descricao:row?.descricao||'',quantidade:row?.quantidade||1,total:row?saleTotal(row):'',data:row?.data||todayISO(),status:row?.status||'',pronto:row?meta.pronto:false,entregue:row?meta.entregue:false,tipo:meta.tipo,obs:meta.notas,gramas:cost?.gramas??'',horas:cost?.horas??'',embalagens:cost?.embalagens??''};
 x.recebido=draft?(draft.status==='pago'?draft.total:draft.status==='pendente'?0:''):row?TeraPedidos.payment(row).received/100:'';
 const input=pedidoInput;
 root.innerHTML=`<div class="section-head"><h2>${row?'Editar pedido':draft?'Conferir anotação':'Novo pedido'}</h2><button class="btn" id="pedido-back">Voltar</button></div><form id="pedido-form" class="form">${input('cliente','Nome do cliente','text',x.cliente,'required minlength="2" maxlength="100"')}${input('descricao','Tipo / descrição do pedido','text',x.descricao,'required minlength="2" maxlength="500"')}<label>Categoria<select name="tipo"><option value="3d">Impressão 3D</option><option value="software">Software / serviço</option><option value="outro">Outro</option></select></label><div class="pedido-cols">${input('quantidade','Quantidade','number',x.quantidade,'required min="1" max="100000" step="1"')}${input('total','Valor total do pedido (R$)','number',x.total,'required min="0" max="10000000" step="0.01" inputmode="decimal"')}</div>${input('data','Data do registro','date',x.data,'required')}<p class="pedido-hint">${draft?'Informe a data real ou escolha hoje para registrar a migração.':'O valor é o total do pedido, não o preço por peça.'}</p><div class="pedido-cols">${pedidoSelect('pronto','Produção',x.pronto,'A produzir','Pronto')}${pedidoSelect('entregue','Foi entregue?',x.entregue)}</div>${input('recebido','Valor total já recebido (R$)','number',x.recebido,'required min="0" max="10000000" step="0.01" inputmode="decimal"')}<p class="pedido-hint">Informe zero se ainda não recebeu. Para pagamentos parciais, informe o total acumulado recebido.</p><fieldset id="pedido-costs"><legend>Custos do pedido inteiro</legend><p class="pedido-hint">Peso, horas e embalagens são os totais do pedido. Preencha zero somente se souber que não houve consumo.</p><div class="pedido-cols">${input('gramas','Filamento total (g)','number',x.gramas,'min="0" step="0.01"')}${input('horas','Tempo total de impressão (h)','number',x.horas,'min="0" step="0.01"')}${input('embalagens','Número de embalagens','number',x.embalagens,'min="0" step="1"')}</div><details><summary>Parâmetros de cálculo</summary><div class="pedido-cols">${input('filamentoKg','Filamento por kg (R$)','number',params.filamentoKg,'required min="0" step="0.01"')}${input('embalagem','Cada embalagem (R$)','number',params.embalagem,'required min="0" step="0.01"')}${input('maquina','Valor da impressora (R$)','number',params.maquina,'required min="0" step="0.01"')}${input('vidaHoras','Vida útil estimada (horas)','number',params.vidaHoras,'required min="1" step="1"')}${input('residual','Valor residual estimado (R$)','number',params.residual,'required min="0" step="0.01"')}</div><p class="pedido-hint">5.000 h é uma hipótese editável para orçamento. Os parâmetros ficam gravados com cada pedido, sem recalcular os anteriores.</p></details><div class="margin-box" id="pedido-preview" role="status"></div><p class="pedido-hint">Energia, manutenção e mão de obra não estão incluídas. Não desconte duas vezes a compra do mesmo material ao apurar margem.</p></fieldset><label>Observações<textarea name="obs" maxlength="2500"></textarea></label><p class="error" id="pedido-error" hidden role="alert"></p><button class="btn primary" type="submit" id="pedido-save">${draft?'Confirmar dados e importar':'Salvar pedido'}</button></form>`;
 $('#pedido-back').onclick=()=>options.onCancel?options.onCancel():draft?renderPedidoDrafts(root):renderPedidos(root);const f=$('#pedido-form'),el=n=>f.elements.namedItem(n),val=n=>el(n).value;el('tipo').value=x.tipo||'3d';el('obs').value=x.obs||'';
 const config=()=>Object.fromEntries(['filamentoKg','embalagem','maquina','vidaHoras','residual'].map(k=>[k,val(k)]).concat([['estimativa',true]]));
 const preview=()=>{const hide=val('tipo')!=='3d';$('#pedido-costs').hidden=hide;$('#pedido-costs').disabled=hide;try{const c=TeraPedidos.costing({gramas:val('gramas'),horas:val('horas'),embalagens:val('embalagens')},config());$('#pedido-preview').textContent='Filamento: '+(c.filamento==null?'a informar':money(c.filamento/100))+' · Embalagem: '+(c.embalagem==null?'a informar':money(c.embalagem/100))+' · Depreciação: '+(c.depreciacao==null?'a informar':money(c.depreciacao/100))+' ('+money((c.params.maquina-c.params.residual)/c.params.vidaHoras)+'/h) · '+(c.complete?'Total estimado '+money(c.total/100):'Custo incompleto');}catch(e){$('#pedido-preview').textContent=e.message;}};f.addEventListener('input',preview);preview();
 f.onsubmit=async e=>{
  e.preventDefault();const b=$('#pedido-save',root),error=$('#pedido-error',root);if(b.disabled)return;b.disabled=true;error.hidden=true;
  try{
   if(!session||!perfil?.aprovado)throw Error('Entre novamente com uma conta aprovada.');
   const input=Object.fromEntries(new FormData(f));
   for(const k of ['pronto','entregue'])input[k]=val(k)==='sim'?true:val(k)==='nao'?false:null;
   input.origem=draft?'caderneta-foto-conferida':meta.origem||'manual';
   const payload=TeraPedidos.preserveSale(TeraPedidos.payload(input,config(),perfil.id),row);
   let result;
   if(row){
    let q=sb.from('vendas').update(payload).eq('id',row.id).eq('status',row.status);
    q=row.obs==null?q.is('obs',null):q.eq('obs',row.obs);
    result=await q.select('id');
    if(!result.error&&result.data?.length!==1)throw Error('O pedido mudou em outro aparelho. Reabra a caderneta.');
   }else{
    const id=draft?draft.id:(f.dataset.requestId||(f.dataset.requestId=crypto.randomUUID()));
    if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Identificador do rascunho inválido.');
    result=await sb.from('vendas').upsert({...payload,id},{onConflict:'id',ignoreDuplicates:true}).select('id');
    if(!result.error&&!result.data?.length)throw Error('Este pedido já foi salvo. Volte à caderneta para conferir.');
   }
   if(result.error)throw result.error;
   if(input.tipo==='3d')pedidoState.params={...config()};
   if(draft)draft.importado=true;
   toast('Pedido salvo');if(options.onSave)await options.onSave();else draft?renderPedidoDrafts(root):renderPedidos(root);
  }catch(e){errBox(error,e);b.disabled=false;}
 };
}

async function pedidoUpdate(row,patch){
 if(!session||!perfil?.aprovado)throw Error('Entre novamente com uma conta aprovada.');
 let q=sb.from('vendas').update(patch).eq('id',row.id).eq('status',row.status);
 q=row.obs==null?q.is('obs',null):q.eq('obs',row.obs);
 const result=await q.select('id');
 if(result.error)throw result.error;
 if(result.data?.length!==1)throw Error('O pedido mudou em outro aparelho. Reabra a caderneta antes de salvar.');
}
function pedidoEnhanceCard(root,card,row,onChange){
 const p=TeraPedidos.payment(row),m=pedidoMeta(row);
 card.querySelector('.pedido-status div:last-child dd').textContent=p.partial?'Parcial':p.due===0?'Sim':'Não';
 const values=document.createElement('p');values.className='pedido-money';
 values.textContent='Recebido '+money(p.received/100)+' · Falta pagar '+money(p.due/100);
 card.querySelector('.pedido-status').after(values);
 const actions=document.createElement('div');actions.className='pedido-actions';actions.setAttribute('aria-label','Ações de '+row.cliente);
 const button=(label,selected,click)=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent=label;if(selected!==null)b.setAttribute('aria-pressed',String(selected));b.onclick=click;actions.append(b);return b;};
 const paidButton=button('Pago',p.due===0,()=>pedidoPagamento(root,row,'recebido',patch=>onChange(patch,'paid')));
 paidButton.dataset.statusAction='paid';
 const unpaidButton=button('Não pago',p.due>0,()=>pedidoPagamento(root,row,'aberto',patch=>onChange(patch,'unpaid')));
 unpaidButton.dataset.statusAction='unpaid';
 const situationAction=(action,label,current,value,makePatch,feedback)=>{
  const b=button(label,current===value,async()=>{
   if(current===value)return;
   const group=Array.from(actions.querySelectorAll('button'));
   group.forEach(control=>{control.disabled=true;});
   try{
    const patch=makePatch(row,value);
    await pedidoUpdate(row,patch);
    onChange(patch,action);
    toast(feedback);
   }catch(e){toast(e.message);}
   finally{group.forEach(control=>{control.disabled=false;});}
  });
  b.dataset.statusAction=action;
 };
 situationAction('ready','Pronto',m.pronto,true,TeraPedidos.productionPatch,'Produção atualizada');
 situationAction('to-make','A produzir',m.pronto,false,TeraPedidos.productionPatch,'Produção atualizada');
 situationAction('delivered','Entregue',m.entregue,true,TeraPedidos.deliveryPatch,'Entrega atualizada');
 situationAction('undelivered','Não entregue',m.entregue,false,TeraPedidos.deliveryPatch,'Entrega atualizada');
 button('Imprimir pedido',null,()=>pedidoPrint([row]));
 card.append(actions);
}
function pedidoPagamento(root,row,mode,refresh=()=>renderPedidos(root)){
 const previous=document.querySelector('#pedido-payment-dialog');if(previous)return;
 const p=TeraPedidos.payment(row),receivedMode=mode==='recebido',dialog=document.createElement('dialog');
 dialog.id='pedido-payment-dialog';dialog.className='pedido-dialog';dialog.setAttribute('aria-labelledby','pedido-payment-title');
 dialog.innerHTML='<form class="form"><h2 id="pedido-payment-title">'+(receivedMode?'Registrar valor pago':'Registrar valor não pago')+'</h2><p>'+esc(row.cliente)+' · Total do pedido: <strong>'+money(p.total/100)+'</strong></p><p class="pedido-hint">Já recebido: '+money(p.received/100)+'. Em aberto: '+money(p.due/100)+'.</p>'+pedidoInput('valor',receivedMode?'Valor total já recebido (R$)':'Valor que ainda falta pagar (R$)','number',(receivedMode?p.total:p.due)/100,'required min="0" max="'+p.total/100+'" step="0.01" inputmode="decimal"')+'<p class="pedido-hint">'+(receivedMode?'Informe o total acumulado recebido, incluindo pagamentos anteriores.':'Informe o saldo restante. O recebido será o total do pedido menos este saldo.')+' O preço do pedido permanece o mesmo.</p><p role="status" class="pedido-payment-preview"></p><p class="error" hidden role="alert"></p><div class="row"><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn primary">Salvar pagamento</button></div></form>';
 document.body.append(dialog);const form=dialog.querySelector('form'),field=form.elements.namedItem('valor'),save=form.querySelector('[type=submit]'),cancel=form.querySelector('[data-close]'),error=form.querySelector('.error');
 let saving=false;
 const close=()=>{if(!saving){dialog.close();dialog.remove();}};
 cancel.onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 const preview=()=>{try{const patch=TeraPedidos.paymentPatch(row,mode,field.value,perfil?.id),next=TeraPedidos.payment({...row,...patch});form.querySelector('[role=status]').textContent='Recebido '+money(next.received/100)+' · Falta pagar '+money(next.due/100);}catch(e){form.querySelector('[role=status]').textContent=e.message;}};
 field.oninput=preview;preview();
 form.onsubmit=async e=>{e.preventDefault();if(saving)return;saving=true;save.disabled=cancel.disabled=true;error.hidden=true;
  try{const patch=TeraPedidos.paymentPatch(row,mode,field.value,perfil?.id);await pedidoUpdate(row,patch);saving=false;close();toast('Pagamento atualizado');await refresh(patch);}
  catch(e){saving=false;save.disabled=cancel.disabled=false;errBox(error,e);}
 };
 dialog.showModal();field.focus();field.select();
}
function pedidoPrint(rows){
 if(!rows.length)return toast('Nenhum pedido para imprimir.');
 if(document.querySelector('#pedido-print-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='pedido-print-dialog';dialog.className='pedido-dialog pedido-print-dialog';dialog.setAttribute('aria-labelledby','pedido-print-title');
 dialog.innerHTML='<div class="pedido-print-controls"><h2 id="pedido-print-title">Fichas para o quadro</h2><p>'+rows.length+' pedido(s). Imprima em papel A4 e recorte pelas bordas.</p><div class="row"><button class="btn" type="button" data-close>Fechar</button><button class="btn primary" type="button" data-print>Imprimir fichas</button></div></div><section class="pedido-print-sheet">'+TeraPedidosPrint.cards(rows)+'</section>';
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};dialog.querySelector('[data-print]').onclick=()=>window.print();
 document.body.append(dialog);dialog.showModal();
}

function pedidoCard(root,row,onChange){
 const meta=pedidoMeta(row),card=document.createElement('article');
 card.className='card pedido-card pedido-compact';
 card.innerHTML='<div class="pedido-card-head"><h3>'+esc(row.cliente||'Cliente não informado')+'</h3><strong>'+money(saleTotal(row))+'</strong></div><p class="pedido-card-desc">'+esc(row.descricao||'Pedido')+'</p><div class="meta"><span>'+esc(row.quantidade)+' unidade(s)</span><span>'+esc(row.data)+'</span></div><dl class="pedido-status"><div><dt>Produção</dt><dd>'+TeraPedidos.productionLabel(meta.pronto)+'</dd></div><div><dt>Entregue</dt><dd>'+pedidoText(meta.entregue)+'</dd></div><div><dt>Pago</dt><dd></dd></div></dl><button class="btn pedido-details" type="button">Ver detalhes</button>';
 card.querySelector('.pedido-details').onclick=()=>pedidoDetails(root,row);
 pedidoEnhanceCard(root,card,row,onChange);
 const print=card.querySelector('.pedido-actions button:last-child'),footer=document.createElement('div');footer.className='pedido-card-footer';
 footer.append(card.querySelector('.pedido-details'),print);card.append(footer);
 return card;
}
function pedidoDetails(root,row){
 if(document.querySelector('#pedido-details-dialog'))return;
 const meta=pedidoMeta(row),p=TeraPedidos.payment(row),c=meta.custo,dialog=document.createElement('dialog');
 dialog.id='pedido-details-dialog';dialog.className='pedido-dialog pedido-detail-dialog';dialog.setAttribute('aria-labelledby','pedido-detail-title');
 const cost=c?(c.complete?'Custo estimado '+money(c.total/100):'Custo incompleto; valores conhecidos '+money(c.parcial/100)):(row.custo_unit!=null?'Custo informado '+money(Number(row.custo_unit)*Number(row.quantidade)):'Custo não informado');
 dialog.innerHTML='<div class="form"><h2 id="pedido-detail-title">'+esc(row.cliente||'Pedido')+'</h2><p>'+esc(row.descricao||'Descrição não informada')+'</p><p class="pedido-hint">'+esc(row.quantidade)+' unidade(s) · Registro '+esc(row.data)+'</p><dl class="pedido-status"><div><dt>Produção</dt><dd>'+TeraPedidos.productionLabel(meta.pronto)+'</dd></div><div><dt>Entregue</dt><dd>'+pedidoText(meta.entregue)+'</dd></div><div><dt>Pagamento</dt><dd>'+(p.partial?'Parcial':p.due===0?'Pago':'Não pago')+'</dd></div></dl><p><strong>Total '+money(p.total/100)+'</strong></p><p>Recebido '+money(p.received/100)+' · Falta pagar '+money(p.due/100)+'</p><section class="margin-box"><h3>Custos</h3><p>'+esc(cost)+'</p>'+(c?'<p class="pedido-hint">Filamento: '+(c.gramas==null?'a informar':esc(c.gramas)+' g')+' · Impressão: '+(c.horas==null?'a informar':esc(c.horas)+' h')+' · Embalagens: '+(c.embalagens==null?'a informar':esc(c.embalagens))+'</p>':'')+'</section><section><h3>Observações</h3><p class="pedido-note">'+esc(meta.notas||'Sem observações.')+'</p></section><div class="row"><button class="btn" type="button" data-close>Fechar</button><button class="btn" type="button" data-print>Imprimir</button><button class="btn primary" type="button" data-edit>Editar pedido</button></div></div>';
 const close=()=>{dialog.close();dialog.remove();};
 dialog.querySelector('[data-close]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 dialog.querySelector('[data-print]').onclick=()=>{close();pedidoPrint([row]);};
 dialog.querySelector('[data-edit]').onclick=()=>{close();pedidoEditDialog(root,row);};
 document.body.append(dialog);dialog.showModal();
}
function pedidoEditDialog(root,row=null){
 if(document.querySelector('#pedido-edit-dialog'))return;
 const dialog=document.createElement('dialog');dialog.id='pedido-edit-dialog';dialog.className='pedido-dialog pedido-detail-dialog';dialog.setAttribute('aria-label',row?'Editar pedido de '+row.cliente:'Novo pedido');
 const content=document.createElement('div');dialog.append(content);document.body.append(dialog);
 const close=()=>{if(dialog.querySelector('#pedido-save')?.disabled)return;dialog.close();dialog.remove();};
 renderPedidoForm(content,row,null,{onCancel:close,onSave:async()=>{dialog.close();dialog.remove();await renderPedidos(root);}});
 dialog.oncancel=e=>{e.preventDefault();close();};dialog.showModal();
}
