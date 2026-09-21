/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { chromium, expect: baseExpect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');

process.loadEnvFile('.env');
if (process.env.RATINGS_LIVE_TESTS !== '1') throw Error('Set RATINGS_LIVE_TESTS=1 to run temporary hosted fixtures.');
const expect = baseExpect.configure({ timeout: 20000 });
const base = process.env.RATINGS_TEST_BASE_URL || 'http://localhost:3103';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [], rides = [], cars = [];
let browser;
const check = ({ data, error }) => { if (error) throw Error(error.message); return data; };
const forms = page => page.getByRole('form', { name: /^Rate / });
const noOverflow = async page => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile content must fit');

async function student(name) {
  const email = `ratings-${name}-${randomUUID()}@${process.env.STUDENT_EMAIL_DOMAINS.split(',')[0].trim()}`;
  const link = check(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
  const person = { id: link.user.id, name: `Ratings Test ${name}` };
  users.push(person);
  check(await admin.from('profiles').insert({ id: person.id, full_name: person.name, photo_url: `${base}/icon.svg`, university: 'UKIM', phone: 'PRIVATE RATINGS CONTACT' }));
  const jar = [];
  person.client = createServerClient(url, key, { cookies: {
    getAll: () => jar,
    setAll: values => values.forEach(cookie => { const index = jar.findIndex(item => item.name === cookie.name); if (index >= 0) jar.splice(index, 1); jar.push(cookie); }),
  } });
  check(await person.client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: link.properties.verification_type }));
  person.context = await browser.newContext({ viewport: { width: 375, height: 850 } });
  await person.context.addCookies(jar.map(cookie => ({ name: cookie.name, value: cookie.value, url: base, sameSite: 'Lax' })));
  person.page = await person.context.newPage();
  return person;
}

async function main() {
  fs.mkdirSync('.test-dist/ratings', { recursive: true });
  browser = await chromium.launch({ channel: process.env.RATINGS_TEST_BROWSER || 'msedge', headless: true });
  const driver = await student('driver'), one = await student('one'), two = await student('two');
  const pending = await student('pending'), outsider = await student('outsider');
  const cities = check(await admin.from('cities').select('id').order('id').limit(2));
  const car = check(await admin.from('cars').insert({ owner_id: driver.id, make: 'Test', model: 'Ratings car', fuel_type: 'petrol', consumption_l_100km: 6.5, seats_total: 4 }).select('id').single());
  cars.push(car.id);
  for (const status of ['published', 'published', 'cancelled']) {
    const ride = check(await admin.from('rides').insert({ driver_id: driver.id, car_id: car.id, origin_city_id: cities[0].id, dest_city_id: cities[1].id, departure_at: new Date(Date.now() + (rides.length ? 86400000 : -3600000)).toISOString(), seats_total: 4, seats_available: 4, status, details: { distance_km: 100, ratings_test: true } }).select('id').single());
    rides.push(ride.id);
    check(await admin.from('bookings').insert([{ ride_id: ride.id, passenger_id: one.id, seats: 2, status: 'accepted', decided_at: new Date(Date.now() - 7200000).toISOString() }, { ride_id: ride.id, passenger_id: two.id, seats: 1, status: 'accepted', decided_at: new Date(Date.now() - 7200000).toISOString() }, { ride_id: ride.id, passenger_id: pending.id, seats: 1, status: 'requested' }]));
  }
  const rideId = rides[0];
  await driver.page.goto(`${base}/dashboard/driver`);
  await driver.page.screenshot({ path: '.test-dist/ratings/driver-before-completion.png', fullPage: true });
  console.log('Driver route:', new URL(driver.page.url()).pathname);
  await expect(driver.page.getByRole('heading', { name: 'Your offered rides' })).toBeVisible();
  await expect(forms(driver.page)).toHaveCount(0);
  await driver.page.getByRole('button', { name: 'Mark completed', exact: true }).click();
  await expect(forms(driver.page)).toHaveCount(2);
  await noOverflow(driver.page);
  for (const person of [one, two, pending, outsider]) await person.page.goto(`${base}/dashboard/trips`);
  await expect(forms(one.page)).toHaveCount(1);
  await expect(forms(two.page)).toHaveCount(1);
  await expect(forms(pending.page)).toHaveCount(0);
  await expect(forms(outsider.page)).toHaveCount(0);
  const before = check(await admin.from('rides').select('id,status,seats_available,seats_total').in('id', rides));
  const bookingsBefore = check(await admin.from('bookings').select('id,status,seats').in('ride_id', rides).order('id'));
  const impactBefore = await one.page.getByText(/kg CO/).allTextContents();
  console.log('PASS completion unlocks only valid counterpart controls, including mobile');

  const malicious = '<img src=x onerror="window.ratingInjected=true">';
  const stale = await one.context.newPage();
  await stale.goto(`${base}/dashboard/trips`);
  const form = forms(one.page);
  const first = form.getByRole('radio').first();
  await first.focus();
  await first.press('Space');
  for (let index = 0; index < 3; index++) await one.page.keyboard.press('ArrowRight');
  await expect(form.getByRole('radio', { name: '4 — Very good' })).toBeChecked();
  await one.page.keyboard.press('Tab');
  await expect(form.getByLabel(/Private feedback/)).toBeFocused();
  await form.getByLabel(/Private feedback/).fill(`  ${malicious}  `);
  await one.page.screenshot({ path: '.test-dist/ratings/passenger-form-mobile.png', fullPage: true });
  await one.page.keyboard.press('Tab');
  await expect(form.getByRole('button', { name: 'Submit rating' })).toBeFocused();
  await one.page.keyboard.press('Enter');
  await expect(one.page.getByText('Your submitted rating: 4 out of 5')).toBeVisible();
  await expect(one.page.getByText(malicious, { exact: true })).toBeVisible();
  assert.equal(await one.page.evaluate(() => window.ratingInjected), undefined);
  await one.page.reload();
  await expect(forms(one.page)).toHaveCount(0);
  await expect(one.page.getByText(malicious, { exact: true })).toBeVisible();
  await forms(stale).getByRole('radio', { name: '5 — Excellent' }).check();
  await forms(stale).getByRole('button', { name: 'Submit rating' }).click();
  await expect(stale.getByText(/You have already rated this person/)).toBeVisible();
  assert.equal(check(await admin.from('ratings').select('id').eq('ride_id', rideId)).length, 1);
  console.log('PASS keyboard submission, trimmed escaped feedback, reload, stale duplicate');

  // Tampering happens in the real form; the Server Action must reload facts.
  const twoForm = forms(two.page);
  await twoForm.getByRole('radio', { name: '2 — Fair' }).check();
  await twoForm.locator('input[name="rateeId"]').evaluate((input, target) => { input.value = target; }, one.id);
  await twoForm.getByRole('button', { name: 'Submit rating' }).click();
  await expect(forms(two.page).getByRole('alert')).toContainText('You can only rate');
  assert.equal(check(await admin.from('ratings').select('id').eq('ride_id', rideId)).length, 1);
  await two.page.reload();
  await forms(two.page).getByRole('radio', { name: '2 — Fair' }).check();
  await forms(two.page).locator('input[name="rideId"]').evaluate((input, target) => { input.value = target; }, rides[1]);
  await forms(two.page).getByRole('button', { name: 'Submit rating' }).click();
  await expect(forms(two.page).getByRole('alert')).toContainText('You can only rate');
  await two.page.reload();
  const racing = await two.context.newPage();
  await racing.goto(`${base}/dashboard/trips`);
  for (const page of [two.page, racing]) await forms(page).getByRole('radio', { name: '2 — Fair' }).check();
  await Promise.all([two.page, racing].map(page => forms(page).getByRole('button', { name: 'Submit rating' }).click()));
  await expect.poll(async () => check(await admin.from('ratings').select('id').eq('ride_id', rideId)).length).toBe(2);
  await two.page.reload();
  await expect(two.page.getByText('Your submitted rating: 2 out of 5')).toBeVisible();
  console.log('PASS forged targets/ride IDs and concurrent pair submissions');

  for (const [person, score] of [[one, 5], [two, 3]]) {
    await driver.page.reload();
    const target = driver.page.getByRole('form', { name: `Rate ${person.name}`, exact: true });
    await target.getByRole('radio', { name: new RegExp(`^${score} —`) }).check();
    await target.getByRole('button', { name: 'Submit rating' }).click();
    await expect(driver.page.getByText(`Your submitted rating: ${score} out of 5`)).toBeVisible();
  }
  await driver.page.reload();
  await expect(forms(driver.page)).toHaveCount(0);
  await noOverflow(driver.page);
  await driver.page.screenshot({ path: '.test-dist/ratings/driver-submitted-mobile.png', fullPage: true });
  const publicPage = await browser.newPage({ viewport: { width: 375, height: 850 } });
  await publicPage.goto(`${base}/profile/${driver.id}`);
  await expect(publicPage.getByText('3.0 out of 5 · 2 ratings')).toBeVisible();
  const profileHtml = await publicPage.content();
  for (const secret of [one.id, two.id, rideId, malicious, 'PRIVATE RATINGS CONTACT']) assert(!profileHtml.includes(secret), `Public profile leaked ${secret}`);
  await noOverflow(publicPage);
  await publicPage.screenshot({ path: '.test-dist/ratings/profile-mobile.png', fullPage: true });
  await publicPage.goto(`${base}/profile/${outsider.id}`);
  await expect(publicPage.getByText('No completed-ride ratings yet.')).toBeVisible();
  for (const [person, score] of [[one, '5.0'], [two, '3.0']]) {
    await publicPage.goto(`${base}/profile/${person.id}`);
    await expect(publicPage.getByText(`${score} out of 5 · 1 rating`)).toBeVisible();
  }
  console.log('PASS both driver targets and aggregate-only public profiles');

  for (const person of [pending, outsider]) {
    const denied = await person.client.from('ratings').insert({ ride_id: rideId, rater_id: person.id, ratee_id: driver.id, score: 5 });
    assert.equal(denied.error?.code, '42501');
    assert.deepEqual(check(await person.client.from('ratings').select('*').eq('ride_id', rideId)), []);
  }
  const duplicate = await one.client.from('ratings').insert({ ride_id: rideId, rater_id: one.id, ratee_id: driver.id, score: 5 });
  assert.equal(duplicate.error?.code, '23505');
  assert.deepEqual(check(await admin.from('rides').select('id,status,seats_available,seats_total').in('id', rides)), before);
  assert.deepEqual(check(await admin.from('bookings').select('id,status,seats').in('ride_id', rides).order('id')), bookingsBefore);
  await one.page.reload();
  assert.deepEqual(await one.page.getByText(/kg CO/).allTextContents(), impactBefore);
  await noOverflow(one.page);
  console.log('PASS direct RLS denial, unchanged lifecycle, seats and impact totals');
  fs.writeFileSync('.test-dist/ratings/results.json', JSON.stringify({ passed: true, date: new Date().toISOString(), cases: ['completion', 'eligibility', 'keyboard', 'mobile', 'escaping', 'duplicate', 'forged-target', 'forged-ride', 'concurrent-pair', 'both-directions', 'public-privacy', 'empty-summary', 'RLS', 'lifecycle-impact'] }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  let cleanupFailed = false;
  for (const [table, ids] of [['rides', rides], ['cars', cars]]) for (const id of ids) {
    const { error } = await admin.from(table).delete().eq('id', id);
    if (error) { console.error(`Cleanup failed for ${table} ${id}: ${error.message}`); cleanupFailed = true; }
  }
  for (const person of users) {
    const { error } = await admin.auth.admin.deleteUser(person.id);
    if (error) { console.error(`Cleanup failed for user ${person.id}: ${error.message}`); cleanupFailed = true; }
  }
  if (cleanupFailed) process.exitCode = 1;
  else console.log('PASS temporary fixture cleanup');
});
