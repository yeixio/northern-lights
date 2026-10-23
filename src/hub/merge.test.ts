import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lanesToLoad, visible, withFirstPage, type Lane, type LanePost } from "./merge.js";

const post = (id: string, minute: number): LanePost => ({ id, created_at: `2026-10-23T10:${String(minute).padStart(2, "0")}:00.000Z` });
const lane = (posts: LanePost[], more = true): Lane => ({ posts, done: !more, error: null, loading: false });
const ids = (posts: LanePost[]) => posts.map((p) => p.id);

describe("merging feeds", () => {
  test("shows posts newest first, down to where every site with more has been loaded", () => {
    const family = lane([post("f1", 50), post("f2", 40), post("f3", 10)]);
    const club = lane([post("c1", 45), post("c2", 30)]);
    // The club may still have posts between 10:30 and 10:10, so the family's 10:10 waits.
    assert.deepEqual(ids(visible([family, club])), ["f1", "c1", "f2", "c2"]);
    assert.deepEqual(lanesToLoad([family, club]), [1]);
  });

  test("a finished site doesn't hold the others back", () => {
    const family = lane([post("f1", 50), post("f2", 10)], false);
    const club = lane([post("c1", 45)], false);
    assert.deepEqual(ids(visible([family, club])), ["f1", "c1", "f2"]);
    assert.deepEqual(lanesToLoad([family, club]), []);
  });

  test("nothing shows while a site's first page is on its way", () => {
    const family = lane([post("f1", 50)]);
    const club: Lane = { posts: [], done: false, error: null, loading: true };
    assert.deepEqual(visible([family, club]), []);
  });

  test("a site that can't be reached is left out", () => {
    const family = lane([post("f1", 50)], false);
    const club: Lane = { posts: [post("c1", 55)], done: false, error: "Can't reach club", loading: false };
    assert.deepEqual(ids(visible([family, club])), ["f1"]);
  });

  test("posts at the same moment are ordered like the server pages them", () => {
    const a = lane([post("b", 10), post("a", 10)], false);
    assert.deepEqual(ids(visible([a])), ["b", "a"]);
  });

  test("a fresh first page replaces the newest posts and keeps older pages", () => {
    const old = [post("p3", 40), post("p2", 30), post("p1", 20)];
    const page = [post("p4", 50), post("p3", 40)];
    assert.deepEqual(ids(withFirstPage(old, page)), ["p4", "p3", "p2", "p1"]);
    assert.deepEqual(withFirstPage(old, []), []);
  });
});
