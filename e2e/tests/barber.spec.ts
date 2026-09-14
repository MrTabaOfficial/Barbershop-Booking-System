import { expect, test } from "@playwright/test";
import { API_URL, SEED_PASSWORD } from "../environment.ts";
import { logIn, signUp } from "./helpers.ts";

const GIORGI = "giorgi@dalaki.example";

type ScheduleDay = { date: string; bookings: unknown[] };

test("a barber records how an appointment went and manages days off", async ({
  page,
  request,
}) => {
  await logIn(page, GIORGI);

  // A barber lands on the schedule, with their own navigation.
  await expect(page).toHaveURL(/\/barber$/);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByRole("link", { name: "My bookings" })).toHaveCount(0);

  // --- an outcome, on an appointment from last week (so it has started)
  await page.getByRole("button", { name: "Previous week" }).click();
  const day = page
    .locator("details")
    .filter({ hasText: /[1-9]\d* appointments?/ })
    .first();
  await day.locator("summary").click();
  const appointment = day.getByRole("listitem").first();
  const noShow = appointment.getByRole("button", { name: "No-show" });
  const completed = appointment.getByRole("button", { name: "Completed" });

  await noShow.click();
  await expect(noShow).toHaveAttribute("aria-pressed", "true");
  // A mis-tap can be corrected.
  await completed.click();
  await expect(completed).toHaveAttribute("aria-pressed", "true");
  await expect(noShow).toHaveAttribute("aria-pressed", "false");

  // --- a day off on a day with bookings is refused, and says which ones.
  // The seed gives Giorgi two bookings on one of the next few days; ask
  // the API which day that is.
  const login = await request.post(`${API_URL}/auth/login`, {
    data: { email: GIORGI, password: SEED_PASSWORD },
  });
  const { accessToken } = await login.json();
  const { today } = await (await request.get(`${API_URL}/shop`)).json();
  const tomorrow = addDays(today, 1);
  const schedule = await request.get(
    `${API_URL}/barber/schedule?from=${tomorrow}&to=${addDays(today, 14)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const { days } = (await schedule.json()) as { days: ScheduleDay[] };
  const bookedDay = days.find((entry) => entry.bookings.length > 0);
  expect(bookedDay, "the seed should give Giorgi upcoming bookings").toBeDefined();

  await page.getByLabel("Date").fill(bookedDay?.date ?? "");
  await page.getByRole("button", { name: "Add day off" }).click();
  const refusal = page.getByRole("alert");
  await expect(refusal).toContainText("You have 2 bookings on");
  await expect(refusal).toContainText("11:00 Davit Maisuradze, Haircut");

  // --- a free day is accepted, shows in the list, and can be removed
  await page.getByLabel("Date").fill(addDays(today, 40));
  await page.getByLabel("Reason (optional)").fill("Dentist");
  await page.getByRole("button", { name: "Add day off" }).click();
  const dayOff = page.getByRole("listitem").filter({ hasText: "Dentist" });
  await expect(dayOff).toBeVisible();

  await dayOff.getByRole("button", { name: /^Remove day off/ }).click();
  await expect(dayOff).toHaveCount(0);
});

test("a customer who opens the barber page is told it isn't theirs", async ({ page }) => {
  await signUp(page);

  await page.goto("/barber");

  await expect(page.getByRole("heading", { name: "This page isn't for your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Today" })).toHaveCount(0);
});

// Calendar arithmetic on a YYYY-MM-DD date.
function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
