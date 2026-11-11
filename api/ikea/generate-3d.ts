import { handleVercelPost, synthesizeProduct3D } from '../../src/server/ikeaService.js';
import type { IkeaProduct } from '../../src/types/ikea.js';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{
    product?: IkeaProduct;
    swatchHex?: string;
    swatchName?: string;
  }>(request, async (body) => synthesizeProduct3D(body));
}
