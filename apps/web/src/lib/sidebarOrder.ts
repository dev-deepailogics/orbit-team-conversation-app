import type { SidebarSort } from "../stores/sidebarSortStore";

export interface ConversationKeys<T> {
  name: (item: T) => string;
  /** Last activity as epoch ms (0 when never used). */
  activity: (item: T) => number;
  unread: (item: T) => number;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

/**
 * Orders sidebar conversations: anything unread comes first (newest first), then the rest in the user's chosen order.
 * Once a conversation is read it drops back to its normal place. Keys are computed once per item, not per comparison.
 */
export function orderConversations<T>(items: T[], sort: SidebarSort, keys: ConversationKeys<T>): T[] {
  return items
    .map((item) => ({ item, name: keys.name(item), at: keys.activity(item), unread: keys.unread(item) > 0 }))
    .sort((a, b) => {
      if (a.unread !== b.unread) return a.unread ? -1 : 1;
      if ((a.unread || sort === "recent") && a.at !== b.at) return b.at - a.at;
      return collator.compare(a.name, b.name);
    })
    .map((d) => d.item);
}
