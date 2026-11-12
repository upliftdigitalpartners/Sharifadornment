/* Runs once a day. Three days after an order is marked Delivered, the customer is asked
 * for a review: by email when emails are set up and they gave one; otherwise the admin
 * gets one Telegram note saying who to ask by text from the Studio. */
import { configured } from "../lib/studio.mjs";
import { askForReviews } from "../lib/orders.mjs";

export default async () => {
  if (!configured()) return new Response("not set up", { status: 200 });
  try {
    const out = await askForReviews();
    return new Response(JSON.stringify(out), { status: 200 });
  } catch (x) {
    console.error(x);
    return new Response("failed", { status: 500 });
  }
};

// 15:10 UTC is late morning in New York
export const config = { schedule: "10 15 * * *" };
