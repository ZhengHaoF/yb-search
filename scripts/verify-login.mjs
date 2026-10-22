import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3200';
const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PASSWORD = process.env.VERIFY_PASSWORD ?? 'verify-pass';
const OUT = 'test-results';

await mkdir(OUT, { recursive: true });

const failures = [];
function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures.push(message);
    console.error(`FAIL ${message}`);
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/?q=腾讯云`, { waitUntil: 'networkidle' });
  await page.locator('.login-card').waitFor();
  check(true, '启用口令后展示登录页');
  await page.screenshot({ path: join(OUT, '10-login.png') });

  await page.locator('#site-password').fill('wrong-password');
  await page.locator('.login-card button[type="submit"]').click();
  await page.locator('.login-card .error').waitFor();
  check(
    (await page.locator('.login-card .error').innerText()).includes('口令不正确'),
    '错误口令给出提示',
  );

  await page.locator('#site-password').fill(PASSWORD);
  await page.locator('.login-card button[type="submit"]').click();
  await page.waitForSelector('.search-summary', { timeout: 30000 });
  check(new URL(page.url()).searchParams.get('q') === '腾讯云', '登录后恢复原查询');

  const cookies = await context.cookies(BASE);
  const sessionCookie = cookies.find((cookie) => cookie.name === 'yb_session');
  check(Boolean(sessionCookie?.httpOnly), '会话 cookie 为 HttpOnly');

  const session = await page.evaluate(() => fetch('/api/session').then((response) => response.json()));
  check(session.authRequired === true && session.authenticated === true, '会话状态为已登录');
  await page.screenshot({ path: join(OUT, '11-results-authed.png'), fullPage: false });

  await page.getByRole('button', { name: '退出登录' }).click();
  await page.locator('.login-card').waitFor();
  const afterLogout = await context.cookies(BASE);
  check(!afterLogout.some((cookie) => cookie.name === 'yb_session'), '退出后清除会话 cookie');

  const unauthorized = await page.evaluate(async () => {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    return { status: response.status, body: await response.json() };
  });
  check(
    unauthorized.status === 401 && unauthorized.body?.error?.code === 'UNAUTHORIZED',
    '退出后搜索接口返回 401',
  );

  await context.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} 项失败：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\n登录验收全部通过');
