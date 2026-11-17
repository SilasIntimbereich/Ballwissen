import test from "node:test";
import assert from "node:assert/strict";
import { hasIndependentHttpsSources, normalizeHttpsHost } from "../scripts/source-url-validation.mjs";

test("normalizes www aliases before checking independent source hosts", () => {
  assert.equal(normalizeHttpsHost("https://www.fifa.com/squad.pdf"), "fifa.com");
  assert.equal(normalizeHttpsHost("https://fifa.com/squad.pdf"), "fifa.com");
  assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf", "https://fifa.com/other.pdf"]), false);
});

test("accepts two distinct HTTPS source hosts", () => {
  assert.equal(hasIndependentHttpsSources(["https://www.fifa.com/squad.pdf", "https://www.rsssf.org/tables/"]), true);
});

test("rejects invalid, insecure and incomplete source lists", () => {
  assert.equal(hasIndependentHttpsSources(["https://fifa.com", "http://rsssf.org"]), false);
  assert.equal(hasIndependentHttpsSources(["https://fifa.com", "not a url"]), false);
  assert.equal(hasIndependentHttpsSources(["https://fifa.com"]), false);
  assert.equal(hasIndependentHttpsSources([]), false);
});
