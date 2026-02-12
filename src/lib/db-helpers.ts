/**
 * Database helper functions for connection management and retry logic
 */

import { pool } from "./db";
import type { Pool } from "mysql2/promise";

/**
 * Execute a query with retry logic for connection errors
 */
export async function queryWithRetry<T = any>(
  query: string,
  params: any[] = [],
  retries = 2,
  delay = 1000
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      const result = await pool.query<T>(query, params);
      return result as T;
    } catch (error: any) {
      const isConnectionError =
        error?.code === "ER_CON_COUNT_ERROR" ||
        error?.message?.includes("Too many connections") ||
        error?.message?.includes("ECONNREFUSED");

      if (isConnectionError && i < retries) {
        console.warn(`Connection error, retrying... (${i + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        continue;
      }

      throw error;
    }
  }
  throw new Error("Query failed after retries");
}
