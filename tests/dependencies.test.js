import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
test('Google SDK multipart requests work with the patched UUID dependency',async()=>{
  const require=createRequire(import.meta.url);
  const storageRequire=createRequire(require.resolve('@google-cloud/storage'));
  const gaxios=storageRequire('gaxios');
  const uuidRequire=createRequire(storageRequire.resolve('gaxios'));
  assert.match(uuidRequire('uuid').v4(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  let prepared;
  await gaxios.request({url:'https://example.invalid/upload',method:'POST',multipart:[{headers:{'Content-Type':'text/plain'},body:'test'}],adapter:async config=>{prepared=config;return {config,data:{},status:200,statusText:'OK',headers:{}};}});
  assert.match(prepared.headers['Content-Type'],/^multipart\/related; boundary=/);
});
