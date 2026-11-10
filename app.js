const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const money = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const WA = "https://wa.me/5531993535517";

let products = [];
let cart = [];
let category = "Todos";

try {
  const saved = JSON.parse(localStorage.getItem("teralab-cart") || "[]");
  if (Array.isArray(saved)) {
    cart = saved.filter((x) => x && typeof x.id === "string" && Number.isInteger(x.quantity) && x.quantity > 0 && x.quantity <= 999);
  }
} catch {}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function empty(title, text, link = true) {
  const box = el("div", undefined, "empty-catalog");
  box.append(el("span", "⬡", "empty-icon"), el("h3", title), el("p", text));
  if (link) {
    const a = el("a", "Criar uma encomenda personalizada ↗");
    a.href = "#encomenda";
    a.addEventListener("click", () => $("#cart-dialog").close());
    box.append(a);
  }
  return box;
}

function setCatalogVisible(visible) {
  $$("[data-catalog]").forEach((node) => {
    node.hidden = !visible;
  });
}

function persist() {
  try {
    localStorage.setItem("teralab-cart", JSON.stringify(cart));
  } catch {}
  updateCart();
}

function updateCart() {
  const countEl = $("#cart-count");
  const titleCount = $("#cart-title-count");
  const root = $("#cart-items");
  const summary = $("#cart-summary");
  const checkout = $("#checkout");
  if (!root) return;

  const items = cart.map((c) => ({ ...c, product: products.find((p) => p.id === c.id) })).filter((c) => c.product);
  const count = items.reduce((n, c) => n + c.quantity, 0);
  if (countEl) countEl.textContent = count;
  if (titleCount) titleCount.textContent = count ? " / " + count : "";
  root.replaceChildren();
  let total = 0;
  let quote = false;

  if (!items.length) {
    root.append(empty("Um espaço para suas ideias.", "Sua sacola está vazia. Explore o catálogo ou peça uma criação sob encomenda."));
  }

  items.forEach((c) => {
    const row = el("div", undefined, "cart-row");
    const desc = el("div");
    desc.append(el("h3", c.product.name), el("p", c.product.price === null ? "Sob consulta" : money(c.product.price)));
    const controls = el("div", undefined, "quantity");
    for (const [label, delta] of [["−", -1], ["+", 1]]) {
      const b = el("button", label);
      b.type = "button";
      b.setAttribute("aria-label", (delta < 0 ? "Diminuir" : "Aumentar") + " quantidade de " + c.product.name);
      b.addEventListener("click", () => {
        const i = cart.find((x) => x.id === c.id);
        i.quantity = Math.min(999, i.quantity + delta);
        cart = cart.filter((x) => x.quantity > 0);
        persist();
      });
      controls.append(b);
      if (delta === -1) controls.append(el("span", String(c.quantity)));
    }
    row.append(desc, controls);
    root.append(row);
    if (c.product.price === null) quote = true;
    else total += c.product.price * c.quantity;
  });

  summary.replaceChildren();
  if (items.length) {
    const line = el("div", undefined, "cart-total");
    line.append(el("span", quote ? "Subtotal conhecido" : "Subtotal"), el("strong", money(total)));
    summary.append(line);
    if (quote) summary.append(el("p", "Há peças com valor sob consulta.", "modal-note"));
  }

  checkout.hidden = !items.length;
  checkout.style.display = items.length ? "flex" : "none";
  checkout.href =
    WA +
    "?text=" +
    encodeURIComponent(
      "Olá, TeraLab! Gostaria de consultar este pedido:\n" +
        items.map((c) => c.quantity + " × " + c.product.name + " — " + (c.product.price === null ? "sob consulta" : money(c.product.price))).join("\n") +
        "\nSubtotal conhecido: " +
        money(total) +
        "\nPodem confirmar os valores, prazo e entrega?"
    );
}

function renderProducts() {
  const root = $("#products");
  if (!root) return;
  root.replaceChildren();
  const search = $("#search");
  const term = (search ? search.value : "").trim().toLocaleLowerCase("pt-BR");
  const list = products.filter(
    (p) => (category === "Todos" || p.category === category) && [p.name, p.description].join(" ").toLocaleLowerCase("pt-BR").includes(term)
  );
  if (!list.length) {
    root.append(
      empty(
        products.length ? "Nenhuma peça encontrada." : "Novas criações estão chegando.",
        products.length
          ? "Tente outra busca ou escolha uma categoria diferente."
          : "Nosso catálogo está sendo preparado. Enquanto isso, conte sua ideia e receba um orçamento personalizado."
      )
    );
    return;
  }
  const grid = el("div", undefined, "product-grid");
  list.forEach((p) => {
    const card = el("article", undefined, "product-card");
    if (p.image) {
      const img = el("img");
      img.src = p.image;
      img.alt = p.name;
      img.loading = "lazy";
      card.append(img);
    }
    const body = el("div", undefined, "product-body");
    body.append(el("small", p.category.toUpperCase()), el("h3", p.name), el("p", p.description), el("strong", p.price === null ? "Sob consulta" : money(p.price)));
    const b = el("button", "Adicionar à sacola +", "button orange");
    b.type = "button";
    b.addEventListener("click", () => {
      const exists = cart.find((c) => c.id === p.id);
      if (exists) exists.quantity = Math.min(999, exists.quantity + 1);
      else cart.push({ id: p.id, quantity: 1 });
      persist();
      const t = $("#toast");
      t.textContent = "Peça adicionada à sacola";
      t.style.display = "block";
      setTimeout(() => (t.style.display = "none"), 2200);
    });
    body.append(b);
    card.append(body);
    grid.append(card);
  });
  root.append(grid);
}

function syncProjectType() {
  const type = ($('input[name="projectType"]:checked') || {}).value || "software";
  const software = $("#fields-software");
  const print = $("#fields-print");
  const qty = $('input[name="quantity"]');
  software.hidden = type !== "software";
  print.hidden = type !== "print";
  if (qty) qty.required = type === "print";
}

function openWhatsApp(text) {
  const url = WA + "?text=" + encodeURIComponent(text);
  const win = window.open(url, "_blank", "noopener");
  if (!win) window.location.href = url;
}

/* Menu */
const toggle = $("#menu-toggle");
const nav = $("#site-nav");

function closeMenu() {
  if (!toggle || !nav) return;
  nav.classList.remove("is-open");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Abrir menu");
  document.body.classList.remove("menu-open");
}

function openMenu() {
  nav.classList.add("is-open");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "Fechar menu");
  document.body.classList.add("menu-open");
}

if (toggle && nav) {
  toggle.addEventListener("click", () => (nav.classList.contains("is-open") ? closeMenu() : openMenu()));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) closeMenu();
  });
}

$$("[data-filter]").forEach((b) =>
  b.addEventListener("click", () => {
    category = b.dataset.filter;
    $$("[data-filter]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
    renderProducts();
  })
);

const search = $("#search");
if (search) search.addEventListener("input", renderProducts);

const cartOpen = $("#cart-open");
if (cartOpen) cartOpen.addEventListener("click", () => { $("#cart-dialog").showModal(); updateCart(); });
$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
const continueBtn = $("#continue-shopping");
if (continueBtn) {
  continueBtn.addEventListener("click", () => {
    $("#cart-dialog").close();
    location.hash = "catalogo";
  });
}
$$("dialog").forEach((d) =>
  d.addEventListener("click", (e) => {
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }
  })
);

$$('input[name="projectType"]').forEach((input) => input.addEventListener("change", syncProjectType));
syncProjectType();

$("#order-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const d = new FormData(e.target);
  const type = d.get("projectType");
  const name = d.get("name");
  const description = d.get("description");
  const reference = d.get("reference");
  let message;
  if (type === "software") {
    message =
      "Olá! Quero um orçamento de site/sistema.\nMeu nome: " +
      name +
      "\nTipo: " +
      d.get("softwareCategory") +
      "\nMinha ideia: " +
      description +
      (reference ? "\nReferência: " + reference : "");
  } else {
    message =
      "Olá, TeraLab! Sou " +
      name +
      ".\nQuero um orçamento de impressão 3D.\nCategoria: " +
      d.get("printCategory") +
      "\nQuantidade: " +
      d.get("quantity") +
      "\nMinha ideia: " +
      description +
      (reference ? "\nReferência: " + reference : "");
  }
  openWhatsApp(message);
});

const year = $("#year");
if (year) year.textContent = new Date().getFullYear();

setCatalogVisible(false);
updateCart();

fetch("products.json")
  .then((r) => {
    if (!r.ok) throw new Error("catalog");
    return r.json();
  })
  .then((data) => {
    if (!Array.isArray(data)) throw new Error("catalog");
    products = data.filter(
      (p) =>
        p &&
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.category === "string" &&
        typeof p.description === "string" &&
        (p.price === null || (typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0))
    );
    setCatalogVisible(products.length > 0);
    if (products.length) {
      renderProducts();
      updateCart();
    }
  })
  .catch(() => {
    setCatalogVisible(false);
    updateCart();
  });
