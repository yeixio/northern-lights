// Fills an empty Northern Lights database with a made-up family: members,
// posts, comments, likes, messages, albums and a customized home page. Every
// name, message and photo is fictional, and the photos are painted in code.
//
//   npm run demo          build, seed ./demo-data if it's empty, and start the server
//   npm run demo:seed     only seed; honors DATA_DIR and DATABASE_URL
//
// Everyone's password is "northern-lights". Sign in as astrid@example.com (an
// admin) or any other member below.

import path from "node:path";
import { SCENES, landscape, type Scene } from "./pictures.js";

process.env.DATA_DIR ??= path.resolve("demo-data");
const { config } = await import("../../server/config.js");
const { openDatabase, newId } = await import("../../server/db/index.js");
const { createStorage } = await import("../../server/storage.js");
const { hashPassword } = await import("../../server/auth.js");

export const DEMO_PASSWORD = "northern-lights";

const db = await openDatabase(config.databaseUrl);
const storage = createStorage();

// Timestamps relative to now, so the feed always reads "2h ago", "yesterday"...
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

let seed = 1;
async function picture(scene: Scene, ownerId: string, size: [number, number] = [1200, 800]) {
  const key = `${newId()}.png`;
  const png = landscape(scene, seed++, size[0], size[1]);
  await storage.put(key, png, "image/png");
  await db.insertInto("files")
    .values({ key, owner_id: ownerId, mime: "image/png", size: png.length, created_at: ago(24 * 60) }).execute();
  return `/files/${key}`;
}

async function seedDemo() {
  // ---- people --------------------------------------------------------------
  const people = [
    { key: "astrid", first: "Astrid", last: "Halvorsen", admin: true, scene: SCENES.aurora, bio: "Keeper of the family photo archive. Usually found somewhere north of the Arctic Circle with a camera." },
    { key: "erik", first: "Erik", last: "Halvorsen", scene: SCENES.fjord, bio: "Boats, bread, and terrible puns." },
    { key: "maja", first: "Maja", last: "Lund", scene: SCENES.meadow, bio: "Gardener, grandmother, champion of the yearly cloudberry hunt." },
    { key: "nils", first: "Nils", last: "Halvorsen", scene: SCENES.winter, bio: "Studying in Trondheim. Will ski for food." },
    { key: "sofia", first: "Sofia", last: "Berg", scene: SCENES.sunset, bio: "Photographer by day, baker by night." },
    { key: "oskar", first: "Oskar", last: "Lund", scene: SCENES.forest, bio: null },
    { key: "linnea", first: "Linnea", last: "Halvorsen", scene: SCENES.dusk, bio: "Age 9 and three quarters. Likes horses." },
  ] as const;

  const password = await hashPassword(DEMO_PASSWORD);
  const ids = {} as Record<(typeof people)[number]["key"], string>;
  for (const [i, p] of people.entries()) {
    const id = newId();
    ids[p.key] = id;
    await db.insertInto("users").values({
      id, email: `${p.key}@example.com`, password_hash: password, first_name: p.first, last_name: p.last,
      display_name: null, bio: p.bio, avatar_url: null, is_admin: "admin" in p ? 1 : 0, is_active: 1,
      preferences: null, created_at: ago(24 * (90 - i * 7)), updated_at: ago(24 * (90 - i * 7)),
    }).execute();
  }
  for (const p of people) {
    if (p.key === "oskar") continue; // one member without a photo shows the initials fallback
    const url = await picture(p.scene, ids[p.key], [256, 256]);
    await db.updateTable("users").set({ avatar_url: url }).where("id", "=", ids[p.key]).execute();
  }

  // ---- albums --------------------------------------------------------------
  const albumDefs = [
    { title: "Lofoten, last summer", description: "Midnight sun, fishing villages and far too many seagulls.", owner: "astrid", public: true, scenes: ["fjord", "coast", "sunset", "fjord", "meadow", "coast"], age: 24 * 40 },
    { title: "Winter at the cabin", description: "Snow up to the windows and the best aurora in years.", owner: "erik", public: true, scenes: ["aurora", "winter", "dusk", "aurora", "winter"], age: 24 * 12 },
    { title: "Maja's garden", description: "From the first crocus to the last apple.", owner: "maja", public: true, scenes: ["meadow", "forest", "meadow", "forest"], age: 24 * 25 },
    { title: "Linnea's birthday", description: "Private: just for the family.", owner: "sofia", public: false, scenes: ["sunset", "dusk", "coast"], age: 24 * 5 },
  ] as const;

  const albums: { id: string; cover: string }[] = [];
  for (const a of albumDefs) {
    const id = newId();
    const owner = ids[a.owner];
    const urls = [];
    for (const s of a.scenes) urls.push(await picture(SCENES[s], owner));
    await db.insertInto("albums").values({
      id, owner_id: owner, title: a.title, description: a.description, cover_url: urls[0],
      is_public: a.public ? 1 : 0, created_at: ago(a.age), updated_at: ago(a.age),
    }).execute();
    for (const [i, url] of urls.entries()) {
      await db.insertInto("media").values({
        id: newId(), user_id: owner, album_id: id, url, type: "image", caption: null, created_at: ago(a.age - i * 0.1),
      }).execute();
    }
    albums.push({ id, cover: urls[0] });
  }

  // ---- posts, comments and likes ---------------------------------------------
  type Who = keyof typeof ids;
  const postDefs: { by: Who; hours: number; text: string; scenes?: (keyof typeof SCENES)[]; public?: boolean; likes: Who[]; comments?: [Who, string][] }[] = [
    {
      by: "erik", hours: 2, scenes: ["aurora", "dusk"],
      text: "Stepped outside to grab firewood and the whole sky lit up. Stood there in my socks for twenty minutes. Worth it.",
      likes: ["astrid", "maja", "nils", "sofia", "linnea"],
      comments: [["maja", "Put some boots on next time! But wow."], ["nils", "Jealous. All we have in Trondheim tonight is drizzle."], ["linnea", "I WANT TO SEE IT"]],
    },
    {
      by: "sofia", hours: 7,
      text: "Cardamom buns are out of the oven. First five people to the kitchen get one, the rest of you get the smell.",
      likes: ["erik", "linnea", "oskar"],
      comments: [["oskar", "On my way."]],
    },
    {
      by: "maja", hours: 26, scenes: ["meadow"], public: true,
      text: "The cloudberries are early this year! Annual picking trip is on for Saturday. Bring buckets, bug spray, and patience.",
      likes: ["astrid", "erik", "sofia", "linnea", "oskar", "nils"],
      comments: [["astrid", "Wouldn't miss it. I'll bring the thermos."], ["erik", "Last year's record was 4.2 kg. Just saying."]],
    },
    {
      by: "nils", hours: 50,
      text: "Passed my thermodynamics exam. Celebrating with instant noodles and nine hours of sleep.",
      likes: ["astrid", "erik", "maja", "sofia"],
      comments: [["astrid", "So proud of you! Real food when you're home, I promise."]],
    },
    {
      by: "astrid", hours: 75, scenes: ["fjord", "coast", "sunset"], public: true,
      text: "Finally sorted the photos from Lofoten. The full album is up for everyone. Thank you all for a summer we'll talk about for years.",
      likes: ["erik", "maja", "nils", "sofia", "oskar"],
      comments: [["sofia", "That light at 2am still doesn't feel real."]],
    },
    {
      by: "linnea", hours: 120,
      text: "I lost my first tooth at school today and the tooth fairy better know where I am this weekend.",
      likes: ["astrid", "erik", "maja", "nils", "sofia", "oskar"],
      comments: [["maja", "She always knows, sweetheart."], ["erik", "I have it on good authority she takes forwarding addresses."]],
    },
  ];

  for (const p of postDefs) {
    const id = newId();
    const media = [];
    for (const s of p.scenes ?? []) media.push(await picture(SCENES[s], ids[p.by]));
    await db.insertInto("posts").values({
      id, user_id: ids[p.by], content: p.text, media_urls: JSON.stringify(media), is_public: p.public ? 1 : 0,
      created_at: ago(p.hours), updated_at: ago(p.hours),
    }).execute();
    for (const [i, who] of p.likes.entries()) {
      await db.insertInto("reactions")
        .values({ id: newId(), post_id: id, user_id: ids[who], type: "like", created_at: ago(p.hours - 0.1 * (i + 1)) }).execute();
    }
    for (const [i, [who, text]] of (p.comments ?? []).entries()) {
      await db.insertInto("comments")
        .values({ id: newId(), post_id: id, user_id: ids[who], content: text, created_at: ago(p.hours - 0.3 * (i + 1)) }).execute();
    }
  }

  // ---- messages --------------------------------------------------------------
  const conversations: [Who, Who, number, string, boolean?][] = [
    ["maja", "astrid", 30, "Did you find Grandpa's old slides in the attic?"],
    ["astrid", "maja", 29.5, "Three boxes of them! I'm scanning a few every evening."],
    ["maja", "astrid", 29, "Wonderful. There should be some from the 1974 trip to Tromsø."],
    ["astrid", "maja", 28, "Found those yesterday. You had quite the hat."],
    ["maja", "astrid", 3, "Don't you dare put the hat on the public page 😄", false],
    ["maja", "astrid", 2.9, "Also: dinner Sunday? Erik is making fish soup.", false],
    ["nils", "astrid", 20, "Can you send me the cabin wifi password?"],
    ["astrid", "nils", 19.8, "It's on the fridge, like always. 😉"],
    ["sofia", "astrid", 9, "I uploaded the birthday photos to a private album, just for us.", false],
    ["erik", "astrid", 48, "Snow tires are on. We're good for the drive up."],
  ];
  for (const [from, to, hours, content, read = true] of conversations) {
    await db.insertInto("messages").values({
      id: newId(), sender_id: ids[from], recipient_id: ids[to], content, read: read ? 1 : 0, created_at: ago(hours),
    }).execute();
  }

  // ---- site and home page ------------------------------------------------------
  const hero = await picture(SCENES.aurora, ids.astrid, [1600, 900]);
  const about = await picture(SCENES.fjord, ids.astrid);
  await db.updateTable("site_settings").set({
    site_name: "The Halvorsens",
    tagline: "Photos, news and stories from up north, shared with the people we love.",
    contact_email: "hello@example.com",
    theme: JSON.stringify({ preset: "aurora", mode: "light", font: "sans", radius: "default" }),
    home: JSON.stringify({
      sections: [
        {
          id: "welcome", type: "hero", eyebrow: "Welcome to",
          title: "The Halvorsens",
          subtitle: "Photos, news and stories from up north, shared with the people we love.",
          image: hero, look: "image", height: "tall", align: "center",
          buttons: [
            { label: "Browse photos", href: "/gallery", style: "primary" },
            { label: "Member login", href: "/login", style: "secondary" },
          ],
        },
        {
          id: "about", type: "split", eyebrow: "About us",
          heading: "Three generations, one very long group chat",
          body: "We're spread from Oslo to Tromsø these days, so this is where we keep up: holiday photos, birthdays, garden updates and the occasional lost tooth. Have a look around, and if you're family, sign in to see everything.",
          image: about, side: "right", buttons: [],
        },
        {
          id: "highlights", type: "cards", heading: "What you'll find here", intro: "", columns: 3, bg: "muted",
          items: [
            { icon: "camera", title: "Photo albums", body: "Trips to Lofoten, winters at the cabin, and Maja's famous garden.", href: "/gallery" },
            { icon: "newspaper", title: "Family news", body: "Milestones and updates we've chosen to share with everyone." },
            { icon: "lock", title: "A private space", body: "Family members get a private feed, albums and messages, by invitation only.", href: "/login" },
          ],
        },
        { id: "albums", type: "gallery", heading: "Recent photos", intro: "", limit: 6 },
        { id: "news", type: "updates", heading: "Latest updates", limit: 3, width: "narrow" },
        {
          id: "join", type: "cta", heading: "Part of the family?", bg: "bold",
          body: "Members can sign in to see private posts, albums and messages. Ask anyone already here for an invite.",
          buttons: [{ label: "Member login", href: "/login", style: "primary" }],
        },
      ],
    }),
    updated_at: ago(24),
  }).where("id", "=", 1).execute();

  // A pending invite, so the invite page has something to show.
  await db.insertInto("invitations").values({
    id: newId(), token_hash: "demo-" + newId(), email: "freya@example.com", invited_by: ids.astrid,
    message: "Come join the family page!", expires_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    accepted_at: null, created_at: ago(5),
  }).execute();

  console.log(`[demo] Seeded ${config.databaseUrl}`);
  console.log(`[demo] Sign in as astrid@example.com (admin) with the password "${DEMO_PASSWORD}".`);
}

const existing = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
if (existing) {
  console.log(`[demo] ${config.databaseUrl} already has accounts; leaving it alone.`);
} else {
  await seedDemo();
}
await db.destroy();
if (process.argv.includes("--serve")) await import("../../server/index.js");
