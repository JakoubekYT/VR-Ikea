import { handleVercelPost, searchIkeaProducts } from '../../src/server/ikeaService';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{ query?: unknown }>(request, async (body) => ({
    payload: await searchIkeaProducts(body?.query),
  }));
}
