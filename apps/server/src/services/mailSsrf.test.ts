import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPrivateIp, assertPublicHost } from "./mailSsrf.js";

describe("Mail SSRF Service", () => {
  it("detects private IPv4 addresses", () => {
    assert.equal(isPrivateIp("127.0.0.1"), true);
    assert.equal(isPrivateIp("10.0.1.5"), true);
    assert.equal(isPrivateIp("192.168.1.1"), true);
    assert.equal(isPrivateIp("172.16.0.10"), true);
    assert.equal(isPrivateIp("169.254.169.254"), true);
    assert.equal(isPrivateIp("0.0.0.0"), true);
  });

  it("detects private IPv6 addresses", () => {
    assert.equal(isPrivateIp("::1"), true);
    assert.equal(isPrivateIp("fe80::1"), true);
    assert.equal(isPrivateIp("fc00::1234"), true);
    assert.equal(isPrivateIp("::ffff:192.168.1.1"), true);
  });

  it("identifies public IP addresses as safe", () => {
    assert.equal(isPrivateIp("8.8.8.8"), false);
    assert.equal(isPrivateIp("1.1.1.1"), false);
    assert.equal(isPrivateIp("142.250.190.46"), false);
  });

  it("blocks localhost and private hosts", async () => {
    await assert.rejects(async () => {
      await assertPublicHost("localhost");
    });
    await assert.rejects(async () => {
      await assertPublicHost("127.0.0.1");
    });
    await assert.rejects(async () => {
      await assertPublicHost("169.254.169.254");
    });
  });

  it("allows standard public mail hostnames", async () => {
    // Note: imap.gmail.com resolves to public Google IPs
    await assert.doesNotReject(async () => {
      await assertPublicHost("imap.gmail.com");
    });
  });
});
