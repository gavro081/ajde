/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');
const { expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 15000 });
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const fs = require('node:fs');
process.loadEnvFile('.env');
if (process.env.CHAT_LIVE_TESTS !== '1')
    throw new Error('Set CHAT_LIVE_TESTS=1 to authorize temporary Supabase fixtures.');
fs.mkdirSync('.test-dist/chat', { recursive: true });
const base = process.env.CHAT_TEST_BASE_URL || 'http://localhost:3102';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
let rideId, carId, browser;
function check(r) { if (r.error)
    throw new Error(r.error.message); return r.data; }
(async () => {
    browser = await chromium.launch({ channel: process.env.CHAT_TEST_BROWSER || 'msedge', headless: true });
    const domain = (process.env.STUDENT_EMAIL_DOMAINS || 'students.finki.ukim.mk').split(',')[0];
    for (const name of ['driver', 'one', 'two', 'pending', 'outsider', 'late']) {
        const email = `room-test-${Date.now()}-${name}@${domain}`;
        const generated = check(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
        const id = generated.user.id;
        const entry = { id, name };
        users.push(entry);
        check(await admin.from('profiles').insert({ id, full_name: `Room Test ${name}`, photo_url: `${base}/icon.svg`, university: 'UKIM', phone: '+38970123456' }));
        const jar = [];
        const session = createServerClient(url, key, { cookies: { getAll: () => jar, setAll: values => { for (const c of values) {
                    const i = jar.findIndex(x => x.name === c.name);
                    if (i >= 0)
                        jar.splice(i, 1);
                    jar.push(c);
                } } } });
        check(await session.auth.verifyOtp({ token_hash: generated.properties.hashed_token, type: generated.properties.verification_type }));
        entry.context = await browser.newContext({ viewport: { width: name === 'two' ? 375 : 1100, height: 850 } });
        await entry.context.addCookies(jar.map(c => ({ name: c.name, value: c.value, url: base, httpOnly: false, sameSite: 'Lax' })));
        entry.page = await entry.context.newPage();
        entry.events = [];
        entry.page.on('websocket', ws => ws.on('framereceived', f => { try {
            const raw = JSON.parse(String(f.payload));
            const event = Array.isArray(raw) ? { event: raw[3], payload: raw[4] } : raw;
            if (event.event === 'postgres_changes')
                entry.events.push(event.payload?.data?.record?.body);
        }
        catch { /* Ignore non-JSON transport frames. */ } }));
    }
    const driver = users[0], one = users[1], two = users[2], pending = users[3], outsider = users[4], late = users[5];
    const cities = check(await admin.from('cities').select('id').order('id').limit(2));
    carId = check(await admin.from('cars').insert({ owner_id: driver.id, make: 'Test', model: 'Room car', fuel_type: 'petrol', consumption_l_100km: 6.5, seats_total: 4 }).select('id').single()).id;
    rideId = check(await admin.from('rides').insert({ driver_id: driver.id, car_id: carId, origin_city_id: cities[0].id, dest_city_id: cities[1].id, departure_at: new Date(Date.now() + 86400000).toISOString(), seats_total: 4, seats_available: 4, status: 'published', price_per_seat_mkd: 300, details: { chat_test: true } }).select('id').single()).id;
    check(await admin.from('bookings').insert([one, two].map(u => ({ ride_id: rideId, passenger_id: u.id, status: 'accepted', decided_at: new Date(Date.now() - 60000).toISOString() }))));
    check(await admin.from('bookings').insert([pending, late].map(u => ({ ride_id: rideId, passenger_id: u.id, status: 'requested' }))));
    check(await admin.from('messages').insert(Array.from({ length: 55 }, (_, i) => ({ ride_id: rideId, sender_id: driver.id, body: `History ${String(i).padStart(2, '0')}` }))));
    for (const u of users)
        await u.page.goto(`${base}/rides/${rideId}/chat`);
    for (const u of [driver, one, two])
        await expect(u.page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });
    for (const u of [pending, outsider, late])
        await expect(u.page.getByRole('heading', { name: 'Ride room unavailable' })).toBeVisible();
    await expect(driver.page.getByLabel('Room messages').getByRole('listitem')).toHaveCount(50);
    await driver.page.getByRole('button', { name: 'Load older messages' }).click();
    await expect(driver.page.getByLabel('Room messages').getByRole('listitem')).toHaveCount(55);
    const send = async (user, text) => {
        await user.page.bringToFront();
        const input = user.page.getByLabel('Message to the ride group');
        await input.fill(text);
        await expect(user.page.getByRole('button', {name:'Send message',exact:true})).toBeEnabled();
        await input.press('Enter');
        await expect(user.page.getByText(text,{exact:true})).toHaveCount(1);
        await expect(input).toHaveValue('');
    };
    for (const sender of [driver, one, two]) {
        const text = `Live reply from ${sender.name}`;
        await send(sender, text);
        for (const u of [driver, one, two]) {
            await expect(u.page.getByText(text, { exact: true })).toHaveCount(1, { timeout: 12000 });
            await expect.poll(() => u.events.includes(text), { timeout: 12000 }).toBe(true);
        }
    }
    console.log('PASS: real WebSocket delivery to driver and two passengers; denied pending and unrelated; 55-message pagination');
    await two.page.reload();
    await expect(two.page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(two.page.getByText('Live reply from driver', { exact: true })).toBeVisible();
    const long = 'x'.repeat(1900);
    await send(two, long);
    await expect(one.page.getByText(long, { exact: true })).toHaveCount(1);
    const width = await two.page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
    if (width.scroll > width.viewport)
        throw new Error('Mobile horizontal overflow');
    await two.page.screenshot({ path: '.test-dist/chat/mobile.png', fullPage: true });
    await one.page.getByLabel('Message to the ride group').fill('Line one');
    await one.page.getByLabel('Message to the ride group').press('Shift+Enter');
    await one.page.getByLabel('Message to the ride group').press('L');
    await one.page.getByLabel('Message to the ride group').press('Enter');
    await expect(one.page.getByLabel('Message to the ride group')).toBeFocused();
    check(await admin.from('bookings').update({ status: 'accepted', decided_at: new Date().toISOString() }).eq('ride_id', rideId).eq('passenger_id', late.id));
    await late.page.reload();
    await expect(late.page.getByLabel('Room messages').getByRole('listitem')).toHaveCount(50);
    await late.page.getByRole('button', { name: 'Load older messages' }).click();
    await expect(late.page.getByText('History 00', { exact: true })).toBeVisible();
    await expect(late.page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30000 });
    await send(driver, 'Only after late joined');
    await expect(late.page.getByText('Only after late joined', { exact: true })).toBeVisible();
    await expect(late.page.getByText('Live reply from driver', { exact: true })).toHaveCount(1);
    console.log('PASS: reload, mobile long text, keyboard send/focus, new member full history');
    await two.context.setOffline(true);
    await expect(two.page.getByText('Offline — retry when connected')).toBeVisible();
    await send(driver, 'Missed while offline');
    await two.context.setOffline(false);
    await two.page.getByRole('button', { name: 'Retry connection' }).click();
    await expect(two.page.getByText('Missed while offline', { exact: true })).toHaveCount(1, { timeout: 30000 });
    check(await admin.from('bookings').update({ status: 'cancelled' }).eq('ride_id', rideId).eq('passenger_id', two.id));
    await expect(two.page.getByRole('heading', { name: 'Ride room unavailable' })).toBeVisible({ timeout: 35000 });
    const count = two.events.length;
    await send(driver, 'After passenger cancellation');
    await expect(one.page.getByText('After passenger cancellation', { exact: true })).toBeVisible();
    if (two.events.length !== count)
        throw new Error('Cancelled passenger received message event');
    const detail = await one.context.newPage();
    await detail.goto(`${base}/rides/${rideId}`);
    await expect(detail.getByRole('link', { name: 'Ride room', exact: true })).toBeVisible();
    await detail.getByLabel('Ask a question or answer').fill('Public Q&A regression');
    await detail.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(detail.getByText('Public Q&A regression', { exact: true })).toBeVisible();
    const publicDetail = await outsider.context.newPage();
    await publicDetail.goto(`${base}/rides/${rideId}`);
    await expect(publicDetail.getByText('Public Q&A regression', { exact: true })).toBeVisible();
    await expect(publicDetail.getByRole('link', { name: 'Ride room', exact: true })).toHaveCount(0);
    await expect(publicDetail.getByText('+38970123456', { exact: false })).toHaveCount(0);
    const trips = await one.context.newPage();
    await trips.goto(`${base}/dashboard/trips`);
    await expect(trips.getByText('Driver contact: +38970123456', { exact: true })).toBeVisible();
    await trips.getByRole('link', { name: 'View trip', exact: true }).click();
    await expect(trips).toHaveURL(`${base}/rides/${rideId}`);
    await expect(trips.getByRole('heading', { name: 'Request seats', exact: true })).toBeVisible();
    await trips.goto(`${base}/dashboard/trips`);
    await trips.getByRole('link', { name: 'Open ride chat', exact: true }).click();
    await expect(trips).toHaveURL(`${base}/rides/${rideId}/chat`);
    await expect(trips.getByRole('heading', { name: 'Ride room', exact: true })).toBeVisible();
    await trips.goto(`${base}/dashboard/trips`);
    await trips.locator('summary').filter({ hasText: 'Booking options' }).click();
    await trips.getByRole('button', { name: 'Create or retrieve link' }).click();
    await expect(trips.getByLabel('Trip link', { exact: true })).toBeVisible();
    const anonymous = await browser.newContext();
    const shared = await anonymous.newPage();
    await shared.goto(await trips.getByLabel('Trip link', { exact: true }).inputValue());
    await expect(shared.getByRole('heading', { name: 'Shared itinerary' })).toBeVisible();
    await expect(shared.getByText('+38970123456', { exact: false })).toHaveCount(0);
    await expect(shared.getByText('Room Test one', { exact: false })).toHaveCount(0);
    await trips.getByRole('button', { name: 'Revoke link', exact: true }).click();
    await expect(trips.getByText('Trip link revoked. New visits cannot open it.', { exact: true })).toBeVisible();
    await shared.reload();
    await expect(shared.getByRole('heading', { name: 'Itinerary unavailable' })).toBeVisible();
    await publicDetail.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(publicDetail.getByText('Seat request sent to the driver.', { exact: true })).toBeVisible();
    const outsiderTrips = await outsider.context.newPage();
    await outsiderTrips.goto(`${base}/dashboard/trips`);
    await expect(outsiderTrips.getByText('Awaiting approval', { exact: true })).toBeVisible();
    await expect(outsiderTrips.getByRole('link', {name:'Open ride chat',exact:true})).toHaveCount(0);
    await expect(outsiderTrips.getByText('Ride chat becomes available when the driver accepts your booking.',{exact:true})).toBeVisible();
    await expect(outsiderTrips.getByText('+38970123456', { exact: false })).toHaveCount(0);
    const dashboard = await driver.context.newPage();
    await dashboard.goto(`${base}/dashboard/driver`);
    const request = dashboard.locator('article').filter({ hasText: 'Room Test outsider' });
    await request.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(request.getByText('accepted', { exact: true })).toBeVisible();
    const pendingRequest = dashboard.locator('article').filter({ hasText: 'Room Test pending' });
    await pendingRequest.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(pendingRequest.getByText('declined', { exact: true })).toBeAttached();
    await dashboard.locator('summary').filter({ hasText: 'Manage ride' }).click();
    await expect(pendingRequest.getByText('declined', { exact: true })).toBeVisible();
    await outsiderTrips.reload();
    await expect(outsiderTrips.getByText('Driver contact: +38970123456', { exact: true })).toBeVisible();
    await publicDetail.reload();
    await expect(publicDetail.getByRole('link', { name: 'Ride room', exact: true })).toBeVisible();
    await outsiderTrips.locator('summary').filter({ hasText: 'Booking options' }).click();
    await outsiderTrips.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    await expect(outsiderTrips.getByText('cancelled', { exact: true })).toBeVisible();
    await outsider.page.reload();
    await expect(outsider.page.getByRole('heading', { name: 'Ride room unavailable' })).toBeVisible();
    await dashboard.reload();
    await dashboard.locator('summary').filter({ hasText: 'Manage ride' }).click();
    await dashboard.getByRole('button', { name: 'Cancel ride', exact: true }).click();
    await dashboard.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await expect(dashboard.getByRole('button', { name: 'Confirm cancellation', exact: true })).toHaveCount(0);
    console.log('PASS: ride detail, public Q&A, contacts, trip sharing/revocation, request/accept/decline/cancel');
    await driver.page.reload();
    await expect(driver.page.getByLabel('Message to the ride group')).toBeDisabled();
    await expect(driver.page.getByText('Only after late joined', { exact: true })).toBeVisible();
    console.log('PASS: offline recovery, booking revocation, no cancelled-member events, cancelled ride read-only');
    await driver.page.screenshot({ path: '.test-dist/chat/desktop.png', fullPage: true });
    fs.writeFileSync('.test-dist/chat/live-results.json', JSON.stringify({ passed: true, date: new Date().toISOString(), cases: ['websocket-three-members', 'denied-users', 'pagination-55', 'reload', 'mobile-long-text', 'keyboard', 'full-history', 'offline-reconnect', 'cancellation', 'read-only', 'public-qa', 'contact-visibility', 'trip-sharing', 'booking-lifecycle'] }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
    const cleanup = async (action) => { try {
        await action();
    }
    catch (error) {
        console.error('Fixture cleanup failed:', error.message);
        process.exitCode = 1;
    } };
    if (browser)
        await cleanup(() => browser.close());
    if (rideId)
        await cleanup(async () => check(await admin.from('rides').delete().eq('id', rideId)));
    if (carId)
        await cleanup(async () => check(await admin.from('cars').delete().eq('id', carId)));
    for (const user of users)
        await cleanup(async () => check(await admin.auth.admin.deleteUser(user.id)));
    console.log('Finished cleanup of isolated chat fixtures');
});
