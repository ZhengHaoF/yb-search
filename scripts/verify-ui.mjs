import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
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

async function shot(page, name, fullPage = false) {
  await page.screenshot({ path: join(OUT, name), fullPage });
  console.log(`SHOT ${name}`);
}

function waitForSearch(page) {
  return page.waitForResponse(
    (response) => response.url().includes('/api/search') && response.request().method() === 'POST',
    { timeout: 30000 },
  );
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await desktop.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.hero-search input').waitFor();
  check((await page.title()) === 'YB Search', '首页标题为 YB Search');
  check(await page.locator('.hint').isVisible(), '首页显示快捷键提示');
  await shot(page, '01-home-desktop.png');

  const homeInput = page.locator('.hero-search input[aria-label="搜索词"]');
  await homeInput.fill('腾讯云');
  await homeInput.press('Enter');
  await page.waitForSelector('.search-summary', { timeout: 30000 });
  await page.waitForSelector('.result-card', { timeout: 30000 });
  const summary = await page.locator('.search-summary').innerText();
  check(summary.includes('标准版'), '结果摘要显示标准版');
  check(new URL(page.url()).searchParams.get('q') === '腾讯云', 'URL 同步查询词');
  check((await page.locator('.result-card').count()) > 0, '结果卡片渲染');
  check((await page.locator('.deeplinks').count()) === 0, '标准版不展示子链');
  check((await page.locator('.desktop-filters').getByText('子链').count()) === 0, '标准版隐藏子链开关');
  const picGroupSizes = await page
    .locator('.result-card .pics')
    .evaluateAll((groups) => groups.map((group) => group.children.length));
  check(picGroupSizes.every((size) => size <= 3), '配图最多展示 3 张');
  await shot(page, '02-results-desktop.png', true);

  let response = waitForSearch(page);
  await page.locator('.site .trigger').click();
  await page.locator('.site .surface').waitFor();
  const popoverCheck = await page.evaluate(() => {
    const surface = document.querySelector('.site .surface');
    const rect = surface?.getBoundingClientRect();
    if (!rect) return { visible: false, withinViewport: false, noOverflow: false };
    const element = document.elementFromPoint(rect.left + 20, rect.bottom - 10);
    return {
      visible: Boolean(element && surface.contains(element)),
      withinViewport: rect.left >= 0 && rect.right <= window.innerWidth,
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    };
  });
  check(
    popoverCheck.visible && popoverCheck.withinViewport && popoverCheck.noOverflow,
    '站点弹层完整可见且不被裁切',
  );
  await page.locator('.site input[aria-label="要包含的域名"]').fill('tencent.com');
  await page.locator('.site .apply').click();
  await response;
  await page.waitForFunction(() => new URL(location.href).searchParams.get('site') === 'tencent.com');
  const hostnames = await page.locator('.result-card a.title').evaluateAll((links) =>
    links.map((link) => {
      try {
        return new URL(link.href).hostname;
      } catch {
        return '';
      }
    }),
  );
  check(
    hostnames.length > 0 && hostnames.every((host) => host === 'tencent.com'),
    `站点包含筛选生效（${hostnames.slice(0, 3).join(', ')}）`,
  );

  response = waitForSearch(page);
  await page.locator('.reset').click();
  await response;
  check(!new URL(page.url()).searchParams.has('site'), '重置清除站点条件');

  response = waitForSearch(page);
  await page.locator('.site .trigger').click();
  await page.locator('.site').getByRole('radio', { name: '排除站点' }).click();
  await page.locator('.site input[aria-label="要排除的域名"]').fill('qq.com');
  await page.locator('.site .add').click();
  await page.locator('.site .apply').click();
  await response;
  check(new URL(page.url()).searchParams.get('site') === 'exclude:qq.com', '站点排除筛选生效');
  response = waitForSearch(page);
  await page.locator('.reset').click();
  await response;

  response = waitForSearch(page);
  await page.locator('.freshness .trigger').click();
  await page.locator('.freshness .chip', { hasText: '近7天' }).click();
  await response;
  await page.waitForFunction(() => new URL(location.href).searchParams.get('freshness') === 'd7');
  check(true, '时效快捷筛选生效并写入 URL');

  response = waitForSearch(page);
  await page.locator('.freshness .trigger').click();
  await page.getByRole('tab', { name: '日期区间' }).click();
  await page.locator('.freshness input[aria-label="开始日期"]').fill('2026-10-01');
  await page.locator('.freshness input[aria-label="结束日期"]').fill('2026-10-22');
  await page.locator('.freshness .apply').click();
  await response;
  await page.waitForFunction(
    () => new URL(location.href).searchParams.get('freshness') === '2026-10-01,2026-10-22',
  );
  check(true, '自定义日期区间生效');

  response = waitForSearch(page);
  await page.locator('.freshness .trigger').click();
  await page.getByRole('tab', { name: '相对时间' }).click();
  await page.locator('.freshness .number').fill('3');
  await page.locator('.freshness .unit').selectOption('m');
  await page.locator('.freshness .apply').click();
  await response;
  await page.waitForFunction(() => new URL(location.href).searchParams.get('freshness') === 'm3');
  check(true, '自定义相对时间生效');

  response = waitForSearch(page);
  await page.locator('.freshness .trigger').click();
  await page.getByRole('tab', { name: '指定日期' }).click();
  await page.locator('.freshness input[aria-label="指定日期"]').fill('2026-10-20');
  await page.locator('.freshness .apply').click();
  await response;
  await page.waitForFunction(
    () => new URL(location.href).searchParams.get('freshness') === '2026-10-20',
  );
  check(true, '自定义单日生效');

  response = waitForSearch(page);
  await page.locator('.reset').click();
  await response;

  response = waitForSearch(page);
  await page.locator('.segmented button', { hasText: '网页' }).click();
  await response;
  response = waitForSearch(page);
  await page.locator('select[aria-label="垂直领域"]').selectOption('news');
  await response;
  response = waitForSearch(page);
  await page.locator('select[aria-label="返回条数"]').selectOption('10');
  await response;

  const filteredUrl = new URL(page.url());
  check(
    filteredUrl.searchParams.get('mode') === '0' &&
      filteredUrl.searchParams.get('industry') === 'news' &&
      filteredUrl.searchParams.get('cnt') === '10',
    '模式/领域/条数写入 URL',
  );
  const filteredCount = await page.locator('.result-card').count();
  check(filteredCount <= 10, `条数限制生效（${filteredCount} ≤ 10）`);
  await shot(page, '03-filters-desktop.png', true);

  await page.goto(
    `${BASE}/?q=腾讯云&freshness=d7&industry=news&cnt=10&mode=0&site=exclude:qq.com`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForSelector('.search-summary', { timeout: 30000 });
  const industryValue = await page.locator('select[aria-label="垂直领域"]').inputValue();
  const cntValue = await page.locator('select[aria-label="返回条数"]').inputValue();
  const modeActive = (await page.locator('.segmented button[aria-pressed="true"]').innerText()).trim();
  const siteLabel = await page.locator('.site .trigger-value').innerText();
  check(
    industryValue === 'news' &&
      cntValue === '10' &&
      modeActive === '网页' &&
      siteLabel.includes('排除'),
    '直达 URL 后筛选完整还原',
  );

  await page.route('**/api/search', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        query: '无结果测试',
        version: 'standard',
        results: [],
        count: 0,
        elapsedMs: 12,
        requestId: 'empty-req',
      }),
    }),
  );
  const headerInput = page.locator('.header-row input[aria-label="搜索词"]');
  await headerInput.fill('无结果测试');
  await headerInput.press('Enter');
  await page.locator('.empty').waitFor({ timeout: 15000 });
  check(true, '0 结果空状态展示');
  await shot(page, '04-empty-desktop.png');
  await page.unroute('**/api/search');

  await page.route('**/api/search', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'TEST_UPSTREAM_ERROR', message: '模拟上游错误', requestId: 'test-req-123' },
      }),
    }),
  );
  await headerInput.fill('错误测试');
  await headerInput.press('Enter');
  await page.locator('.error-card').waitFor({ timeout: 15000 });
  check((await page.locator('.error-card').innerText()).includes('test-req-123'), '错误态展示 RequestId');
  await page.locator('.error-card .copy').click();
  await page.waitForTimeout(200);
  check((await page.locator('.error-card .copy').innerText()) === '已复制', 'RequestId 可复制');
  await shot(page, '05-error-desktop.png');
  await page.unroute('**/api/search');

  response = waitForSearch(page);
  await page.locator('.error-card .btn').click();
  await response;
  await page.waitForSelector('.search-summary', { timeout: 30000 });
  check(true, '错误后可重试');

  const mockTitleResponse = (title) => ({
    query: title,
    version: 'standard',
    results: [
      {
        title,
        url: `https://example.com/${encodeURIComponent(title)}`,
        date: '2026-10-22',
        passage: 'mock',
        site: 'Example',
        pics: [],
        deeplinks: [],
      },
    ],
    count: 1,
    elapsedMs: 10,
    requestId: `mock-${title}`,
  });
  await page.route('**/api/search', async (route) => {
    const body = route.request().postDataJSON();
    if (body.query === '慢查询') {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockTitleResponse('慢查询结果')),
        });
      } catch {
        // 客户端已取消该请求
      }
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTitleResponse('快查询结果')),
    });
  });
  await headerInput.fill('慢查询');
  await headerInput.press('Enter');
  await page.locator('.skeleton-card').first().waitFor({ timeout: 5000 });
  check(true, '加载时展示骨架屏');
  await headerInput.fill('快查询');
  await headerInput.press('Enter');
  await page.waitForSelector('.result-card', { timeout: 5000 });
  await page.waitForTimeout(1500);
  const latestTitle = await page.locator('.result-card a.title').innerText();
  check(latestTitle === '快查询结果', '新查询取消旧请求并只渲染最新结果');
  await page.unroute('**/api/search');

  const mockResult = {
    title: '版本能力测试结果',
    url: 'https://example.com/flagship',
    date: '2026-10-22',
    passage: '用于验证旗舰版权威徽标与子链展示。',
    site: 'Example',
    authorityLevel: 5,
    favicon: '',
    pics: [],
    deeplinks: [{ title: '子页 A', url: 'https://example.com/a' }],
  };
  const mockResponse = (version) => ({
    query: '版本测试',
    version,
    results: [
      {
        ...mockResult,
        authorityLevel: version === 'flagship' ? 5 : undefined,
        deeplinks: version === 'flagship' ? mockResult.deeplinks : [],
      },
    ],
    count: 1,
    elapsedMs: 15,
    requestId: `mock-${version}`,
  });

  await page.route('**/api/search', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse('lite')),
    }),
  );
  await headerInput.fill('版本降级测试');
  await headerInput.press('Enter');
  await page.waitForSelector('.search-summary', { timeout: 15000 });
  const liteHidden =
    (await page.locator('.segmented').count()) === 0 &&
    (await page.locator('select[aria-label="垂直领域"]').count()) === 0 &&
    (await page.locator('select[aria-label="返回条数"]').count()) === 0 &&
    (await page.locator('.desktop-filters').getByText('子链').count()) === 0;
  check(liteHidden, '极速版隐藏模式/领域/条数/子链');
  const liteUrl = new URL(page.url());
  check(
    !liteUrl.searchParams.has('mode') &&
      !liteUrl.searchParams.has('industry') &&
      !liteUrl.searchParams.has('cnt'),
    '极速版自动清理不支持的筛选',
  );
  await page.unroute('**/api/search');

  const mockBodies = [];
  await page.route('**/api/search', (route) => {
    mockBodies.push(route.request().postDataJSON());
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse('flagship')),
    });
  });
  await headerInput.fill('旗舰版测试');
  await headerInput.press('Enter');
  await page.waitForSelector('.authority', { timeout: 15000 });
  check(await page.locator('.authority').isVisible(), '旗舰版展示权威徽标');
  check(await page.locator('.deeplink-toggle').isVisible(), '旗舰版展示子链');
  await page.locator('.deeplink-toggle').click();
  check(await page.locator('.deeplink-list').isVisible(), '子链可展开');
  await shot(page, '06a-flagship-mock.png');
  response = waitForSearch(page);
  await page.locator('.desktop-filters label.switch').click();
  await response;
  check(mockBodies.at(-1)?.deeplinks === false, '关闭子链开关后请求参数为 false');
  await page.unroute('**/api/search');

  await page.locator('.brand-link').click();
  await page.locator('.hero').waitFor();
  await page.waitForTimeout(450);
  check((await page.locator('.recent-list button').count()) > 0, '首页展示最近搜索');
  await shot(page, '06-home-with-recent.png');

  await page.locator('body').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('/');
  const homeSearchInput = page.locator('.hero-search input[aria-label="搜索词"]');
  check(
    await homeSearchInput.evaluate((element) => element === document.activeElement),
    '/ 快捷键聚焦搜索框',
  );
  await homeSearchInput.fill('临时输入');
  await homeSearchInput.press('Escape');
  check((await homeSearchInput.inputValue()) === '', 'Esc 清空搜索框');

  await page.goBack();
  await page.waitForSelector('.search-summary', { timeout: 30000 });
  check(new URL(page.url()).searchParams.has('q'), '浏览器后退恢复搜索结果');

  const meaningfulErrors = consoleErrors.filter(
    (message) => !/Failed to load resource|net::ERR/.test(message),
  );
  check(meaningfulErrors.length === 0, `无前端控制台错误${meaningfulErrors.length ? `：${meaningfulErrors[0]}` : ''}`);

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: 'networkidle' });
  await mobilePage.locator('.hero-search input').waitFor();
  await shot(mobilePage, '07-home-mobile.png');
  await mobilePage.goto(`${BASE}/?q=腾讯云&freshness=d7&cnt=10`, {
    waitUntil: 'domcontentloaded',
  });
  await mobilePage.waitForSelector('.search-summary', { timeout: 30000 });
  check(await mobilePage.locator('.filter-toggle').isVisible(), '移动端筛选按钮可见');
  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  check(!overflow, '移动端无横向溢出');
  await shot(mobilePage, '08-results-mobile.png', true);

  await mobilePage.locator('.filter-toggle').click();
  await mobilePage.locator('.sheet').waitFor();
  await shot(mobilePage, '09-filters-mobile.png');
  const mobileResponse = waitForSearch(mobilePage);
  await mobilePage.locator('.sheet select[aria-label="返回条数"]').selectOption('20');
  await mobileResponse;
  check(!new URL(mobilePage.url()).searchParams.has('cnt'), '移动端筛选抽屉可用');
  await mobilePage.locator('.sheet-head button').click();
  await mobilePage.locator('.sheet').waitFor({ state: 'detached' });

  await desktop.close();
  await mobile.close();
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} 项失败：`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\n全部 UI 验收项通过');
