// Exports the catalogue master workbook to the CSV format verify-catalogue.mjs,
// import-catalogue.mjs, and import-images.mjs already expect. This script is
// the ONLY thing that should write catalogue/csv/velmaya-products.csv —
// edit the .xlsx, not the .csv, then re-run this.
//
//   node scripts/export-catalogue.mjs
//   (or: npm run catalogue:export)
//
// Reads the first sheet of catalogue/csv/velmaya-products.xlsx and writes
// catalogue/csv/velmaya-products.csv (UTF-8, comma-delimited, overwritten
// every run). Every column and every blank cell in the sheet is carried
// through as-is — this script doesn't know or care what the columns mean,
// so adding a column to the workbook later doesn't require touching this
// script. Quoting follows minimal RFC4180 rules (only when a field contains
// a comma, a quote, or a newline) via XLSX.utils.sheet_to_csv, which also
// correctly resolves Excel-formatted cells (e.g. a cell typed as "12%",
// which Excel stores as the number 0.12 with a percent format) back to
// their displayed text rather than the raw underlying number.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const XLSX_PATH = "catalogue/csv/velmaya-products.xlsx";
const CSV_PATH = "catalogue/csv/velmaya-products.csv";

function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`Master workbook not found: ${XLSX_PATH}`);
    process.exit(2);
  }

  // XLSX.readFile() relies on this package's internal Node fs binding, which
  // isn't reliably wired up in this ESM build — read the bytes ourselves and
  // hand them to XLSX.read() instead.
  const fileBuffer = readFileSync(XLSX_PATH);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    console.error(`${XLSX_PATH} has no sheets`);
    process.exit(2);
  }
  const sheet = workbook.Sheets[sheetName];

  const csv = XLSX.utils.sheet_to_csv(sheet);
  writeFileSync(CSV_PATH, csv, "utf8");

  const rowCount = csv.split("\n").filter((l) => l.length > 0).length;
  console.log(
    `Exported "${sheetName}" (${rowCount} row(s) incl. header) from ${XLSX_PATH} to ${CSV_PATH}`
  );
}

main();
