import { handleVercelPost, scrapeIkeaProductUrl } from '../../src/server/ikeaService';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{ url?: unknown }>(request, async (body) => ({
    payload: await scrapeIkeaProductUrl(body?.url),
  }));
}
