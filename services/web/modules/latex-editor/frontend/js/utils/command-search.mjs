/**
 * Pure search logic for the equation editor's command search.
 *
 * Entries are expected to be objects of the shape
 * `{ cmd: string, desc: string, insert?: string }`, but the search is
 * defensive: entries missing fields are skipped rather than crashing.
 */

export const SEARCH_RESULT_LIMIT = 30

/**
 * @param {Array<{cmd?: string, desc?: string, insert?: string}>} commands
 * @param {string} query
 * @param {object} [options]
 * @param {number} [options.limit]
 * @returns {Array} up to `limit` matching entries, in original order
 */
export function searchCommands(commands, query, { limit = SEARCH_RESULT_LIMIT } = {}) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : ''
  if (!q || !Array.isArray(commands)) {
    return []
  }

  const matches = []
  for (const entry of commands) {
    if (matches.length >= limit) break
    if (!entry || typeof entry !== 'object') continue

    const haystacks = [entry.cmd, entry.desc, entry.insert].filter(
      value => typeof value === 'string'
    )
    if (haystacks.some(value => value.toLowerCase().includes(q))) {
      matches.push(entry)
    }
  }

  return matches
}
