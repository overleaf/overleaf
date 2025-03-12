// @ts-check
import { ObjectId } from 'mongodb'
import { READ_PREFERENCE_SECONDARY } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db, client } from '../lib/mongodb.js'

const projectsCollection = db.collection('projects')

// Enable caching for ObjectId.toString()
ObjectId.cacheHexString = true

// Configuration
const SAMPLE_SIZE_PER_ITERATION = process.argv[2]
  ? parseInt(process.argv[2], 10)
  : 10000
const TARGET_ERROR_PERCENTAGE = process.argv[3]
  ? parseFloat(process.argv[3])
  : 5.0

let gracefulShutdownInitiated = false

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

function handleSignal() {
  gracefulShutdownInitiated = true
  console.warn('graceful shutdown initiated')
}

async function takeSample(sampleSize) {
  const results = await projectsCollection
    .aggregate(
      [
        { $sample: { size: sampleSize } },
        {
          $match: { 'overleaf.backup.lastBackedUpVersion': { $exists: true } },
        },
        {
          $count: 'total',
        },
      ],
      { readPreference: READ_PREFERENCE_SECONDARY }
    )
    .toArray()

  const count = results[0]?.total || 0
  return { totalSampled: sampleSize, backedUp: count }
}

function calculateStatistics(
  cumulativeSampled,
  cumulativeBackedUp,
  totalPopulation
) {
  const proportion = Math.max(1, cumulativeBackedUp) / cumulativeSampled

  // Standard error with finite population correction
  const fpc = Math.sqrt(
    (totalPopulation - cumulativeSampled) / (totalPopulation - 1)
  )
  const stdError =
    Math.sqrt((proportion * (1 - proportion)) / cumulativeSampled) * fpc

  // 95% confidence interval is approximately ±1.96 standard errors
  const marginOfError = 1.96 * stdError

  return {
    proportion,
    percentage: (proportion * 100).toFixed(2),
    marginOfError,
    errorPercentage: (marginOfError * 100).toFixed(2),
    lowerBound: ((proportion - marginOfError) * 100).toFixed(2),
    upperBound: ((proportion + marginOfError) * 100).toFixed(2),
    sampleSize: cumulativeSampled,
    populationSize: totalPopulation,
  }
}

async function main() {
  console.log('Date:', new Date().toISOString())
  const totalCount = await projectsCollection.estimatedDocumentCount({
    readPreference: READ_PREFERENCE_SECONDARY,
  })
  console.log(
    `Total projects in collection (estimated): ${totalCount.toLocaleString()}`
  )
  console.log(`Target margin of error: ${TARGET_ERROR_PERCENTAGE}%`)

  let cumulativeSampled = 0
  let cumulativeBackedUp = 0
  let currentError = Infinity
  let iteration = 0

  console.log('Iteration | Total Sampled | % Backed Up | Margin of Error')
  console.log('----------|---------------|-------------|----------------')

  while (currentError > TARGET_ERROR_PERCENTAGE) {
    if (gracefulShutdownInitiated) {
      console.log('Graceful shutdown initiated. Exiting sampling loop.')
      break
    }

    iteration++
    const { totalSampled, backedUp } = await takeSample(
      SAMPLE_SIZE_PER_ITERATION
    )
    cumulativeSampled += totalSampled
    cumulativeBackedUp += backedUp

    const stats = calculateStatistics(
      cumulativeSampled,
      cumulativeBackedUp,
      totalCount
    )
    currentError = parseFloat(stats.errorPercentage)

    console.log(
      `${iteration.toString().padStart(9)} | ` +
        `${cumulativeSampled.toString().padStart(13)} | ` +
        `${stats.percentage.padStart(10)}% | ` +
        `\u00B1${stats.errorPercentage}%`
    )

    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const finalStats = calculateStatistics(
    cumulativeSampled,
    cumulativeBackedUp,
    totalCount
  )

  console.log(
    `Projects sampled: ${cumulativeSampled.toLocaleString()} out of ${totalCount.toLocaleString()}`
  )
  console.log(
    `Estimated percentage with lastBackedUpVersion: ${finalStats.percentage}%`
  )
  console.log(
    `95% Confidence Interval: ${finalStats.lowerBound}% - ${finalStats.upperBound}%`
  )
  console.log(`Final Margin of Error: \u00B1${finalStats.errorPercentage}%`)
}

main()
  .then(() => console.log('Done.'))
  .catch(err => {
    console.error('Error:', err)
    process.exitCode = 1
  })
  .finally(() => {
    client.close().catch(err => console.error('Error closing MongoDB:', err))
  })
