# Aiven Free Tier — Final Solution (Connection Pooling)

Aiven free plan par:
- **max_connections** change nahi hota (provider lock karta hai).
- **Connection pooling** zaroori hai — bina pool ke app stable nahi rahegi.

Is project mein pool **pehle se** use ho raha hai (`src/lib/db.ts`). Aiven ke liye config already safe hai.

---

## STEP 1 — mysql2

Project mein already hai:
```bash
npm install mysql2
```

---

## STEP 2 — Pool config (Aiven-safe)

**File:** `src/lib/db.ts`

- **DATABASE_URL** use karo (e.g. Aiven connection string), ya
- **DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_PORT** (optional) use karo.

Aiven detect hone par automatically:
- `connectionLimit: 5` (free tier safe)
- `queueLimit: 0`
- `ssl: { rejectUnauthorized: false }` — Aiven cert Node ke trust store mein nahi hota; false se "self-signed certificate in certificate chain" nahi aata (connection phir bhi encrypted rehti hai)
- `waitForConnections: true`

**.env example (Aiven):**
```env
# Option A — single URL (recommended)
DATABASE_URL="mysql://USER:PASSWORD@your-db.aivencloud.com:13040/defaultdb?ssl-mode=REQUIRED"

# Option B — separate vars
# DB_HOST=your-db.aivencloud.com
# DB_PORT=13040
# DB_USER=avnadmin
# DB_PASS=your-password
# DB_NAME=defaultdb
```

---

## STEP 3 — Routes mein sirf pool use karo

**Galat (har request pe nayi connection → crash):**
```js
const connection = await mysql.createConnection(config);
await connection.query(...);
```

**Sahi (is project mein already yahi hai):**
```js
import { pool } from "@/lib/db";
// ya
import { executeQuery } from "@/lib/db";

// API route / server code
const [rows] = await pool.query("SELECT * FROM users");
// ya
const [rows] = await executeQuery("SELECT * FROM users", []);
```

Pool automatically:
- connections **reuse** karta hai
- limit **enforce** karta hai (5 for Aiven)
- **queueLimit: 0** se extra connections open nahi hoti

---

## STEP 4 — Purani open connections clean karo (ek baar)

MySQL Workbench / mysql client se connect karke:

```sql
SHOW PROCESSLIST;
```

Aiven free tier par connections limited hoti hain. Agar purani connections dikhen to app restart karke nayi pool se start karo.

---

## STEP 5 — App restart

```bash
npm run dev
# ya production:
# pm2 restart all
```

---

## Result

| Before (no pool / wrong use) | After (pool only) |
|-----------------------------|-------------------|
| 1 request = 1 connection    | 1000 requests = 5 connections |
| 50 users = 50 connections   | Stable, no DB crash |
| Too many connections        | Pool limit 5 (Aiven safe) |

---

## Extra safety (optional)

Agar ab bhi connection errors aaye to `.env` mein:

```env
DB_POOL_SIZE=3
```

Se pool size 3 kar do (zyada conservative).

---

**Summary:** Cloud free DB + pooling ke bina app stable nahi hoti. Is project mein pool use ho raha hai aur Aiven ke liye config set hai — sirf `.env` sahi karo aur app restart karo.
