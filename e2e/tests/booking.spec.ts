import { expect, test } from "@playwright/test";
import { API_URL } from "../environment.ts";
import {
  bookHaircutWithLuka,
  bookingCard,
  chooseHaircutWithLuka,
  fillRegistrationForm,
  logIn,
  newCustomer,
  payDeposit,
  signUp,
  timeButton,
} from "./helpers.ts";

test("a visitor books a haircut and registers on the way", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("27 Lado Asatiani Street, Sololaki, Tbilisi 0105");
  await expect(footer.getByRole("link", { name: "+995 555 00 00 00" })).toHaveAttribute(
    "href",
    "tel:+995555000000",
  );
  await page.getByRole("link", { name: "Book an appointment" }).first().click();
  await expect(page.getByRole("heading", { name: "Choose a service" })).toBeVisible();

  const day = await chooseHaircutWithLuka(page);
  await timeButton(page, "11:00").click();

  await expect(page.getByRole("heading", { name: "Confirm your booking" })).toBeVisible();
  const confirmStepUrl = page.url();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByText("Your booking is waiting")).toBeVisible();
  await fillRegistrationForm(page);

  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
  expect(page.url()).toBe(confirmStepUrl);
  await expect(page.getByText(`${day} at 11:00`)).toBeVisible();

  await page.getByRole("button", { name: "Continue to payment" }).click();
  await payDeposit(page);

  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page.getByText(`You are booked for ${day} at 11:00 with Luka`)).toBeVisible();
  const card = bookingCard(page, day, "11:00");
  await expect(card).toContainText("Haircut with Luka Gelashvili");
  await expect(card).toContainText("Confirmed");
});

test("a choice can be changed from a later step", async ({ page }) => {
  await chooseHaircutWithLuka(page);
  await timeButton(page, "19:00").click();
  await expect(page.getByRole("heading", { name: "Confirm your booking" })).toBeVisible();

  await page.getByRole("button", { name: "Change barber, now Luka" }).click();

  await expect(page.getByRole("heading", { name: "Choose your barber" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change service, now Haircut" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Change barber/ })).toHaveCount(0);
});

test("a regular sees the latest visits first and can show the earlier ones", async ({ page }) => {
  await logIn(page, "davit@dalaki.example");
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();

  const past = page.getByRole("region", { name: "Past" }).getByRole("listitem");
  await expect(past).toHaveCount(5);

  await page.getByRole("button", { name: /^Show earlier visits/ }).click();

  await expect(past).not.toHaveCount(5);
  await expect(page.getByRole("button", { name: /^Show earlier visits/ })).toHaveCount(0);
});

test("a slot taken before confirming is reported and the times are reloaded", async ({
  page,
  request,
}) => {
  await signUp(page);
  await chooseHaircutWithLuka(page);
  await timeButton(page, "12:00").click();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();

  const choice = new URL(page.url()).searchParams;
  const rival = await request.post(`${API_URL}/auth/register`, { data: newCustomer() });
  const { accessToken } = await rival.json();
  const rivalBooking = await request.post(`${API_URL}/bookings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      serviceId: choice.get("service"),
      barberId: choice.get("barber"),
      startsAt: choice.get("time"),
    },
  });
  expect(rivalBooking.status()).toBe(201);

  await page.getByRole("button", { name: "Continue to payment" }).click();

  await expect(page.getByText("That time has just been taken")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a day and time" })).toBeVisible();
  await expect(timeButton(page, "13:00")).toBeVisible();
  await expect(timeButton(page, "12:00")).toHaveCount(0);

  await timeButton(page, "13:00").click();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await payDeposit(page);
  await expect(page.getByText("at 13:00 with Luka")).toBeVisible();
});

test("a customer who leaves the payment page can pay later from My bookings", async ({ page }) => {
  await signUp(page);
  const day = await chooseHaircutWithLuka(page);
  await timeButton(page, "14:00").click();
  await page.getByRole("button", { name: "Continue to payment" }).click();

  await page.getByRole("link", { name: "Go back without paying" }).click();

  await expect(page.getByText("Pay the deposit to confirm your booking.")).toBeVisible();
  const card = bookingCard(page, day, "14:00");
  await expect(card).toContainText("Awaiting payment");
  await expect(card).toContainText("We are holding the time until");
  await expect(card.getByRole("button", { name: "Move booking" })).toHaveCount(0);

  await card.getByRole("link", { name: "Pay the deposit" }).click();
  await payDeposit(page);

  await expect(page.getByText(`You are booked for ${day} at 14:00 with Luka`)).toBeVisible();
  await expect(bookingCard(page, day, "14:00")).toContainText("Confirmed");
});

test("a customer moves a booking to a time that overlaps the current one", async ({ page }) => {
  await signUp(page);
  const day = await bookHaircutWithLuka(page, "16:00");

  await bookingCard(page, day, "16:00").getByRole("button", { name: "Move booking" }).click();
  const dialog = page.getByRole("dialog");

  await expect(dialog.getByRole("heading", { name: day })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "16:00 Current" })).toBeDisabled();
  await timeButton(dialog, "16:15").click();
  await dialog.getByRole("button", { name: "Move to 16:15" }).click();

  await expect(dialog).toBeHidden();
  await expect(bookingCard(page, day, "16:15")).toBeVisible();
  await expect(bookingCard(page, day, "16:00")).toHaveCount(0);
});

test("a customer cancels a booking after seeing the 24-hour rule", async ({ page }) => {
  await signUp(page);
  const day = await bookHaircutWithLuka(page, "18:00");
  const card = bookingCard(page, day, "18:00");

  await card.getByRole("button", { name: "Cancel" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Cancelling 24 hours or more before the appointment refunds");
  await expect(dialog).toContainText("your 15 ₾ deposit will be refunded");
  await dialog.getByRole("button", { name: "Cancel booking" }).click();

  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Your 15 ₾ deposit was refunded.");
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("a reload keeps the customer logged in, and logging out ends the session", async ({
  page,
}) => {
  await signUp(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page).toHaveURL(/\/bookings$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/bookings");
  await expect(page).toHaveURL(/\/login\?next=%2Fbookings$/);
});
