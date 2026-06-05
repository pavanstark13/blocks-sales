# How to Run Your Blocks Sales Manager

## Option 1: Run on your computer (recommended for daily use)

### First time setup
```bash
# 1. Clone the repo
git clone https://github.com/pavanstark13/blocks-sales.git
cd blocks-sales

# 2. Switch to the working branch
git checkout claude/exciting-lovelace-I7vDH

# 3. Install dependencies
npm install

# 4. The database is already included (data/sales.db has all your Excel data)
#    Skip this if data/sales.db already exists.
#    Only run if you want to re-migrate from the Excel file:
# python3 scripts/migrate.py

# 5. Start the app
npm run dev
```

### Open in browser
Go to: http://localhost:3000

### Every day after that
```bash
cd blocks-sales
npm run dev
```
Then open http://localhost:3000

---

## Option 2: Deploy to Vercel (access from anywhere / phone)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to your Vercel account
vercel login

# Deploy (from the project folder)
vercel --prod
```

**Important:** Vercel's serverless functions have a read-only filesystem.
To support write operations (adding new sales) on Vercel, the database
needs to be migrated to a cloud DB like Turso or Neon. Ask for help if needed.

---

## How to add new sales

1. Open the app → click **"+ New Sale"** tab
2. Fill in: Date, Customer name, Address, Phone, Block size, Quantity, Rate
3. Enter any advance received
4. Click **Save**

The balance and total are calculated automatically as you type.

---

## How to mark a payment received

**Option A - Outstanding tab:**
Go to **Outstanding** → find the customer → type the amount paid → click **Pay**
The balance updates instantly and closes the order if fully paid.

**Option B - Sales Log tab:**
Find the sale → click **Edit** → update Advance and Status → Save

---

## How to search

The search box in **Sales Log** matches:
- Customer name
- Address / village name  
- Phone number

Just type any of these and results filter instantly.

---

## How to print a customer ledger

1. Go to **Ledger** tab
2. Click the customer name on the left
3. Click **Print Ledger** button (top right of the ledger)
4. Use browser Print (Ctrl+P / Cmd+P)

The print layout is clean — header, company name, Debit/Credit columns, running balance, and totals.
