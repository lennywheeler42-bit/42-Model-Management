import { expect, test } from "@playwright/test";

// Anonymous visitor checks against real data. They never write anything.
test.describe("public site", () => {
  test("home page renders with navigation and security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const headers = response!.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-powered-by"]).toBeUndefined();
    await expect(page.getByRole("link", { name: /42 Model Management/i }).first()).toBeVisible();
  });

  test("roster page lists talent or an empty state", async ({ page }) => {
    await page.goto("/models");
    await expect(page.locator("main")).toContainText(/talent/i);
  });

  test("unknown profile paths return a real 404", async ({ page }) => {
    const response = await page.goto("/models/this-talent-does-not-exist-e2e");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();
  });

  test("the page never has horizontal overflow", async ({ page }) => {
    for (const path of ["/", "/models", "/login"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(1);
    }
  });

  test("robots and sitemap are served", async ({ request }) => {
    expect((await request.get("/robots.txt")).status()).toBe(200);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });
});

test.describe("signed-out access", () => {
  test("the dashboard redirects to sign in", async ({ page }) => {
    await page.goto("/dashboard/talent");
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Ftalent/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("staff previews require sign in", async ({ page }) => {
    await page.goto("/preview/talent/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard APIs reject anonymous callers", async ({ request }) => {
    const response = await request.get("/api/dashboard/talents");
    expect([401, 403, 405]).toContain(response.status());
  });

  test("forgot-password page is reachable from sign in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot your password/i }).click();
    await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
  });

  test("an external next= target is ignored", async ({ page }) => {
    await page.goto("/auth/callback?next=//evil.example");
    await expect(page).toHaveURL(/\/login\?error=/);
  });
});
