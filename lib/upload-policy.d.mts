export type ImageUploadPolicyInput = {
  folder?: unknown;
  role?: unknown;
  contentType?: unknown;
  size?: number;
};

export type ImageUploadPolicyResult =
  | {
      ok: true;
      folder: string;
      bucket: 'content' | 'avatars' | 'photos';
      extension: string;
      maxBytes: number;
    }
  | {
      ok: false;
      status: 400 | 403;
      error: string;
    };

export function resolveImageUploadPolicy(
  input: ImageUploadPolicyInput,
): ImageUploadPolicyResult;
