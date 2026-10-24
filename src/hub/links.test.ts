import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { linkPath } from "./links.js";

describe("links that open the app", () => {
  test("a QR code link keeps its pairing code", () => {
    assert.deepEqual(linkPath("https://app.yeix.io/add#instance=https%3A%2F%2Ffamily.example.org&code=abc"), {
      pathname: "/add",
      hash: "#instance=https%3A%2F%2Ffamily.example.org&code=abc",
    });
  });

  test("the app's own scheme, with the code as a query or a fragment", () => {
    assert.deepEqual(linkPath("northernlights://add?instance=family.example.org&code=abc"), {
      pathname: "/add",
      hash: "#instance=family.example.org&code=abc",
    });
    assert.deepEqual(linkPath("northernlights://add#invite=x"), { pathname: "/add", hash: "#invite=x" });
    assert.deepEqual(linkPath("northernlights://"), { pathname: "/", hash: "" });
  });

  test("other links are ignored", () => {
    assert.equal(linkPath("https://evil.example/add#code=abc"), null);
    assert.equal(linkPath("http://app.yeix.io/add"), null);
    assert.equal(linkPath("not a url"), null);
  });
});
