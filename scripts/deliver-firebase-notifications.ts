import { deliverPendingFirebaseNotifications } from "../src/lib/firebase/notification-delivery";

const limitArgument = process.argv.find((value) => value.startsWith("--limit="))?.split("=", 2)[1];
const limit = limitArgument ? Number(limitArgument) : undefined;
const result = await deliverPendingFirebaseNotifications({ workerId: `firebase-email-script-${process.pid}`, limit });
process.stdout.write(`${JSON.stringify(result)}\n`);
