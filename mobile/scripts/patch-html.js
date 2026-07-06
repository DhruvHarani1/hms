/* Post-export: inject PWA manifest link + iOS Add-to-Home-Screen meta into
 * dist/index.html (Expo's SPA template omits them). Runs after expo export. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(file)) {
  console.error('patch-html: dist/index.html not found');
  process.exit(0);
}
let html = fs.readFileSync(file, 'utf8');

const tags = [
  '<link rel="manifest" href="/manifest.json" />',
  '<meta name="theme-color" content="#4f46e5" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="AIFDMS" />',
  '<link rel="apple-touch-icon" href="/icon.png" />',
].join('\n    ');

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', `    ${tags}\n  </head>`);
  fs.writeFileSync(file, html);
  console.log('patch-html: injected PWA/manifest tags');
} else {
  console.log('patch-html: tags already present');
}
