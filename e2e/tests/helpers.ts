import { expect, type Locator, type Page } from "@playwright/test";

const PASSWORD = "e2e-test-password";
let customerCount = 0;

// A customer nobody has registered yet. Each test uses its own, so one
// test's bookings never show up in another's "My bookings".
export function newCustomer() {
  customerCount += 1;
  return {
    name: "Sandro Jgenti",
    email: `sandro.${Date.now()}.${customerCount}@dalaki.example`,
    password: PASSWORD,
  };
}

export async function fillRegistrationForm(page: Page) {
  const customer = newCustomer();
  await page.getByLabel("Full name").fill(customer.name);
  await page.getByLabel("Email").fill(customer.email);
  await page.getByLabel("Password").fill(customer.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

export async function signUp(page: Page) {
  await page.goto("/register");
  await fillRegistrationForm(page);
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
}

export function timeButton(scope: Page | Locator, time: string): Locator {
  return scope.getByRole("button", { name: time, exact: true });
}

// Walks the first three steps of the booking flow: a haircut, with Luka, on
// his first working day of next week. Returns that day as the site writes
// it ("Monday 12 October"), with the free times on screen.
//
// Next week keeps the tests clear of the seeded bookings, and of today,
// where the hour the suite runs at would decide which times are left.
export async function chooseHaircutWithLuka(page: Page): Promise<string> {
  await page.goto("/book");
  await page
    .getByRole("button")
    .filter({ has: page.getByText("Haircut", { exact: true }) })
    .click();
  await page.getByRole("button").filter({ hasText: "Luka Gelashvili" }).click();

  await page.getByRole("button", { name: "Later" }).click();
  const day = page.getByRole("list", { name: "Days" }).getByRole("button", { disabled: false }).first();
  await day.click();
  await expect(day).toHaveAttribute("aria-pressed", "true");

  const label = await day.getAttribute("aria-label");
  if (!label) {
    throw new Error("The day button has no label");
  }
  return label;
}

// Books that haircut at the given time as the logged-in customer and ends
// on "My bookings". Returns the day, as above.
export async function bookHaircutWithLuka(page: Page, time: string): Promise<string> {
  const day = await chooseHaircutWithLuka(page);
  await timeButton(page, time).click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(`You are booked for ${day} at ${time} with Luka`)).toBeVisible();
  return day;
}

// The card for one booking in "My bookings".
export function bookingCard(page: Page, day: string, time: string): Locator {
  return page.getByRole("listitem").filter({ hasText: `${day}, ${time}` });
}
