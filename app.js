const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
const UNIT_PRICE_AED = 10;
const RECEIPT_PREPAY_DAYS = 7;
const EXPECTED_ACCOUNT_HOLDER = "MUHAMAD KHAIRULANWAR";
const EXPECTED_BANK_NAME = "ADIB";
const EXPECTED_ACCOUNT_NUMBER = "19407908";
const EXPECTED_IBAN = "AE550500000000019407908";
const PICKUP_ADDRESS = "817, Noya Viva, YN 07, Yas Island, Abu Dhabi";
const PICKUP_QUERY = encodeURIComponent(PICKUP_ADDRESS);
const DEFAULT_SETTINGS = {
  dailyLimit: 120,
  ordersOpen: true,
  orderDate: new Date().toISOString().slice(0, 10),
  accountHolder: EXPECTED_ACCOUNT_HOLDER,
  bankName: EXPECTED_BANK_NAME,
  iban: EXPECTED_IBAN,
  accountNumber: EXPECTED_ACCOUNT_NUMBER,
};

let state = createInitialState();
const receiptVerification = {
  status: "idle",
  accountMatched: false,
  dateMatched: false,
  transactionDate: "",
  normalizedTransactionDate: "",
  text: "",
};

const views = document.querySelectorAll(".view");
const tabButtons = document.querySelectorAll(".tab-button");
const adminAccessButton = document.getElementById("adminAccessButton");
const form = document.getElementById("orderForm");
const nameInput = document.getElementById("customerName");
const packInput = document.getElementById("packCount");
const pickupTimeInput = document.getElementById("pickupTime");
const decreaseButton = document.getElementById("decreasePacks");
const increaseButton = document.getElementById("increasePacks");
const paymentInputs = document.querySelectorAll('input[name="paymentMethod"]');
const bankDetails = document.getElementById("bankDetails");
const receiptUpload = document.getElementById("receiptUpload");
const receiptStatus = document.getElementById("receiptStatus");
const receiptChecks = document.getElementById("receiptChecks");
const receiptAccountCheck = document.getElementById("receiptAccountCheck");
const receiptDateCheck = document.getElementById("receiptDateCheck");
const summaryName = document.getElementById("summaryName");
const summaryPacks = document.getElementById("summaryPacks");
const summaryPickup = document.getElementById("summaryPickup");
const summaryTotal = document.getElementById("summaryTotal");
const summaryPayment = document.getElementById("summaryPayment");
const confirmation = document.getElementById("confirmation");
const confirmationText = document.getElementById("confirmationText");
const dailyLimit = document.getElementById("dailyLimit");
const remainingPacks = document.getElementById("remainingPacks");
const orderedPacks = document.getElementById("orderedPacks");
const orderStatus = document.getElementById("orderStatus");
const submitOrderButton = document.getElementById("submitOrderButton");
const settingsForm = document.getElementById("settingsForm");
const adminOrderDate = document.getElementById("adminOrderDate");
const adminPackLimit = document.getElementById("adminPackLimit");
const adminOrdersOpen = document.getElementById("adminOrdersOpen");
const adminTotalPacks = document.getElementById("adminTotalPacks");
const adminPaidPacks = document.getElementById("adminPaidPacks");
const adminUnpaidPacks = document.getElementById("adminUnpaidPacks");
const adminSalesTotal = document.getElementById("adminSalesTotal");
const weeklyOrderCount = document.getElementById("weeklyOrderCount");
const weeklyPackCount = document.getElementById("weeklyPackCount");
const weeklySalesTotal = document.getElementById("weeklySalesTotal");
const weeklyPaidTotal = document.getElementById("weeklyPaidTotal");
const weeklyUnpaidTotal = document.getElementById("weeklyUnpaidTotal");
const monthlyOrderCount = document.getElementById("monthlyOrderCount");
const monthlyPackCount = document.getElementById("monthlyPackCount");
const monthlySalesTotal = document.getElementById("monthlySalesTotal");
const monthlyPaidTotal = document.getElementById("monthlyPaidTotal");
const monthlyUnpaidTotal = document.getElementById("monthlyUnpaidTotal");
const clearOrdersButton = document.getElementById("clearOrdersButton");
const ordersList = document.getElementById("ordersList");
const orderCountLabel = document.getElementById("orderCountLabel");
const accountHolderValue = document.getElementById("accountHolderValue");
const bankNameValue = document.getElementById("bankNameValue");
const ibanValue = document.getElementById("ibanValue");
const accountValue = document.getElementById("accountValue");
const pickupAddress = document.getElementById("pickupAddress");
const googleMapsLink = document.getElementById("googleMapsLink");
const wazeLink = document.getElementById("wazeLink");
const appleMapsLink = document.getElementById("appleMapsLink");
const unitPrice = document.getElementById("unitPrice");
const receiptDialog = document.getElementById("receiptDialog");
const receiptDialogTitle = document.getElementById("receiptDialogTitle");
const receiptDialogImage = document.getElementById("receiptDialogImage");
const receiptDialogMeta = document.getElementById("receiptDialogMeta");

unitPrice.textContent = String(UNIT_PRICE_AED);
pickupAddress.textContent = PICKUP_ADDRESS;
googleMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${PICKUP_QUERY}`;
wazeLink.href = `https://waze.com/ul?q=${PICKUP_QUERY}&navigate=yes`;
appleMapsLink.href = `https://maps.apple.com/?q=${PICKUP_QUERY}`;

function createInitialState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    orders: [],
    summary: {
      orderCount: 0,
      totalPacks: 0,
      paidPacks: 0,
      unpaidPacks: 0,
      remainingPacks: DEFAULT_SETTINGS.dailyLimit,
    },
  };
}

function applyServerState(payload = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(payload.settings || {}) };
  settings.accountHolder = EXPECTED_ACCOUNT_HOLDER;
  settings.bankName = EXPECTED_BANK_NAME;
  settings.iban = EXPECTED_IBAN;
  settings.accountNumber = EXPECTED_ACCOUNT_NUMBER;
  state.settings = settings;
  state.orders = Array.isArray(payload.orders) ? payload.orders : [];
  state.summary = {
    orderCount: Number(payload.summary?.orderCount || state.orders.length || 0),
    totalPacks: Number(payload.summary?.totalPacks || 0),
    paidPacks: Number(payload.summary?.paidPacks || 0),
    unpaidPacks: Number(payload.summary?.unpaidPacks || 0),
    remainingPacks: Number(payload.summary?.remainingPacks || settings.dailyLimit),
  };
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(pathname, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error || `Request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function refreshState() {
  const payload = await apiRequest("/api/state", { method: "GET", headers: {} });
  applyServerState(payload);
  return payload;
}

function selectedPaymentMethod() {
  return document.querySelector('input[name="paymentMethod"]:checked')?.value || "Cash";
}

function receiptUploaded() {
  return receiptUpload.files && receiptUpload.files.length > 0;
}

function receiptFileValid() {
  const file = receiptUpload.files?.[0];
  return Boolean(file && file.size <= MAX_RECEIPT_BYTES);
}

function receiptVerified() {
  return receiptVerification.status === "valid";
}

function resetReceiptVerification() {
  receiptVerification.status = "idle";
  receiptVerification.accountMatched = false;
  receiptVerification.dateMatched = false;
  receiptVerification.transactionDate = "";
  receiptVerification.normalizedTransactionDate = "";
  receiptVerification.text = "";
}

function normalizeReceiptText(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function findTransactionDate(text) {
  const patterns = [
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/,
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/,
    /\b\d{1,2}\s(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s\d{4}\b/i,
  ];
  for (const pattern of patterns) {
    const match = String(text || "").match(pattern);
    if (match) return match[0];
  }
  return "";
}

function normalizeTransactionDate(value) {
  const text = String(value || "").trim();
  let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  match = text.match(/^(\d{1,2})\s([A-Z]+)\s(\d{4})$/i);
  if (match) {
    const [, day, monthName, year] = match;
    const months = {
      JAN: "01",
      FEB: "02",
      MAR: "03",
      APR: "04",
      MAY: "05",
      JUN: "06",
      JUL: "07",
      AUG: "08",
      SEP: "09",
      OCT: "10",
      NOV: "11",
      DEC: "12",
    };
    const month = months[monthName.slice(0, 3).toUpperCase()];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }

  return "";
}

function dateOnlyTimestamp(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  const [, year, month, day] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function receiptDateAllowed(receiptDate, orderDate) {
  const receiptTime = dateOnlyTimestamp(receiptDate);
  const orderTime = dateOnlyTimestamp(orderDate);
  if (!Number.isFinite(receiptTime) || !Number.isFinite(orderTime)) return false;
  const earliestAllowed = orderTime - RECEIPT_PREPAY_DAYS * 24 * 60 * 60 * 1000;
  return receiptTime >= earliestAllowed && receiptTime <= orderTime;
}

function evaluateReceiptText(text) {
  const compactText = normalizeReceiptText(text);
  const compactIban = normalizeReceiptText(EXPECTED_IBAN);
  const compactAccount = normalizeReceiptText(EXPECTED_ACCOUNT_NUMBER);
  const transactionDate = findTransactionDate(text);
  const normalizedTransactionDate = normalizeTransactionDate(transactionDate);
  const orderDate = state.settings.orderDate;
  return {
    accountMatched: compactText.includes(compactIban) || compactText.includes(compactAccount),
    dateMatched: receiptDateAllowed(normalizedTransactionDate, orderDate),
    transactionDate,
    normalizedTransactionDate,
  };
}

function renderReceiptVerification() {
  const bankTransfer = selectedPaymentMethod() === "Bank transfer";
  receiptChecks.hidden = !bankTransfer || !receiptUploaded();
  receiptAccountCheck.textContent = receiptVerification.accountMatched
    ? "Account/IBAN matched"
    : "Account/IBAN not verified";
  receiptDateCheck.textContent = receiptVerification.dateMatched
    ? `Transaction date accepted: ${receiptVerification.transactionDate}`
    : receiptVerification.transactionDate
      ? `Transaction date is outside the allowed preorder window: ${receiptVerification.transactionDate}`
      : "Transaction date not verified";
  receiptChecks.classList.toggle("ready", receiptVerified());
}

async function verifyReceiptImage() {
  resetReceiptVerification();
  renderReceiptVerification();
  updateSummary();

  const file = receiptUpload.files?.[0];
  if (!file || !receiptFileValid()) return;

  if (!window.Tesseract?.recognize) {
    receiptVerification.status = "invalid";
    receiptStatus.textContent = "Receipt reader is unavailable. Please check your internet connection and refresh.";
    renderReceiptVerification();
    renderSubmitState();
    return;
  }

  receiptVerification.status = "checking";
  receiptStatus.textContent = "Reading receipt. This may take a few seconds...";
  receiptStatus.classList.remove("ready");
  renderSubmitState();

  try {
    const result = await window.Tesseract.recognize(file, "eng");
    const text = result?.data?.text || "";
    const evaluation = evaluateReceiptText(text);
    receiptVerification.text = text;
    receiptVerification.accountMatched = evaluation.accountMatched;
    receiptVerification.dateMatched = evaluation.dateMatched;
    receiptVerification.transactionDate = evaluation.transactionDate;
    receiptVerification.normalizedTransactionDate = evaluation.normalizedTransactionDate;
    receiptVerification.status = evaluation.accountMatched && evaluation.dateMatched ? "valid" : "invalid";
  } catch (error) {
    receiptVerification.status = "invalid";
    receiptVerification.text = "";
    console.warn("Receipt OCR failed:", error);
  }

  updateSummary();
}

function readReceiptFile() {
  const file = receiptUpload.files?.[0];
  if (!file) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result || ""),
      });
    });
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function totalPacks() {
  return Number(state.summary?.totalPacks ?? state.orders.reduce((total, order) => total + Number(order.packs || 0), 0));
}

function paidPacks() {
  return Number(state.summary?.paidPacks ?? state.orders
    .filter((order) => order.paid)
    .reduce((total, order) => total + Number(order.packs || 0), 0));
}

function orderTotal(order) {
  return Number(order.totalAmount || Number(order.packs || 0) * UNIT_PRICE_AED);
}

function formatAed(amount) {
  return `AED ${Number(amount || 0).toLocaleString("en-AE")}`;
}

function remainingCapacity() {
  return Number(state.summary?.remainingPacks ?? Math.max(Number(state.settings.dailyLimit || 0) - totalPacks(), 0));
}

function clampPackCount(value) {
  const number = Number.parseInt(value, 10);
  const max = Math.max(remainingCapacity(), 1);
  if (!Number.isFinite(number)) return 1;
  return Math.min(Math.max(number, 1), max);
}

function selectedPackCount() {
  if (String(packInput.value).trim() === "") return 0;
  return clampPackCount(packInput.value);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function orderDateKey(order) {
  return order.orderDate || dateKey(order.createdAt);
}

function addDays(dateKeyValue, days) {
  const timestamp = dateOnlyTimestamp(dateKeyValue);
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function weekRangeFor(dateKeyValue) {
  const timestamp = dateOnlyTimestamp(dateKeyValue);
  if (!Number.isFinite(timestamp)) return { start: "", end: "" };
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const start = new Date(timestamp - daysSinceMonday * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { start, end: addDays(start, 6) };
}

function monthRangeFor(dateKeyValue) {
  const timestamp = dateOnlyTimestamp(dateKeyValue);
  if (!Number.isFinite(timestamp)) return { start: "", end: "" };
  const date = new Date(timestamp);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function summarizeOrders(startDate, endDate) {
  return state.orders.reduce((summary, order) => {
    const currentDate = orderDateKey(order);
    if (!currentDate || currentDate < startDate || currentDate > endDate) return summary;
    const total = orderTotal(order);
    summary.orders += 1;
    summary.packs += Number(order.packs || 0);
    summary.sales += total;
    if (order.paid) summary.paid += total;
    else summary.unpaid += total;
    return summary;
  }, { orders: 0, packs: 0, sales: 0, paid: 0, unpaid: 0 });
}

function updateTabs(targetId) {
  views.forEach((view) => view.classList.toggle("active", view.id === targetId));
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === targetId);
  });
  adminAccessButton.textContent = targetId === "adminView" ? "Customer" : "Admin";
}

function isEditingAdminSettings() {
  return settingsForm.contains(document.activeElement);
}

async function openAdminAccess() {
  if (document.getElementById("adminView").classList.contains("active")) {
    await apiRequest("/api/admin/logout", { method: "POST", headers: {} });
    updateTabs("customerView");
    await refreshState();
    render();
    return;
  }

  const password = window.prompt("Admin password");
  if (password === null) return;
  await apiRequest("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  updateTabs("adminView");
  await refreshState();
  render();
}

function updateSummary() {
  const name = nameInput.value.trim();
  const packs = selectedPackCount();
  const pickupTime = pickupTimeInput.value;
  const payment = selectedPaymentMethod();
  const bankTransfer = payment === "Bank transfer";

  if (packs > 0 && String(packs) !== packInput.value) {
    packInput.value = String(packs);
  }

  summaryName.textContent = name || "Not entered";
  summaryPacks.textContent = packs > 0 ? String(packs) : "Not selected";
  summaryPickup.textContent = pickupTime || "Not selected";
  summaryTotal.textContent = formatAed(packs * UNIT_PRICE_AED);
  summaryPayment.textContent = payment;
  bankDetails.hidden = !bankTransfer;
  receiptUpload.required = bankTransfer;
  if (bankTransfer && receiptUploaded() && !receiptFileValid()) {
    receiptStatus.textContent = "Receipt file is too large. Please upload a file under 4 MB.";
  } else if (bankTransfer && receiptVerification.status === "checking") {
    receiptStatus.textContent = "Reading receipt. This may take a few seconds...";
  } else if (bankTransfer && receiptUploaded() && receiptVerified()) {
    receiptStatus.textContent = `Receipt verified: ${receiptUpload.files[0].name}`;
  } else if (bankTransfer && receiptUploaded()) {
    receiptStatus.textContent = `Receipt must show the matching account/IBAN and a transaction date from up to ${RECEIPT_PREPAY_DAYS} days before ${state.settings.orderDate}, not after.`;
  } else {
    receiptStatus.textContent = "Receipt required before placing a bank transfer order.";
  }
  receiptStatus.classList.toggle("ready", bankTransfer && receiptVerified());
  renderReceiptVerification();
  renderSubmitState();
}

function renderCapacity() {
  const limit = Number(state.settings.dailyLimit || DEFAULT_SETTINGS.dailyLimit);
  const ordered = totalPacks();
  const remaining = remainingCapacity();
  const open = state.settings.ordersOpen && remaining > 0;

  dailyLimit.textContent = String(limit);
  packInput.max = String(Math.max(remaining, 1));
  remainingPacks.textContent = `${remaining} pack${remaining === 1 ? "" : "s"} left`;
  orderedPacks.textContent = `${ordered} / ${limit}`;
  orderStatus.textContent = open ? "Orders open" : remaining === 0 ? "Sold out" : "Orders closed";
  orderStatus.classList.toggle("closed", !open);
  renderSubmitState(open, remaining);
}

function renderSubmitState(open = state.settings.ordersOpen && remainingCapacity() > 0, remaining = remainingCapacity()) {
  const receiptNeeded = selectedPaymentMethod() === "Bank transfer";
  const invalidReceipt = receiptNeeded && (!receiptFileValid() || !receiptVerified());
  const checkingReceipt = receiptNeeded && receiptVerification.status === "checking";
  submitOrderButton.disabled = !open || invalidReceipt;
  if (!open) {
    submitOrderButton.textContent = remaining === 0 ? "Sold out" : "Orders closed";
  } else if (checkingReceipt) {
    submitOrderButton.textContent = "Reading receipt...";
  } else if (invalidReceipt) {
    submitOrderButton.textContent = "Verify receipt to place order";
  } else {
    submitOrderButton.textContent = "Place order";
  }
}

function renderSettings() {
  adminOrderDate.value = state.settings.orderDate;
  adminPackLimit.value = String(state.settings.dailyLimit);
  adminOrdersOpen.checked = Boolean(state.settings.ordersOpen);
  accountHolderValue.textContent = state.settings.accountHolder;
  bankNameValue.textContent = state.settings.bankName;
  ibanValue.textContent = state.settings.iban;
  accountValue.textContent = state.settings.accountNumber;
}

function renderAdminMetrics() {
  const paid = paidPacks();
  const total = totalPacks();
  adminTotalPacks.textContent = String(total);
  adminPaidPacks.textContent = String(paid);
  adminUnpaidPacks.textContent = String(total - paid);
  adminSalesTotal.textContent = formatAed(state.orders.reduce((sum, order) => sum + orderTotal(order), 0));
  const orderCount = Number(state.summary?.orderCount ?? state.orders.length);
  orderCountLabel.textContent = `${orderCount} order${orderCount === 1 ? "" : "s"}`;
}

function saveAdminSettings() {
  return apiRequest("/api/settings", {
    method: "PATCH",
    body: JSON.stringify({
      orderDate: adminOrderDate.value || DEFAULT_SETTINGS.orderDate,
      dailyLimit: Math.max(Number(adminPackLimit.value || DEFAULT_SETTINGS.dailyLimit), totalPacks()),
      ordersOpen: adminOrdersOpen.checked,
    }),
  }).then(refreshState).then(render);
}

function renderSalesReports() {
  const anchorDate = state.settings.orderDate || new Date().toISOString().slice(0, 10);
  const weekRange = weekRangeFor(anchorDate);
  const monthRange = monthRangeFor(anchorDate);
  const weekly = summarizeOrders(weekRange.start, weekRange.end);
  const monthly = summarizeOrders(monthRange.start, monthRange.end);

  weeklyOrderCount.textContent = String(weekly.orders);
  weeklyPackCount.textContent = String(weekly.packs);
  weeklySalesTotal.textContent = formatAed(weekly.sales);
  weeklyPaidTotal.textContent = formatAed(weekly.paid);
  weeklyUnpaidTotal.textContent = formatAed(weekly.unpaid);

  monthlyOrderCount.textContent = String(monthly.orders);
  monthlyPackCount.textContent = String(monthly.packs);
  monthlySalesTotal.textContent = formatAed(monthly.sales);
  monthlyPaidTotal.textContent = formatAed(monthly.paid);
  monthlyUnpaidTotal.textContent = formatAed(monthly.unpaid);
}

function pickupSortValue(order) {
  const match = String(order.pickupTime || "").match(/^(\d{1,2}):(\d{2})\s(AM|PM)/i);
  if (!match) return 9999;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function renderOrders() {
  if (!state.orders.length) {
    ordersList.innerHTML = `<div class="empty-state">No orders yet.</div>`;
    return;
  }

  const sortedOrders = [...state.orders].sort((a, b) => {
    const timeDiff = pickupSortValue(a) - pickupSortValue(b);
    if (timeDiff) return timeDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const groups = sortedOrders.reduce((result, order) => {
    const key = order.pickupTime || "Not selected";
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(order);
    return result;
  }, new Map());

  ordersList.innerHTML = [...groups.entries()].map(([pickupTime, orders]) => `
    <section class="pickup-order-group">
      <h3>${escapeHtml(pickupTime)}</h3>
      ${orders.map((order) => `
    <article class="order-card" data-order-id="${order.id}">
      <div>
        <strong>${escapeHtml(order.name)}</strong>
        <p>${order.packs} pack${order.packs === 1 ? "" : "s"} · ${escapeHtml(order.paymentMethod)} · ${formatAed(orderTotal(order))}</p>
        <p>Pickup: ${escapeHtml(order.pickupTime || "Not selected")}</p>
        ${order.receipt?.transactionDate ? `<p>Receipt date: ${escapeHtml(order.receipt.transactionDate)}</p>` : ""}
        ${order.receipt?.dataUrl ? `<button class="receipt-link" type="button" data-receipt-open>Open receipt</button>` : ""}
        <small>${formatTime(order.createdAt)}</small>
      </div>
      <div class="order-actions">
        <label class="paid-toggle">
          <input type="checkbox" ${order.paid ? "checked" : ""} data-paid-toggle>
          <span>${order.paid ? "Paid" : "Unpaid"}</span>
        </label>
        <label class="taken-toggle">
          <input type="checkbox" ${order.taken ? "checked" : ""} data-taken-toggle>
          <span>${order.taken ? "Taken" : "Not taken"}</span>
        </label>
      </div>
    </article>
      `).join("")}
    </section>
  `).join("");
}

function render() {
  renderCapacity();
  if (!isEditingAdminSettings()) renderSettings();
  renderAdminMetrics();
  renderSalesReports();
  renderOrders();
  updateSummary();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function closeReceiptPreview() {
  if (receiptDialog?.open && typeof receiptDialog.close === "function") {
    receiptDialog.close();
  }
  if (receiptDialogImage) receiptDialogImage.src = "";
  if (receiptDialogTitle) receiptDialogTitle.textContent = "Receipt preview";
  if (receiptDialogMeta) receiptDialogMeta.textContent = "";
}

function openReceiptPreview(order) {
  const receipt = order?.receipt;
  const dataUrl = String(receipt?.dataUrl || "");
  if (!dataUrl) return;

  if (receiptDialogTitle) {
    receiptDialogTitle.textContent = `Receipt preview - ${order.name || "Order"}`;
  }
  if (receiptDialogImage) {
    receiptDialogImage.src = dataUrl;
    receiptDialogImage.alt = `Receipt for ${order.name || "order"}`;
  }
  if (receiptDialogMeta) {
    const meta = [receipt?.name, receipt?.type, receipt?.size ? `${Math.round(Number(receipt.size) / 1024)} KB` : ""]
      .filter(Boolean)
      .join(" · ");
    receiptDialogMeta.textContent = meta;
  }

  if (receiptDialog?.showModal && !receiptDialog.open) {
    receiptDialog.showModal();
    return;
  }

  if (receiptDialog) {
    receiptDialog.open = true;
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => updateTabs(button.dataset.view));
});

adminAccessButton.addEventListener("click", () => {
  openAdminAccess().catch((error) => window.alert(error.message));
});

nameInput.addEventListener("input", updateSummary);
packInput.addEventListener("input", updateSummary);
pickupTimeInput.addEventListener("change", updateSummary);

decreaseButton.addEventListener("click", () => {
  const current = selectedPackCount();
  packInput.value = current <= 1 ? "" : String(current - 1);
  updateSummary();
});

increaseButton.addEventListener("click", () => {
  const current = selectedPackCount();
  packInput.value = String(clampPackCount(current + 1));
  updateSummary();
});

paymentInputs.forEach((input) => {
  input.addEventListener("change", updateSummary);
});

adminOrdersOpen.addEventListener("change", () => {
  state.settings.ordersOpen = adminOrdersOpen.checked;
  saveAdminSettings().catch((error) => window.alert(error.message));
});

receiptUpload.addEventListener("change", verifyReceiptImage);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  updateSummary();

  try {
    const available = remainingCapacity();
    if (!state.settings.ordersOpen || available <= 0) return;
    if (!form.reportValidity()) return;
    if (selectedPaymentMethod() === "Bank transfer" && (!receiptFileValid() || !receiptVerified())) {
      receiptStatus.textContent = "Please upload a receipt that verifies the account/IBAN and transaction date first.";
      receiptStatus.classList.remove("ready");
      return;
    }

    const packs = clampPackCount(packInput.value);
    if (packs > available) {
      confirmationText.textContent = `Only ${available} pack${available === 1 ? "" : "s"} left. Please reduce the quantity.`;
      confirmation.hidden = false;
      return;
    }

    const paymentMethod = selectedPaymentMethod();
    let receipt = null;
    if (paymentMethod === "Bank transfer") {
      receipt = await readReceiptFile();
      receipt.verified = true;
      receipt.accountMatched = receiptVerification.accountMatched;
      receipt.dateMatched = receiptVerification.dateMatched;
      receipt.transactionDate = receiptVerification.transactionDate;
      receipt.normalizedTransactionDate = receiptVerification.normalizedTransactionDate;
      receipt.ocrText = receiptVerification.text;
    }

    const order = {
      name: nameInput.value.trim(),
      packs,
      pickupTime: pickupTimeInput.value,
      paymentMethod,
      receipt,
    };

    await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify(order),
    });
    await refreshState();

    const paymentNote = paymentMethod === "Bank transfer"
      ? "Payment receipt received."
      : "Please prepare cash payment.";
    confirmationText.textContent = `${order.name}, your order is ${packs} pack${packs === 1 ? "" : "s"} of nasi lemak. Total: ${formatAed(packs * UNIT_PRICE_AED)}. Pickup time: ${order.pickupTime}. Payment method: ${order.paymentMethod}. ${paymentNote} Pickup is self pickup at the location below.`;
    confirmation.hidden = false;
    form.reset();
    resetReceiptVerification();
    render();
  } catch (error) {
    window.alert(error.message);
  }
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveAdminSettings().catch((error) => window.alert(error.message));
});

ordersList.addEventListener("change", (event) => {
  const paidCheckbox = event.target.closest("[data-paid-toggle]");
  const takenCheckbox = event.target.closest("[data-taken-toggle]");
  if (!paidCheckbox && !takenCheckbox) return;
  const card = event.target.closest("[data-order-id]");
  const order = state.orders.find((item) => item.id === card?.dataset.orderId);
  if (!order) return;
  apiRequest(`/api/orders/${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      paid: paidCheckbox ? paidCheckbox.checked : undefined,
      taken: takenCheckbox ? takenCheckbox.checked : undefined,
    }),
  }).then(refreshState).then(render).catch((error) => window.alert(error.message));
});

ordersList.addEventListener("click", (event) => {
  const receiptButton = event.target.closest("[data-receipt-open]");
  if (!receiptButton) return;
  const card = event.target.closest("[data-order-id]");
  const order = state.orders.find((item) => item.id === card?.dataset.orderId);
  if (!order?.receipt?.dataUrl) return;
  openReceiptPreview(order);
});

receiptDialog?.addEventListener("click", (event) => {
  if (event.target === receiptDialog) closeReceiptPreview();
});

receiptDialog?.addEventListener("close", closeReceiptPreview);

clearOrdersButton.addEventListener("click", () => {
  const confirmed = window.confirm("Clear all orders for this browser?");
  if (!confirmed) return;
  const password = window.prompt("Enter admin password to clear orders");
  if (password === null) return;
  apiRequest("/api/admin/clear", {
    method: "POST",
    body: JSON.stringify({ password }),
  }).then(refreshState).then(render).catch((error) => window.alert(error.message));
});

(async () => {
  try {
    await refreshState();
  } catch (error) {
    console.warn("Using local defaults until the server is available:", error);
  }
  render();
})();
