/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser verifier, separate from the Next.js bundle. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const repo = path.resolve(__dirname, '../..');
mkdirSync(path.join(repo, '.scratch'), { recursive: true });
process.loadEnvFile(path.join(repo, 'ride-share-app/.env'));
const { createClient } = require(path.join(repo, 'ride-share-app/node_modules/@supabase/supabase-js'));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const base = process.env.UX_BASE_URL || 'http://localhost:3102';
const users = [], rideIds = [], carIds = [];
let browser;
async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}
async function user(role) {
  const email = `tier2-${role}-${randomUUID()}@${process.env.STUDENT_EMAIL_DOMAINS.split(',')[0].trim()}`;
  const data = await checked(admin.auth.admin.createUser({ email, email_confirm: true }));
  users.push(data.user.id);
  await checked(admin.from('profiles').insert({ id: data.user.id, full_name: `Tier Two ${role}`, university: 'Synthetic Verification', photo_url: `${base}/icon.svg?fixture-avatar=1`, phone: 'PRIVATE-CONTACT-TIER2' }));
  return { id: data.user.id, email };
}
async function signedIn(person) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${base}/login`);
  await page.getByLabel('Student email').fill(person.email);
  await page.getByRole('button', { name: 'Development sign-in (no email)' }).click();
  try {
    await page.waitForURL('**/rides', { timeout: 60000, waitUntil: 'domcontentloaded' });
  } catch (error) {
    const notice = await page.locator('#login-message').textContent().catch(() => 'No login message');
    throw new Error(`Sign-in failed at ${new URL(page.url()).pathname}: ${notice || error.message}`);
  }
  return page;
}
async function visible(page, text) {
  await page.getByText(text, { exact: true }).first().waitFor();
}
async function mobile(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal mobile overflow');
}
async function main() {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const parent = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await parent.goto(`${base}/trip/invalid`);
  await visible(parent, 'Itinerary unavailable');
  assert.match(await parent.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
  assert.equal(await parent.locator('meta[name="referrer"]').getAttribute('content'), 'no-referrer');
  console.log('PASS signed-out unavailable page and privacy metadata');

  const driver = await user('Driver');
  const passenger = await user('Passenger');
  const other = await user('Other');
  const cities = await checked(admin.from('cities').select('id').order('id').limit(2));
  assert.equal(cities.length, 2);
  const car = await checked(admin.from('cars').insert({ owner_id: driver.id, make: 'Verification', model: 'Petrol', fuel_type: 'petrol', consumption_l_100km: 7, color: 'Blue', seats_total: 4 }).select('id').single());
  carIds.push(car.id);
  const ride = await checked(admin.from('rides').insert({ driver_id: driver.id, car_id: car.id, origin_city_id: cities[0].id, dest_city_id: cities[1].id, departure_at: new Date(Date.now() + 3600000).toISOString(), seats_total: 4, seats_available: 4, status: 'published', details: { distance_km: 100, verification: 'pero-tier2' } }).select('id').single());
  rideIds.push(ride.id);
  await checked(admin.from('bookings').insert({ ride_id: ride.id, passenger_id: passenger.id, seats: 2, status: 'accepted', decided_at: new Date().toISOString(), message: 'PRIVATE-BOOKING-TIER2' }));
  const riderPage = await signedIn(passenger);
  const driverPage = await signedIn(driver);
  const otherPage = await signedIn(other);
  await riderPage.goto(`${base}/dashboard/trips`);
  await visible(riderPage, 'Your passenger savings');
  await mobile(riderPage);
  await riderPage.getByText('Booking options', { exact: true }).first().click();
  await riderPage.getByRole('button', { name: 'Create or retrieve link' }).click();
  await riderPage.getByLabel('Trip link', { exact: true }).waitFor();
  const sharedUrl = await riderPage.getByLabel('Trip link', { exact: true }).inputValue();
  await riderPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await riderPage.getByRole('button', { name: 'Copy link', exact: true }).click();
  await visible(riderPage, 'Trip link copied.');
  assert.equal(await riderPage.evaluate(() => navigator.clipboard.readText()), sharedUrl);
  let avatarReferrer;
  parent.on('request', request => { if (request.url().includes('fixture-avatar')) avatarReferrer = request.headers().referer || ''; });
  await parent.goto(sharedUrl);
  await visible(parent, 'Shared itinerary');
  await visible(parent, 'Tier Two Driver');
  const html = await parent.content();
  for (const secret of ['PRIVATE-CONTACT-TIER2', 'PRIVATE-BOOKING-TIER2', 'PRIVATE-APPLICANT-TIER2', 'Tier Two Passenger', 'Tier Two Other']) assert(!html.includes(secret));
  assert.equal(avatarReferrer, '');
  await mobile(parent);
  await riderPage.getByRole('button', { name: 'Revoke link' }).click();
  await visible(riderPage, 'Trip link revoked. New visits cannot open it.');
  await parent.reload();
  await visible(parent, 'Itinerary unavailable');
  console.log('PASS create/copy/public projection/photo referrer/revoke/mobile');

  await riderPage.goto(`${base}/rides/${ride.id}`);
  const malicious = '<img src=x onerror="window.tier2Injected=true">';
  await riderPage.getByLabel('Ask a question or answer').fill(malicious);
  await riderPage.getByRole('button', { name: 'Post comment' }).click();
  await visible(riderPage, malicious);
  assert.equal(await riderPage.evaluate(() => window.tier2Injected), undefined);
  await driverPage.goto(`${base}/rides/${ride.id}`);
  await visible(driverPage, malicious);
  assert.equal(await driverPage.getByRole('button', { name: 'Delete my comment' }).count(), 0);
  await driverPage.getByLabel('Ask a question or answer').fill('Yes, luggage is welcome.');
  await driverPage.getByRole('button', { name: 'Post comment' }).click();
  await visible(driverPage, 'Yes, luggage is welcome.');
  await otherPage.goto(`${base}/rides/${ride.id}`);
  await visible(otherPage, 'Yes, luggage is welcome.');
  assert.equal(await otherPage.getByRole('button', { name: 'Delete my comment' }).count(), 0);
  await riderPage.reload();
  await riderPage.getByRole('button', { name: 'Delete my comment' }).click();
  await riderPage.getByText(malicious, { exact: true }).waitFor({ state: 'detached' });
  await mobile(riderPage);
  console.log('PASS three-user Q&A, escaped markup, author deletion, mobile');

  // Exercise the existing Tier 1 request/decision/contact/cancellation path.
  await otherPage.goto(`${base}/rides/${ride.id}`);
  await otherPage.getByRole('button', { name: 'Send request' }).click();
  await otherPage.waitForURL(/success=/);
  await otherPage.goto(`${base}/dashboard/trips`);
  assert(!(await otherPage.locator('body').innerText()).includes('PRIVATE-CONTACT-TIER2'));
  await driverPage.goto(`${base}/dashboard/driver`);
  await driverPage.getByRole('button', { name: 'Accept', exact: true }).click();
  await visible(driverPage, 'Request accepted.');
  await otherPage.reload();
  assert((await otherPage.locator('body').innerText()).includes('PRIVATE-CONTACT-TIER2'));
  await otherPage.getByText('Booking options', { exact: true }).click();
  await otherPage.getByRole('button', { name: 'Cancel booking' }).click();
  await visible(otherPage, 'Booking cancelled.');
  const released = await checked(admin.from('rides').select('seats_available').eq('id', ride.id).single());
  assert.equal(released.seats_available, 2);
  await otherPage.goto(`${base}/rides/${ride.id}`);
  await otherPage.getByRole('button', { name: 'Send request' }).click();
  await otherPage.waitForURL(/success=/);
  await driverPage.goto(`${base}/dashboard/driver`);
  await driverPage.getByRole('button', { name: 'Decline', exact: true }).click();
  await visible(driverPage, 'Request declined.');
  await otherPage.goto(`${base}/dashboard/trips`);
  await visible(otherPage, 'declined');
  assert(!(await otherPage.locator('body').innerText()).includes('PRIVATE-CONTACT-TIER2'));
  console.log('PASS Tier 1 request/accept/contact reveal/cancel/seat release/decline');

  await checked(admin.from('rides').update({ departure_at: new Date(Date.now() - 3600000).toISOString() }).eq('id', ride.id));
  await driverPage.goto(`${base}/dashboard/driver`);
  await driverPage.getByRole('button', { name: 'Mark completed' }).click();
  await driverPage.getByText('completed', { exact: true }).first().waitFor();
  assert.equal(await driverPage.getByRole('button', { name: 'Accept', exact: true }).count(), 0);
  const completed = await checked(admin.from('rides').select('status,seats_available').eq('id', ride.id).single());
  assert.deepEqual(completed, { status: 'completed', seats_available: 2 });
  await riderPage.goto(`${base}/dashboard/trips`);
  const personal = riderPage.getByRole('heading', { name: 'Your passenger savings' }).locator('..');
  assert.match(await personal.innerText(), /32\.34/);
  await riderPage.getByText('Booking options', { exact: true }).first().click();
  await riderPage.getByRole('button', { name: 'Create or retrieve link' }).click();
  await riderPage.getByLabel('Trip link', { exact: true }).waitFor();
  const completedUrl = await riderPage.getByLabel('Trip link', { exact: true }).inputValue();
  await parent.goto(completedUrl);
  await visible(parent, 'Shared itinerary');
  await riderPage.getByRole('button', { name: 'Cancel booking' }).click();
  await visible(riderPage, 'Booking cancelled.');
  assert.doesNotMatch(await personal.innerText(), /32\.34/);
  await parent.reload();
  await visible(parent, 'Itinerary unavailable');
  console.log('PASS completion, unchanged seat counts, counter arithmetic, cancellation invalidation');
}

(process.env.UX_ONLY === 'true' ? Promise.resolve() : main()).then(verifyUX).catch(error => { console.error('FAIL', error.stack); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  // Every ID in users was created by this run. Remove only those users' fixtures.
  let removedRides = 0, removedCars = 0;
  for (const id of users) {
    removedRides += (await checked(admin.from('rides').delete().eq('driver_id', id).select('id'))).length;
    removedCars += (await checked(admin.from('cars').delete().eq('owner_id', id).select('id'))).length;
    await checked(admin.from('imports').delete().eq('created_by', id));
    const files = await checked(admin.storage.from('profile-photos').list(id));
    if (files.length) await checked(admin.storage.from('profile-photos').remove(files.map(file => `${id}/${file.name}`)));
  }
  // Delete only IDs returned from fixture creation in this run, never existing data.
  for (const id of users) await checked(admin.auth.admin.deleteUser(id));
  console.log(`Cleaned up ${removedRides} synthetic rides, ${removedCars} cars, uploaded photos, and ${users.length} test users.`);
});

async function screenshot(page, name) {
  await page.screenshot({ caret: 'initial', path: path.join(repo, '.scratch', `ux-${name}.png`), fullPage: true });
  await page.screenshot({ caret: 'initial', path: path.join(repo, '.scratch', `ux-viewport-${name}.png`) });
}
async function responsive(page, label) {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: overflow at ${width}px`);
    if (width === 390) await page.screenshot({ caret: 'initial', path: path.join(repo, '.scratch', `ux-mobile-${label.toLowerCase().replaceAll(' ', '-')}.png`) });
  }
}
async function menu(page) {
  const button = page.getByRole('button', { name: 'Menu', exact: true });
  if (await button.isVisible()) await button.click();
}
async function verifyUX() {
  browser ??= await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const visitor = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await visitor.goto(base);
  await visitor.getByRole('heading', { level: 1 }).waitFor();
  await responsive(visitor, 'Landing');
  await screenshot(visitor, 'home');
  await visitor.getByRole('link', { name: 'Sign up', exact: true }).click();
  await visitor.getByRole('heading', { name: 'Your next ride starts here' }).waitFor();
  await responsive(visitor, 'Signup');
  await visitor.getByLabel('Student email').fill('not-a-student@example.invalid');
  await visitor.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await visible(visitor, 'Use an approved student email address to continue.');
  assert.equal(await visitor.getByLabel('Student email').getAttribute('aria-invalid'), 'true');
  for (const route of ['/rides', '/rides/new', '/rides/import', '/dashboard/trips', '/dashboard/driver', '/onboarding']) {
    await visitor.goto(base + route);
    await visitor.waitForURL(/\/login\?next=/);
    assert.equal(new URL(visitor.url()).searchParams.get('next'), route);
  }
  console.log('PASS landing, signup entry, invalid domain, all protected routes');

  const signupEmail = `ux-signup-${randomUUID()}@${process.env.STUDENT_EMAIL_DOMAINS.split(',')[0].trim()}`;
  const signup = await checked(admin.auth.admin.createUser({ email: signupEmail, email_confirm: true }));
  users.push(signup.user.id);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const runtimeErrors = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) runtimeErrors.push(message.text());
  });
  await page.goto(base + '/login?mode=signup');
  await page.getByLabel('Student email').fill(signupEmail);
  await page.getByRole('button', { name: 'Development sign-in (no email)' }).click();
  await page.waitForURL('**/onboarding');
  await page.getByLabel('Full name').waitFor();
  await responsive(page, 'Onboarding');
  await screenshot(page, 'onboarding');
  await page.getByLabel('Profile photo').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
  await visible(page, 'Choose a JPEG, PNG, or WebP image.');
  await page.getByLabel('Full name').fill('UX Verification Student');
  await page.getByLabel('University').fill('Synthetic Verification University');
  await page.getByLabel('Bio').fill('UI regression test profile.');
  await page.getByLabel('Gender').selectOption('woman');
  await page.getByLabel('Profile photo').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Complete profile & find a ride' }).click();
  await page.waitForURL('**/rides?welcome=1');
  await visible(page, 'Your profile is ready. Welcome aboard — find your first ride below.');
  const savedProfile = await checked(admin.from('profiles').select('full_name,university,bio,gender,photo_url').eq('id', signup.user.id).single());
  assert.equal(savedProfile.full_name, 'UX Verification Student');
  assert.equal(savedProfile.bio, 'UI regression test profile.');
  assert.equal(savedProfile.gender, 'woman');
  assert(savedProfile.photo_url.includes(signup.user.id));
  await responsive(page, 'Feed');
  await screenshot(page, 'feed');
  await page.setViewportSize({ width: 390, height: 844 });
  await menu(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['Find a ride', 'Offer a ride', 'My trips', 'My rides', 'Profile']) await nav.getByRole('link', { name: label, exact: true }).waitFor();
  await nav.getByRole('button', { name: 'Sign out' }).waitFor();
  await nav.getByRole('link', { name: 'Profile', exact: true }).click();
  await page.getByRole('heading', { name: 'UX Verification Student' }).waitFor();
  await responsive(page, 'Profile');
  await screenshot(page, 'profile');
  console.log('PASS actual profile upload/save, all fields, authenticated mobile navigation, public profile');

  const cities = await checked(admin.from('cities').select('id,name_en').order('id').limit(2));
  const pickups = await checked(admin.from('pickup_points').select('id,name_en').eq('city_id', cities[0].id).limit(1));
  assert(pickups.length);
  async function fillRide(mode) {
    await page.goto(base + '/rides/new');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await screenshot(page, 'create-initial');
    await page.locator('[name="originCityId"]').selectOption(String(cities[0].id));
    await page.locator('[name="originPickupPointId"]').selectOption(String(pickups[0].id));
    await page.locator('[name="destinationCityId"]').selectOption(String(cities[1].id));
    const departure = new Date(Date.now() + 86400000 * 3);
    await page.getByLabel('Departure', { exact: true }).fill(departure.toISOString().slice(0, 16));
    await page.getByLabel('Available seats', { exact: true }).fill('3');
    await page.getByLabel('Price per seat (MKD)', { exact: true }).fill('400');
    if (mode === 'manual') {
      await page.getByRole('button', { name: 'Enter manually', exact: true }).click();
      await page.getByLabel('Make', { exact: true }).fill('UX');
      await page.getByLabel('Model', { exact: true }).fill('Verification');
      await page.getByLabel('Consumption (L/100 km)', { exact: true }).fill('7');
      await page.getByLabel('Color (optional)', { exact: true }).fill('Sage');
      await page.getByLabel('Last 3 plate characters (optional)', { exact: true }).fill('UX1');
    } else if (mode === 'catalog') {
      await page.getByRole('button', { name: 'Find model', exact: true }).click();
      await page.locator('[name="carModelId"]').selectOption({ index: 1 });
      assert(Number(await page.getByLabel('Consumption (L/100 km)', { exact: true }).inputValue()) > 0);
    } else {
      await page.getByRole('button', { name: 'Saved car', exact: true }).click();
      await page.locator('[name="carId"]').selectOption({ index: 1 });
    }
    await page.getByText('Estimate fuel costs & CO₂ savings', { exact: true }).click();
    await page.getByLabel('Estimated route distance (km)', { exact: true }).fill('100');
    await page.getByLabel('No smoking', { exact: true }).check();
    await page.locator('[name="genderPreference"]').selectOption('any');
    await page.getByLabel('Notes', { exact: true }).fill('UX regression fixture. Pickup by the main entrance.');
  }
  await fillRide('manual');
  await responsive(page, 'Create ride');
  await screenshot(page, 'create');
  // Existing validation must still reject impossible routes.
  await page.locator('[name="destinationCityId"]').selectOption(String(cities[0].id));
  await page.getByRole('button', { name: 'Publish ride', exact: true }).click();
  await page.locator('main').getByRole('alert').waitFor();
  assert.equal(await page.locator('[name="carMake"]').inputValue(), 'UX', 'Validation must retain the entered car make');
  assert.equal(await page.locator('[name="notes"]').inputValue(), 'UX regression fixture. Pickup by the main entrance.', 'Validation must retain notes');
  assert.equal(await page.locator('[name="originCityId"]').inputValue(), String(cities[0].id));
  await page.locator('[name="destinationCityId"]').selectOption(String(cities[1].id));
  await page.getByRole('button', { name: 'Publish ride', exact: true }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+\?success=/, { timeout: 15000 }).catch(async error => {
    console.log('CREATE FAILURE', await page.locator('form.ride-form').evaluate(form => Array.from(form.elements).filter(el => el.name && el.type !== 'hidden').map(el => ({ name: el.name, value: el.value, valid: el.checkValidity(), message: el.validationMessage }))));
    console.log('PAGE', (await page.locator('main').innerText()).slice(-2400));
    await screenshot(page, 'create-failure');
    throw error;
  });
  await visible(page, 'Ride published.');
  const createdId = new URL(page.url()).pathname.split('/').pop();
  const created = await checked(admin.from('rides').select('*').eq('id', createdId).single());
  assert.equal(created.status, 'published');
  assert.equal(created.origin_pickup_id, pickups[0].id);
  assert.equal(created.price_per_seat_mkd, 400);
  assert.equal(created.seats_total, 3);
  assert.deepEqual(created.tags, ['no_smoking']);
  assert.equal(created.notes, 'UX regression fixture. Pickup by the main entrance.');
  await visible(page, pickups[0].name_en);
  await responsive(page, 'Ride details');
  await screenshot(page, 'detail');
  await page.getByRole('link', { name: 'Manage my ride' }).click();
  await page.getByRole('heading', { name: 'My rides' }).waitFor();
  await responsive(page, 'Driver dashboard');
  await screenshot(page, 'driver');
  console.log('PASS manual car, validation recovery, publish, saved data, pickup display, redirect, owner management');

  await fillRide('existing');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+\?success=/);
  await visible(page, 'Ride saved as a draft.');
  const draftId = new URL(page.url()).pathname.split('/').pop();
  assert.equal((await checked(admin.from('rides').select('status').eq('id', draftId).single())).status, 'draft');
  await fillRide('catalog');
  const suggestion = page.getByRole('button', { name: /Use .* MKD suggestion/ });
  if (await suggestion.count()) {
    await suggestion.click();
    assert(Number(await page.getByLabel('Price per seat (MKD)', { exact: true }).inputValue()) > 0);
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.waitForURL(/\/rides\/[0-9a-f-]+\?success=/);
  console.log('PASS saved-car and catalog modes, private draft save and redirect');
  if (!(await suggestion.count())) console.log('LIMITATION no configured fuel price: estimate arithmetic is covered by automated tests.');

  await page.goto(base + '/rides');
  await page.getByText('Filter by city, date or seats', { exact: true }).click();
  const filters = page.getByRole('form', { name: 'Filter rides' });
  await filters.locator('[name="origin"]').selectOption(String(cities[0].id));
  await filters.locator('[name="destination"]').selectOption(String(cities[1].id));
  await filters.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForURL(/origin=/);
  const card = page.locator('article').filter({ has: page.locator(`a[href="/rides/${createdId}"]`) });
  await card.waitFor();
  await card.getByText('Departure', { exact: true }).waitFor();
  await card.getByText('Destination', { exact: true }).waitFor();
  await card.getByText(pickups[0].name_en, { exact: true }).waitFor();
  await page.screenshot({ caret: 'initial', path: path.join(repo, '.scratch', 'ux-filtered-feed.png'), fullPage: true });
  await filters.getByLabel('Date', { exact: true }).fill('2099-01-01');
  await filters.getByRole('button', { name: 'Apply filters' }).click();
  await page.getByRole('heading', { name: 'No rides match yet' }).waitFor();
  await page.getByRole('link', { name: 'Show all rides' }).click();
  await page.waitForURL('**/rides');
  // The error case is deliberately injected only at the browser boundary.
  await page.route('**/api/search', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'AI search is temporarily unavailable. Use the manual filters instead.' }) }));
  await page.getByLabel('Describe the ride you need').fill('Skopje tomorrow');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await visible(page, 'AI search is temporarily unavailable. Use the manual filters instead.');
  await page.getByText('Filter by city, date or seats', { exact: true }).click();
  await filters.getByRole('button', { name: 'Apply filters' }).waitFor();
  await page.unroute('**/api/search');
  console.log('PASS manual filters, route card landmarks, empty state recovery, AI failure fallback');

  await page.getByLabel('Describe the ride you need').fill('from Skopje to Kumanovo');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await Promise.race([
    page.getByRole('region', { name: 'Search interpretation' }).waitFor({ timeout: 90000 }),
    page.locator('main').getByRole('alert').waitFor({ timeout: 90000 })
  ]);
  if (await page.getByRole('region', { name: 'Search interpretation' }).isVisible()) {
    assert.equal(new URL(page.url()).searchParams.get('origin'), String(cities[0].id));
    assert.equal(new URL(page.url()).searchParams.get('destination'), String(cities[1].id));
    console.log('PASS live natural-language search and filter interpretation');
  } else {
    console.log('LIMITATION live search service:', await page.locator('main').getByRole('alert').innerText());
  }
  await page.goto(base + '/rides/import');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await responsive(page, 'Import');
  await screenshot(page, 'import');
  await page.getByLabel('Source').selectOption('viber');
  await page.getByLabel('Post text').fill('Имам 3 слободни места од Скопје кај Мавровка до Куманово утре во 18:00, 400 денари по човек.');
  await page.getByRole('button', { name: 'Create review draft' }).click();
  await Promise.race([
    page.getByRole('heading', { name: 'Review the extracted details' }).waitFor({ timeout: 90000 }),
    page.locator('main').getByRole('alert').waitFor({ timeout: 90000 })
  ]);
  if (await page.getByRole('heading', { name: 'Review the extracted details' }).isVisible()) {
    assert.equal(await page.getByText('Origin city ID', { exact: true }).count(), 0);
    await screenshot(page, 'import-review');
    await page.getByRole('link', { name: 'Continue to editable ride form' }).click();
    await page.locator('[name="originCityId"]').waitFor();
    assert.equal(await page.locator('[name="originCityId"]').inputValue(), String(cities[0].id));
    console.log('PASS live AI post parsing, readable location review, editable prefill');
  } else {
    console.log('LIMITATION live import service:', await page.locator('main').getByRole('alert').innerText());
  }
  await page.goto(base + '/dashboard/driver');
  const rideSection = page.locator('section').filter({ has: page.locator(`a[href="/rides/${createdId}"]`) }).first();
  if (!(await rideSection.locator('details').first().getAttribute('open')) && !(await rideSection.getByRole('button', { name: 'Cancel ride', exact: true }).isVisible())) await rideSection.locator('summary').first().click();
  await rideSection.getByRole('button', { name: 'Cancel ride', exact: true }).click();
  await rideSection.getByRole('button', { name: 'Keep ride', exact: true }).click();
  assert.equal((await checked(admin.from('rides').select('status').eq('id', createdId).single())).status, 'published');
  const fullPassenger = await user('FullRide');
  await checked(admin.from('bookings').insert({ ride_id: createdId, passenger_id: fullPassenger.id, seats: 3, status: 'accepted', decided_at: new Date().toISOString() }));
  await page.reload();
  if (!(await rideSection.locator('details').first().getAttribute('open')) && !(await rideSection.getByRole('button', { name: 'Cancel ride', exact: true }).isVisible())) await rideSection.locator('summary').first().click();
  await rideSection.getByRole('button', { name: 'Cancel ride', exact: true }).click();
  assert(await rideSection.getByRole('button', { name: 'Confirm cancellation', exact: true }).isDisabled());
  await rideSection.getByRole('checkbox', { name: 'I understand that confirmed passengers will need other plans.' }).check();
  await rideSection.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await rideSection.getByText('cancelled', { exact: true }).waitFor();
  assert.equal((await checked(admin.from('rides').select('status').eq('id', createdId).single())).status, 'cancelled');
  await menu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login?status=signed-out');
  await visible(page, 'You have been signed out safely.');
  await page.goto(base + '/dashboard/driver');
  await page.waitForURL(/\/login\?next=/);
  // Validate the real callback handler using a generated test token, without sending email.
  const magic = await checked(admin.auth.admin.generateLink({ type: 'magiclink', email: signupEmail }));
  await page.goto(`${base}/auth/callback?token_hash=${encodeURIComponent(magic.properties.hashed_token)}&type=magiclink&next=%2Fdashboard%2Ftrips`);
  await page.waitForURL('**/dashboard/trips');
  await responsive(page, 'Passenger dashboard');
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, 'trips-mobile');
  await menu(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.waitForURL('**/login?status=signed-out');
  assert.deepEqual(runtimeErrors, []);
  console.log('PASS full-ride cancellation acknowledgement/keep/cancel, sign out, actual magic-link callback and return path, protected redirect, no browser runtime errors');
}
