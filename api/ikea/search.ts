import { handleVercelPost, searchIkeaProducts } from '../../src/server/ikeaService.js';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{ query?: unknown }>(request, async (body) => ({
    payload: await searchIkeaProducts(body?.query),
  }));
}
