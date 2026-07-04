import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

const [modeArg, accountArg, coinArg] = process.argv.slice(2);
const USERNAME = "shiroxx";
const PROFILES_DIR = path.resolve("./profiles");
const COINS_FILE = path.resolve("./coins.json");
const MINIMUMS_FILE = path.resolve("./minimums.json");
const APP = {
  name: "FP Auto Transfer Bot",
  version: "1.1.0",
  author: "Lucifirst",
  website: "https://faucetpay.io/transfer",
};
const color = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};
const KNOWN_COINS = [
  "BTC", "ETH", "DOGE", "LTC", "TRX", "USDT", "BCH", "DASH", "DGB", "FEY",
  "BNB", "SOL", "XRP", "ADA", "MATIC", "TON", "XLM", "ZEC", "ETC", "USDC",
  "TARA", "TRUMP", "PEPE", "FLT",
];

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function paint(value, name) {
  return `${color[name]}${value}${color.reset}`;
}

function line(title = "") {
  if (!title) {
    console.log(paint("=".repeat(60), "cyan"));
    return;
  }

  const text = ` ${title} `;
  const left = Math.max(0, Math.floor((60 - text.length) / 2));
  const right = Math.max(0, 60 - text.length - left);
  console.log(paint(`${"=".repeat(left)}${text}${"=".repeat(right)}`, "cyan"));
}

function section(title) {
  console.log("");
  line(title);
}

function ok(text) {
  console.log(`${paint("OK", "green")}   ${text}`);
}

function okStatus(text) {
  ok(text);
}

function skip(text) {
  console.log(`${paint("SKIP", "yellow")} ${text}`);
}

function fail(text) {
  console.log(`${paint("FAIL", "red")} ${text}`);
}

function table(rows, columns) {
  const widths = columns.map((column) => Math.max(
    column.title.length,
    ...rows.map((row) => String(row[column.key] ?? "").length),
  ));
  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const formatRow = (row) => `|${columns.map((column, i) => ` ${String(row[column.key] ?? "").padEnd(widths[i])} `).join("|")}|`;

  console.log(paint(border, "cyan"));
  console.log(paint(formatRow(Object.fromEntries(columns.map((column) => [column.key, column.title]))), "cyan"));
  console.log(paint(border, "cyan"));
  rows.forEach((row) => console.log(formatRow(row)));
  console.log(paint(border, "cyan"));
}

function fixedTable(columns) {
  const border = `+${columns.map((column) => "-".repeat(column.width + 2)).join("+")}+`;
  const row = (data) => `|${columns.map((column) => ` ${String(data[column.key] ?? "").slice(0, column.width).padEnd(column.width)} `).join("|")}|`;

  console.log(paint(border, "cyan"));
  console.log(paint(row(Object.fromEntries(columns.map((column) => [column.key, column.title]))), "cyan"));
  console.log(paint(border, "cyan"));

  return {
    row: (data) => console.log(row(data)),
    end: () => console.log(paint(border, "cyan")),
  };
}

async function withSpinner(label, task) {
  const frames = ["|", "/", "-", "\\"];
  let i = 0;
  output.write(`${frames[i]} ${label}`);
  const timer = setInterval(() => {
    i = (i + 1) % frames.length;
    output.write(`\r${frames[i]} ${label}`);
  }, 120);

  try {
    return await task();
  } finally {
    clearInterval(timer);
    output.write(`\r${" ".repeat(label.length + 4)}\r`);
  }
}

function findChrome() {
  const executablePath = chromePaths.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("Chrome not found. Set executablePath manually.");
  return executablePath;
}

function listAccounts() {
  if (!fs.existsSync(PROFILES_DIR)) return [];
  return fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function loadSavedCoins() {
  try {
    const data = JSON.parse(fs.readFileSync(COINS_FILE, "utf8"));
    return Array.isArray(data.coins) && data.coins.length ? data.coins : KNOWN_COINS;
  } catch {
    return KNOWN_COINS;
  }
}

function saveCoins(coins) {
  fs.writeFileSync(COINS_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), coins }, null, 2));
}

function loadMinimums() {
  if (!fs.existsSync(MINIMUMS_FILE)) return {};

  try {
    return JSON.parse(fs.readFileSync(MINIMUMS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function ensureMinimumsFile() {
  if (fs.existsSync(MINIMUMS_FILE) && fs.statSync(MINIMUMS_FILE).size > 0) return;
  const minimums = Object.fromEntries(KNOWN_COINS.map((coin) => [coin, null]));
  fs.writeFileSync(MINIMUMS_FILE, JSON.stringify({
    note: "Isi minimum transfer resmi per coin kalau punya. null = pakai deteksi tombol FaucetPay saat runtime.",
    minimums,
  }, null, 2));
}

async function launchAccount(account) {
  const profilePath = path.join(PROFILES_DIR, account);
  fs.mkdirSync(profilePath, { recursive: true });

  console.log(`${paint("Chrome", "dim")}  ${findChrome()}`);
  console.log(`${paint("Profile", "dim")} ${profilePath}`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: findChrome(),
    userDataDir: profilePath,
    defaultViewport: null,
    args: ["--start-maximized", "--no-first-run", "--no-default-browser-check"],
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  page.setDefaultTimeout(60000);
  return { browser, page };
}

async function openTransfer(page) {
  await page.goto(APP.website, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(2500);
}

async function openFaucetPay(page) {
  await page.goto("https://faucetpay.io/", { waitUntil: "domcontentloaded", timeout: 60000 });
  console.log("Browser ready. Login manual.");
  await new Promise((resolve) => page.browser().on("disconnected", resolve));
}

function cleanCoin(text) {
  const upper = String(text || "").toUpperCase().replace(/\s+/g, " ").trim();
  return KNOWN_COINS.find((coin) => upper.includes(coin)) || "";
}

function readAmountFromText(text) {
  const numbers = String(text || "").match(/\d+(?:\.\d+)?/g) || [];
  return Number(numbers.at(-1) || 0) || 0;
}

async function openCoinDropdown(page) {
  return await page.evaluate((knownCoins) => {
    const candidates = [...document.querySelectorAll("button, div, span")]
      .filter((el) => {
        const text = (el.innerText || "").trim().toUpperCase();
        const looksLikeCoinField = /\d/.test(text) || text.includes("COIN");
        return text && text.length <= 100 && looksLikeCoinField && knownCoins.some((coin) => text.includes(coin));
      });

    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const av = ar.width > 0 && ar.height > 0;
      const bv = br.width > 0 && br.height > 0;
      if (av !== bv) return av ? -1 : 1;
      const ad = /\d/.test(a.innerText || "");
      const bd = /\d/.test(b.innerText || "");
      if (ad !== bd) return ad ? -1 : 1;
      return (a.innerText || "").length - (b.innerText || "").length;
    });

    const el = candidates[0];
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center" });
    el.click();
    return true;
  }, KNOWN_COINS);
}

async function getCoinList(page) {
  const nativeCoins = await page.evaluate((knownCoins) => {
    const coins = [];
    for (const select of document.querySelectorAll("select")) {
      for (const option of select.options) {
        const text = `${option.textContent || ""} ${option.value || ""}`.toUpperCase();
        const coin = knownCoins.find((item) => text.includes(item));
        if (coin) coins.push(coin);
      }
    }
    return [...new Set(coins)];
  }, KNOWN_COINS);

  if (nativeCoins.length) return nativeCoins;

  await openCoinDropdown(page);
  await sleep(800);

  const customCoins = await page.evaluate((knownCoins) => {
    const coins = [...document.querySelectorAll("button, div, span, li")]
      .map((el) => (el.innerText || "").trim().toUpperCase())
      .filter((text) => text && text.length <= 100)
      .map((text) => knownCoins.find((coin) => text.includes(coin)))
      .filter(Boolean);
    return [...new Set(coins)];
  }, KNOWN_COINS);

  await page.keyboard.press("Escape").catch(() => {});
  return customCoins;
}

async function getCoinBalancesFromDropdown(page) {
  const nativeItems = await page.evaluate((knownCoins) => {
    const items = [];
    for (const select of document.querySelectorAll("select")) {
      for (const option of select.options) {
        const text = `${option.textContent || ""} ${option.value || ""}`.replace(/\s+/g, " ").trim();
        const upper = text.toUpperCase();
        const coin = knownCoins.find((item) => upper.includes(item));
        if (coin && /\d/.test(text)) items.push({ coin, text });
      }
    }
    return items;
  }, KNOWN_COINS);

  if (nativeItems.length) {
    return nativeItems.map((item) => ({ ...item, amount: readAmountFromText(item.text) }));
  }

  await openCoinDropdown(page);
  await sleep(800);

  const customItems = await page.evaluate((knownCoins) => {
    const items = [...document.querySelectorAll("button, div, span, li")]
      .map((el) => (el.innerText || "").replace(/\s+/g, " ").trim())
      .filter((text) => text && text.length <= 150 && /\d/.test(text))
      .map((text) => {
        const coin = knownCoins.find((item) => text.toUpperCase().includes(item));
        return coin ? { coin, text } : null;
      })
      .filter(Boolean);

    return items;
  }, KNOWN_COINS);

  await page.keyboard.press("Escape").catch(() => {});

  const seen = new Set();
  return customItems
    .map((item) => ({ ...item, amount: readAmountFromText(item.text) }))
    .filter((item) => {
      if (seen.has(item.coin)) return false;
      seen.add(item.coin);
      return true;
    });
}

async function clickByText(page, text) {
  return await page.evaluate((text) => {
    const target = text.toLowerCase();
    const candidates = [...document.querySelectorAll("button, div, span, li")]
      .filter((el) => (el.innerText || "").trim().toLowerCase().includes(target));

    candidates.sort((a, b) => (a.innerText || "").length - (b.innerText || "").length);
    const el = candidates[0];
    if (!el) return false;

    el.scrollIntoView({ block: "center", inline: "center" });
    el.click();
    return true;
  }, text);
}

async function selectCoin(page, coin) {
  const nativeSelected = await page.evaluate((coin) => {
    for (const select of document.querySelectorAll("select")) {
      const option = [...select.options].find((item) =>
        `${item.textContent || ""} ${item.value || ""}`.toUpperCase().includes(coin)
      );

      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }

    return false;
  }, coin);

  if (nativeSelected) return true;

  if (!await openCoinDropdown(page)) return false;
  await sleep(800);
  return await clickByText(page, coin);
}

async function clickMax(page) {
  const clicked = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("button")];
    const btn = buttons.find((b) => (b.innerText || "").trim().toLowerCase() === "max");
    if (!btn) return false;
    btn.scrollIntoView({ block: "center", inline: "center" });
    btn.click();
    return true;
  });

  await sleep(1000);
  return clicked;
}

async function fillUsername(page) {
  const ok = await page.evaluate((username) => {
    const inputs = [...document.querySelectorAll("input[type='text']")]
      .filter((input) => {
        const r = input.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

    // ponytail: FaucetPay currently renders amount first, username second; update when UI changes.
    const input = inputs[1];
    if (!input) return false;

    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    input.scrollIntoView({ block: "center", inline: "center" });
    input.focus();
    setValue.call(input, username);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    return true;
  }, USERNAME);

  await sleep(1000);
  return ok;
}

async function readAmount(page) {
  const value = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input[type='text']")]
      .filter((input) => {
        const r = input.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    return inputs[0]?.value || "";
  });

  return Number(String(value).replace(/[^0-9.]/g, "")) || 0;
}

async function transferReady(page) {
  return await page.evaluate(() => {
    const button = [...document.querySelectorAll("button, input[type='submit']")]
      .find((el) => (el.innerText || el.value || "").toLowerCase().includes("transfer funds"));
    return Boolean(button && !button.disabled);
  });
}

async function clickTransferFunds(page) {
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button, input[type='submit']")]
      .find((el) => (el.innerText || el.value || "").toLowerCase().includes("transfer funds"));
    if (!button || button.disabled) return false;
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    return true;
  });

  await sleep(3000);
  return clicked;
}

async function prepareCoin(page, coin) {
  if (!await selectCoin(page, coin)) return { coin, ok: false, reason: "coin not found" };
  await sleep(1000);
  if (!await clickMax(page)) return { coin, ok: false, reason: "MAX not found" };
  if (!await fillUsername(page)) return { coin, ok: false, reason: "username input not found" };

  const amount = await readAmount(page);
  const ready = await transferReady(page);
  const configuredMinimum = loadMinimums().minimums?.[coin];
  const meetsConfiguredMinimum = configuredMinimum == null || amount >= Number(configuredMinimum);
  const ok = amount > 0 && ready && meetsConfiguredMinimum;
  const reason = amount <= 0
    ? "no balance"
    : !meetsConfiguredMinimum
      ? `below configured minimum ${configuredMinimum}`
      : ready
        ? ""
        : "below minimum or disabled";

  return { coin, amount, ready, ok, reason, minimum: configuredMinimum ?? "runtime" };
}

async function scanTransferableCoins(page, requestedCoins) {
  ensureMinimumsFile();
  if (!requestedCoins.length) {
    const minimums = loadMinimums().minimums || {};
    const items = await getCoinBalancesFromDropdown(page);
    const transferable = [];
    const rows = [];

    section("BALANCE SNAPSHOT");

    for (const item of items) {
      const minimum = Number(minimums[item.coin] ?? 0.000001);
      const passed = item.amount >= minimum;
      rows.push({ coin: item.coin, amount: item.amount, minimum, status: passed ? "OK" : "SKIP" });
      if (passed) transferable.push({ coin: item.coin, amount: item.amount });
    }

    table(rows, [
      { key: "coin", title: "COIN" },
      { key: "amount", title: "AMOUNT" },
      { key: "minimum", title: "MINIMUM" },
      { key: "status", title: "STATUS" },
    ]);

    return transferable;
  }

  const coins = requestedCoins;
  const transferable = [];

  for (const coin of coins) {
    const result = await prepareCoin(page, coin);
    if (result.ok) okStatus(`${coin.padEnd(6)} amount=${result.amount} min=${result.minimum}`);
    else skip(`${coin.padEnd(6)} ${result.reason}`);
    if (result.ok) transferable.push({ coin, amount: result.amount });
  }

  return transferable;
}

async function scanCoins(account) {
  const { browser, page } = await launchAccount(account);
  try {
    section(`SCAN ${account}`);
    await openTransfer(page);
    const items = await getCoinBalancesFromDropdown(page);
    const coins = items.map((item) => item.coin);
    saveCoins(coins);
    ok(`Coins found: ${coins.join(", ") || "none"}`);
    section("DROPDOWN DATA");
    table(items.map((item) => ({ coin: item.coin, amount: item.amount, source: item.text })), [
      { key: "coin", title: "COIN" },
      { key: "amount", title: "AMOUNT" },
      { key: "source", title: "SOURCE" },
    ]);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function transferAccount(account, requestedCoins) {
  const { browser, page } = await launchAccount(account);

  try {
    section(`ACCOUNT ${account}`);
    await openTransfer(page);
    const plan = await scanTransferableCoins(page, requestedCoins);
    section("TRANSFER PLAN");
    if (plan.length) ok(plan.map((item) => `${item.coin}:${item.amount}`).join("  "));
    else skip("No coin reaches minimum.");

    section("SEND RESULTS");
    const sendTable = fixedTable([
      { key: "coin", title: "COIN", width: 6 },
      { key: "amount", title: "AMOUNT", width: 14 },
      { key: "status", title: "STATUS", width: 8 },
      { key: "note", title: "NOTE", width: 28 },
    ]);

    for (const item of plan) {
      const result = await withSpinner(`Loading ${item.coin}...`, async () => {
        await openTransfer(page);
        const prepared = await prepareCoin(page, item.coin);
        if (!prepared.ok) return { coin: item.coin, amount: prepared.amount || 0, status: "SKIP", note: prepared.reason };

        const sent = await clickTransferFunds(page);
        return {
          coin: item.coin,
          amount: prepared.amount,
          status: sent ? "SENT" : "FAIL",
          note: sent ? "Transfer Funds clicked" : "button disabled/not found",
        };
      });

      sendTable.row(result);
    }

    sendTable.end();
  } finally {
    await browser.close().catch(() => {});
  }
}

function printBanner() {
  console.clear();
  line();
  console.log(`${paint("  " + APP.name, "bold")}`);
  line();
  console.log(`  ${paint("Version", "cyan")} : ${APP.version}`);
  console.log(`  ${paint("Author ", "cyan")} : ${APP.author}`);
  console.log(`  ${paint("Website", "cyan")} : ${APP.website}`);
  console.log(`  ${paint("Target ", "cyan")} : auto transfer saldo ke ${paint(USERNAME, "green")}`);
  line();
  console.log("");
}

function printAccounts() {
  const accounts = listAccounts();
  console.log(`${paint("Profiles", "cyan")}: ${accounts.length ? accounts.join(", ") : "belum ada"}`);
}

function printChoiceList(title, items, allowAll = false) {
  console.log(paint(title, "cyan"));
  items.forEach((item, index) => {
    console.log(`  ${paint(String(index + 1).padStart(2, "0"), "yellow")}. ${item.label}`);
  });
  if (allowAll) console.log(`  ${paint("all", "yellow")} = pilih semua`);
  console.log("");
}

async function chooseFromList(rl, title, items, allowAll = false) {
  while (true) {
    printChoiceList(title, items, allowAll);
    const answer = (await rl.question(paint("Pilih nomor: ", "green"))).trim().toLowerCase();
    const index = Number(answer) - 1;
    if (Number.isInteger(index) && items[index]) return items[index].value;
    if (allowAll && answer === "all") return "all";
    const byValue = items.find((item) => String(item.value).toLowerCase() === answer);
    if (byValue) return byValue.value;
    console.log(paint("Pilihan tidak valid.\n", "red"));
  }
}

async function askMenu() {
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      printBanner();
      printAccounts();

      const mode = await chooseFromList(rl, "Menu", [
        { label: "Open FaucetPay / login manual", value: "open" },
        { label: "Scan coin dropdown akun", value: "scan" },
        { label: "Auto transfer", value: "transfer" },
        { label: "Info script", value: "info" },
        { label: "Exit", value: "exit" },
      ]);

      if (mode === "exit") return {};

      if (mode === "info") {
        section("INFO");
        console.log(`  ${paint("Account", "cyan")} : pilih profile atau all`);
        console.log(`  ${paint("Coin", "cyan")}    : pilih coin atau all`);
        console.log(`  ${paint("All coin", "cyan")} : scan dropdown sekali, lalu kirim yang saldo >= minimum`);
        console.log(`  ${paint("All akun", "cyan")} : jalan berurutan dari profile pertama sampai terakhir`);
        console.log(`  ${paint("Safety", "cyan")}  : OTP/captcha/konfirmasi tambahan tetap manual jika muncul\n`);
        await rl.question(paint("Tekan Enter untuk kembali...", "green"));
        continue;
      }

      const accountItems = listAccounts().map((account) => ({ label: account, value: account }));
      const account = await chooseFromList(rl, "Pilih profile", accountItems, mode === "transfer");
      const coin = mode === "transfer" ? await chooseFromList(rl, "Pilih coin", [
        ...loadSavedCoins().map((coin) => ({ label: coin, value: coin })),
      ], true) : "all";
      return { mode, account, coin };
    }
  } finally {
    rl.close();
  }
}

async function resolveInput() {
  if (!modeArg) return await askMenu();
  if (!["open", "scan", "transfer"].includes(modeArg) || !accountArg) {
    console.error("Usage: node fp.js <open|scan|transfer> <akun|all> [coin|all]");
    process.exit(1);
  }
  return { mode: modeArg, account: accountArg, coin: coinArg || "all" };
}

function expandAccounts(account) {
  const accounts = listAccounts();
  if (account === "all") return accounts;
  if (!accounts.includes(account)) throw new Error(`Profile not found: ${account}`);
  return [account];
}

const selected = await resolveInput();
if (!selected.mode) process.exit(0);

const accounts = expandAccounts(selected.account);
const coins = selected.coin === "all" ? [] : [selected.coin.toUpperCase()];

printBanner();
console.log("Mode:", selected.mode);
console.log("Accounts:", accounts.join(", "));
console.log("Coins:", selected.coin || "all");

if (selected.mode === "open") {
  const { page } = await launchAccount(accounts[0]);
  await openFaucetPay(page);
} else if (selected.mode === "scan") {
  await scanCoins(accounts[0]);
  } else {
  ensureMinimumsFile();
  for (const account of accounts) {
    await transferAccount(account, coins);
  }
}
