import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { requireIsolatedPlaywrightSmokeConfiguration } from "../scripts/playwright-smoke-isolation";

requireIsolatedPlaywrightSmokeConfiguration(process.env);
const fixture = JSON.parse(readFileSync(process.env.PLAYWRIGHT_SMOKE_FIXTURE_PATH!, "utf8"));

for (const viewport of [{ name: "desktop", width: 1440, height: 1050 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`Homeschool attendance and private PDF ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const login = await page.request.post('/chore-api/auth/login', { data: { email: fixture.parent_email, password: fixture.parent_password } });
    expect(login.ok()).toBe(true);
    const session = await login.json();
    const household_id = session.user.household_id;
    const headers = { 'X-CSRF-Token': session.csrf_token };
    const children = await (await page.request.get(`/chore-api/children?household_id=${household_id}`)).json();
    const child_id = children.find((child: {name: string}) => child.name === fixture.child_name).id;
    const create = async (endpoint: string, data: object) => {
      const response = await page.request.post(`/chore-api/${endpoint}`, { data: { household_id, ...data }, headers });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    const [mathColor, readingColor] = viewport.name === 'desktop' ? ['#1d4ed8', '#047857'] : ['#7e22ce', '#c2410c'];
    const math = await create('homeschool/subjects', { name: `Math ${viewport.name}`, color: mathColor });
    const reading = await create('homeschool/subjects', { name: `Reading ${viewport.name}`, color: readingColor });
    const semester = await create('homeschool/semesters', { name: `Autumn ${viewport.name}`, start_date: '2026-09-02', end_date: '2026-12-20' });
    const otherChild = await create('children', { name: `Other learner ${viewport.name}` });
    const put = async (endpoint: string, data: object) => {
      const response = await page.request.put(`/chore-api/homeschool/${endpoint}`, { data: { household_id, ...data }, headers });
      expect(response.ok(), await response.text()).toBe(true); return response.json();
    };
    await put('attendance', { child_id, subject_id: math.id, date: '2026-09-01', present: true, comment: 'Fractions review' });
    await put('attendance', { child_id, subject_id: reading.id, date: '2026-09-01', present: false, comment: 'Reading postponed' });
    await put('attendance', { child_id: otherChild.id, subject_id: math.id, date: '2026-09-05', present: true, comment: 'Other child private note' });
    await put('grades', { child_id, subject_id: math.id, semester_id: semester.id, grade: 'A−' });
    await page.goto('/chore/homeschool');
    await expect(page.getByRole('heading', { name: 'Attendance Calendar' })).toBeVisible();
    const calendar = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Attendance Calendar', exact: true }) });
    await calendar.getByRole('combobox', { name: 'Child', exact: true }).selectOption(String(child_id));
    const date = page.getByRole('button', { name: /^2026-09-08,/ });
    await date.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Copy previous day' }).click();
    await expect(dialog.getByText(/Copied 2026-09-01/)).toBeVisible();
    await expect(dialog.getByLabel(`${math.name} present`)).toBeChecked();
    await expect(dialog.getByLabel(`${reading.name} present`)).not.toBeChecked();
    await expect(dialog.getByLabel(`${reading.name} notes`)).toHaveValue('Reading postponed');
    await expect(dialog.getByText('Other child private note')).toHaveCount(0);
    await dialog.getByLabel(`${math.name} notes`).fill('Fractions and decimals');
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    const output = path.join(process.env.PLAYWRIGHT_SMOKE_DIR!, 'homeschool-review');
    mkdirSync(output, { recursive: true, mode: 0o700 });
    await page.screenshot({ path: path.join(output, `${viewport.name}-attendance-modal.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByText(/Attendance saved/)).toBeVisible();
    await expect(dialog).not.toBeVisible({ timeout: 6000 });
    const records = await (await page.request.get(`/chore-api/homeschool/attendance?household_id=${household_id}&child_id=${child_id}`)).json();
    expect(records.filter((row: {date: string;subject_id:number}) => row.date === '2026-09-08' && [math.id,reading.id].includes(row.subject_id))).toHaveLength(2);
    await expect(page.locator('details.homeschool-log')).not.toHaveAttribute('open', '');
    await date.click();
    await expect(dialog.getByLabel(`${math.name} notes`)).toHaveValue('Fractions and decimals');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(date).toBeFocused();
    await date.click();
    await page.goBack();
    await expect(dialog).not.toBeVisible();
    await calendar.getByRole('combobox', { name: 'Child', exact: true }).selectOption(String(otherChild.id));
    await page.getByRole('button', { name: /^2026-09-01,/ }).click();
    await dialog.getByRole('button', { name: 'Copy previous day' }).click();
    await expect(dialog.getByText(/No earlier attendance for this child/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await calendar.getByRole('combobox', { name: 'Child', exact: true }).selectOption(String(child_id));
    await page.screenshot({ path: path.join(output, `${viewport.name}-calendar.png`), fullPage: true });
    await page.getByRole('combobox', { name: 'Report semester', exact: true }).selectOption(String(semester.id));
    await expect(page.getByLabel('Include attendance and day notes')).not.toBeChecked();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Semester PDF', exact: true }).click();
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    await download.saveAs(path.join(output, `${viewport.name}-semester-report.pdf`));
    await expect(page.getByRole('status').filter({ hasText: 'Semester PDF downloaded.' })).toBeVisible();
    if (viewport.name === 'desktop') {
      const attempts = new Map<number, number>();
      let failReading = true;
      await page.route('**/chore-api/homeschool/attendance', async route => {
        if (route.request().method() !== 'PUT') return route.continue();
        const payload = route.request().postDataJSON();
        attempts.set(payload.subject_id, (attempts.get(payload.subject_id) ?? 0) + 1);
        if (payload.subject_id === reading.id && failReading) {
          failReading = false;
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Temporary test failure' }) });
        } else await route.continue();
      });
      await page.getByRole('button', { name: /^2026-09-09,/ }).click();
      await dialog.getByRole('button', { name: 'Copy previous day' }).click();
      await dialog.getByRole('button', { name: 'Save', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(dialog.getByRole('alert')).toContainText('1 could not be saved');
      expect(attempts.get(math.id)).toBe(1);
      expect(attempts.get(reading.id)).toBe(1);
      await expect(dialog.getByText(/Attendance saved/)).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(dialog.getByText(/Attendance saved/)).toBeVisible();
      expect(attempts.get(math.id)).toBe(1);
      expect(attempts.get(reading.id)).toBe(2);
      await expect(dialog).not.toBeVisible({ timeout: 6000 });
      await page.unroute('**/chore-api/homeschool/attendance');
    }
    // Also verify the real authenticated endpoint's binary response, without optional notes.
    const report = await page.request.get(`/chore-api/homeschool/semesters/${semester.id}/report.pdf?household_id=${household_id}&child_id=${child_id}`);
    expect(report.ok(), await report.text()).toBe(true);
    expect(report.headers()['content-type']).toContain('application/pdf');
    expect((await report.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });
}
