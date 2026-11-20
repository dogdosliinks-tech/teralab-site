async function carregarClientes() {
  const clientes = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb.from('clientes').select('id,nome,telefone')
      .order('nome').order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    clientes.push(...data);
    if (data.length < pageSize) return clientes;
  }
}

function editarCliente(cliente, aoSalvar) {
  if ($('#cliente-dialog')) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'cliente-dialog';
  dialog.className = 'pedido-dialog';
  dialog.setAttribute('aria-labelledby', 'cliente-title');
  dialog.innerHTML = `
    <form class="form">
      <h2 id="cliente-title">${cliente ? 'Editar cliente' : 'Cadastrar cliente'}</h2>
      <label>Nome <input name="nome" maxlength="120" minlength="2" required autocomplete="off" value="${esc(cliente?.nome)}"></label>
      <label>Telefone (opcional) <input name="telefone" maxlength="30" type="tel" autocomplete="off" value="${esc(cliente?.telefone)}"></label>
      <p class="error" role="alert" hidden></p>
      <div class="row">
        <button class="btn" type="button" data-cancel>Cancelar</button>
        <button class="btn primary" type="submit">Salvar cliente</button>
      </div>
    </form>`;
  const form = dialog.querySelector('form');
  const nome = form.elements.namedItem('nome');
  const telefone = form.elements.namedItem('telefone');
  const id = cliente?.id || crypto.randomUUID();
  const save = form.querySelector('[type=submit]');
  const cancel = form.querySelector('[data-cancel]');
  const close = () => { dialog.close(); dialog.remove(); };
  cancel.onclick = close;
  dialog.oncancel = (event) => { event.preventDefault(); if (!save.disabled) close(); };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    const errorBox = form.querySelector('.error');
    const fields = { nome: nome.value.trim(), telefone: telefone.value.trim() || null };
    errorBox.hidden = true;
    if (fields.nome.length < 2) return errBox(errorBox, new Error('Informe um nome com pelo menos 2 caracteres.'));
    save.disabled = cancel.disabled = nome.disabled = telefone.disabled = true;
    let saved;
    try {
      if (!session || !perfil?.aprovado) throw Error('Entre novamente com uma conta aprovada.');
      const query = cliente ? sb.from('clientes').update(fields).eq('id', id) : sb.from('clientes').insert({ id, ...fields });
      const result = await query.select('id,nome,telefone').single();
      if (result.error) throw result.error;
      saved = result.data;
    } catch (error) {
      errBox(errorBox, error);
      save.disabled = cancel.disabled = nome.disabled = telefone.disabled = false;
      return;
    }
    close();
    toast(cliente ? 'Cliente atualizado' : 'Cliente cadastrado');
    aoSalvar(saved);
  };
  document.body.append(dialog);
  dialog.showModal();
  nome.focus();
}

async function renderClientes(root) {
  root.innerHTML = `
    <div class="section-head"><h2>Clientes</h2><button class="btn" type="button" id="cliente-novo">Cadastrar cliente</button></div>
    <label>Buscar por nome ou telefone <input id="cliente-busca" type="search" maxlength="120"></label>
    <div class="list clientes-list" aria-live="polite"><p class="empty">Carregando clientes…</p></div>`;
  const list = $('.clientes-list', root);
  const search = $('#cliente-busca', root);
  const findable = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const clientes = new Map();

  function draw() {
    const term = search.value.trim();
    const termDigits = digits(term);
    const matches = [...clientes.values()].filter((cliente) => findable(cliente.nome).includes(findable(term)) ||
      (termDigits && digits(cliente.telefone).includes(termDigits)));
    matches.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    list.replaceChildren();
    if (!matches.length) {
      list.innerHTML = `<p class="empty">${term ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</p>`;
    }
    for (const cliente of matches) {
      const card = document.createElement('article');
      card.className = 'card cliente-card';
      card.innerHTML = `<div><h3>${esc(cliente.nome)}</h3>${cliente.telefone ? `<p>${esc(cliente.telefone)}</p>` : ''}</div><button type="button" class="btn">Editar</button>`;
      card.querySelector('button').onclick = () => editarCliente(cliente, saveCliente);
      list.append(card);
    }
  }

  function saveCliente(cliente) {
    clientes.set(cliente.id, cliente);
    search.value = '';
    draw();
  }

  $('#cliente-novo', root).onclick = () => editarCliente(null, saveCliente);
  search.oninput = draw;
  try {
    const rows = await carregarClientes();
    for (const cliente of rows) if (!clientes.has(cliente.id)) clientes.set(cliente.id, cliente);
    draw();
  } catch (error) {
    if (clientes.size) return toast('Não foi possível carregar todos os clientes.');
    list.innerHTML = '<p class="error" role="alert">Não foi possível carregar os clientes. Abra a aba novamente para tentar.</p>';
  }
}
