import mysql from "mysql2/promise";

/** Aiven free tier: max_connections change nahi hota → connection pooling mandatory. */
function getPoolConfig(): mysql.PoolOptions {
  let host: string;
  let port: number;
  let user: string;
  let password: string;
  let database: string;
  let isAiven = false;

  if (process.env.DB_HOST) {
    host = process.env.DB_HOST;
    port = Number(process.env.DB_PORT) || 3306;
    user = process.env.DB_USER ?? "";
    password = process.env.DB_PASS ?? "";
    database = process.env.DB_NAME ?? "";
    isAiven = host.includes("aivencloud.com");
  } else {
    const url = process.env.DATABASE_URL;
    if (url) {
      const match = url.match(
        /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/
      );
      if (match) {
        const [, u, p, h, prt, db] = match;
        host = h;
        port = Number(prt);
        user = decodeURIComponent(u);
        password = decodeURIComponent(p);
        database = db.split("?")[0];
        isAiven = url.includes("aivencloud.com");
      } else {
        host = process.env.MYSQL_HOST ?? "localhost";
        port = Number(process.env.MYSQL_PORT) || 3306;
        user = process.env.MYSQL_USER ?? "root";
        password = process.env.MYSQL_PASSWORD ?? "";
        database = process.env.MYSQL_DATABASE ?? "asanamanager";
      }
    } else {
      host = process.env.MYSQL_HOST ?? "localhost";
      port = Number(process.env.MYSQL_PORT) || 3306;
      user = process.env.MYSQL_USER ?? "root";
      password = process.env.MYSQL_PASSWORD ?? "";
      database = process.env.MYSQL_DATABASE ?? "asanamanager";
    }
  }

  const poolSize = Number(process.env.DB_POOL_SIZE) || (isAiven ? 5 : 5);
  const connectionLimit = isAiven
    ? Math.min(poolSize, 5)
    : Math.max(1, Math.min(poolSize, 50));
  const queueLimit = isAiven ? 0 : 20;
  const needsSsl = isAiven || host.includes("aivencloud.com") || process.env.DATABASE_URL?.includes("ssl-mode=REQUIRED");

  return {
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit,
    queueLimit,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    acquireTimeout: 30000,
    timeout: 30000,
    reconnect: true,
    ...(needsSsl && {
      // Aiven/cloud DB: server cert often not in Node's trust store → avoid "self-signed certificate in certificate chain"
      ssl: { rejectUnauthorized: false },
    }),
  };
}

// Reuse same pool in dev (Next.js hot reload creates new module instances)
const globalForDb = globalThis as unknown as { mysqlPool: mysql.Pool | undefined };
const pool = globalForDb.mysqlPool ?? mysql.createPool(getPoolConfig());
if (process.env.NODE_ENV !== "production") globalForDb.mysqlPool = pool;

// Handle pool errors and connection management
pool.on("connection", (connection) => {
  connection.on("error", (err: any) => {
    console.error("MySQL connection error:", err);
    if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
      console.log("MySQL connection lost, will reconnect on next query...");
    }
  });
});

pool.on("error", (err: any) => {
  console.error("MySQL pool error:", err);
  // Don't crash on connection errors, pool will handle reconnection
});

// Gracefully handle process termination
if (typeof process !== "undefined") {
  process.on("SIGINT", async () => {
    await pool.end();
    process.exit(0);
  });
  
  process.on("SIGTERM", async () => {
    await pool.end();
    process.exit(0);
  });
}

/**
 * Execute query with retry logic for connection errors
 */
export async function executeQuery<T = any>(
  query: string,
  params: any[] = [],
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await pool.query<T>(query, params);
      return result as T;
    } catch (error: any) {
      const isConnectionError =
        error?.code === "ER_CON_COUNT_ERROR" ||
        error?.message?.includes("Too many connections") ||
        error?.message?.includes("ECONNREFUSED");

      if (isConnectionError && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff, max 5s
        console.warn(`Connection error (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }
  throw new Error("Query failed after retries");
}

export { pool };

export type User = {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};
