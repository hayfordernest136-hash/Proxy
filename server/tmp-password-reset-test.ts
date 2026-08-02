import "dotenv/config";
import { sendPasswordResetEmail } from "./src/services/auth-email.service";

async function main() {
  const ok = await sendPasswordResetEmail({
    userName: "Test User",
    email: "hayfordernest136@gmail.com",
    rawToken: "test-reset-token-123",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  console.log("sendPasswordResetEmail result=", ok);
}

main().catch((err) => {
  console.error("ERROR", err);
  process.exit(1);
});
