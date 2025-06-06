#!/usr/bin/env node
// @ts-check

const { rclientHistory: rclient } = require('../lib/redis')
const { keySchema } = require('../lib/chunk_store/redis')
const commandLineArgs = require('command-line-args')

const optionDefinitions = [
  { name: 'historyId', type: String, defaultOption: true },
]

// Column width for key display alignment; can be overridden with COL_WIDTH env variable
const COLUMN_WIDTH = process.env.COL_WIDTH
  ? parseInt(process.env.COL_WIDTH, 10)
  : 45

let options
try {
  options = commandLineArgs(optionDefinitions)
} catch (e) {
  console.error(
    'Error parsing command line arguments:',
    e instanceof Error ? e.message : String(e)
  )
  console.error('Usage: ./show_buffer.js <historyId>')
  process.exit(1)
}

const { historyId } = options

if (!historyId) {
  console.error('Usage: ./show_buffer.js <historyId>')
  process.exit(1)
}

function format(str, indent = COLUMN_WIDTH + 2) {
  const lines = str.split('\n')
  for (let i = 1; i < lines.length; i++) {
    lines[i] = ' '.repeat(indent) + lines[i]
  }
  return lines.join('\n')
}

async function displayKeyValue(
  rclient,
  key,
  { parseJson = false, formatDate = false } = {}
) {
  const value = await rclient.get(key)
  let displayValue = '(nil)'
  if (value) {
    if (parseJson) {
      try {
        displayValue = format(JSON.stringify(JSON.parse(value), null, 2))
      } catch (e) {
        displayValue = `  Raw value: ${value}`
      }
    } else if (formatDate) {
      const ts = parseInt(value, 10)
      displayValue = `${new Date(ts).toISOString()} (${value})`
    } else {
      displayValue = value
    }
  }
  console.log(`${key.padStart(COLUMN_WIDTH)}: ${displayValue}`)
}

async function displayBuffer(projectId) {
  console.log(`Buffer for history ID: ${projectId}`)
  console.log('--------------------------------------------------')

  try {
    const headKey = keySchema.head({ projectId })
    const headVersionKey = keySchema.headVersion({ projectId })
    const persistedVersionKey = keySchema.persistedVersion({ projectId })
    const expireTimeKey = keySchema.expireTime({ projectId })
    const persistTimeKey = keySchema.persistTime({ projectId })
    const changesKey = keySchema.changes({ projectId })

    await displayKeyValue(rclient, headKey, { parseJson: true })
    await displayKeyValue(rclient, headVersionKey)
    await displayKeyValue(rclient, persistedVersionKey)
    await displayKeyValue(rclient, expireTimeKey, { formatDate: true })
    await displayKeyValue(rclient, persistTimeKey, { formatDate: true })

    const changesList = await rclient.lrange(changesKey, 0, -1)

    // 6. changes
    let changesListDisplay = '(nil)'
    if (changesList) {
      changesListDisplay = changesList.length
        ? format(
            changesList
              .map((change, index) => `[${index}]: ${change}`)
              .join('\n')
          )
        : '(empty list)'
    }
    console.log(`${changesKey.padStart(COLUMN_WIDTH)}: ${changesListDisplay}`)
  } catch (error) {
    console.error('Error fetching data from Redis:', error)
    throw error
  }
}

;(async () => {
  let errorOccurred = false
  try {
    await displayBuffer(historyId)
  } catch (error) {
    errorOccurred = true
  } finally {
    rclient.quit(() => {
      process.exit(errorOccurred ? 1 : 0)
    })
  }
})()
