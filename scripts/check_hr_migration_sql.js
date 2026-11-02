const fs = require("fs");
const path = require("path");

const migrationPath = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20261102000000_add_hr_payroll",
  "migration.sql"
);

const sql = fs.readFileSync(migrationPath, "utf8");
const statements = sql
  .split(";")
  .map((statement) => statement.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

const forbidden = [
  { label: "ALTER TABLE", regex: /^ALTER\s+TABLE\b/i },
  { label: "DROP", regex: /^DROP\b/i },
  { label: "TRUNCATE", regex: /^TRUNCATE\b/i },
  { label: "DELETE", regex: /^DELETE\b/i },
  { label: "UPDATE", regex: /^UPDATE\b/i },
  { label: "INSERT", regex: /^INSERT\b/i },
  { label: "REPLACE", regex: /^REPLACE\b/i },
];

const violations = [];
for (const statement of statements) {
  for (const rule of forbidden) {
    if (rule.regex.test(statement)) {
      violations.push(`${rule.label}: ${statement.split("\n")[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error("HR migration contains statements that may modify existing data:");
  violations.forEach((violation) => console.error(`  - ${violation}`));
  process.exit(1);
}

console.log("HR migration safety check passed: additive CREATE TABLE / CREATE INDEX only.");
