const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

const REQUEST_TIMEOUT_MS = 8000;
const MAX_CREATE_ATTEMPTS = 3;
const STATUS_ACTIONS = [
  { status: "confirmed", label: "Confirm" },
  { status: "shipped", label: "Ship" },
  { status: "delivered", label: "Deliver" },
  { status: "cancelled", label: "Cancel", className: "danger" },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "className") {
      node.className = value;
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function formatMoney(cents) {
  return money.format(cents / 100);
}

function formatTime(iso) {
  return `${dateTime.format(new Date(iso))} UTC`;
}

function statusBadge(status) {
  return el("span", { className: `status status-${status}` }, status);
}

let toastTimer;
function toast(message, kind = "info") {
  toastEl.textContent = message;
  toastEl.className = `toast ${kind === "error" ? "error" : ""}`;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 5000);
}

class ApiError extends Error {
  constructor(status, code, message, retryable) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw new ApiError(
      0,
      timedOut ? "TIMEOUT" : "NETWORK",
      timedOut ? "Request timed out" : "Network error",
      true,
    );
  } finally {
    clearTimeout(timer);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const err = body?.error ?? {};
    throw new ApiError(
      response.status,
      err.code ?? "HTTP_ERROR",
      err.message ?? `Request failed with ${response.status}`,
      response.status >= 500,
    );
  }
  return body;
}

async function renderOrders() {
  const { orders } = await api("/api/orders");
  const rows = orders.map((order) =>
    el(
      "tr",
      {},
      el("td", {}, el("a", { href: `#/orders/${encodeURIComponent(order.id)}` }, order.id)),
      el("td", {}, statusBadge(order.status)),
      el("td", { className: "num" }, order.itemCount),
      el("td", { className: "num" }, formatMoney(order.totalCents)),
      el("td", {}, formatTime(order.createdAt)),
    ),
  );
  app.replaceChildren(
    el(
      "section",
      { className: "card" },
      el("h1", {}, "Orders"),
      orders.length === 0
        ? el("p", { className: "muted" }, "No orders yet.")
        : el(
            "table",
            {},
            el(
              "thead",
              {},
              el(
                "tr",
                {},
                el("th", {}, "Order"),
                el("th", {}, "Status"),
                el("th", { className: "num" }, "Items"),
                el("th", { className: "num" }, "Total"),
                el("th", {}, "Created"),
              ),
            ),
            el("tbody", {}, rows),
          ),
    ),
  );
}

function newIdempotencyKey() {
  return crypto.randomUUID();
}

async function renderNewOrder() {
  const { products } = await api("/api/products");
  let attemptKey = newIdempotencyKey();
  let keyUsed = false;

  const quantityInputs = new Map();
  const totalEl = el("strong", {}, formatMoney(0));
  const keyEl = el("code", {}, attemptKey);
  const simulateRetry = el("input", { type: "checkbox", id: "simulate-retry" });
  const submit = el("button", { type: "submit", className: "primary" }, "Place order");

  function selectedItems() {
    const items = [];
    for (const [productId, input] of quantityInputs) {
      const quantity = Number(input.value);
      if (input.value !== "" && quantity !== 0) items.push({ productId, quantity });
    }
    return items;
  }

  function onFormEdited() {
    const estimate = selectedItems().reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product ? product.priceCents * item.quantity : 0);
    }, 0);
    totalEl.textContent = formatMoney(estimate);
    if (keyUsed) {
      attemptKey = newIdempotencyKey();
      keyUsed = false;
      keyEl.textContent = attemptKey;
    }
  }

  const rows = products.map((product) => {
    const input = el("input", {
      type: "number",
      min: "0",
      max: "99",
      step: "1",
      value: "0",
      "aria-label": `Quantity of ${product.name}`,
      onInput: onFormEdited,
    });
    quantityInputs.set(product.id, input);
    return el(
      "tr",
      {},
      el("td", {}, product.name),
      el("td", { className: "num" }, formatMoney(product.priceCents)),
      el("td", { className: "num" }, input),
    );
  });

  async function sendCreate(items, key) {
    return api("/api/orders", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify({ items }),
    });
  }

  async function onSubmit(event) {
    event.preventDefault();
    const items = selectedItems();
    if (items.length === 0) {
      toast("Choose at least one product", "error");
      return;
    }
    submit.disabled = true;
    keyUsed = true;
    const key = attemptKey;
    try {
      let result;
      for (let attempt = 1; attempt <= MAX_CREATE_ATTEMPTS; attempt++) {
        try {
          result = await sendCreate(items, key);
          if (simulateRetry.checked && attempt === 1) {
            result = await sendCreate(items, key);
          }
          break;
        } catch (error) {
          if (!(error instanceof ApiError) || !error.retryable || attempt === MAX_CREATE_ATTEMPTS) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
      }
      toast(`Order ${result.order.id} placed`);
      location.hash = `#/orders/${encodeURIComponent(result.order.id)}`;
    } catch (error) {
      const retryHint = error.retryable ? " You can retry safely with the same request." : "";
      toast(`${error.message}.${retryHint}`, "error");
    } finally {
      submit.disabled = false;
    }
  }

  app.replaceChildren(
    el(
      "form",
      { className: "card", onSubmit },
      el("h1", {}, "New order"),
      el(
        "table",
        {},
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", {}, "Product"),
            el("th", { className: "num" }, "Price"),
            el("th", { className: "num" }, "Quantity"),
          ),
        ),
        el("tbody", {}, rows),
      ),
      el(
        "div",
        { className: "form-footer" },
        el(
          "span",
          {},
          "Estimated total: ",
          totalEl,
          el("span", { className: "muted" }, " (the server calculates the final total)"),
        ),
        submit,
      ),
      el(
        "p",
        { className: "muted" },
        "Idempotency-Key for this order: ",
        keyEl,
        ". It is reused if the request is retried and replaced when you start a different order.",
      ),
      el(
        "p",
        { className: "muted" },
        el(
          "label",
          { for: "simulate-retry" },
          simulateRetry,
          " Demo control: simulate a lost response (the browser re-sends the same request with the same Idempotency-Key)",
        ),
      ),
    ),
  );
}

async function renderOrder(id) {
  const { order } = await api(`/api/orders/${encodeURIComponent(id)}`);

  async function changeStatus(status, button) {
    button.disabled = true;
    try {
      await api(`/api/orders/${encodeURIComponent(order.id)}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      toast(`Order is now ${status}`);
    } catch (error) {
      toast(`${error.code}: ${error.message}`, "error");
    } finally {
      await renderOrder(order.id);
    }
  }

  const actions = STATUS_ACTIONS.map((action) => {
    const button = el("button", { type: "button", className: action.className }, action.label);
    button.addEventListener("click", () => changeStatus(action.status, button));
    return button;
  });

  app.replaceChildren(
    el(
      "section",
      { className: "card" },
      el("h1", {}, "Order ", el("code", {}, order.id), " ", statusBadge(order.status)),
      el(
        "p",
        { className: "muted" },
        `Created ${formatTime(order.createdAt)} · Last updated ${formatTime(order.updatedAt)}`,
      ),
      el("div", { className: "actions" }, actions),
      el("p", { className: "muted" }, "The server decides which status changes are allowed."),
    ),
    el(
      "section",
      { className: "card" },
      el("h2", {}, "Line items"),
      el(
        "table",
        {},
        el(
          "thead",
          {},
          el(
            "tr",
            {},
            el("th", {}, "Product"),
            el("th", { className: "num" }, "Unit price"),
            el("th", { className: "num" }, "Qty"),
            el("th", { className: "num" }, "Line total"),
          ),
        ),
        el(
          "tbody",
          {},
          order.items.map((item) =>
            el(
              "tr",
              {},
              el("td", {}, item.productName),
              el("td", { className: "num" }, formatMoney(item.unitPriceCents)),
              el("td", { className: "num" }, item.quantity),
              el("td", { className: "num" }, formatMoney(item.lineTotalCents)),
            ),
          ),
          el(
            "tr",
            {},
            el("td", { colspan: "3" }, el("strong", {}, "Total")),
            el("td", { className: "num" }, el("strong", {}, formatMoney(order.totalCents))),
          ),
        ),
      ),
    ),
    el(
      "section",
      { className: "card" },
      el("h2", {}, "Status history"),
      el(
        "ol",
        { className: "history" },
        order.history.map((entry) =>
          el(
            "li",
            {},
            entry.fromStatus ? [statusBadge(entry.fromStatus), " → "] : "Created as ",
            statusBadge(entry.toStatus),
            el("div", { className: "muted" }, formatTime(entry.at)),
          ),
        ),
      ),
    ),
  );
}

async function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  try {
    if (hash === "/" || hash === "/orders") {
      await renderOrders();
    } else if (hash === "/new") {
      await renderNewOrder();
    } else if (hash.startsWith("/orders/")) {
      await renderOrder(decodeURIComponent(hash.slice("/orders/".length)));
    } else {
      app.replaceChildren(el("section", { className: "card" }, el("h1", {}, "Not found")));
    }
  } catch (error) {
    app.replaceChildren(
      el(
        "section",
        { className: "card" },
        el("h1", {}, "Something went wrong"),
        el("p", { className: "muted" }, error.message ?? String(error)),
      ),
    );
  }
}

window.addEventListener("hashchange", route);
route();
