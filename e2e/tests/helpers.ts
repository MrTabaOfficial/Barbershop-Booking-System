import { type APIRequestContext, expect, type Locator, type Page } from "@playwright/test";
import { API_URL, SEED_PASSWORD } from "../environment.ts";

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

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

type Named = { id: string; name: string };

export async function bookWithBarber(
  request: APIRequestContext,
  barberName: string,
  serviceName: string,
  count: number,
) {
  const registration = await request.post(`${API_URL}/auth/register`, { data: newCustomer() });
  const { accessToken } = await registration.json();
  const { barbers } = (await (await request.get(`${API_URL}/barbers`)).json()) as { barbers: Named[] };
  const { services } = (await (await request.get(`${API_URL}/services`)).json()) as { services: Named[] };
  const { today } = await (await request.get(`${API_URL}/shop`)).json();
  const barberId = barbers.find((barber) => barber.name === barberName)?.id;
  const serviceId = services.find((service) => service.name === serviceName)?.id;
  expect(barberId, `${barberName} should be on the public list`).toBeDefined();
  expect(serviceId, `${serviceName} should be on the public list`).toBeDefined();

  let booked = 0;
  for (let daysAhead = 7; booked < count && daysAhead <= 28; daysAhead++) {
    const availability = await request.get(
      `${API_URL}/availability?barberId=${barberId}&serviceId=${serviceId}&date=${addDays(today, daysAhead)}`,
    );
    const { slots } = (await availability.json()) as { slots: { startsAt: string }[] };
    const slot = slots[0];
    if (!slot) {
      continue;
    }
    const booking = await request.post(`${API_URL}/bookings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { serviceId, barberId, startsAt: slot.startsAt },
    });
    expect(booking.status()).toBe(201);
    const { checkoutUrl } = await booking.json();
    const payment = await request.post(checkoutUrl, { maxRedirects: 0 });
    expect(payment.status()).toBe(303);
    booked += 1;
  }
  expect(booked, `${barberName} should have ${count} free days in the next four weeks`).toBe(count);
}

export async function logIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
}
