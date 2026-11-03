import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Development-only integrity check. Stores counts/IDs/fingerprints, NOT row data,
// codes, cookies, token hashes or encryption envelopes. No destructive operation.
const tables = ["doctors", "products", "visits", "pharmacy_observations", "pending_visits", "demo_sessions"];
const require = createRequire(new URL("../lib/db/package.json", import.meta.url));
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const file = new URL("../generated-artifacts/demo-audit-baseline.json", import.meta.url);
try {
  const current = {};
  for (const table of tables) {
    // Identifiers are from this fixed allowlist, never external input.
    current[table] = (await pool.query(`SELECT count(*)::integer AS count,
      coalesce(jsonb_agg(id ORDER BY id),'[]') AS ids,
      md5(coalesce(string_agg(row_to_json(t)::text,'' ORDER BY id),'')) AS fingerprint
      FROM ${table} t`)).rows[0];
  }
  if (process.argv.includes("--snapshot")) {
    await mkdir(new URL("../generated-artifacts/", import.meta.url), { recursive: true });
    await writeFile(file, JSON.stringify({ capturedAt: new Date().toISOString(), tables: current }, null, 2));
    console.log("حُفظت بصمات وأعداد السجلات الأصلية دون نسخ محتوياتها أو أسرارها.");
  } else {
    const original = JSON.parse(await readFile(file, "utf8")).tables;
    for (const table of tables) {
      assert.deepEqual(current[table], original[table], `Data changed in ${table}; never restore a baseline over user changes.`);
      console.log(`محفوظة دون تغيير: ${table} (${current[table].count})`);
    }
  }
} finally {
  await pool.end();
}
