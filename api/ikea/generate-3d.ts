import { handleVercelPost, synthesizeProduct3D } from '../../src/server/ikeaService';
import type { IkeaProduct } from '../../src/types/ikea';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{
    product?: IkeaProduct;
    swatchHex?: string;
    swatchName?: string;
  }>(request, async (body) => synthesizeProduct3D(body));
}
