const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
const hrMigrationNames = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.includes("_add_hr_"))
  .map((entry) => entry.name)
  .sort();

if (hrMigrationNames.length === 0) {
  console.error("No HR migrations found.");
  process.exit(1);
}

const forbiddenStatements = [
  { label: "DROP", regex: /^DROP\b/i },
  { label: "TRUNCATE", regex: /^TRUNCATE\b/i },
  { label: "DELETE", regex: /^DELETE\b/i },
  { label: "UPDATE", regex: /^UPDATE\b/i },
  { label: "INSERT", regex: /^INSERT\b/i },
  { label: "REPLACE", regex: /^REPLACE\b/i },
];

const forbiddenAlterOperations = /\b(DROP|MODIFY|CHANGE|RENAME)\b/i;

const violations = [];

for (const name of hrMigrationNames) {
  const migrationPath = path.join(migrationsDir, name, "migration.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.replace(/--.*$/gm, "").trim())
    .filter(Boolean);

  for (const statement of statements) {
    const isCreate = /^CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)\b/i.test(statement);
    const isAdditiveAlter = /^ALTER\s+TABLE\b/i.test(statement) && /\bADD\s+(COLUMN\s+)?`/i.test(statement);

    if (!isCreate && !isAdditiveAlter) {
      violations.push(`${name}: unexpected statement -> ${statement.split("\n")[0]}`);
      continue;
    }

    for (const rule of forbiddenStatements) {
      if (rule.regex.test(statement)) {
        violations.push(`${name}: ${rule.label} -> ${statement.split("\n")[0]}`);
      }
    }

    if (isAdditiveAlter && forbiddenAlterOperations.test(statement)) {
      violations.push(`${name}: destructive ALTER operation -> ${statement.split("\n")[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error("HR migration contains statements that may modify existing data:");
  violations.forEach((violation) => console.error(`  - ${violation}`));
  process.exit(1);
}

console.log(
  `HR migration safety check passed (${hrMigrationNames.length} migrations): CREATE TABLE / CREATE INDEX / ALTER TABLE ADD COLUMN only.`
);
