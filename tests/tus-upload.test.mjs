import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTusUploadEndpoint,
  encodeTusMetadata,
  nextTusChunkEnd,
  TUS_CHUNK_SIZE,
} from '../lib/tus-upload.mjs';

function decodeBase64Utf8(value) {
  return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
}

test('builds the dedicated Supabase Storage hostname for resumable uploads', () => {
  assert.equal(
    buildTusUploadEndpoint('https://project-ref.supabase.co'),
    'https://project-ref.storage.supabase.co/storage/v1/upload/resumable',
  );
});

test('does not duplicate an already dedicated Storage hostname', () => {
  assert.equal(
    buildTusUploadEndpoint('https://project-ref.storage.supabase.co'),
    'https://project-ref.storage.supabase.co/storage/v1/upload/resumable',
  );
});

test('rejects non-HTTPS and unrecognized storage hosts', () => {
  assert.throws(() => buildTusUploadEndpoint('http://project-ref.supabase.co'));
  assert.throws(() => buildTusUploadEndpoint('https://storage.example.com'));
});

test('encodes TUS metadata as UTF-8 base64 values', () => {
  const encoded = encodeTusMetadata({
    bucketName: 'content',
    objectName: 'tutorials/图片.jpg',
    contentType: 'image/jpeg',
    cacheControl: '3600',
  });
  const decoded = Object.fromEntries(encoded.split(',').map((entry) => {
    const [key, value] = entry.split(' ');
    return [key, decodeBase64Utf8(value)];
  }));
  assert.deepEqual(decoded, {
    bucketName: 'content',
    objectName: 'tutorials/图片.jpg',
    contentType: 'image/jpeg',
    cacheControl: '3600',
  });
});

test('splits a 50 MB file into six MiB chunks and a final remainder', () => {
  const total = 50 * 1024 * 1024;
  let offset = 0;
  const chunks = [];
  while (offset < total) {
    const end = nextTusChunkEnd(offset, total);
    chunks.push(end - offset);
    offset = end;
  }
  assert.equal(chunks.length, 9);
  assert.equal(chunks.slice(0, 8).every((size) => size === TUS_CHUNK_SIZE), true);
  assert.equal(chunks.reduce((sum, size) => sum + size, 0), total);
  assert.equal(chunks[8], total - 8 * TUS_CHUNK_SIZE);
});

test('validates TUS chunk ranges', () => {
  assert.equal(nextTusChunkEnd(0, 100, 64), 64);
  assert.equal(nextTusChunkEnd(64, 100, 64), 100);
  assert.throws(() => nextTusChunkEnd(-1, 100));
  assert.throws(() => nextTusChunkEnd(101, 100));
  assert.throws(() => nextTusChunkEnd(0, 100, 0));
});
