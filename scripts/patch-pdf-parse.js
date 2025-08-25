// scripts/patch-pdf-parse.js
const fs = require('fs');
const path = require('path');

const target = path.join(process.cwd(), 'node_modules', 'pdf-parse', 'index.js');

try {
  let src = fs.readFileSync(target, 'utf8');

  // Zet debugmodus uit zodat pdf-parse niet naar ./test/data/... grijpt
  const before = src;
  src = src.replace(
    /let\s+isDebugMode\s*=\s*!module\.parent\s*;/,
    'let isDebugMode = false;'
  );

  if (src !== before) {
    fs.writeFileSync(target, src, 'utf8');
    console.log('[patch-pdf-parse] Debug mode disabled in pdf-parse/index.js');
  } else {
    console.log('[patch-pdf-parse] Pattern not found; file may already be patched or version differs.');
  }
} catch (e) {
  console.warn('[patch-pdf-parse] Could not patch pdf-parse:', e.message);
  // Niet hard falen bij postinstall; build kan door
}
