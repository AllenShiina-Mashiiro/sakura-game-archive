import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveImageUploadPolicy } from '../lib/upload-policy.mjs';

const validImage = {
  contentType: 'image/jpeg',
  size: 1024,
};

test('ordinary content folders use the 12 MB content bucket', () => {
  const result = resolveImageUploadPolicy({
    ...validImage,
    folder: 'tutorials',
    role: 'user',
  });
  assert.equal(result.ok, true);
  assert.equal(result.bucket, 'content');
  assert.equal(result.folder, 'tutorials');
  assert.equal(result.maxBytes, 12 * 1024 * 1024);
  assert.equal(result.extension, 'jpg');
});

test('avatar uploads use the 4 MB avatar bucket', () => {
  const result = resolveImageUploadPolicy({
    ...validImage,
    folder: 'avatars',
    role: 'user',
  });
  assert.equal(result.ok, true);
  assert.equal(result.bucket, 'avatars');
  assert.equal(result.maxBytes, 4 * 1024 * 1024);
});

test('photo wall uploads use the 50 MB bucket and require an administrator', () => {
  const denied = resolveImageUploadPolicy({
    ...validImage,
    folder: 'photos',
    role: 'user',
  });
  assert.deepEqual(denied, {
    ok: false,
    status: 403,
    error: '该上传目录仅管理员可用',
  });

  const allowed = resolveImageUploadPolicy({
    ...validImage,
    folder: 'photos',
    role: 'admin',
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.bucket, 'photos');
  assert.equal(allowed.maxBytes, 50 * 1024 * 1024);
});

test('other administrator-only folders reject ordinary users', () => {
  const result = resolveImageUploadPolicy({
    ...validImage,
    folder: 'games',
    role: 'user',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
});

test('unknown folders and unsupported MIME types are rejected', () => {
  assert.equal(resolveImageUploadPolicy({
    ...validImage,
    folder: 'unexpected',
    role: 'admin',
  }).ok, false);
  assert.equal(resolveImageUploadPolicy({
    folder: 'tutorials',
    role: 'user',
    contentType: 'text/html',
    size: 10,
  }).ok, false);
});

test('file size limits are inclusive at the limit and reject oversize files', () => {
  const limit = 12 * 1024 * 1024;
  const atLimit = resolveImageUploadPolicy({
    folder: 'content',
    role: 'user',
    contentType: 'image/png',
    size: limit,
  });
  const tooLarge = resolveImageUploadPolicy({
    folder: 'content',
    role: 'user',
    contentType: 'image/png',
    size: limit + 1,
  });
  assert.equal(atLimit.ok, true);
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.error, '图片不能超过 12 MB');
});

test('invalid file sizes are rejected', () => {
  for (const size of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(resolveImageUploadPolicy({
      folder: 'content',
      role: 'user',
      contentType: 'image/png',
      size,
    }).ok, false);
  }
});

test('folder input is sanitized before allow-list checks', () => {
  const result = resolveImageUploadPolicy({
    ...validImage,
    folder: 'tutorials/../../private',
    role: 'user',
  });
  assert.equal(result.ok, false);
});
