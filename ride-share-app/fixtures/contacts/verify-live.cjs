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
fs.mkdirSync('.test-dist/contacts', { recursive: true });
const base = process.env.CHAT_TEST_BASE_URL || 'http://localhost:3104';
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
    for (const name of ['driver', 'one', 'outsider']) {
        const email = `room-test-${Date.now()}-${name}@${domain}`;
        const generated = check(await admin.auth.admin.generateLink({ type: 'magiclink', email }));
        const id = generated.user.id;
        const entry = { id, name };
        users.push(entry);
        check(await admin.from('profiles').insert({ id, full_name: `Room Test ${name}`, photo_url: `${base}/icon.svg`, university: 'UKIM', phone: name === 'one' ? null : '+38970123456', social_url: `https://x.com/${name}` }));
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
    const [driver, one, outsider] = users;
    await one.page.goto(`${base}/dashboard/trips`);
    await expect(one.page).toHaveURL(`${base}/onboarding`);
    await expect(one.page.getByLabel('Full name')).toHaveValue('Room Test one');
    await expect(one.page.getByLabel('Phone number')).toHaveAttribute('required','');
    await one.page.getByLabel('Phone number').fill('+389 70 222 333');
    await one.page.getByLabel('Social profile (optional)').fill('https://instagram.com/roomstudent');
    await one.page.getByRole('button',{name:'Complete profile & find a ride'}).click();
    await expect(one.page).toHaveURL(/\/rides/);
    const saved=check(await admin.from('profiles').select('phone, social_url, photo_url').eq('id',one.id).single());
    if(saved.phone!=='+38970222333'||saved.photo_url!==`${base}/icon.svg`)throw Error('Existing photo or normalized phone was not preserved');
    await one.page.goto(`${base}/onboarding`);
    await expect(one.page.getByLabel('Phone number')).toHaveValue('+38970222333');
    await one.page.screenshot({path:'.test-dist/contacts/profile.png',fullPage:true});
    console.log('PASS: existing account requires phone, preserves photo, saves social link, and can edit again');
    const cities=check(await admin.from('cities').select('id').order('id').limit(2));
    carId=check(await admin.from('cars').insert({owner_id:driver.id,make:'Test',model:'Contact car',fuel_type:'petrol',consumption_l_100km:6.5,seats_total:4}).select('id').single()).id;
    rideId=check(await admin.from('rides').insert({driver_id:driver.id,car_id:carId,origin_city_id:cities[0].id,dest_city_id:cities[1].id,departure_at:new Date(Date.now()+86400000).toISOString(),seats_total:4,seats_available:4,status:'published',price_per_seat_mkd:300}).select('id').single()).id;
    check(await admin.from('bookings').insert({ride_id:rideId,passenger_id:one.id,status:'accepted',decided_at:new Date(Date.now()-60000).toISOString()}));
    await outsider.page.goto(`${base}/rides/${rideId}`);
    await outsider.page.getByRole('button',{name:'Request my seat',exact:true}).click();
    await expect(outsider.page.getByText('requested',{exact:true})).toBeVisible();
    await outsider.page.goto(`${base}/rides/${rideId}/chat`);
    await expect(outsider.page.getByRole('heading',{name:'Ride room unavailable'})).toBeVisible();
    await driver.page.goto(`${base}/dashboard/trips?view=driver`);
    const request=driver.page.locator('article').filter({hasText:'Room Test outsider'});
    await expect(request.getByRole('link',{name:'+38970123456',exact:true})).toHaveAttribute('href','tel:+38970123456');
    await driver.page.screenshot({path:'.test-dist/contacts/request.png',fullPage:true});
    await request.getByRole('button',{name:'Accept',exact:true}).click();
    await expect(request.getByText('accepted',{exact:true})).toHaveCount(1);
    console.log('PASS: booking request shares phone before acceptance, pending room access is denied');
    await one.page.goto(`${base}/rides/${rideId}/chat`);
    const roster=one.page.getByLabel('Room participants');
    await expect(roster.getByRole('listitem')).toHaveCount(3);
    await expect(roster.getByRole('link',{name:'+38970222333',exact:true})).toHaveAttribute('href','tel:+38970222333');
    await expect(roster.getByRole('link',{name:/instagram.com/})).toHaveAttribute('href','https://instagram.com/roomstudent');
    await one.page.screenshot({path:'.test-dist/contacts/room-desktop.png',fullPage:true});
    await one.page.setViewportSize({width:375,height:850});
    const overflow=await one.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    if(overflow)throw Error('Mobile contacts overflow the viewport');
    await one.page.screenshot({path:'.test-dist/contacts/room-mobile.png',fullPage:true});
    await outsider.page.reload();
    await expect(outsider.page.getByLabel('Room participants').getByRole('listitem')).toHaveCount(3);
    await outsider.page.goto(`${base}/profile/${one.id}`);
    await expect(outsider.page.getByRole('link',{name:'+38970222333',exact:true})).toHaveCount(0);
    await expect(outsider.page.locator('a[href="https://instagram.com/roomstudent"]')).toHaveCount(0);
    console.log('PASS: accepted room participants see contacts, mobile fits, public profile omits contacts');
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


