import express, { Router } from "express";
import type { Dependencies } from "../dependencies.ts";
import { AppError } from "../errors.ts";
import { FakePaymentProvider } from "./fake.ts";
import { InvalidWebhookError } from "./provider.ts";
import { handlePaymentEvent } from "./service.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// The page the fake provider sends customers to instead of Stripe's. It is
// deliberately plain, so nobody mistakes it for a real payment page.
function fakeCheckoutPage(description: string, amount: string, cancelUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fake payment page</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #141210; color: #f2ebdd; margin: 0; padding: 2rem 1rem; }
      main { max-width: 28rem; margin: 0 auto; }
      p { line-height: 1.6; }
      .note { color: #b4aa99; }
      button { font: inherit; font-weight: 600; background: #b8893b; color: #141210; border: 0; border-radius: 2px; padding: 0.75rem 1.5rem; cursor: pointer; }
      a { color: #cfa55c; }
    </style>
  </head>
  <body>
    <main>
      <h1>Fake payment page</h1>
      <p class="note">No Stripe keys are configured, so this page stands in for Stripe Checkout. No money moves.</p>
      <p>${escapeHtml(description)}</p>
      <p><strong>${escapeHtml(amount)}</strong></p>
      <form method="post">
        <button type="submit">Pay the deposit</button>
      </form>
      <p><a href="${escapeHtml(cancelUrl)}">Go back without paying</a></p>
    </main>
  </body>
</html>`;
}

export function createPaymentsRouter(deps: Dependencies): Router {
  const router = Router();
  const { payments } = deps;

  // The provider calls this when something happens to a payment. The body
  // is read as raw bytes, not parsed as JSON: the signature is calculated
  // over the exact bytes that were sent, and parsing then re-serialising
  // them would not reproduce those bytes.
  router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw new AppError(400, "BAD_REQUEST", "A webhook must be sent as application/json");
    }
    let event;
    try {
      event = payments.active.parseWebhook(req.body, req.headers);
    } catch (error) {
      if (error instanceof InvalidWebhookError) {
        throw new AppError(400, "INVALID_SIGNATURE", error.message);
      }
      throw error;
    }
    await handlePaymentEvent(deps, event);
    // Any 2xx tells the provider not to send this event again.
    res.json({ received: true });
  });

  // The fake provider's payment page. With Stripe taking the deposits no
  // fake checkout is ever created, so these routes have nothing to show.
  const fake = payments.named("fake");
  if (fake instanceof FakePaymentProvider) {
    router.get("/fake-checkout/:sessionId", (req, res) => {
      const checkout = fake.checkouts.get(req.params.sessionId);
      if (!checkout) {
        throw new AppError(404, "NOT_FOUND", "This checkout doesn't exist");
      }
      const amount = `${(checkout.amountCents / 100).toFixed(2)} ${checkout.currency.toUpperCase()}`;
      res.type("html").send(fakeCheckoutPage(checkout.description, amount, checkout.cancelUrl));
    });

    router.post("/fake-checkout/:sessionId", async (req, res) => {
      const { sessionId } = req.params;
      const checkout = fake.checkouts.get(sessionId);
      if (!checkout) {
        throw new AppError(404, "NOT_FOUND", "This checkout doesn't exist");
      }
      // Paying here does what Stripe's webhook would do. Like Stripe, the
      // fake refuses payment once the checkout has run out.
      if (checkout.expiresAt > new Date()) {
        await handlePaymentEvent(deps, {
          type: "payment_succeeded",
          sessionId,
          paymentId: fake.paymentIdFor(sessionId),
        });
      }
      res.redirect(303, checkout.successUrl);
    });
  }

  return router;
}
