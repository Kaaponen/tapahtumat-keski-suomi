const BARE_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i;

/** Palauttaa vain http(s)-osoitteen; paljas verkkotunnus saa https://-etuliitteen. Muuten undefined. */
export function safeUrl(value?: string | null): string | undefined {
  const s = value?.trim();
  if (!s || /\s/.test(s)) return undefined;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(s);
  const candidate = !hasScheme && BARE_DOMAIN.test(s) ? `https://${s}` : s;
  try {
    const u = new URL(candidate);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
