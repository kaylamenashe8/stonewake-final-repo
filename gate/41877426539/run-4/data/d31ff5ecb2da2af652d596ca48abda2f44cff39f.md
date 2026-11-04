# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api.spec.ts >> api 2 me
- Location: tests/api.spec.ts:16:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | var KEY = 'swk_live_QRReoWVfrAKc91ipjs8WYqNpiCo9HzEWhYxKu5H8';
  4   | 
  5   | test('api 1 health', async ({ request }) => {
  6   |   var r = await request.get('https://api.stonewake.ai/v1/health');
  7   |   expect(r.status()).toBe(200);
  8   |   var b = await r.json();
  9   |   expect(Object.keys(b).sort()).toEqual(['app', 'environment', 'status', 'version']);
  10  |   expect(b.status).toBe('ok');
  11  |   expect(b.app).toBe('stonewake');
  12  |   expect(typeof b.version).toBe('string');
  13  |   expect(typeof b.environment).toBe('string');
  14  | });
  15  | 
  16  | test('api 2 me', async ({ request }) => {
  17  |   var r = await request.get('https://api.stonewake.ai/v1/me', { headers: { Authorization: 'Token ' + KEY } });
> 18  |   expect(r.status()).toBe(200);
      |                      ^ Error: expect(received).toBe(expected) // Object.is equality
  19  |   var b = await r.json();
  20  |   console.log(b);
  21  |   expect(b.credential).toBe('api_key');
  22  |   expect(typeof b.role).toBe('string');
  23  |   expect(b.role).toMatch(/^[a-z_]+$/);
  24  |   expect(typeof b.team_scope.all_teams).toBe('boolean');
  25  |   expect(Array.isArray(b.team_scope.teams)).toBe(true);
  26  |   if (!b.team_scope.all_teams) {
  27  |     expect(b.team_scope.teams.length).toBeGreaterThan(0);
  28  |     for (var t of b.team_scope.teams) {
  29  |       expect(typeof t.id).toBe('string');
  30  |       expect(typeof t.name).toBe('string');
  31  |     }
  32  |   }
  33  |   expect(r.headers()['x-ratelimit-limit']).toMatch(/^\d+$/);
  34  |   expect(r.headers()['x-ratelimit-remaining']).toMatch(/^\d+$/);
  35  | });
  36  | 
  37  | test('api 3 no token', async ({ request }) => {
  38  |   var r = await request.get('https://api.stonewake.ai/v1/me');
  39  |   expect(r.status()).toBe(401);
  40  |   expect(await r.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  41  |   var r2 = await request.get('https://api.stonewake.ai/v1/portfolio');
  42  |   expect(r2.status()).toBe(401);
  43  |   expect(await r2.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  44  |   var r3 = await request.get('https://api.stonewake.ai/v1/countries');
  45  |   expect(r3.status()).toBe(401);
  46  |   expect(await r3.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  47  |   var r4 = await request.get('https://api.stonewake.ai/v1/entities');
  48  |   expect(r4.status()).toBe(401);
  49  |   expect(await r4.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  50  |   var r5 = await request.post('https://api.stonewake.ai/v1/citations/resolve');
  51  |   expect(r5.status()).toBe(401);
  52  |   expect(await r5.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  53  | });
  54  | 
  55  | test('api 4 bad keys', async ({ request }) => {
  56  |   var r = await request.get('https://api.stonewake.ai/v1/me', { headers: { Authorization: 'Bearer swk_live_invalid000000000000000000000000' } });
  57  |   expect(r.status()).toBe(401);
  58  |   expect(await r.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  59  |   var r2 = await request.get('https://api.stonewake.ai/v1/me', { headers: { Authorization: 'Bearer not-a-key' } });
  60  |   expect(r2.status()).toBe(401);
  61  |   expect(await r2.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  62  |   var r3 = await request.get('https://api.stonewake.ai/v1/me', { headers: { Authorization: 'Basic abc' } });
  63  |   expect(r3.status()).toBe(401);
  64  |   expect(await r3.json()).toEqual({ error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } });
  65  |   var r4 = await request.get('https://api.stonewake.ai/v1/portfolio', { headers: { Authorization: 'Bearer swk_live_invalid000000000000000000000000' } });
  66  |   expect(r4.status()).toBe(401);
  67  | });
  68  | 
  69  | test('api 5 portfolio list', async ({ request }) => {
  70  |   var r = await request.get('https://api.stonewake.ai/v1/portfolio?limit=2', { headers: { Authorization: 'Bearer ' + KEY } });
  71  |   expect(r.status()).toBe(200);
  72  |   var b = await r.json();
  73  |   expect(Array.isArray(b.data)).toBe(true);
  74  |   expect(b.data.length).toBeLessThanOrEqual(2);
  75  |   expect(b.limit).toBe(2);
  76  |   expect(b.offset).toBe(0);
  77  |   expect(Number.isInteger(b.total)).toBe(true);
  78  |   for (var i of b.data) {
  79  |     expect(typeof i.id).toBe('number');
  80  |     expect(typeof i.label).toBe('string');
  81  |     expect(typeof i.active).toBe('boolean');
  82  |     expect(['green', 'amber', 'red', 'insufficient', 'not_assessed', 'sole_trader']).toContain(i.status);
  83  |     expect(i.completeness).toBeGreaterThanOrEqual(0);
  84  |     expect(i.completeness).toBeLessThanOrEqual(1);
  85  |   }
  86  |   var r2 = await request.get('https://api.stonewake.ai/v1/portfolio?limit=100', { headers: { Authorization: 'Bearer ' + KEY } });
  87  |   expect(r2.status()).toBe(200);
  88  |   var b2 = await r2.json();
  89  |   expect(b2.limit).toBe(100);
  90  |   var r3 = await request.get('https://api.stonewake.ai/v1/portfolio?limit=-1', { headers: { Authorization: 'Bearer ' + KEY } });
  91  |   expect(r3.status()).toBe(422);
  92  |   var r4 = await request.get('https://api.stonewake.ai/v1/portfolio?limit=abc', { headers: { Authorization: 'Bearer ' + KEY } });
  93  |   expect(r4.status()).toBe(422);
  94  |   var r5 = await request.get('https://api.stonewake.ai/v1/portfolio?limit=100000', { headers: { Authorization: 'Bearer ' + KEY } });
  95  |   expect(r5.status()).toBe(422);
  96  |   expect((await r5.json()).detail[0].msg).toBe('Input should be less than or equal to 100');
  97  | });
  98  | 
  99  | test('api 6 portfolio summary', async ({ request }) => {
  100 |   var r = await request.get('https://api.stonewake.ai/v1/portfolio/summary', { headers: { Authorization: 'Bearer ' + KEY } });
  101 |   expect(r.status()).toBe(200);
  102 |   var s = await r.json();
  103 |   expect(Object.keys(s.statuses).sort()).toEqual(['amber', 'green', 'insufficient', 'not_assessed', 'red', 'sole_trader']);
  104 |   var sum = 0;
  105 |   for (var k in s.statuses) {
  106 |     expect(Number.isInteger(s.statuses[k])).toBe(true);
  107 |     sum = sum + s.statuses[k];
  108 |   }
  109 |   expect(Number.isInteger(s.active_exposures)).toBe(true);
  110 |   expect(Number.isInteger(s.reviews_overdue)).toBe(true);
  111 |   expect(sum).toBe(s.active_exposures);
  112 |   var r2 = await request.get('https://api.stonewake.ai/v1/portfolio?limit=1', { headers: { Authorization: 'Bearer ' + KEY } });
  113 |   expect((await r2.json()).total).toBe(s.active_exposures);
  114 | });
  115 | 
  116 | test('api 7 entities', async ({ request }) => {
  117 |   var r = await request.get('https://api.stonewake.ai/v1/entities?limit=2', { headers: { Authorization: 'Bearer ' + KEY } });
  118 |   expect(r.status()).toBe(200);
```