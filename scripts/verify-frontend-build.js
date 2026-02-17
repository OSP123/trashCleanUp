const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "frontend", "dist");
const indexPath = path.join(distDir, "index.html");

if (!fs.existsSync(distDir)) {
  console.error("Frontend build missing: dist/ directory not found.");
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error("Frontend build missing: dist/index.html not found.");
  process.exit(1);
}

console.log("Frontend build verified.");
