import { createApp } from "./app.ts";
import { env } from "./env.ts";

createApp().listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});
