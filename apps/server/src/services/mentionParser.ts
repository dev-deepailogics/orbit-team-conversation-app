// Shared @mention matching, used by mentionService (in-app notifications) and
// pushService (filtering push recipients who only want "MENTIONS" notifications).
// Kept in one place so the matching rule never drifts between the two.

const MENTION_REGEX = /(?:^|[\s(])@([a-zA-Z0-9_.-]+)/g;

export function extractMentionTokens(content: string): string[] {
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    if (match[1]) tokens.push(match[1].toLowerCase());
  }
  return tokens;
}

/** Returns the ids of candidates whose username or display name is @mentioned in content. */
export function matchMentionedUserIds(
  content: string,
  candidates: { id: string; username: string; displayName: string }[],
  excludeUserId?: string | null
): string[] {
  const tokens = extractMentionTokens(content);
  if (tokens.length === 0) return [];
  const lowerContent = content.toLowerCase();

  return candidates
    .filter((u) => {
      if (!u || u.id === excludeUserId) return false;
      const uUsername = u.username.toLowerCase();
      const uDisplayName = u.displayName.toLowerCase();
      return (
        tokens.includes(uUsername) ||
        tokens.includes(uDisplayName) ||
        lowerContent.includes(`@${uDisplayName}`) ||
        lowerContent.includes(`@${uUsername}`)
      );
    })
    .map((u) => u.id);
}
