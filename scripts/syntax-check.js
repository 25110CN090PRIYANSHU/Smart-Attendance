const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isDirectory()) result.push(...walk(full));
    else if (entry.name.endsWith(".js")) result.push(full);
  }
  return result;
}

for (const file of walk(process.cwd())) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log("✓ JavaScript syntax check passed.");
