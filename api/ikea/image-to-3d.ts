import { handleVercelPost, reconstructImageTo3D } from '../../src/server/ikeaService';

export async function POST(request: Request): Promise<Response> {
  return handleVercelPost<{
    imageBase64?: string;
    mimeType?: string;
    dimensionsCm?: { width: number; depth: number; height: number };
    nameHint?: string;
  }>(request, async (body) => ({
    payload: await reconstructImageTo3D(body),
  }));
}
