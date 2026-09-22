/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');

// Reused by the live room fixture. Browser AI responses are deterministic;
// server authorization/budget calls still hit the real development database.
module.exports = async function verifyAi({ users, rideId, base, admin, expect, send }) {
  const [driver, one, , pending, outsider, late] = users;
  for (const denied of [pending, outsider]) {
    const response = await denied.context.request.post(`${base}/api/chat/assist`, {
      headers: { origin: base }, data: { rideId, mode: 'summary' },
    });
    assert.equal(response.status(), 403);
  }
  const history = await admin.from('messages').select('id, body, created_at')
    .eq('ride_id', rideId).is('recipient_id', null).order('created_at').order('id');
  if (history.error) throw history.error;
  const first = history.data[0], last = history.data.at(-1);
  if (process.env.CHAT_AI_LIVE === '1') {
    const live = await driver.context.request.post(`${base}/api/chat/assist`, {
      headers: { origin: base }, data: { rideId, mode: 'question', question: 'What is the exact text of the earliest message in this chat?' }, timeout: 60000,
    });
    assert.equal(live.status(), 200);
    const result = await live.json();
    assert.equal(result.ok, true);
    assert.equal(result.value.messageCount, history.data.length);
    assert.ok(result.value.items.some(item => item.sources.some(source => source.id === first.id && source.body === first.body)));
    console.log('PASS: real authenticated AI endpoint cites the earliest synthetic message beyond the first browser page');
  }
  const answer = { mode: 'summary', insufficientEvidence: false,
    items: [{ category: 'information', text: 'Private summary of the earlier room discussion.',
      sources: [{ ...first, author: 'Room Test driver' }] }],
    messageCount: history.data.length, cutoff: { id: last.id, created_at: last.created_at } };
  await late.page.route('**/api/chat/assist', route => {
    const payload = route.request().postDataJSON();
    assert.equal(payload.rideId, rideId);
    return route.fulfill({ json: { ok: true, value: payload.mode === 'summary' ? answer : {
      ...answer, mode: 'question', items: [{ ...answer.items[0], text: 'Private answer about the earlier messages.' }],
    } } });
  });
  await late.page.getByRole('button', { name: 'Summarize chat', exact: true }).click();
  await expect(late.page.getByText(answer.items[0].text, { exact: true })).toBeVisible();
  assert.equal(await late.page.getByRole('dialog').evaluate(dialog => dialog.matches(':modal')), true);
  for (let index = 0; index < 8; index++) {
    await late.page.keyboard.press('Tab');
    assert.equal(await late.page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement)), true);
  }
  await late.page.getByText('Source messages (1)', { exact: true }).click();
  await expect(late.page.getByRole('dialog', { name: 'Private chat assistant' }).getByText(first.body, { exact: true })).toBeVisible();
  await expect(one.page.getByText(answer.items[0].text, { exact: true })).toHaveCount(0);
  await expect(driver.page.getByText(answer.items[0].text, { exact: true })).toHaveCount(0);
  await late.page.screenshot({ path: '.test-dist/chat/ai-desktop.png', fullPage: true });
  await send(driver, 'New detail after the AI summary');
  await expect(late.page.getByText('New messages since this answer.', { exact: true })).toBeVisible();
  await late.page.keyboard.press('Escape');
  await expect(late.page.getByRole('button', { name: 'Summarize chat', exact: true })).toBeFocused();
  await late.page.getByRole('button', { name: 'Ask AI', exact: true }).click();
  await expect(late.page.getByLabel('Your question')).toBeFocused();
  await late.page.getByLabel('Your question').fill('What was discussed before I joined?');
  await late.page.getByRole('button', { name: 'Ask about chat', exact: true }).click();
  await expect(late.page.getByText('Private answer about the earlier messages.', { exact: true })).toBeVisible();
  await expect(one.page.getByText('What was discussed before I joined?', { exact: true })).toHaveCount(0);
  await late.page.setViewportSize({ width: 375, height: 850 });
  await late.page.screenshot({ path: '.test-dist/chat/ai-mobile.png', fullPage: true });
  assert.equal(await late.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await late.page.keyboard.press('Escape');
  // Realtime room updates continue behind the modal during a slow AI fetch.
  await late.page.unroute('**/api/chat/assist');
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await late.page.route('**/api/chat/assist', async route => { await held; await route.fulfill({ json: { ok: true, value: answer } }).catch(() => {}); });
  await late.page.getByRole('button', { name: 'Summarize chat', exact: true }).click();
  await expect(late.page.getByText('Reading the chat…', { exact: true })).toBeVisible();
  await send(driver, 'Still chatting while AI is busy');
  await expect(driver.page.getByText('Still chatting while AI is busy', { exact: true })).toBeVisible();
  const cancelled = await admin.from('bookings').update({ status: 'cancelled' }).eq('ride_id', rideId).eq('passenger_id', late.id);
  if (cancelled.error) throw cancelled.error;
  await expect(late.page.getByRole('heading', { name: 'Ride room unavailable' })).toBeVisible({ timeout: 35000 });
  release();
  await expect(late.page.getByText(answer.items[0].text, { exact: true })).toHaveCount(0);
  const cancelledAi = await late.context.request.post(`${base}/api/chat/assist`, { headers: { origin: base }, data: { rideId, mode: 'summary' } });
  assert.equal(cancelledAi.status(), 403);
  const accepted = await admin.from('bookings').update({ status: 'accepted', decided_at: new Date().toISOString() }).eq('ride_id', rideId).eq('passenger_id', late.id);
  if (accepted.error) throw accepted.error;
  await late.page.unroute('**/api/chat/assist');
  await late.page.reload();
  await late.page.getByRole('button', { name: 'Load older messages', exact: true }).click();
  await expect(late.page.getByText(first.body, { exact: true })).toBeVisible();
  const ride = await admin.from('rides').select('status').eq('id', rideId).single();
  if (ride.error) throw ride.error;
  const closed = await admin.from('rides').update({ status: 'cancelled' }).eq('id', rideId);
  if (closed.error) throw closed.error;
  await late.page.reload();
  await expect(late.page.getByLabel('Message to the ride group')).toBeDisabled();
  await late.page.route('**/api/chat/assist', route => route.fulfill({ json: { ok: true, value: answer } }));
  await late.page.getByRole('button', { name: 'Summarize chat', exact: true }).click();
  await expect(late.page.getByText(answer.items[0].text, { exact: true })).toBeVisible();
  await late.page.unroute('**/api/chat/assist');
  const reopened = await admin.from('rides').update({ status: ride.data.status }).eq('id', rideId);
  if (reopened.error) throw reopened.error;
  await late.page.reload();
  // The identity is carried by these normal authenticated RPC calls, not a chosen user ID.
  const permits = await Promise.all(Array.from({ length: 10 }, () => late.client.rpc('try_chat_ai_request')));
  if (permits.some(r => r.error)) throw new Error('Budget RPC failed');
  assert.equal(permits.filter(r => r.data === true).length, 5);
  console.log('PASS: private summary/questions, source excerpts, stale state, mobile layout, concurrent chat, access loss/reacceptance, read-only assistance, and shared AI request budget');
};
