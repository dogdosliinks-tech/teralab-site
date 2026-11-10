const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&amp;";
    if (c === "<") return "&lt;";
    if (c === ">") return "&gt;";
    if (c === '"') return "&quot;";
    return "&#39;";
  });
}
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const monthValue = (iso) => (iso || todayISO()).slice(0, 7);
const monthBounds = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(y, m, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
};
const slugify = (name) =>
  (name || "peca")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "peca";

const CATS = ["Natal", "Educação", "Sensoriais", "Bonecos", "Utilidades", "Personalizados"];
const PAY = [
  ["pix", "Pix"],
  ["dinheiro", "Dinheiro"],
  ["cartao", "Cartão"],
  ["transferencia", "Transferência"],
  ["outro", "Outro"],
];
const COST_TYPES = [
  ["filamento", "Filamento"],
  ["energia", "Energia"],
  ["equipamento", "Equipamento"],
  ["outros", "Outros"],
];

const sb = supabase.createClient(TERALAB.url, TERALAB.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let session = null;
let perfil = null;
let view = "painel";
let month = monthValue();
let produtos = [];

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2400);
}

function show(id) {
  ["screen-boot", "screen-auth", "screen-pending", "screen-app"].forEach((s) => {
    $(`#${s}`).hidden = s !== id;
  });
}

function setAuthMode(signup) {
  $("#auth-title").textContent = signup ? "Criar conta" : "Entrar";
  $("#auth-submit").textContent = signup ? "Criar conta" : "Entrar";
  $("#auth-toggle").textContent = signup ? "Já tenho conta" : "Quero criar uma conta";
  $("#auth-nome-wrap").hidden = !signup;
  $("#auth-nome").required = signup;
  $("#auth-form").dataset.mode = signup ? "signup" : "login";
  const senha = $("#auth-form [name=senha]");
  senha.autocomplete = signup ? "new-password" : "current-password";
  $("#auth-error").hidden = true;
}

function errBox(el, e) {
  const msg = (e && (e.message || e.error_description)) || "Não foi possível concluir. Tente de novo.";
  el.textContent = msg === "Invalid login credentials" ? "E-mail ou senha incorretos." : msg;
  el.hidden = false;
}

async function loadPerfil() {
  if (!session) return null;
  const { data, error } = await sb.from("perfis").select("id,nome,papel,aprovado").eq("id", session.user.id).maybeSingle();
  if (error) throw error;
  return data;
}

async function refreshSessionUI() {
  const { data } = await sb.auth.getSession();
  session = data.session || null;
  if (!session) {
    perfil = null;
    show("screen-auth");
    return;
  }
  try {
    perfil = await loadPerfil();
  } catch {
    perfil = null;
  }
  if (!perfil) {
    show("screen-pending");
    $("#pending-text").textContent = "Sua conta foi criada. Se o e-mail precisar de confirmação, abra o link que chegou na sua caixa de entrada. Depois toque em atualizar.";
    return;
  }
  if (!perfil.aprovado) {
    show("screen-pending");
    $("#pending-text").textContent = "Olá, " + (perfil.nome || "tudo bem") + ". Um administrador precisa aprovar seu acesso.";
    return;
  }
  $("#who").textContent = perfil.nome + (perfil.papel === "admin" ? " · admin" : "");
  $("#btn-equipe").hidden = perfil.papel !== "admin";
  show("screen-app");
  render();
}

function navActive() {
  $$(".tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
}

function render() {
  navActive();
  const root = $("#content");
  root.replaceChildren();
  if (view === "painel") renderPainel(root);
  else if (view === "produtos") renderProdutos(root);
  else if (view === "produto") renderProdutoForm(root);
  else if (view === "nova-venda") renderNovaVenda(root);
  else if (view === "vendas") renderVendas(root);
  else if (view === "custos") renderCustos(root);
  else if (view === "equipe") renderEquipe(root);
}

function monthPicker() {
  return `<label>Mês <input id="flt-mes" type="month" value="${esc(month)}"></label>`;
}

async function fetchProdutos() {
  const { data, error } = await sb.from("produtos").select("*").order("ordem").order("nome");
  if (error) throw error;
  produtos = data || [];
  return produtos;
}

function saleTotal(v) {
  return Number(v.quantidade) * Number(v.valor_unit) - Number(v.desconto || 0);
}
function saleCost(v) {
  return Number(v.quantidade) * Number(v.custo_unit || 0);
}

async function renderPainel(root) {
  root.innerHTML = `<div class="section-head"><h2>Painel</h2>${monthPicker()}</div><p class="empty">Carregando números do mês…</p>`;
  $("#flt-mes").onchange = (e) => { month = e.target.value || month; render(); };
  const { start, end } = monthBounds(month);
  const [vendasRes, custosRes] = await Promise.all([
    sb.from("vendas").select("id,data,produto_id,descricao,quantidade,valor_unit,custo_unit,desconto,status").gte("data", start).lt("data", end),
    sb.from("custos").select("id,valor").gte("data", start).lt("data", end),
  ]);
  if (vendasRes.error || custosRes.error) {
    root.querySelector(".empty").textContent = "Não deu para carregar o painel.";
    return;
  }
  const vendas = vendasRes.data || [];
  const pagas = vendas.filter((v) => v.status === "pago");
  const pend = vendas.filter((v) => v.status === "pendente");
  const fat = pagas.reduce((n, v) => n + saleTotal(v), 0);
  const custoPecas = pagas.reduce((n, v) => n + saleCost(v), 0);
  const despesas = (custosRes.data || []).reduce((n, c) => n + Number(c.valor || 0), 0);
  const receber = pend.reduce((n, v) => n + saleTotal(v), 0);
  const lucro = fat - custoPecas - despesas;
  const top = {};
  pagas.forEach((v) => {
    const key = v.descricao || v.produto_id || "Venda avulsa";
    top[key] = (top[key] || 0) + saleTotal(v);
  });
  const topList = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
  root.innerHTML = `
    <div class="section-head"><h2>Painel</h2>${monthPicker()}</div>
    <div class="grid-cards">
      <div class="stat"><span>Faturamento</span><strong>${money(fat)}</strong></div>
      <div class="stat"><span>Custo das peças</span><strong>${money(custoPecas)}</strong></div>
      <div class="stat"><span>Despesas</span><strong>${money(despesas)}</strong></div>
      <div class="stat"><span>Lucro</span><strong>${money(lucro)}</strong></div>
      <div class="stat wide"><span>A receber</span><strong>${money(receber)}</strong></div>
    </div>
    <h3 style="margin:8px 0 12px">Mais vendidos no mês</h3>
    <div class="list" id="top-list"></div>`;
  $("#flt-mes").onchange = (e) => { month = e.target.value || month; render(); };
  const list = $("#top-list");
  if (!topList.length) list.innerHTML = `<p class="empty">Ainda não há vendas pagas neste mês.</p>`;
  else topList.forEach(([name, val]) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<div class="prod-row"><div style="grid-column:1/-1"><h3>${esc(name)}</h3><div class="meta">${money(val)}</div></div></div>`;
    list.append(card);
  });
}

async function renderProdutos(root) {
  root.innerHTML = `<div class="section-head"><h2>Peças</h2><button class="btn primary" id="btn-new-prod" style="width:auto">Nova peça</button></div><p class="empty">Carregando…</p>`;
  $("#btn-new-prod").onclick = () => { view = "produto"; renderProdutoForm.editing = null; render(); };
  try { await fetchProdutos(); } catch { root.querySelector(".empty").textContent = "Não deu para carregar as peças."; return; }
  if (!produtos.length) { root.querySelector(".empty").textContent = "Nenhuma peça cadastrada ainda."; return; }
  const list = document.createElement("div");
  list.className = "list";
  produtos.forEach((p) => {
    const img = (p.imagens && p.imagens[0]) || "";
    const card = document.createElement("article");
    card.className = "card";
    const precoTxt = p.preco_label === "sob consulta" || p.preco === null ? "Sob consulta" : ((p.preco_label === "a partir de" ? "A partir de " : "") + money(p.preco));
    const margem = p.preco && p.custo != null ? ` · margem ${(((Number(p.preco) - Number(p.custo)) / Number(p.preco)) * 100).toFixed(0)}%` : "";
    card.innerHTML = `
      <div class="prod-row">
        ${img ? `<img class="thumb" src="${esc(img)}" alt="">` : `<div class="thumb"></div>`}
        <div>
          <h3>${esc(p.nome)}</h3>
          <div class="meta">${esc(p.categoria)} · ${precoTxt}${p.custo != null ? " · custo " + money(p.custo) + margem : ""}</div>
          <div class="meta">${p.ativo ? '<span class="badge ok">No site</span>' : '<span class="badge warn">Oculta</span>'}${p.ilustrativa ? ' <span class="badge warn">Ilustrativa</span>' : ""}</div>
        </div>
        <button class="btn" type="button">Editar</button>
      </div>`;
    card.querySelector("button").onclick = () => { view = "produto"; renderProdutoForm.editing = p; render(); };
    list.append(card);
  });
  root.querySelector(".empty").replaceWith(list);
}

async function uniqueId(base) {
  let id = base, n = 2;
  while (true) {
    const { data } = await sb.from("produtos").select("id").eq("id", id).maybeSingle();
    if (!data) return id;
    id = `${base}-${n++}`;
  }
}

async function compressImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    return blob || file;
  } catch {
    return file;
  }
}

function renderProdutoForm(root) {
  const p = renderProdutoForm.editing || {
    id: "", nome: "", descricao: "", categoria: "Personalizados", preco: "", preco_label: null,
    custo: "", imagens: [], ilustrativa: false, ativo: true, ordem: produtos.length + 1,
  };
  const imagens = [...(p.imagens || [])];
  const cats = Array.from(new Set([...CATS, p.categoria].filter(Boolean)));
  root.innerHTML = `
    <div class="section-head"><h2>${p.id ? "Editar peça" : "Nova peça"}</h2><button class="btn" type="button" id="back-prod">Voltar</button></div>
    <form class="form" id="form-prod">
      <label>Nome <input name="nome" required value="${esc(p.nome)}"></label>
      <label>Categoria
        <select name="categoria">${cats.map((c) => `<option ${c === p.categoria ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      </label>
      <label>Descrição <textarea name="descricao">${esc(p.descricao || "")}</textarea></label>
      <label>Tipo de preço
        <select name="preco_label">
          <option value="" ${!p.preco_label ? "selected" : ""}>Preço fechado</option>
          <option value="a partir de" ${p.preco_label === "a partir de" ? "selected" : ""}>A partir de</option>
          <option value="sob consulta" ${p.preco_label === "sob consulta" ? "selected" : ""}>Sob consulta</option>
        </select>
      </label>
      <label>Preço de venda (R$) <input name="preco" type="number" min="0" step="0.01" inputmode="decimal" value="${p.preco ?? ""}"></label>
      <label>Custo (R$) <input name="custo" type="number" min="0" step="0.01" inputmode="decimal" value="${p.custo ?? ""}" placeholder="Filamento + energia + outros"></label>
      <div class="margin-box" id="margem-box"></div>
      <label class="switch"><span>Mostrar no site</span><input name="ativo" type="checkbox" ${p.ativo !== false ? "checked" : ""}></label>
      <label class="switch"><span>Imagem ilustrativa</span><input name="ilustrativa" type="checkbox" ${p.ilustrativa ? "checked" : ""}></label>
      <div>
        <p class="meta" style="margin-bottom:8px">Fotos</p>
        <div class="photos" id="photos"></div>
        <div class="row" style="margin-top:8px">
          <button class="btn" type="button" id="btn-cam">Tirar foto</button>
          <button class="btn" type="button" id="btn-gal">Galeria</button>
        </div>
        <input id="file-cam" type="file" accept="image/*" capture="environment" hidden>
        <input id="file-gal" type="file" accept="image/*" hidden>
      </div>
      <p class="error" id="prod-error" hidden></p>
      <button class="btn primary" type="submit">Salvar peça</button>
      ${p.id ? '<button class="btn danger" type="button" id="btn-del-prod">Excluir peça</button>' : ""}
    </form>`;
  $("#back-prod").onclick = () => { view = "produtos"; render(); };

  const updateMargin = () => {
    const preco = Number($("[name=preco]").value);
    const custo = $("[name=custo]").value === "" ? null : Number($("[name=custo]").value);
    const label = $("[name=preco_label]").value;
    if (label === "sob consulta" || !preco || custo == null) {
      $("#margem-box").textContent = "Informe o preço e o custo para ver a margem automaticamente.";
      return;
    }
    const lucro = preco - custo;
    const pct = (lucro / preco) * 100;
    $("#margem-box").innerHTML = `<strong>Lucro ${money(lucro)}</strong> · margem ${pct.toFixed(0)}%`;
  };
  $("[name=preco]").oninput = updateMargin;
  $("[name=custo]").oninput = updateMargin;
  $("[name=preco_label]").onchange = updateMargin;
  updateMargin();

  const drawPhotos = () => {
    const box = $("#photos");
    box.replaceChildren();
    imagens.forEach((src, i) => {
      const wrap = document.createElement("div");
      wrap.className = "photo";
      wrap.innerHTML = `<img src="${esc(src)}" alt=""><button type="button" aria-label="Remover foto">×</button>`;
      wrap.querySelector("button").onclick = () => { imagens.splice(i, 1); drawPhotos(); };
      box.append(wrap);
    });
  };
  drawPhotos();

  const handleFiles = async (input) => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    toast("Enviando foto…");
    try {
      const blob = await compressImage(file);
      const id = p.id || "tmp";
      const path = `${id}/${Date.now()}.jpg`;
      const { error } = await sb.storage.from("produtos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = sb.storage.from("produtos").getPublicUrl(path);
      imagens.push(data.publicUrl);
      drawPhotos();
      toast("Foto adicionada");
    } catch (e) {
      toast(e.message || "Não deu para enviar a foto.");
    }
  };
  $("#btn-cam").onclick = () => $("#file-cam").click();
  $("#btn-gal").onclick = () => $("#file-gal").click();
  $("#file-cam").onchange = () => handleFiles($("#file-cam"));
  $("#file-gal").onchange = () => handleFiles($("#file-gal"));

  $("#form-prod").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const precoLabel = fd.get("preco_label") || null;
    const payload = {
      nome: String(fd.get("nome") || "").trim(),
      categoria: String(fd.get("categoria") || "Outros"),
      descricao: String(fd.get("descricao") || "").trim(),
      preco: precoLabel === "sob consulta" || fd.get("preco") === "" ? null : Number(fd.get("preco")),
      preco_label: precoLabel,
      custo: fd.get("custo") === "" ? null : Number(fd.get("custo")),
      imagens,
      ilustrativa: $("#form-prod [name=ilustrativa]").checked,
      ativo: $("#form-prod [name=ativo]").checked,
    };
    if (!payload.nome) return;
    try {
      if (p.id) {
        const { error } = await sb.from("produtos").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        payload.id = await uniqueId(slugify(payload.nome));
        payload.ordem = produtos.length + 1;
        const { error } = await sb.from("produtos").insert(payload);
        if (error) throw error;
      }
      toast("Peça salva");
      view = "produtos";
      render();
    } catch (err) {
      errBox($("#prod-error"), err);
    }
  };
  const del = $("#btn-del-prod");
  if (del) del.onclick = async () => {
    if (!confirm("Excluir esta peça do catálogo?")) return;
    const { error } = await sb.from("produtos").delete().eq("id", p.id);
    if (error) return toast(error.message);
    toast("Peça excluída");
    view = "produtos";
    render();
  };
}

async function renderNovaVenda(root) {
  try { if (!produtos.length) await fetchProdutos(); } catch {}
  const opts = produtos.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join("");
  root.innerHTML = `
    <div class="section-head"><h2>Nova venda</h2></div>
    <form class="form" id="form-venda">
      <label>Peça
        <select name="produto_id">
          <option value="">Venda avulsa</option>
          ${opts}
        </select>
      </label>
      <label>Descrição <input name="descricao" placeholder="Nome da peça ou serviço"></label>
      <label>Cliente <input name="cliente" placeholder="Opcional"></label>
      <label>Quantidade <input name="quantidade" type="number" min="0.01" step="1" value="1" required></label>
      <label>Valor unitário (R$) <input name="valor_unit" type="number" min="0" step="0.01" required></label>
      <label>Custo unitário (R$) <input name="custo_unit" type="number" min="0" step="0.01" placeholder="Cópia do custo da peça"></label>
      <label>Desconto (R$) <input name="desconto" type="number" min="0" step="0.01" value="0"></label>
      <label>Pagamento
        <select name="forma_pagamento">${PAY.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>
      </label>
      <label>Status
        <select name="status">
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
        </select>
      </label>
      <label>Data <input name="data" type="date" value="${todayISO()}" required></label>
      <label>Observação <textarea name="obs" placeholder="Opcional"></textarea></label>
      <div class="margin-box" id="venda-total"></div>
      <p class="error" id="venda-error" hidden></p>
      <button class="btn primary" type="submit">Registrar venda</button>
    </form>`;
  const form = $("#form-venda");
  const fillFromProduto = () => {
    const id = form.produto_id.value;
    const p = produtos.find((x) => x.id === id);
    if (!p) return;
    form.descricao.value = p.nome;
    if (p.preco != null) form.valor_unit.value = p.preco;
    if (p.custo != null) form.custo_unit.value = p.custo;
    updateTotal();
  };
  const updateTotal = () => {
    const q = Number(form.quantidade.value || 0);
    const vu = Number(form.valor_unit.value || 0);
    const d = Number(form.desconto.value || 0);
    const cu = form.custo_unit.value === "" ? null : Number(form.custo_unit.value);
    const total = q * vu - d;
    const custo = cu == null ? null : q * cu;
    $("#venda-total").innerHTML = `<strong>Total ${money(total)}</strong>${custo != null ? " · lucro " + money(total - custo) : ""}`;
  };
  form.produto_id.onchange = fillFromProduto;
  ["quantidade", "valor_unit", "desconto", "custo_unit"].forEach((n) => form[n].addEventListener("input", updateTotal));
  updateTotal();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      data: form.data.value,
      cliente: form.cliente.value.trim() || null,
      produto_id: form.produto_id.value || null,
      descricao: form.descricao.value.trim() || (form.produto_id.value && (produtos.find((x) => x.id === form.produto_id.value) || {}).nome) || "Venda avulsa",
      quantidade: Number(form.quantidade.value),
      valor_unit: Number(form.valor_unit.value),
      custo_unit: form.custo_unit.value === "" ? null : Number(form.custo_unit.value),
      desconto: Number(form.desconto.value || 0),
      forma_pagamento: form.forma_pagamento.value,
      status: form.status.value,
      vendedor: perfil && perfil.id,
      obs: form.obs.value.trim() || null,
    };
    const { error } = await sb.from("vendas").insert(payload);
    if (error) return errBox($("#venda-error"), error);
    toast("Venda registrada");
    view = "vendas";
    render();
  };
}

async function renderVendas(root) {
  root.innerHTML = `<div class="section-head"><h2>Vendas</h2>${monthPicker()}</div><p class="empty">Carregando…</p>`;
  $("#flt-mes").onchange = (e) => { month = e.target.value || month; render(); };
  const { start, end } = monthBounds(month);
  const { data, error } = await sb.from("vendas").select("*").gte("data", start).lt("data", end).order("data", { ascending: false }).order("created_at", { ascending: false });
  if (error) { root.querySelector(".empty").textContent = "Não deu para carregar as vendas."; return; }
  if (!data.length) { root.querySelector(".empty").textContent = "Nenhuma venda neste mês."; return; }
  const list = document.createElement("div");
  list.className = "list";
  data.forEach((v) => {
    const card = document.createElement("article");
    card.className = "card";
    const pay = (PAY.find((x) => x[0] === v.forma_pagamento) || [v.forma_pagamento, v.forma_pagamento || ""])[1];
    card.innerHTML = `
      <div class="prod-row" style="grid-template-columns:1fr auto">
        <div>
          <h3>${esc(v.descricao || "Venda")}</h3>
          <div class="meta">${esc(v.data)} · ${esc(v.cliente || "sem cliente")} · ${v.quantidade} × ${money(v.valor_unit)}</div>
          <div class="meta">${money(saleTotal(v))} · ${esc(pay)} · ${v.status === "pago" ? '<span class="badge ok">Pago</span>' : '<span class="badge warn">Pendente</span>'}</div>
        </div>
      </div>
      <div class="row">
        <button class="btn" type="button" data-act="toggle">${v.status === "pago" ? "Marcar pendente" : "Marcar pago"}</button>
        <button class="btn danger" type="button" data-act="del">Excluir</button>
      </div>`;
    card.querySelector('[data-act="toggle"]').onclick = async () => {
      const next = v.status === "pago" ? "pendente" : "pago";
      const { error: e } = await sb.from("vendas").update({ status: next }).eq("id", v.id);
      if (e) return toast(e.message);
      render();
    };
    card.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm("Excluir esta venda?")) return;
      const { error: e } = await sb.from("vendas").delete().eq("id", v.id);
      if (e) return toast(e.message);
      toast("Venda excluída");
      render();
    };
    list.append(card);
  });
  root.querySelector(".empty").replaceWith(list);
}

async function renderCustos(root) {
  root.innerHTML = `
    <div class="section-head"><h2>Custos</h2>${monthPicker()}</div>
    <form class="form" id="form-custo" style="margin-bottom:18px">
      <label>Tipo <select name="tipo">${COST_TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></label>
      <label>Descrição <input name="descricao" required placeholder="Ex.: rolo de PLA, conta de luz"></label>
      <label>Valor (R$) <input name="valor" type="number" min="0" step="0.01" required></label>
      <label>Data <input name="data" type="date" value="${todayISO()}" required></label>
      <button class="btn primary" type="submit">Registrar custo</button>
    </form>
    <p class="empty">Carregando…</p>`;
  $("#flt-mes").onchange = (e) => { month = e.target.value || month; render(); };
  $("#form-custo").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const { error } = await sb.from("custos").insert({
      tipo: f.tipo.value,
      descricao: f.descricao.value.trim(),
      valor: Number(f.valor.value),
      data: f.data.value,
      user_id: perfil && perfil.id,
    });
    if (error) return toast(error.message);
    toast("Custo registrado");
    render();
  };
  const { start, end } = monthBounds(month);
  const { data, error } = await sb.from("custos").select("*").gte("data", start).lt("data", end).order("data", { ascending: false });
  if (error) { root.querySelector(".empty").textContent = "Não deu para carregar os custos."; return; }
  if (!data.length) { root.querySelector(".empty").textContent = "Nenhum custo neste mês."; return; }
  const list = document.createElement("div");
  list.className = "list";
  const total = data.reduce((n, c) => n + Number(c.valor || 0), 0);
  const sum = document.createElement("div");
  sum.className = "stat wide";
  sum.innerHTML = `<span>Total do mês</span><strong>${money(total)}</strong>`;
  list.append(sum);
  data.forEach((c) => {
    const tipo = (COST_TYPES.find((x) => x[0] === c.tipo) || [c.tipo, c.tipo])[1];
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="prod-row" style="grid-template-columns:1fr auto">
        <div>
          <h3>${esc(c.descricao)}</h3>
          <div class="meta">${esc(c.data)} · ${esc(tipo)} · ${money(c.valor)}</div>
        </div>
        <button class="btn danger" type="button">Excluir</button>
      </div>`;
    card.querySelector("button").onclick = async () => {
      if (!confirm("Excluir este custo?")) return;
      const { error: e } = await sb.from("custos").delete().eq("id", c.id);
      if (e) return toast(e.message);
      render();
    };
    list.append(card);
  });
  root.querySelector(".empty").replaceWith(list);
}

async function renderEquipe(root) {
  root.innerHTML = `<div class="section-head"><h2>Equipe</h2></div><p class="empty">Carregando…</p>`;
  const { data, error } = await sb.from("perfis").select("id,nome,papel,aprovado,created_at").order("created_at");
  if (error) { root.querySelector(".empty").textContent = "Não deu para carregar a equipe."; return; }
  const list = document.createElement("div");
  list.className = "list";
  data.forEach((u) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <h3>${esc(u.nome || "Sem nome")}</h3>
      <div class="meta">${u.papel === "admin" ? "Administrador" : "Membro"} · ${u.aprovado ? '<span class="badge ok">Aprovado</span>' : '<span class="badge warn">Aguardando</span>'}</div>
      <div class="row"></div>`;
    const row = card.querySelector(".row");
    if (u.id !== perfil.id) {
      const b = document.createElement("button");
      b.className = "btn";
      b.type = "button";
      b.textContent = u.aprovado ? "Revogar acesso" : "Aprovar";
      b.onclick = async () => {
        const { error: e } = await sb.from("perfis").update({ aprovado: !u.aprovado }).eq("id", u.id);
        if (e) return toast(e.message);
        toast(u.aprovado ? "Acesso revogado" : "Membro aprovado");
        render();
      };
      row.append(b);
    }
    list.append(card);
  });
  root.querySelector(".empty").replaceWith(list);
}

$("#auth-toggle").onclick = () => setAuthMode($("#auth-form").dataset.mode !== "signup");
$("#auth-form").onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("senha") || "");
  const nome = String(fd.get("nome") || "").trim();
  $("#auth-error").hidden = true;
  $("#auth-submit").disabled = true;
  try {
    if ($("#auth-form").dataset.mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { nome } } });
      if (error) throw error;
      if (data.session) {
        session = data.session;
        await refreshSessionUI();
      } else {
        show("screen-pending");
        $("#pending-text").textContent = "Conta criada. Se chegar um e-mail de confirmação, abra o link e depois toque em atualizar. Se você for a primeira pessoa a se cadastrar, já entra como administrador.";
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refreshSessionUI();
    }
  } catch (err) {
    errBox($("#auth-error"), err);
  } finally {
    $("#auth-submit").disabled = false;
  }
};

$("#pending-refresh").onclick = () => refreshSessionUI();
$("#pending-logout").onclick = async () => { await sb.auth.signOut(); await refreshSessionUI(); };
$("#btn-sair").onclick = async () => { await sb.auth.signOut(); await refreshSessionUI(); };
$("#btn-equipe").onclick = () => { view = "equipe"; render(); };
$$(".tabbar button").forEach((b) => {
  b.onclick = () => { view = b.dataset.view; render(); };
});

sb.auth.onAuthStateChange((_event, next) => {
  session = next;
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

setAuthMode(false);
refreshSessionUI();
