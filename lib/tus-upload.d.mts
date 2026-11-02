export type TusMetadata = Record<string, string | number>;

export function encodeTusMetadata(metadata: TusMetadata): string;
export function buildTusUploadEndpoint(supabaseUrl: string): string;
export function nextTusChunkEnd(offset: number, totalSize: number, chunkSize?: number): number;
export const TUS_CHUNK_SIZE: number;
