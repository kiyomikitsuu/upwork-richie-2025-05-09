// src/setup.ts
import fetch from 'node-fetch';

if (!global.fetch) {
  (global as any).fetch = fetch;
  (global as any).Response = fetch.Response;
  (global as any).Headers = fetch.Headers;
}