// Railway (and other platforms) set HOSTNAME to the pod name. Next standalone
// uses HOSTNAME for the bind address, so force 0.0.0.0 for public traffic.
process.env.HOSTNAME = "0.0.0.0";

await import("../.next/standalone/server.js");
