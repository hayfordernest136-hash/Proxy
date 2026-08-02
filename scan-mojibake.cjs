const fs = require("fs");
const path = require("path");

const dirs = ["src", "server"];
const exts = [".tsx", ".ts", ".js", ".jsx", ".html", ".md", ".json", ".sql", ".css", ".txt"];

// Mojibake patterns: UTF-8 bytes misinterpreted as Windows-1252 / Latin-1
// U+00E2 U+20AC  -> â€ (prefix of em dash, curly quotes, bullet, ellipsis, en dash)
// U+00C3 + x     -> Ã© Ã¨ Ã± Ã¢ etc.
// U+00C2 + x     -> Â (NBSP, °, ¢)
const mojibakeRegex = /[\u00C2\u00C3\u00E2]|[\u0080-\u009F]/;

const results = [];

function walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".output" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }
      walk(p);
    } else if (entry.isFile() && exts.includes(path.extname(entry.name).toLowerCase())) {
      try {
        const content = fs.readFileSync(p, "utf8");
        if (mojibakeRegex.test(content)) {
          // Collect specific matches with context
          const lines = content.split("\n");
          const matches = [];
          lines.forEach((line, i) => {
            if (mojibakeRegex.test(line)) {
              const snippet = line.replace(/\t/g, " ").trim();
              matches.push(`    L${i + 1}: ${snippet.slice(0, 160)}`);
            }
          });
          results.push({ file: p, matches });
        }
      } catch {
        // ignore binary/unreadable
      }
    }
  }
}

dirs.forEach(walk);

if (results.length === 0) {
  console.log("NO MOJIBAKE FILES FOUND");
} else {
  results.forEach(({ file, matches }) => {
    console.log("=".repeat(80));
    console.log(file);
    console.log("-".repeat(80));
    matches.forEach((m) => console.log(m));
  });
  console.log("\n\nTOTAL FILES WITH POTENTIAL MOJIBAKE: " + results.length);
}

