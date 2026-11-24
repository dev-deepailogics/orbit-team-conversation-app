import dns from "dns/promises";
import net from "net";

/**
 * Validates that an IP address is not private, loopback, link-local, or otherwise internal.
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return false;
  }

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map((n) => parseInt(n, 10));
    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata, e.g. 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 172.16.0.0/12 (Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (b0 === 192 && b1 === 0 && parts[2] === 0) return true;
    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;
    // 198.18.0.0/15 (Network benchmark tests)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;
    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224 && b0 <= 239) return true;
    // 240.0.0.0/4 (Reserved / Future use)
    if (b0 >= 240) return true;

    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Loopback
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
    // Unspecified
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
    // Unique Local Addresses (fc00::/7)
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    // Link-local (fe80::/10)
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true;
    }
    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (normalized.startsWith("::ffff:")) {
      const v4Part = normalized.replace("::ffff:", "");
      if (net.isIPv4(v4Part)) {
        return isPrivateIp(v4Part);
      }
    }

    return false;
  }

  return false;
}

/**
 * Resolves a hostname and asserts that none of the resolved IPs are internal or private.
 * Throws an error if the host is forbidden.
 */
export async function assertPublicHost(host: string): Promise<void> {
  const trimmed = host.trim().toLowerCase();

  // Strip port if accidentally passed
  const cleanHost = trimmed.split(":")[0];

  if (!cleanHost) {
    throw new Error("Host cannot be empty");
  }

  // Obvious localhost names
  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal")
  ) {
    throw new Error(`Connection to internal host '${cleanHost}' is forbidden`);
  }

  // Direct IP provided
  if (net.isIP(cleanHost)) {
    if (isPrivateIp(cleanHost)) {
      throw new Error(`Connection to private IP '${cleanHost}' is forbidden`);
    }
    return;
  }

  // Resolve hostname
  try {
    const addresses = await dns.lookup(cleanHost, { all: true });
    if (!addresses || addresses.length === 0) {
      throw new Error(`Unable to resolve host '${cleanHost}'`);
    }

    for (const record of addresses) {
      if (isPrivateIp(record.address)) {
        throw new Error(
          `Host '${cleanHost}' resolved to forbidden private IP '${record.address}'`
        );
      }
    }
  } catch (err: any) {
    if (err.code === "ENOTFOUND") {
      throw new Error(`Host '${cleanHost}' could not be resolved`);
    }
    throw err;
  }
}
