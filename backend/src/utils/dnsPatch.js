import dns from 'node:dns';
import { execSync } from 'node:child_process';

const dnsPromises = dns.promises;

// Check if we are on Windows and should enable the fallback
const isWindows = process.platform === 'win32';

if (isWindows) {
  // Patch dns.promises.resolveSrv
  const originalResolveSrv = dnsPromises.resolveSrv;
  dnsPromises.resolveSrv = async function (name) {
    try {
      return await originalResolveSrv.call(dnsPromises, name);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'SERVFAIL' || err.code === 'ENOTFOUND') {
        // eslint-disable-next-line no-console
        console.log(`[DNS Patch] c-ares resolveSrv failed for ${name}. Trying native OS fallback...`);
        try {
          const cmd = `powershell -Command "Resolve-DnsName -Name ${name} -Type SRV -ErrorAction SilentlyContinue | Select-Object NameTarget, Port, Priority, Weight | ConvertTo-Json"`;
          const output = execSync(cmd).toString().trim();
          if (output) {
            const parsed = JSON.parse(output);
            const list = Array.isArray(parsed) ? parsed : [parsed];
            const results = list.map(item => ({
              name: item.NameTarget.replace(/\.$/, ''),
              port: item.Port || 27017,
              priority: item.Priority || 0,
              weight: item.Weight || 0
            }));
            // eslint-disable-next-line no-console
            console.log(`[DNS Patch] Successfully resolved SRV for ${name} via PowerShell:`, results);
            return results;
          }
        } catch (fallbackErr) {
          // eslint-disable-next-line no-console
          console.error(`[DNS Patch] PowerShell fallback failed for ${name}:`, fallbackErr.message);
        }
      }
      throw err;
    }
  };

  // Patch dns.promises.resolveTxt
  const originalResolveTxt = dnsPromises.resolveTxt;
  dnsPromises.resolveTxt = async function (name) {
    try {
      return await originalResolveTxt.call(dnsPromises, name);
    } catch (err) {
      if (err.code === 'ECONNREFUSED' || err.code === 'SERVFAIL' || err.code === 'ENOTFOUND') {
        // eslint-disable-next-line no-console
        console.log(`[DNS Patch] c-ares resolveTxt failed for ${name}. Trying native OS fallback...`);
        try {
          const cmd = `powershell -Command "Resolve-DnsName -Name ${name} -Type TXT -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Strings"`;
          const output = execSync(cmd).toString().trim();
          if (output) {
            const lines = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            const results = [lines];
            // eslint-disable-next-line no-console
            console.log(`[DNS Patch] Successfully resolved TXT for ${name} via PowerShell:`, results);
            return results;
          }
        } catch (fallbackErr) {
          // eslint-disable-next-line no-console
          console.error(`[DNS Patch] PowerShell fallback failed for ${name}:`, fallbackErr.message);
        }
      }
      throw err;
    }
  };
}
