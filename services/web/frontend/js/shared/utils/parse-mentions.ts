import { UserId } from '@ol-types/user'

export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; userId: UserId }

export const MENTION_REGEX = /@\[([a-f0-9]{24})\]/g

export function parseMentions(content: string): MentionSegment[] {
  const segments: MentionSegment[] = []
  let lastIndex = 0

  for (const match of content.matchAll(MENTION_REGEX)) {
    const matchStart = match.index
    if (matchStart > lastIndex) {
      segments.push({
        type: 'text',
        value: content.slice(lastIndex, matchStart),
      })
    }
    segments.push({ type: 'mention', userId: match[1] as UserId })
    lastIndex = matchStart + match[0].length
  }

  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}

export function countMentionedUsers(content: string): number {
  const userIds = new Set<string>()

  for (const match of content.matchAll(MENTION_REGEX)) {
    userIds.add(match[1])
  }

  return userIds.size
}

const MENTION_RAW_LENGTH = 27 // @[ + 24 hex chars + ]

export function sliceMentionSegments(
  segments: MentionSegment[],
  limit: number
): MentionSegment[] {
  const result: MentionSegment[] = []
  let consumed = 0

  for (const segment of segments) {
    if (consumed >= limit) break

    const length =
      segment.type === 'text' ? segment.value.length : MENTION_RAW_LENGTH
    const remaining = limit - consumed

    if (length <= remaining) {
      result.push(segment)
      consumed += length
      continue
    }

    if (segment.type === 'text') {
      result.push({ type: 'text', value: segment.value.slice(0, remaining) })
    }
    break
  }

  return result
}
