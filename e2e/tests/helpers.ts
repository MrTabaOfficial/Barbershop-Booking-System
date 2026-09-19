import { expect, type Locator, type Page } from "@playwright/test";
import { SEED_PASSWORD } from "../environment.ts";

const PASSWORD = "e2e-test-password";
let customerCount = 0;

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

export async function payDeposit(page: Page) {
  await expect(page.getByRole("heading", { name: "Fake payment page" })).toBeVisible();
  await page.getByRole("button", { name: "Pay the deposit" }).click();
}

export async function bookHaircutWithLuka(page: Page, time: string): Promise<string> {
  const day = await chooseHaircutWithLuka(page);
  await timeButton(page, time).click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await payDeposit(page);
  await expect(page.getByText(`You are booked for ${day} at ${time} with Luka`)).toBeVisible();
  return day;
}

export function bookingCard(page: Page, day: string, time: string): Locator {
  return page.getByRole("listitem").filter({ hasText: `${day}, ${time}` });
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}
