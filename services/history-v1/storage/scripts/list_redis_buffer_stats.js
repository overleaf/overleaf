const { rclientHistory, disconnect } = require('../lib/redis')
const { scanRedisCluster } = require('../lib/scan')

// Lua script to get snapshot length, change lengths, and change timestamps
// Assumes snapshot key is a string and changes key is a list.
const LUA_SCRIPT = `
  -- local cjson = require('cjson')
  local snapshotKey = KEYS[1]
  local changesKey = KEYS[2]

  -- Get snapshot length (returns 0 if key does not exist)
  local snapshotLen = redis.call('STRLEN', snapshotKey)

  -- Return nil if snapshot is empty
  if snapshotLen == 0 then
    return nil
  end

  local changeLengths = {}
  local changeTimestamps = {}

  -- Get all changes (returns empty list if key does not exist)
  local changes = redis.call('LRANGE', changesKey, 0, -1)

  -- FIXME: it would be better to send all the changes back and do the processing
  -- in JS to avoid blocking redis, if we need to run this script regularly
  for i, change in ipairs(changes) do
    -- Calculate length
    table.insert(changeLengths, string.len(change))

    -- Attempt to decode JSON and extract timestamp
    local ok, decoded = pcall(cjson.decode, change)
    if ok and type(decoded) == 'table' and decoded.timestamp then
      table.insert(changeTimestamps, decoded.timestamp)
    else
      -- Handle cases where decoding fails or timestamp is missing
      -- Log or insert a placeholder like nil if needed, otherwise skip
      table.insert(changeTimestamps, nil) -- Keep placeholder for consistency
    end
  end

  -- Return snapshot length, list of change lengths, and list of change timestamps
  return {snapshotLen, changeLengths, changeTimestamps}
`

// Define the command if it doesn't exist
if (!rclientHistory.getProjectBufferStats) {
  rclientHistory.defineCommand('getProjectBufferStats', {
    numberOfKeys: 2,
    lua: LUA_SCRIPT,
  })
}

/**
 * Processes a single project ID: fetches its buffer stats from Redis
 * and writes the results to the output stream in CSV format.
 *
 * @param {string} projectId The project ID to process.
 * @param {WritableStream} outputStream The stream to write CSV output to.
 */
async function processProject(projectId, outputStream) {
  try {
    // Get current time in milliseconds *before* fetching data
    const nowMs = Date.now()

    // Execute the Lua script
    const result = await rclientHistory.getProjectBufferStats(
      `snapshot:${projectId}`,
      `changes:${projectId}`
    )

    // Check if the result is null (e.g., snapshot is empty)
    if (result === null) {
      console.log(
        `Skipping project ${projectId}: Snapshot is empty or does not exist.`
      )
      return
    }

    const [snapshotSize, changeSizes, changeTimestamps] = result

    // Output snapshot size
    outputStream.write(`${projectId},snapshotSize,${snapshotSize}\n`)
    outputStream.write(`${projectId},changeCount,${changeSizes.length}\n`)

    const changes = changeSizes.map((size, index) => [
      size,
      changeTimestamps[index],
    ])

    let totalChangeSize = 0
    // Output change sizes
    for (const [changeSize, changeTimestamp] of changes) {
      totalChangeSize += parseInt(changeSize, 10)
      const age = nowMs - new Date(changeTimestamp)
      const ageInSeconds = Math.floor(age / 1000)
      outputStream.write(`${projectId},change,${changeSize},${ageInSeconds}\n`)
    }
    outputStream.write(`${projectId},totalChangeSize,${totalChangeSize}\n`)
  } catch (err) {
    // Log error for this specific project but continue with others
    console.error(`Error processing project ${projectId}:`, err)
  }
}

async function main() {
  const outputStream = process.stdout

  // Write CSV header
  outputStream.write('projectId,type,size,age\n')

  try {
    const scanPattern = 'snapshot:*'
    console.log(`Scanning Redis for keys matching "${scanPattern}"...`)

    for await (const keysBatch of scanRedisCluster(
      rclientHistory,
      scanPattern
    )) {
      for (const key of keysBatch) {
        const parts = key.split(':')
        if (parts.length !== 2 || parts[0] !== 'snapshot') {
          console.warn(`Skipping malformed key: ${key}`)
          continue
        }
        const projectId = parts[1]

        // Call processProject directly and await it sequentially
        await processProject(projectId, outputStream)
      }
    }

    console.log('Finished processing keys.')
  } catch (error) {
    console.error('Error during Redis scan:', error)
  } finally {
    await disconnect()
    console.log('Redis connections closed.')
  }
}

main().catch(err => {
  console.error('Unhandled error in main:', err)
  process.exit(1)
})
