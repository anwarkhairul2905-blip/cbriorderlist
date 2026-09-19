const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
// Railway exposes this path when a persistent Volume is attached. Local runs
// continue to use the repository's data directory.
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(ROOT_DIR, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ryna2026";
const SESSION_COOKIE = "nasi_admin_session";
const RECEIPT_PREPAY_DAYS = 7;
const MAX_ORDER_PACKS = 120;
const MENU_KEYS = new Set(["nasi-lemak", "char-kway-teow"]);
const MENU_PRICES_AED = {
  "nasi-lemak": 10,
  "char-kway-teow": 25,
};
const BEAN_SPROUT_OPTIONS = new Set(["with", "without"]);

const DEFAULT_SETTINGS = {
  dailyLimit: 120,
  ordersOpen: true,
  activeMenu: "nasi-lemak",
  orderDate: new Date().toISOString().slice(0, 10),
  accountHolder: "MUHAMAD KHAIRULANWAR",
  bankName: "ADIB",
  iban: "AE550500000000019407908",
  accountNumber: "19407908",
};

const STORE_TEMPLATE = {
  settings: { ...DEFAULT_SETTINGS },
  orders: [],
  salesHistory: [],
};

let store = null;
const sessions = new Map();
let writeQueue = Promise.resolve();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function parseCookies(header) {
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const index = pair.indexOf("=");
      if (index === -1) return acc;
      const key = pair.slice(0, index).trim();
      const value = decodeURIComponent(pair.slice(index + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

function setCookie(name, value, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function createSession() {
  const token = crypto.randomUUID();
  sessions.set(token, Date.now() + 1000 * 60 * 60 * 24 * 7);
  return token;
}

function cleanSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of sessions.entries()) {
    if (expiresAt <= now) sessions.delete(token);
  }
}

function isAdminAuthenticated(req) {
  cleanSessions();
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function normalizeSettings(settings = {}) {
  const normalized = { ...DEFAULT_SETTINGS, ...settings };
  const dailyLimit = Number(normalized.dailyLimit);
  normalized.dailyLimit = Number.isFinite(dailyLimit) ? Math.max(dailyLimit, 0) : DEFAULT_SETTINGS.dailyLimit;
  normalized.ordersOpen = Boolean(normalized.ordersOpen);
  normalized.activeMenu = MENU_KEYS.has(String(normalized.activeMenu)) ? String(normalized.activeMenu) : DEFAULT_SETTINGS.activeMenu;
  normalized.orderDate = String(normalized.orderDate || DEFAULT_SETTINGS.orderDate).slice(0, 10);
  normalized.accountHolder = DEFAULT_SETTINGS.accountHolder;
  normalized.bankName = DEFAULT_SETTINGS.bankName;
  normalized.iban = DEFAULT_SETTINGS.iban;
  normalized.accountNumber = DEFAULT_SETTINGS.accountNumber;
  return normalized;
}

function normalizeStore(input) {
  const settings = normalizeSettings(input && input.settings);
  const orders = Array.isArray(input && input.orders) ? input.orders : [];
  const salesHistory = Array.isArray(input && input.salesHistory) ? input.salesHistory : [];
  return { settings, orders, salesHistory };
}

async function loadStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return normalizeStore(STORE_TEMPLATE);
  }
}

async function saveStore() {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function queueWrite(mutator) {
  writeQueue = writeQueue.then(async () => {
    const result = await mutator();
    await saveStore();
    return result;
  }).catch((error) => {
    writeQueue = Promise.resolve();
    throw error;
  });
  return writeQueue;
}

function ordersForActiveMenu(orders) {
  const activeMenu = store?.settings?.activeMenu || DEFAULT_SETTINGS.activeMenu;
  return orders.filter((order) => (order.menuKey || DEFAULT_SETTINGS.activeMenu) === activeMenu);
}

function totalPacks(orders) {
  return orders.reduce((total, order) => total + Number(order.packs || 0), 0);
}

function paidPacks(orders) {
  return orders
    .filter((order) => order.paid)
    .reduce((total, order) => total + Number(order.packs || 0), 0);
}

function buildSummary() {
  const activeOrders = ordersForActiveMenu(store.orders);
  const total = totalPacks(activeOrders);
  const paid = paidPacks(activeOrders);
  const remaining = Math.max(Number(store.settings.dailyLimit || 0) - total, 0);
  return {
    orderCount: store.orders.length,
    totalPacks: total,
    paidPacks: paid,
    unpaidPacks: total - paid,
    remainingPacks: remaining,
  };
}

function publicState() {
  return {
    settings: store.settings,
    summary: buildSummary(),
  };
}

function adminState() {
  return {
    ...publicState(),
    orders: store.orders,
    salesHistory: store.salesHistory,
  };
}

function parseDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function receiptDateAllowed(receiptDate, orderDate) {
  const receiptTime = parseDateKey(receiptDate);
  const orderTime = parseDateKey(orderDate);
  if (!Number.isFinite(receiptTime) || !Number.isFinite(orderTime)) return false;
  const earliestAllowed = orderTime - RECEIPT_PREPAY_DAYS * 24 * 60 * 60 * 1000;
  return receiptTime >= earliestAllowed && receiptTime <= orderTime;
}

function sanitizeReceipt(receipt, orderDate) {
  const normalized = receipt && typeof receipt === "object" ? receipt : {};
  const verified = Boolean(normalized.verified && normalized.accountMatched && normalized.dateMatched);
  const safeDate = String(normalized.normalizedTransactionDate || "");
  return {
    name: String(normalized.name || ""),
    type: String(normalized.type || ""),
    size: Number(normalized.size || 0),
    dataUrl: String(normalized.dataUrl || ""),
    verified,
    accountMatched: Boolean(normalized.accountMatched),
    dateMatched: Boolean(normalized.dateMatched && receiptDateAllowed(safeDate, orderDate)),
    transactionDate: String(normalized.transactionDate || ""),
    normalizedTransactionDate: safeDate,
  };
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function readStaticFile(requestPath) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const resolved = path.resolve(ROOT_DIR, `.${normalizedPath}`);
  if (!resolved.startsWith(ROOT_DIR)) {
    return null;
  }
  return resolved;
}

async function serveStatic(req, res, url) {
  const filePath = readStaticFile(url.pathname);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    if (!path.extname(url.pathname)) {
      const fallback = path.join(ROOT_DIR, "index.html");
      const html = await fs.readFile(fallback);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    sendText(res, 404, "Not found");
    return;
  }

  if (stat.isDirectory()) {
    const fallback = path.join(filePath, "index.html");
    try {
      const html = await fs.readFile(fallback);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    } catch {
      sendText(res, 404, "Not found");
      return;
    }
  }

  const body = await fs.readFile(filePath);
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  res.end(body);
}

function requireAdmin(req, res) {
  if (isAdminAuthenticated(req)) return true;
  sendJson(res, 401, { error: "Unauthorized" });
  return false;
}

async function handleState(req, res) {
  sendJson(res, 200, isAdminAuthenticated(req) ? adminState() : publicState());
}

async function handleLogin(req, res) {
  const body = await parseJsonBody(req);
  if (String(body.password || "") !== ADMIN_PASSWORD) {
    sendJson(res, 401, { error: "Invalid password" });
    return;
  }
  const token = createSession();
  sendJson(
    res,
    200,
    { ok: true },
    { "Set-Cookie": setCookie(SESSION_COOKIE, token) }
  );
}

async function handleLogout(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  sendJson(res, 200, { ok: true }, { "Set-Cookie": clearCookie(SESSION_COOKIE) });
}

async function handleSettings(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await parseJsonBody(req);
  await queueWrite(async () => {
    store.settings.orderDate = String(body.orderDate || store.settings.orderDate).slice(0, 10);
    const requestedLimit = Number(body.dailyLimit);
    store.settings.dailyLimit = Math.max(Number.isFinite(requestedLimit) ? requestedLimit : store.settings.dailyLimit, totalPacks(store.orders));
    store.settings.ordersOpen = Boolean(body.ordersOpen);
    if (MENU_KEYS.has(String(body.activeMenu))) store.settings.activeMenu = String(body.activeMenu);
  });
  sendJson(res, 200, adminState());
}

function validateOrder(body, activeMenu = DEFAULT_SETTINGS.activeMenu) {
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const packs = Number.parseInt(body.packs, 10);
  const pickupTime = String(body.pickupTime || "").trim();
  const paymentMethod = String(body.paymentMethod || "Cash").trim();
  const beanSproutPreference = String(body.beanSproutPreference || "").trim();
  if (!name) return { ok: false, error: "Name is required" };
  if (!/^[+()\-\s\d]{7,20}$/.test(phone) || !/\d/.test(phone)) return { ok: false, error: "A valid phone number is required" };
  if (!Number.isFinite(packs) || packs < 1) return { ok: false, error: "Pack count is required" };
  if (packs > MAX_ORDER_PACKS) return { ok: false, error: "Pack count too high" };
  if (!pickupTime) return { ok: false, error: "Pickup time is required" };
  if (!["Cash", "Bank transfer"].includes(paymentMethod)) return { ok: false, error: "Invalid payment method" };
  if (activeMenu === "char-kway-teow" && !BEAN_SPROUT_OPTIONS.has(beanSproutPreference)) {
    return { ok: false, error: "Choose whether you want bean sprouts" };
  }
  return { ok: true, name, phone, packs, pickupTime, paymentMethod, beanSproutPreference: activeMenu === "char-kway-teow" ? beanSproutPreference : "" };
}

async function handleCreateOrder(req, res) {
  const body = await parseJsonBody(req);
  const validation = validateOrder(body, store.settings.activeMenu);
  if (!validation.ok) {
    sendJson(res, 400, { error: validation.error });
    return;
  }

  if (!store.settings.ordersOpen) {
    sendJson(res, 409, { error: "Orders are closed" });
    return;
  }

  let createdOrder = null;
  let errorMessage = null;
  await queueWrite(async () => {
    const summary = buildSummary();
    if (validation.packs > summary.remainingPacks) {
      errorMessage = `Only ${summary.remainingPacks} pack(s) left`;
      return;
    }

    let receipt = null;
    if (validation.paymentMethod === "Bank transfer") {
      receipt = sanitizeReceipt(body.receipt, store.settings.orderDate);
      if (!receipt.verified || !receipt.accountMatched || !receipt.dateMatched) {
        errorMessage = "Verified receipt required";
        return;
      }
    }

    createdOrder = {
      id: `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      menuKey: store.settings.activeMenu,
      name: validation.name,
      phone: validation.phone,
      packs: validation.packs,
      unitPrice: MENU_PRICES_AED[store.settings.activeMenu],
      totalAmount: validation.packs * MENU_PRICES_AED[store.settings.activeMenu],
      orderDate: store.settings.orderDate,
      pickupTime: validation.pickupTime,
      beanSproutPreference: validation.beanSproutPreference,
      paymentMethod: validation.paymentMethod,
      receipt,
      paid: validation.paymentMethod === "Bank transfer",
      taken: false,
      createdAt: new Date().toISOString(),
    };
    store.orders.unshift(createdOrder);
  });

  if (errorMessage) {
    sendJson(res, 409, { error: errorMessage });
    return;
  }

  sendJson(res, 201, {
    ok: true,
    order: createdOrder,
    summary: buildSummary(),
  });
}

async function handleOrderUpdate(req, res, orderId) {
  if (!requireAdmin(req, res)) return;
  const body = await parseJsonBody(req);
  let updated = null;
  await queueWrite(async () => {
    const order = store.orders.find((item) => item.id === orderId);
    if (!order) return;
    if (typeof body.paid === "boolean") order.paid = body.paid;
    if (typeof body.taken === "boolean") order.taken = body.taken;
    updated = order;
  });
  if (!updated) {
    sendJson(res, 404, { error: "Order not found" });
    return;
  }
  sendJson(res, 200, { ok: true, summary: buildSummary() });
}

async function handleClearOrders(req, res) {
  if (!requireAdmin(req, res)) return;
  const body = await parseJsonBody(req);
  if (String(body.password || "") !== ADMIN_PASSWORD) {
    sendJson(res, 401, { error: "Invalid password" });
    return;
  }
  await queueWrite(async () => {
    const archivedAt = new Date().toISOString();
    store.salesHistory.unshift(...store.orders.map((order) => ({ ...order, archivedAt })));
    store.orders = [];
  });
  sendJson(res, 200, { ok: true, summary: buildSummary() });
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/state") {
      await handleState(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      await handleLogin(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      await handleLogout(req, res);
      return;
    }
    if (req.method === "PATCH" && url.pathname === "/api/settings") {
      await handleSettings(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/orders") {
      await handleCreateOrder(req, res);
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/admin/clear") {
      await handleClearOrders(req, res);
      return;
    }
    const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (req.method === "PATCH" && orderMatch) {
      await handleOrderUpdate(req, res, decodeURIComponent(orderMatch[1]));
      return;
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server error" });
  }
}

async function requestListener(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await serveStatic(req, res, url);
}

async function start() {
  await ensureDataDir();
  store = await loadStore();
  const server = http.createServer((req, res) => {
    requestListener(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Server error" });
      } else {
        res.destroy();
      }
    });
  });
  server.listen(PORT, HOST, () => {
    console.log(`Nasi lemak server listening on http://${HOST}:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
