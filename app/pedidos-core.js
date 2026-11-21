(function(root){
'use strict';
const PREFIX='TERALAB_PEDIDO_V1\n';
const inProduction='em-producao';
const defaults=Object.freeze({filamentoKg:100,embalagem:1,maquina:2000,vidaHoras:5000,residual:0,estimativa:true});
const filaments=Object.freeze([
 'PLA', 'PLA+', 'PLA Silk', 'PLA Fosco', 'PLA-CF (fibra de carbono)',
 'PETG', 'PETG HF', 'PETG-CF (fibra de carbono)', 'ABS', 'ASA', 'TPU (flexível)',
 'Nylon (PA)', 'PA-CF (nylon com fibra de carbono)', 'PC (policarbonato)', 'PVA', 'HIPS'
]);
const number=(v,field,max=1e9)=>{const n=typeof v==='number'?v:Number(String(v).replace(',','.'));if(v===''||v==null||!Number.isFinite(n)||n<0||n>max)throw Error('Revise '+field+'.');return n;};
const optional=(v,f,max)=>v===''||v==null?null:number(v,f,max);
const cents=v=>Math.round((v+Number.EPSILON)*100);
function decode(obs){
 if(typeof obs!=='string'||!obs.startsWith(PREFIX))return null;
 try{const x=JSON.parse(obs.slice(PREFIX.length));return x&&x.version===1&&typeof x==='object'?x:null;}catch{return null;}
}
function encode(x){return PREFIX+JSON.stringify({...x,version:1});}
function filamentDetails({material,cor}){
 const detail={};
 for(const [key,value] of [['material',material],['cor',cor]]){
  const text=String(value??'').trim();
  if(text.length>80)throw Error('Informe '+key+' com até 80 caracteres.');
  if(text)detail[key]=text;
 }
 return detail;
}
function costing(x,params=defaults){
 const c={...params};
 for(const k of ['filamentoKg','embalagem','maquina','vidaHoras','residual'])c[k]=number(c[k],k);
 if(c.vidaHoras<=0||c.residual>c.maquina)throw Error('Revise a vida útil e o valor residual.');
 const g=optional(x.gramas,'gramas',1e7),h=optional(x.horas,'horas',1e5),p=optional(x.embalagens,'embalagens',1e5);
 if(p!==null&&!Number.isInteger(p))throw Error('Informe um número inteiro de embalagens.');
 const filament=g==null?null:cents(g/1000*c.filamentoKg),pack=p==null?null:cents(p*c.embalagem),depreciation=h==null?null:cents(h*(c.maquina-c.residual)/c.vidaHoras);
 const complete=[filament,pack,depreciation].every(v=>v!==null);
 return {params:c,gramas:g,horas:h,embalagens:p,filamento:filament,embalagem:pack,depreciacao:depreciation,parcial:(filament??0)+(pack??0)+(depreciation??0),total:complete?filament+pack+depreciation:null,complete};
}
function orderQuantity(value){
 const quantity=number(value,'quantidade',100000);
 if(quantity<1||!Number.isInteger(quantity))throw Error('Quantidade deve ser inteira e maior que zero.');
 return quantity;
}

function orderPrice(quantity,unitValue,discountValue=0){
 const units=orderQuantity(quantity);
 const unit=cents(number(unitValue,'preço unitário',1e7));
 const discount=cents(number(discountValue,'desconto',1e7));
 const total=units*unit-discount;
 if(total<0)throw Error('O desconto não pode superar o valor do pedido.');
 if(total>1e9)throw Error('O total do pedido deve ser de até R$ 10.000.000,00.');
 return {unit,discount,total};
}

function validate(x){
 const cliente=String(x.cliente||'').trim(),descricao=String(x.descricao||'').trim();
 if(cliente.length<2||cliente.length>100)throw Error('Informe o nome do cliente (2 a 100 caracteres).');
 if(descricao.length<2||descricao.length>500)throw Error('Informe o tipo ou a descrição do pedido.');
 const q=orderQuantity(x.quantidade);
 let price;
 if(x.precoUnitario!==undefined){
  price=orderPrice(q,x.precoUnitario,x.desconto||0);
 }else{
  const total=cents(number(x.total,'valor total',1e7));
  const unit=Math.ceil(total/q);
  price={unit,discount:unit*q-total,total};
 }
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x.data)||isNaN(Date.parse(x.data+'T12:00:00Z'))||new Date(x.data+'T12:00:00Z').toISOString().slice(0,10)!==x.data)throw Error('Informe uma data válida para o registro.');
 let status=x.status,received=null;
 if(x.recebido!==undefined){received=cents(number(x.recebido,'valor já recebido',1e7));if(received>price.total)throw Error('O valor recebido não pode ultrapassar o total do pedido.');status=received===price.total?'pago':'pendente';}
 if(!['pago','pendente'].includes(status))throw Error('Confirme se o pedido está pago ou não pago.');
 if(![true,false,null,inProduction].includes(x.pronto))throw Error('Situação de produção inválida.');
 if(![true,false,null].includes(x.entregue))throw Error('Situação de entrega inválida.');
 if(!['3d','software','outro'].includes(x.tipo))throw Error('Escolha o tipo de pedido.');
 const obs=String(x.obs||'').trim();if(obs.length>2500)throw Error('Observação muito longa.');
 return {...x,cliente,descricao,quantidade:q,price,status,received,obs};
}
function payload(input,params,vendedor){
 const x=validate(input),cost=x.tipo==='3d'?costing(x,params):null;
 const metadata={version:1,pronto:x.pronto,entregue:x.entregue,tipo:x.tipo,notas:x.obs,custo:cost,origem:x.origem||'manual',...filamentDetails(x)};
 if(x.received!==null)metadata.pagamento={recebidoCentavos:x.received};
 return {data:x.data,cliente:x.cliente,descricao:x.descricao,produto_id:null,quantidade:x.quantidade,valor_unit:x.price.unit/100,desconto:x.price.discount/100,custo_unit:cost?.total==null?null:cost.total/100/x.quantidade,status:x.status,forma_pagamento:'outro',vendedor,obs:encode(metadata)};
}
function preserveSale(payload,row){
 if(!row)return payload;
 const updated={...payload,produto_id:row.produto_id,forma_pagamento:row.forma_pagamento};
 delete updated.vendedor;
 if(!decode(row.obs)?.custo&&updated.custo_unit==null)updated.custo_unit=row.custo_unit;
 const previous=decode(row.obs),next=decode(updated.obs);
 if(previous?.pagamento&&!next.pagamento){
  const paid=payment(row);
  if(paid.received>orderCents(updated))throw Error('O total não pode ser menor que o valor já recebido.');
  next.pagamento=previous.pagamento;updated.obs=encode(next);updated.status=paid.received===orderCents(updated)?'pago':'pendente';
 }
 return updated;
}
function orderCents(row){return cents(Number(row.quantidade)*Number(row.valor_unit)-Number(row.desconto||0));}
function payment(row){
 const total=orderCents(row),stored=decode(row.obs)?.pagamento?.recebidoCentavos;
 const received=Number.isSafeInteger(stored)&&stored>=0&&stored<=total?stored:row.status==='pago'?total:0;
 return {total,received,due:total-received,partial:received>0&&received<total};
}
function paymentPatch(row,mode,amount,actor,at=new Date().toISOString()){
 if(!['recebido','aberto'].includes(mode))throw Error('Escolha o tipo de valor.');
 const total=orderCents(row),value=cents(number(amount,'valor de pagamento',1e7));
 if(value>total)throw Error('O valor não pode ultrapassar o total do pedido.');
 const received=mode==='recebido'?value:total-value;
 const meta=decode(row.obs)||{pronto:null,entregue:null,tipo:'3d',notas:row.obs||'',custo:null};
 meta.pagamento={recebidoCentavos:received,atualizadoEm:at,atualizadoPor:actor};
 return {status:received===total?'pago':'pendente',obs:encode(meta)};
}
function situationPatch(row,field,value){
 const meta=decode(row.obs)||{pronto:null,entregue:null,tipo:'3d',notas:row.obs||'',custo:null};
 return {obs:encode({...meta,[field]:value})};
}
function deliveryPatch(row,delivered){
 if(typeof delivered!=='boolean')throw Error('Situação de entrega inválida.');
 return situationPatch(row,'entregue',delivered);
}
function productionPatch(row,state){
 if(typeof state!=='boolean'&&state!==inProduction)throw Error('Situação de produção inválida.');
 return situationPatch(row,'pronto',state);
}
function productionLabel(state){
 if(state===true)return 'Pronto';
 if(state===inProduction)return 'Em produção';
 if(state===false)return 'A produzir';
 return 'A conferir';
}
function summary(rows){
 return rows.reduce((sum,row)=>{
  const meta=decode(row.obs),p=payment(row);
  sum.total+=p.total;sum.pago+=p.received;sum.receber+=p.due;
  if(meta?.pronto===true)sum.prontos++;
  else if(meta?.pronto===false)sum.produzir++;
  else if(meta?.pronto===inProduction)sum.emProducao++;
  else sum.conferirProducao++;
  if(meta?.entregue!==true)sum.entregar++;
  return sum;
 },{total:0,pago:0,receber:0,produzir:0,emProducao:0,prontos:0,conferirProducao:0,entregar:0});
}
function filter(rows,{busca='',pronto='',entregue='',pago=''}={}){
 const normal=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const situations={sim:true,nao:false,conferir:null};
 return rows.filter(r=>{const m=decode(r.obs);
 const p=payment(r);
 const matchesProduction=!pronto||(m?.pronto??null)===(pronto===inProduction?inProduction:situations[pronto]);
 const matchesDelivery=!entregue||(m?.entregue??null)===situations[entregue];
 const keywords=[r.cliente,r.descricao,m?.material,m?.cor].filter(Boolean).join(' ');
 return normal(keywords).includes(normal(busca))&&matchesProduction&&matchesDelivery&&(!pago||(pago==='parcial'?p.partial:pago==='pago'?p.due===0:p.due>0));});
}
root.TeraPedidos=Object.freeze({defaults,filaments,filamentDetails,decode,encode,costing,validate,payload,preserveSale,summary,filter,cents,orderPrice,payment,paymentPatch,deliveryPatch,productionPatch,productionLabel,inProduction});
})(typeof globalThis==='object'?globalThis:this);

