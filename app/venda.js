function lerItemVenda(item) {
  const field = (name) => item.elements.namedItem(name).value;
  return {
    id: item.dataset.id,
    produto_id: field('produto_id') || null,
    descricao: field('descricao').trim() || 'Venda avulsa',
    quantidade: Number(field('quantidade')),
    valor_unit: Number(field('valor_unit')),
    custo_unit: field('custo_unit') === '' ? null : Number(field('custo_unit')),
    desconto: Number(field('desconto')),
  };
}

async function renderNovaVenda(root) {
  root.innerHTML = `
    <div class="section-head"><h2>Nova venda</h2></div>
    <form class="form" id="form-venda">
      <fieldset class="card venda-cliente">
        <legend>Cliente</legend>
        <div class="row"><button class="btn" type="button" id="venda-cadastrar-cliente">Cadastrar cliente</button></div>
        <label>Buscar cliente cadastrado <input type="search" id="venda-busca-cliente" maxlength="120"></label>
        <label>Selecionar cliente <select name="cliente_id"><option value="">Cliente avulso</option></select></label>
        <p class="pedido-hint" id="venda-clientes-status" role="status">Carregando clientes…</p>
        <label id="venda-cliente-avulso">Nome do cliente avulso (opcional) <input name="cliente" maxlength="120"></label>
      </fieldset>
      <div class="list" id="venda-itens"></div>
      <button class="btn" type="button" id="venda-adicionar">Adicionar produto</button>
      <div class="pedido-cols">
        <label>Forma de pagamento <select name="forma_pagamento">${PAY.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>Status <select name="status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select></label>
        <label>Data <input name="data" type="date" value="${todayISO()}" required></label>
      </div>
      <label>Observação <textarea name="obs" placeholder="Opcional"></textarea></label>
      <div class="margin-box" id="venda-total" role="status"></div>
      <p class="error" id="venda-error" role="alert" hidden></p>
      <button class="btn primary" type="submit">Registrar venda</button>
    </form>`;

  const form = $('#form-venda', root);
  const save = form.querySelector('[type=submit]');
  const errorBox = $('#venda-error', form);
  const list = $('#venda-itens', form);
  const search = $('#venda-busca-cliente', form);
  const customerSelect = form.elements.namedItem('cliente_id');
  const clientStatus = $('#venda-clientes-status', form);
  const clients = new Map();
  let productList = produtos;
  const items = () => [...list.querySelectorAll('.venda-item')];

  function refreshCustomers(selected = customerSelect.value) {
    const term = search.value.trim().toLocaleLowerCase('pt-BR');
    customerSelect.replaceChildren(new Option('Cliente avulso', ''));
    for (const client of [...clients.values()].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'))) {
      const label = client.telefone ? `${client.nome} · ${client.telefone}` : client.nome;
      if (client.id === selected || label.toLocaleLowerCase('pt-BR').includes(term)) {
        customerSelect.add(new Option(label, client.id));
      }
    }
    customerSelect.value = clients.has(selected) ? selected : '';
    $('#venda-cliente-avulso', form).hidden = Boolean(customerSelect.value);
  }

  function refreshProducts(select) {
    const selected = select.value;
    select.replaceChildren(new Option('Venda avulsa', ''));
    for (const product of productList) select.add(new Option(product.nome, product.id));
    select.value = selected;
  }

  function updateTotal() {
    let total = 0;
    let cost = 0;
    let costKnown = true;
    let discountValid = true;
    for (const item of items()) {
      const values = lerItemVenda(item);
      const full = values.quantidade * TeraPedidos.cents(values.valor_unit);
      const discount = TeraPedidos.cents(values.desconto);
      const discountField = item.elements.namedItem('desconto');
      const valid = discount <= full;
      discountField.setCustomValidity(valid ? '' : 'O desconto não pode superar o valor deste item.');
      discountValid &&= valid;
      const subtotal = full - discount;
      $('.venda-subtotal', item).textContent = valid ? `Subtotal ${money(subtotal / 100)}` : 'Revise o desconto deste item';
      total += subtotal;
      if (values.custo_unit == null) costKnown = false;
      else cost += values.quantidade * TeraPedidos.cents(values.custo_unit);
    }
    $('#venda-total', form).textContent = discountValid
      ? `Total da venda ${money(total / 100)}${costKnown ? ` · Margem estimada ${money((total - cost) / 100)}` : ''}`
      : 'Revise os descontos para calcular o total.';
  }

  function numberItems() {
    const rows = items();
    rows.forEach((item, index) => {
      $('legend', item).textContent = `Produto ${index + 1}`;
      const remove = $('.venda-remover', item);
      remove.disabled = rows.length === 1;
      remove.setAttribute('aria-label', `Remover produto ${index + 1}`);
    });
    updateTotal();
  }

  function addItem(focus = false) {
    const item = document.createElement('fieldset');
    item.className = 'card venda-item';
    item.dataset.id = crypto.randomUUID();
    item.innerHTML = `
      <legend></legend>
      <label>Produto <select name="produto_id"></select></label>
      <label>Descrição <input name="descricao" placeholder="Nome da peça ou serviço"></label>
      <div class="pedido-cols">
        <label>Quantidade <input name="quantidade" type="number" min="1" max="100000" step="1" inputmode="numeric" value="1" required></label>
        <label>Valor unitário (R$) <input name="valor_unit" type="number" min="0" max="10000000" step="0.01" inputmode="decimal" required></label>
        <label>Custo unitário (R$) <input name="custo_unit" type="number" min="0" max="10000000" step="0.01" inputmode="decimal" placeholder="Opcional"></label>
        <label>Desconto do item (R$) <input name="desconto" type="number" min="0" max="9999999999.99" step="0.01" inputmode="decimal" value="0"></label>
      </div>
      <div class="venda-item-rodape"><strong class="venda-subtotal"></strong><button class="btn venda-remover" type="button">Remover</button></div>`;
    const input = (name) => item.elements.namedItem(name);
    const select = input('produto_id');
    refreshProducts(select);
    select.onchange = () => {
      const product = productList.find((p) => p.id === select.value);
      input('descricao').value = product?.nome ?? '';
      input('valor_unit').value = product?.preco ?? '';
      input('custo_unit').value = product?.custo ?? '';
      updateTotal();
    };
    $('.venda-remover', item).onclick = () => {
      item.remove();
      numberItems();
      $('#venda-adicionar', form).focus();
    };
    list.append(item);
    numberItems();
    if (focus) select.focus();
  }

  search.oninput = () => refreshCustomers();
  customerSelect.onchange = () => refreshCustomers();
  $('#venda-cadastrar-cliente', form).onclick = () => editarCliente(null, (client) => {
    clients.set(client.id, client);
    search.value = '';
    clientStatus.hidden = true;
    refreshCustomers(client.id);
  });
  $('#venda-adicionar', form).onclick = () => addItem(true);
  list.addEventListener('input', updateTotal);
  addItem();

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    errorBox.hidden = true;
    updateTotal();
    if (!form.reportValidity()) return;
    if (!session || !perfil?.aprovado) return errBox(errorBox, new Error('Entre novamente com uma conta aprovada.'));
    const field = (name) => form.elements.namedItem(name).value;
    const client = clients.get(customerSelect.value);
    if (customerSelect.value && !client) return errBox(errorBox, new Error('Selecione novamente o cliente.'));
    const shared = {
      data: field('data'),
      cliente: client?.nome || field('cliente').trim() || null,
      cliente_id: client?.id || null,
      forma_pagamento: field('forma_pagamento'),
      status: field('status'),
      vendedor: perfil.id,
      obs: field('obs').trim() || null,
    };
    const payload = items().map((item) => ({ ...shared, ...lerItemVenda(item) }));
    const controls = [...form.querySelectorAll('button,input,select,textarea')].filter((control) => !control.disabled);
    controls.forEach((control) => { control.disabled = true; });
    try {
      // A single insert saves the entire sale together. Reusing the item IDs prevents accidental duplicates on retry.
      const { error } = await sb.from('vendas').insert(payload);
      if (error?.code === '23505') throw Error('Esta venda pode já ter sido registrada. Confira em Vendas antes de tentar novamente.');
      if (error) throw error;
    } catch (error) {
      errBox(errorBox, error);
      return;
    } finally {
      controls.forEach((control) => { control.disabled = false; });
    }
    toast(payload.length === 1 ? 'Venda registrada' : `Venda registrada com ${payload.length} produtos`);
    if (!form.isConnected || view !== 'nova-venda') return;
    month = monthValue(shared.data);
    view = 'vendas';
    render();
  };

  if (!productList.length) {
    fetchProdutos().then((rows) => {
      productList = rows;
      for (const item of items()) refreshProducts(item.elements.namedItem('produto_id'));
    }).catch(() => toast('Não foi possível carregar o catálogo. Você pode lançar produtos avulsos.'));
  }
  try {
    const rows = await carregarClientes();
    for (const client of rows) if (!clients.has(client.id)) clients.set(client.id, client);
    clientStatus.hidden = clients.size > 0;
    clientStatus.textContent = 'Nenhum cliente cadastrado.';
    refreshCustomers();
  } catch (error) {
    clientStatus.hidden = false;
    clientStatus.textContent = 'Não foi possível carregar os clientes. Você pode informar um nome avulso.';
  }
}
