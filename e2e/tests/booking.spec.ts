import { expect, test } from "@playwright/test";
import { API_URL } from "../environment.ts";
import {
  bookHaircutWithLuka,
  bookingCard,
  chooseHaircutWithLuka,
  fillRegistrationForm,
  newCustomer,
  signUp,
  timeButton,
} from "./helpers.ts";

// Every test books with the same barber on the same day, so each one uses
// its own time: 11:00, 12:00 and 13:00, 16:00, 18:00.

test("a visitor books a haircut and registers on the way", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Book an appointment" }).first().click();
  await expect(page.getByRole("heading", { name: "Choose a service" })).toBeVisible();

  const day = await chooseHaircutWithLuka(page);
  await timeButton(page, "11:00").click();

  // Not logged in yet: the last step asks for an account.
  await expect(page.getByRole("heading", { name: "Confirm your booking" })).toBeVisible();
  const confirmStepUrl = page.url();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByText("Your booking is waiting")).toBeVisible();
  await fillRegistrationForm(page);

  // Registering leads straight back to the same step, choices intact.
  await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible();
  expect(page.url()).toBe(confirmStepUrl);
  await expect(page.getByText(`${day} at 11:00`)).toBeVisible();

  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page.getByText(`You are booked for ${day} at 11:00 with Luka`)).toBeVisible();
  await expect(bookingCard(page, day, "11:00")).toContainText("Haircut with Luka Gelashvili");
});

test("a slot taken before confirming is reported and the times are reloaded", async ({
  page,
  request,
}) => {
  await signUp(page);
  await chooseHaircutWithLuka(page);
  await timeButton(page, "12:00").click();
  await expect(page.getByRole("button", { name: "Confirm booking" })).toBeVisible();

  // While the customer looks at the confirm step, someone else books the
  // same slot, directly through the API.
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

  await page.getByRole("button", { name: "Confirm booking" }).click();

  // Back on the time step, told why, with that time gone.
  await expect(page.getByText("That time has just been taken")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick a day and time" })).toBeVisible();
  await expect(timeButton(page, "13:00")).toBeVisible();
  await expect(timeButton(page, "12:00")).toHaveCount(0);

  // Another time still works.
  await timeButton(page, "13:00").click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText("at 13:00 with Luka")).toBeVisible();
});

test("a customer moves a booking to a time that overlaps the current one", async ({ page }) => {
  await signUp(page);
  const day = await bookHaircutWithLuka(page, "16:00");

  await bookingCard(page, day, "16:00").getByRole("button", { name: "Reschedule" }).click();
  const dialog = page.getByRole("dialog");

  // The dialog opens on the booking's own day. The haircut runs 16:00 to
  // 16:45, so 16:15 is only on offer because the booking doesn't block itself.
  await expect(dialog.getByRole("heading", { name: day })).toBeVisible();
  // The time the booking already has is shown, labelled, and can't be picked.
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
  await expect(dialog).toContainText("Cancelling is free until 24 hours before the appointment");
  await expect(dialog).toContainText("more than 24 hours away, so cancelling now is free");
  await dialog.getByRole("button", { name: "Cancel booking" }).click();

  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Cancelled in time, free of charge.");
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("a reload keeps the customer logged in, and logging out ends the session", async ({
  page,
}) => {
  await signUp(page);

  // The access token only lives in memory, so this exercises the restore
  // from the refresh cookie.
  await page.reload();
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
  await expect(page).toHaveURL(/\/bookings$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/bookings");
  await expect(page).toHaveURL(/\/login\?next=%2Fbookings$/);
});
