/* Auto-detect this PC's LAN IP, bind Metro to it, print the connect URL.
 * Fixes the "IP changed → phone can't connect" churn. Run: npm run go */
const os = require('os');
const { spawn } = require('child_process');

function lanIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        candidates.push({ name, address: net.address });
      }
    }
  }
  // Prefer common LAN ranges; prefer Wi-Fi/Ethernet over virtual adapters.
  const priv = candidates.filter((c) =>
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(c.address),
  );
  const preferred =
    priv.find((c) => /wi-?fi|wireless|ethernet|en0|wlan/i.test(c.name)) ||
    priv[0] ||
    candidates[0];
  return preferred ? preferred.address : null;
}

const ip = lanIp();
if (!ip) {
  console.warn('⚠️  No LAN IP found — falling back to Expo default detection.');
} else {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  console.log('\n────────────────────────────────────────────');
  console.log(`📡  Metro will bind to LAN IP: ${ip}`);
  console.log(`📱  In the app, connect to:   exp://${ip}:8081`);
  console.log(`🔗  Backend must run at:      http://${ip}:3000`);
  console.log('────────────────────────────────────────────\n');
}

const args = ['expo', 'start', '--dev-client', ...process.argv.slice(2)];
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 0));
