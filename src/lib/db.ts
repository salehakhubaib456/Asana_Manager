import mysql from "mysql2/promise";

function getPoolConfig(): mysql.PoolOptions {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Parse mysql://user:password@host:port/database?query
    const match = url.match(
      /^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?$/
    );
    if (match) {
      const [, user, password, host, port, database] = match;
      const needsSsl =
        url.includes("ssl-mode=REQUIRED") || url.includes("aivencloud.com");
      return {
        host,
        port: Number(port),
        user: decodeURIComponent(user),
        password: decodeURIComponent(password),
        database: database.split("?")[0],
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ...(needsSsl && {
          ssl: { rejectUnauthorized: false },
        }),
      };
    }
  }

  return {
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "asanamanager",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

const pool = mysql.createPool(getPoolConfig());

export { pool };

export type User = {
  id: number;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};
