/**
 * Checks if a client IP address matches any of the whitelisted patterns.
 * @param {string} clientIp - The incoming client IP address
 * @param {string[]} whitelist - The array of whitelisted patterns (e.g., ['127.0.0.1', '192.168.1.*'])
 * @returns {boolean} True if matching, false otherwise
 */
export const isIpAllowed = (clientIp, whitelist) => {
  if (!whitelist || whitelist.length === 0) {
    return true; // Whitelist is disabled/empty, permit by default
  }

  // Normalize client IP address (strip IPv6 prefix for IPv4-mapped addresses)
  const ip = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp;

  return whitelist.some((pattern) => {
    const trimmedPattern = pattern.trim();
    if (trimmedPattern === '*' || trimmedPattern === ip) {
      return true;
    }

    if (trimmedPattern.includes('*')) {
      // Escape dots and replace wildcards with regex matcher
      const escaped = trimmedPattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`);
      return regex.test(ip);
    }

    return false;
  });
};
