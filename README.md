# Auto Send Faucetpay

Auto Send Faucetpay is a local Puppeteer script for managing FaucetPay transfer flow from saved Chrome profiles. It can scan available coin balances from the FaucetPay transfer dropdown, filter coins by minimum send amount, and send eligible balances to a target FaucetPay username.

> Built for personal local automation. Keep your browser profiles private.

## Showcase

```text
============================================================
  FP Auto Transfer Bot
============================================================
  Version : 1.1.0
  Author  : Lucifirst
  Website : https://faucetpay.io/transfer
  Target  : auto transfer saldo ke shiroxx
============================================================

Menu
  01. Open FaucetPay / login manual
  02. Scan coin dropdown akun
  03. Auto transfer
  04. Info script
  05. Exit
```

Balance snapshot:

```text
==================== BALANCE SNAPSHOT ======================
+------+------------+----------+--------+
| COIN | AMOUNT     | MINIMUM  | STATUS |
+------+------------+----------+--------+
| ETH  | 0.00000175 | 0.000001 | OK     |
| BTC  | 1.7e-7     | 0.000001 | SKIP   |
| LTC  | 0.00006128 | 0.000001 | OK     |
+------+------------+----------+--------+
```

Send result:

```text
====================== SEND RESULTS ========================
+------+------------+--------+------------------------+
| COIN | AMOUNT     | STATUS | NOTE                   |
+------+------------+--------+------------------------+
| ETH  | 0.00000175 | SENT   | Transfer Funds clicked |
| LTC  | 0.00006128 | SENT   | Transfer Funds clicked |
+------+------------+--------+------------------------+
```

## Features

- Interactive terminal menu with color output.
- Uses separate Chrome profiles from `profiles/<account>`.
- Opens FaucetPay for manual login/session setup.
- Scans FaucetPay transfer dropdown once and reads all coin balances.
- Supports single coin or `all` coins.
- Supports single account or `all` accounts.
- Runs accounts sequentially from first profile to last profile.
- Filters transfer plan using `minimums.json`.
- Keeps transfer result logs in clean table format.
- Does not bypass FaucetPay OTP, captcha, or extra confirmation screens.

## Requirements

- Node.js 18 or newer.
- Google Chrome installed.
- FaucetPay account already logged in inside script-managed Chrome profile.

## Installation

Clone or download this project, then install dependencies:

```bash
npm install
```

Check syntax:

```bash
npm test
```

## Usage

Start interactive menu:

```bash
npm start
```

Open FaucetPay for login/manual session setup:

```bash
node fp.js open akun1
```

Scan available coins and balances from one account:

```bash
node fp.js scan akun1
```

Transfer one coin from one account:

```bash
node fp.js transfer akun1 DOGE
```

Transfer all eligible coins from one account:

```bash
node fp.js transfer akun1 all
```

Transfer all eligible coins from all profiles:

```bash
node fp.js transfer all all
```

## Profiles

Each account uses its own Chrome profile folder:

```text
profiles/
  akun1/
  akun2/
```

To add another account:

1. Run `node fp.js open akun3`.
2. Login to FaucetPay manually in the opened Chrome window.
3. Close Chrome.
4. Run transfer or scan using `akun3`.

## Coin Minimums

Minimum send values live in `minimums.json`.

Current default:

```json
{
  "minimums": {
    "DOGE": 0.000001,
    "BTC": 0.000001,
    "ETH": 0.000001
  }
}
```

All listed coins can use `0.000001` if that is FaucetPay's current minimum for your account.

## Supported Coins

Known coin list currently includes:

```text
BTC, ETH, DOGE, LTC, TRX, USDT, BCH, DASH, DGB, FEY,
BNB, SOL, XRP, ADA, MATIC, TON, XLM, ZEC, ETC, USDC,
TARA, TRUMP, PEPE, FLT
```

The script also saves scanned dropdown output into `coins.json`.

## Safety Notes

Do not upload these folders/files:

- `profiles/`
- `node_modules/`
- any exported browser data
- any file containing API keys, cookies, passwords, or session tokens

`profiles/` can contain active login cookies. Treat it like a password.



## License

ISC
