import type { FetchContext } from '../src/shared/types';

export function fakeCtx(responses: Record<string, unknown>): FetchContext & { requested: string[] } {
  const requested: string[] = [];
  const lookup = (url: string) => {
    requested.push(url);
    if (!(url in responses)) throw new Error(`Odottamaton URL ${url}`);
    return responses[url];
  };
  return {
    requested,
    getJson: async <T>(url: string) => lookup(url) as T,
    getText: async (url: string) => lookup(url) as string,
    log: () => {},
  };
}
