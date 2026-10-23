// Merging several sites' feeds into one, newest first.
//
// Each site is a "lane" that is paged separately. A post can only be shown once
// every lane that might still hold something newer has been loaded past it,
// otherwise a slow site's posts would later appear above ones already read. So
// the merged feed stops at the horizon: the newest of the oldest posts loaded
// from each lane that has more to give. Loading more fetches the lane that sets
// the horizon.

export interface LanePost {
  id: string;
  created_at: string;
}

export interface Lane<P extends LanePost = LanePost> {
  posts: P[];
  /** The site said there is nothing older. */
  done: boolean;
  /** The site couldn't be reached; it is left out until it can. */
  error: string | null;
  /** The first page hasn't arrived yet. */
  loading: boolean;
}

/** Newest first; posts at the same moment by id, as the server pages them. */
export const newestFirst = (a: LanePost, b: LanePost) =>
  a.created_at === b.created_at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.created_at < b.created_at ? 1 : -1;

const open = (lane: Lane) => !lane.done && !lane.error;

/** The oldest post that is safe to show, or null when every lane is complete. */
export function horizon(lanes: Lane[]): LanePost | null {
  let edge: LanePost | null = null;
  for (const lane of lanes) {
    if (!open(lane)) continue;
    const last = lane.posts.at(-1);
    if (!last) return { id: "￿", created_at: "￿" }; // a lane is still loading: nothing is safe yet
    if (!edge || newestFirst(last, edge) < 0) edge = last;
  }
  return edge;
}

/** The merged feed, cut at the horizon. */
export function visible<P extends LanePost>(lanes: Lane<P>[]): P[] {
  const edge = horizon(lanes);
  const all = lanes.flatMap((l) => (l.error ? [] : l.posts)).sort(newestFirst);
  return edge ? all.filter((p) => newestFirst(p, edge) <= 0) : all;
}

/** Which lanes to page next: those whose oldest post sets the horizon. */
export function lanesToLoad(lanes: Lane[]): number[] {
  const edge = horizon(lanes);
  if (!edge) return [];
  return lanes.flatMap((lane, i) => {
    const last = lane.posts.at(-1);
    return open(lane) && !lane.loading && last && newestFirst(last, edge) === 0 ? [i] : [];
  });
}

/** Folds a fresh first page into what a lane already holds, keeping older pages. */
export function withFirstPage<P extends LanePost>(old: P[], page: P[]): P[] {
  const last = page.at(-1);
  if (!last) return [];
  return [...page, ...old.filter((p) => newestFirst(p, last) > 0)];
}
