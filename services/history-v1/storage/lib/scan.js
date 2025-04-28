const BATCH_SIZE = 1000 // Default batch size for SCAN

/**
 * Asynchronously scans a Redis instance or cluster for keys matching a pattern.
 *
 * This function handles both standalone Redis instances and Redis clusters.
 * For clusters, it iterates over all master nodes. It yields keys in batches
 * as they are found by the SCAN command.
 *
 * @param {object} redisClient - The Redis client instance (from @overleaf/redis-wrapper).
 * @param {string} pattern - The pattern to match keys against (e.g., 'user:*').
 * @param {number} [count=BATCH_SIZE] - Optional hint for Redis SCAN count per iteration.
 * @yields {string[]} A batch of matching keys.
 */
async function* scanRedisCluster(redisClient, pattern, count = BATCH_SIZE) {
  const nodes = redisClient.nodes ? redisClient.nodes('master') : [redisClient]

  for (const node of nodes) {
    let cursor = '0'
    do {
      // redisClient from @overleaf/redis-wrapper uses ioredis style commands
      const [nextCursor, keys] = await node.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count
      )
      cursor = nextCursor
      if (keys.length > 0) {
        yield keys
      }
    } while (cursor !== '0')
  }
}

/**
 * Extracts the content within the first pair of curly braces {} from a string.
 * This is used to extract a user ID or project ID from a Redis key.
 *
 * @param {string} key - The input string containing content within curly braces.
 * @returns {string | null} The extracted content (the key ID) if found, otherwise null.
 */
function extractKeyId(key) {
  const match = key.match(/\{(.*?)\}/)
  if (match && match[1]) {
    return match[1]
  }
  return null
}

module.exports = { scanRedisCluster, extractKeyId }
