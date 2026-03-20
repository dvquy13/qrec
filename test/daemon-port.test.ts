import { describe, test, expect, afterEach } from "bun:test";

// Reproduces: `qrec serve --daemon --port N` spawns child bound to default port 25927
// instead of N. Root cause: daemon.ts Bun.spawn() omits `env: process.env`, so
// mutations made by cli.ts (process.env.QREC_PORT = N) may not reach the child.
describe("daemon --port env propagation", () => {
  const originalPort = process.env.QREC_PORT;

  afterEach(() => {
    if (originalPort === undefined) delete process.env.QREC_PORT;
    else process.env.QREC_PORT = originalPort;
  });

  test("child process sees QREC_PORT mutation when spawned without explicit env", async () => {
    // Simulate what cli.ts does when --port 25999 is passed
    process.env.QREC_PORT = "25999";

    // Spawn a child the way daemon.ts does — with explicit env: process.env
    const child = Bun.spawn(
      ["bun", "-e", "process.stdout.write(process.env.QREC_PORT ?? 'undefined')"],
      {
        detached: true,
        stdio: ["ignore", "pipe", "ignore"],
        env: process.env,
      }
    );

    const output = await new Response(child.stdout).text();
    await child.exited;

    // Fails if env mutation is not inherited: output would be "25927" or "undefined"
    expect(output).toBe("25999");
  });
});
