import { expect, test } from "@playwright/test";
import { bookWithBarber, logIn } from "./helpers.ts";

test.use({ viewport: { width: 1280, height: 900 } });

test("the admin reads the overview, manages a service, the bookings and a barber's hours", async ({
  page,
  request,
}) => {
  await logIn(page, "tamar@dalaki.example");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByText("No-show rate")).toBeVisible();
  await expect(page.getByRole("group", { name: /^Bookings per day/ })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Revenue per day/ })).toBeVisible();
  await expect(page.getByText("Most booked services")).toBeVisible();

  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("link", { name: "Services" }).click();
  await page.getByRole("button", { name: "Add a service" }).click();
  const serviceDialog = page.getByRole("dialog");
  await serviceDialog.getByLabel("Name").fill("Head shave");
  await serviceDialog.getByLabel("Length in minutes").fill("30");
  await serviceDialog.getByLabel("Price in ₾").fill("20");
  await serviceDialog.getByLabel("Deposit in ₾").fill("5");
  await serviceDialog.getByRole("button", { name: "Save service" }).click();
  await expect(serviceDialog).toBeHidden();
  await expect(page.getByText("30 min, 20 ₾, deposit 5 ₾")).toBeVisible();

  const onTheBookingPage = page.getByRole("button").filter({ hasText: "Head shave" });
  await page.goto("/book");
  await expect(onTheBookingPage).toBeVisible();

  await page.goto("/admin/services");
  await page.getByRole("button", { name: "Deactivate Head shave" }).click();
  await expect(page.getByRole("button", { name: "Activate Head shave" })).toBeVisible();
  await page.goto("/book");
  await expect(page.getByRole("heading", { name: "Choose a service" })).toBeVisible();
  await expect(onTheBookingPage).toHaveCount(0);

  // On the days Nika doesn't work the seed leaves her one confirmed booking,
  // so the test adds two of its own to have rows left after cancelling one.
  await bookWithBarber(request, "Nika Tsiklauri", "Kids haircut", 2);

  await page.goto("/admin/bookings");
  await page.getByLabel("Status").selectOption({ label: "Confirmed" });
  await page.getByLabel("Barber").selectOption({ label: "Nika Tsiklauri" });
  await expect(page).toHaveURL(/status=confirmed/);
  await expect(page).toHaveURL(/barberId=/);
  const showing = page.getByText(/^Showing 1 to \d+ of \d+$/);
  await expect(showing).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("Nika Tsiklauri");
  await expect(rows.first()).toContainText("Confirmed");

  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("confirmed");
  await expect(showing).toBeVisible();
  const totalBefore = Number((await showing.textContent())?.split(" of ")[1]);

  await page.getByRole("button", { name: "Customer" }).click();
  await expect(page).toHaveURL(/sort=customer&order=asc/);

  await rows.first().getByRole("button", { name: /^Cancel / }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("table", { name: "Bookings" })).toBeFocused();
  await expect(showing).toHaveText(new RegExp(` of ${totalBefore - 1}$`));

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export to Excel" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^dalaki-bookings-\d{4}-\d{2}-\d{2}\.xlsx$/);

  await page.getByRole("link", { name: "Staff" }).click();
  await page.getByRole("button", { name: "Working hours of Nika Tsiklauri" }).click();
  const hoursDialog = page.getByRole("dialog");
  await hoursDialog.getByRole("checkbox", { name: "Monday" }).check();
  await hoursDialog.getByRole("button", { name: "Save hours" }).click();
  await expect(hoursDialog).toBeHidden();
  await expect(page.getByRole("listitem").filter({ hasText: "Nika Tsiklauri" })).toContainText(
    "Mon, Thu to Sun",
  );
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the admin reads the bookings as a list and filters them", async ({ page }) => {
    await logIn(page, "tamar@dalaki.example");
    await page.getByRole("link", { name: "Bookings" }).click();

    await expect(page.getByText(/^Showing 1 to \d+ of \d+$/)).toBeVisible();
    await expect(page.locator("table")).toHaveCount(0);
    await expect(page.getByLabel("Status")).toHaveCount(0);

    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByLabel("Status").selectOption({ label: "Completed" });
    await page.getByLabel("Sort by").selectOption({ label: "Customer" });
    await expect(page).toHaveURL(/status=completed/);
    await expect(page).toHaveURL(/sort=customer/);

    await page.getByRole("button", { name: "Hide filters" }).click();
    await expect(page.getByRole("button", { name: "Filters (1)" })).toBeVisible();
    const rows = page.getByRole("list", { name: "Bookings" }).getByRole("listitem");
    await expect(rows.first()).toContainText("Completed");
    const pageScrollsSideways = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(pageScrollsSideways).toBe(false);
  });
});
