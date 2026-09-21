/* eslint-disable @typescript-eslint/no-require-imports -- Standalone live verification script. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { chromium, expect } = require('@playwright/test');
process.loadEnvFile(path.resolve(__dirname, '../.env'));
const base = process.env.OFFERS_BASE_URL || 'http://localhost:3104';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
let actor, browser;
async function checked(query) { const { data, error } = await query; if (error) throw new Error(error.message); return data; }
async function main() {
  const email = `offer-check-${randomUUID()}@${process.env.STUDENT_EMAIL_DOMAINS.split(',')[0].trim()}`;
  actor = (await checked(admin.auth.admin.createUser({ email, email_confirm: true }))).user.id;
  await checked(admin.from('profiles').insert({ id: actor, full_name: 'Offer Verification', university: 'Synthetic Verification', photo_url: `${base}/icon.svg` }));
  const link = await checked(admin.auth.admin.generateLink({ type: 'magiclink', email }));
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  await checked(client.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }));
  const departureAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const offer = { source: 'native', importId: null, origin: { cityId: 1, pickupPointId: null, rawText: 'Skopje' }, destination: { cityId: 3, pickupPointId: null, rawText: 'Bitola' },
    departureAt, distanceKm: null, seatsTotal: 3, pricePerSeatMkd: 400, notes: null, tags: [], genderPreference: 'any', car: null, carId: null, confidence: null, fieldConfidence: [], warnings: [] };
  const vehicle = { mode: 'manual', make: 'Renault', model: 'Clio', fuelType: 'petrol', consumptionL100Km: 6, seatsTotal: 4 };
  const firstId = randomUUID(), secondId = randomUUID();
  const save = (id, car = vehicle) => checked(client.rpc('create_ride_offer', { p_offer: offer, p_vehicle: car, p_submission_id: id, p_publish: true }));
  const [a, retry, sibling] = await Promise.all([save(firstId), save(firstId), save(secondId)]);
  assert.equal(a.rideId, retry.rideId); assert.notEqual(a.rideId, sibling.rideId); assert.equal(a.carId, sibling.carId);
  assert.equal((await checked(admin.from('rides').select('id').eq('driver_id', actor))).length, 2);
  assert.equal((await checked(admin.from('cars').select('id').eq('owner_id', actor))).length, 1);
  const other = await save(randomUUID(), { ...vehicle, model: 'Different vehicle' });
  assert.notEqual(other.carId, a.carId);
  const permits = await Promise.all(Array.from({ length: 6 }, () => checked(client.rpc('try_ride_routing_request'))));
  assert.equal(permits.filter(Boolean).length, 1);
  console.log('PASS concurrent duplicate publication, distinct drafts, shared/different vehicles and global routing permits');
  if (process.argv.includes('--database-only')) return;

  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/login`);
  await page.getByLabel('Student email').fill(email);
  await page.getByRole('button', { name: 'Development sign-in (no email)' }).click();
  await page.waitForURL('**/rides', { timeout: 60000 });
  await page.goto(`${base}/rides/new`);
  const localParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(departureAt)).map(p => [p.type, p.value]));
  const dateLocal = `${localParts.year}-${localParts.month}-${localParts.day}`, timeLocal = `${localParts.hour}:${localParts.minute}`;
  const trip = { draft: { ...offer, carId: a.carId }, mentioned: ['origin','destination','departureDate','departureTime','car','seatsTotal','pricePerSeatMkd'], dateLocal, timeLocal };
  await page.route('**/api/rides/interpret', async route => {
    const input = route.request().postDataJSON();
    const trips = input.mode === 'correct' ? [{ ...trip, mentioned: ['departureTime'], timeLocal: '17:00' }] : [trip, { ...trip, draft: { ...trip.draft, origin: offer.destination, destination: offer.origin } }];
    await route.fulfill({ json: { trips } });
  });
  await page.getByLabel('Describe your rides').fill('skp bt next week and back, Clio, 3 seats, 400 den');
  await page.getByRole('button', { name: 'Fill form', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByLabel('Departure', { exact: true })).toHaveValue(`${dateLocal}T${timeLocal}`);
  await expect(page.getByLabel('Estimated route distance (km)')).not.toHaveValue('', { timeout: 30000 });
  console.log('LIVE Skopje–Bitola km:', await page.getByLabel('Estimated route distance (km)').inputValue());
  await page.getByLabel('Estimated route distance (km)').fill('180');
  await page.getByLabel('Notes').fill('Preserve outbound notes');
  await page.getByLabel('Correct this ride').fill('actually at 5pm');
  await page.getByRole('button', { name: 'Update this draft' }).click();
  await expect(page.getByLabel('Departure', { exact: true })).toHaveValue(`${dateLocal}T17:00`);
  await page.getByRole('button', { name: 'Undo fill' }).click();
  await expect(page.getByLabel('Departure', { exact: true })).toHaveValue(`${dateLocal}T${timeLocal}`);
  await page.reload();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByLabel('Estimated route distance (km)')).toHaveValue('180');
  await expect(page.getByLabel('Notes')).toHaveValue('Preserve outbound notes');
  await page.getByRole('tab').first().focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Departure city')).toHaveValue('3');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Publish ride', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View ride', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'View ride', exact: true })).toBeVisible();
  await page.getByRole('tab').nth(1).click();
  await expect(page.getByRole('button', { name: 'Publish ride', exact: true })).toBeEnabled();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile form must not overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Desktop form must not overflow');
  assert.deepEqual(errors, []);
  assert.equal((await checked(admin.from('rides').select('id').eq('driver_id', actor))).length, 4);
  assert.equal((await checked(admin.from('cars').select('id').eq('owner_id', actor))).length, 2);
  console.log('PASS browser two-tab fill, city-first live routing, non-Skopje device timezone, correction/Undo, refresh, separate publication, keyboard and mobile/desktop layout');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (actor) {
    await checked(admin.from('rides').delete().eq('driver_id', actor));
    await checked(admin.from('cars').delete().eq('owner_id', actor));
    await checked(admin.from('profiles').delete().eq('id', actor));
    await checked(admin.auth.admin.deleteUser(actor));
    console.log('Removed synthetic offer-verification records.');
  }
});
