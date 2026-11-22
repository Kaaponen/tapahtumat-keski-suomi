/** Kalenterisyötteen osoitteet: https tilausta varten ja webcal-linkki, joka avautuu kalenterisovellukseen. */
export function feedUrls(baseUrl: string, token: string): { https: string; webcal: string } {
  const https = `${baseUrl.replace(/\/+$/, '')}/${token}.ics`;
  return { https, webcal: https.replace(/^https?:/, 'webcal:') };
}
