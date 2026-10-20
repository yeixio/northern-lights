import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildPlan, fixText } from "./facebook";
import { facebookExport, makeZip } from "./fixtures/facebookExport";
import { readZip } from "./zip";

describe("zip reader", () => {
  for (const zip64 of [false, true]) {
    test(`reads stored and deflated entries${zip64 ? " (Zip64)" : ""}`, async () => {
      const entries = await readZip(makeZip({ "a/b.json": '{"hi":"there"}', "c.jpg": Buffer.from([1, 2, 3]) }, { zip64 }));
      assert.deepEqual(entries.map((e) => [e.path, e.size]), [["a/b.json", 14], ["c.jpg", 3]]);
      assert.equal(await (await entries[0].blob()).text(), '{"hi":"there"}');
      assert.deepEqual([...new Uint8Array(await (await entries[1].blob()).arrayBuffer())], [1, 2, 3]);
    });
  }

  test("rejects files that aren't zips", async () => {
    await assert.rejects(readZip(new Blob(["not a zip at all, sorry"])), /zip/);
  });
});

describe("Facebook export", () => {
  test("repairs Facebook's escaped text", () => {
    assert.equal(fixText("CafÃ©"), "Café");
    assert.equal(fixText("plain"), "plain");
    assert.equal(fixText("Café ☕"), "Café ☕");
    assert.equal(fixText("été"), "été"); // real Latin-1 text that isn't valid UTF-8 stays
  });

  test("finds albums, loose photos, videos and posts across zip parts", async () => {
    const parts = facebookExport();
    const plan = await buildPlan((await Promise.all(parts.map(readZip))).flat());

    assert.deepEqual(plan.albums.map((a) => [a.title, a.items.map((i) => i.name)]), [
      ["Café summer", ["1_n.jpg", "2_n.jpg"]], // ordered by date taken
      ["Photos from Facebook posts", ["4_n.jpg"]], // 1_n.jpg is already in Café summer
      ["Other Facebook photos", ["3_n.jpg"]],
      ["Facebook videos", ["5.mp4"]],
    ]);
    const summer = plan.albums[0];
    assert.equal(summer.description, "Lake days");
    assert.equal(summer.created_at, new Date(1720000000_000).toISOString());
    assert.equal(summer.items[0].caption, "Sunset 🌅");
    assert.equal(summer.items[0].created_at, new Date(1719000000_000).toISOString()); // EXIF date wins
    assert.equal(summer.items[0].mime, "image/jpeg");
    assert.equal(plan.albums[3].items[0].type, "video");

    assert.equal(plan.photos, 4);
    assert.equal(plan.videos, 1);
    assert.equal(plan.missing, 1); // gone.mp4
    assert.equal(plan.unsupported, 1); // notes.srt

    assert.deepEqual(plan.posts.map((p) => [p.content, p.items.map((i) => i.name)]), [
      ["https://example.com/story", []],
      ["At the lake", ["1_n.jpg", "4_n.jpg"]],
    ]);
    // The same photo is one item wherever it appears.
    assert.equal(plan.posts[1].items[0], summer.items[0]);
  });

  test("keys are the same across exports, so re-imports are skipped", async () => {
    const a = await buildPlan((await Promise.all(facebookExport().map(readZip))).flat());
    const b = await buildPlan((await Promise.all(facebookExport({ zip64: true }).map(readZip))).flat());
    const keys = (p: typeof a) => [...p.albums.flatMap((x) => [x.key, ...x.items.map((i) => i.key)]), ...p.posts.map((x) => x.key)];
    assert.deepEqual(keys(a), keys(b));
  });

  test("explains HTML exports", async () => {
    const entries = await readZip(makeZip({ "x/index.html": "<html></html>" }));
    await assert.rejects(buildPlan(entries), /JSON/);
  });
});
