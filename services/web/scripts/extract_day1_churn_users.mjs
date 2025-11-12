import { scriptRunner } from './lib/ScriptRunner.mjs'
import * as csv from 'csv'
import fs from 'node:fs'
import minimist from 'minimist'
import { User } from '../app/src/models/User.mjs'

/**
 * This script extracts users who churned after day 1 - ie. their last session was within 24 hours of registering
 *
 * It will:
 *   — Find users whose lastActive is within 24 hours of their signUpDate
 *   — Filter for a configurable lookback period (default: 6 months)
 *   — Export user IDs and email addresses to CSV
 *
 * Usage:
 *   - Locally:
 *     - docker compose exec web bash
 *     - node scripts/extract_day1_churn_users.js
 *   - On the server:
 *     - rake connect:app[staging,web]
 *     - node scripts/extract_day1_churn_users.js
 *     - exit
 *     - kubectl cp web-standalone-prod-XXXXX:/tmp/day1_churn_users.csv ~/day1_churn_users.csv
 */

function usage() {
  console.log(
    `
    Day 1 Churn Users extraction, outputs to /tmp/day1_churn_users.csv

    Usage:
      node scripts/extract_day1_churn_users.js [--lookbackMonths=<months>] [--outputPath=<path>] [--sampleSize=<number>] [--excludeRecentDays=<days>] [--includeLastActive] [--includeHoursActive]

    Options:
    --help                     Show this screen

    --lookbackMonths=<months>  Number of months to look back for registrations (default: 6)

    --outputPath=<path>        Output file path (default: /tmp/day1_churn_users.csv)

    --sampleSize=<number>      Maximum number of users to randomly sample per month (default: all users)

    --excludeRecentDays=<days> Exclude users who registered in the last X days to avoid premature churn classification (default: 7)

    --includeLastActive        Include lastActive column in the output CSV (default: false)

    --includeHoursActive       Include hoursActive column in the output CSV (default: false)

    Description:
    This script identifies users who churned after day 1, meaning their last activity
    was within 24 hours of their registration date. It looks for users who:
    1. Registered within the specified lookback period
    2. Have a lastActive timestamp
    3. Their lastActive is <= 24 hours after their signUpDate
    4. Did not register within the recent exclusion period

    Grace Period:
    The --excludeRecentDays parameter prevents prematurely marking users as churned.
    For example, with --excludeRecentDays=7, users who registered in the last 7 days
    will be excluded from the analysis.

    Sampling:
    When --sampleSize is specified, the script will add a MongoDB $sample stage to
    randomly sample up to that number of users from each month within the lookback
    period. For example, with --sampleSize=100 and --lookbackMonths=6, you'll get
    up to 100 randomly selected users for each of the 6 months, for a maximum of
    600 users total.
    `
  )
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['outputPath'],
    number: ['lookbackMonths', 'sampleSize', 'excludeRecentDays'],
    bool: ['help', 'includeLastActive', 'includeHoursActive'],
    default: {
      help: false,
      lookbackMonths: 6,
      outputPath: '/tmp/day1_churn_users.csv',
      sampleSize: null, // null => return all users
      excludeRecentDays: 7, // Exclude users who registered in the last 7 days
      includeLastActive: false,
      includeHoursActive: false,
    },
  })

  if (argv.help) {
    usage()
    process.exit(0)
  }

  return argv
}

async function getDay1ChurnUsers({
  lookbackMonths,
  sampleSize,
  excludeRecentDays,
}) {
  // Calculate the actual lookback date used in queries (first day of the oldest month)
  const lookbackDate = new Date()
  lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths)
  lookbackDate.setDate(1)
  lookbackDate.setHours(0, 0, 0, 0)

  const exclusionDate = new Date()
  exclusionDate.setDate(exclusionDate.getDate() - excludeRecentDays)

  console.log(
    `Looking for users who registered after: ${lookbackDate.toISOString()}`
  )
  console.log(
    `Excluding users who registered after: ${exclusionDate.toISOString()} (last ${excludeRecentDays} days)`
  )

  const allChurnUsers = []

  for (let monthOffset = 0; monthOffset < lookbackMonths; monthOffset++) {
    const monthStart = new Date()
    monthStart.setMonth(monthStart.getMonth() - monthOffset - 1)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)

    // Skip months that would include users in the exclusion period
    if (monthEnd > exclusionDate) {
      // Adjust monthEnd to the exclusion date if the month overlaps
      if (monthStart < exclusionDate) {
        monthEnd.setTime(exclusionDate.getTime())
      } else {
        continue
      }
    }

    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

    console.log(
      `Processing month ${monthKey} (${monthStart.toISOString()} to ${monthEnd.toISOString()})`
    )

    const pipeline = [
      // Match users who registered in this month and have a lastActive property
      {
        $match: {
          signUpDate: {
            $gte: monthStart,
            $lt: monthEnd,
          },
          lastActive: { $exists: true, $ne: null },
        },
      },
      // Compute the time between registration and last active
      {
        $addFields: {
          timeDiffHours: {
            $divide: [
              { $subtract: ['$lastActive', '$signUpDate'] },
              1000 * 60 * 60, // Convert milliseconds to hours
            ],
          },
        },
      },
      // Filter for day 1 churn (0-24 hours)
      {
        $match: {
          timeDiffHours: { $gte: 0, $lte: 24 },
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          signUpDate: 1,
          lastActive: 1,
          timeDiffHours: 1,
        },
      },
    ]

    // Add sampling stage if specified
    if (sampleSize && sampleSize > 0) {
      pipeline.push({ $sample: { size: sampleSize } })
    }

    const monthUsers = await User.aggregate(pipeline).exec()

    console.log(
      `Month ${monthKey}: Found ${monthUsers.length} day 1 churn users`
    )

    const formattedUsers = monthUsers.map(user => ({
      userId: user._id.toString(),
      email: user.email,
      signUpDate: new Date(user.signUpDate).toISOString(),
      lastActive: new Date(user.lastActive).toISOString(),
      hoursActive: user.timeDiffHours.toFixed(2),
    }))

    allChurnUsers.push(...formattedUsers)
  }

  console.log(`Total users collected: ${allChurnUsers.length}`)
  return allChurnUsers
}

const args = parseArgs()

async function runScript() {
  console.log(
    `Starting Day 1 churn extraction with lookback period: ${args.lookbackMonths} months`
  )
  console.log(
    `Excluding users who registered in the last ${args.excludeRecentDays} days`
  )
  if (args.sampleSize) {
    console.log(`Sampling enabled: maximum ${args.sampleSize} users per month`)
  } else {
    console.log('No sampling - returning all users')
  }

  if (args.includeLastActive) {
    console.log('Including lastActive column in output')
  }

  if (args.includeHoursActive) {
    console.log('Including hoursActive column in output')
  }

  const churnUsers = await getDay1ChurnUsers(args)

  if (churnUsers.length === 0) {
    console.log('No day 1 churn users found for the specified period')
    process.exit(0)
  }

  console.log(`Writing ${churnUsers.length} users to ${args.outputPath}...`)

  const columns = ['userId', 'email', 'signUpDate']

  if (args.includeLastActive) {
    columns.push('lastActive')
  }

  if (args.includeHoursActive) {
    columns.push('hoursActive')
  }

  csv.stringify(
    churnUsers,
    {
      header: true,
      columns,
    },
    function (err, output) {
      if (err) {
        console.error('Error writing CSV output:', err)
        process.exit(1)
      }

      fs.writeFileSync(args.outputPath, output)
      console.log(
        `Successfully wrote ${churnUsers.length} day 1 churn users to ${args.outputPath}`
      )
      process.exit(0)
    }
  )
}

scriptRunner(runScript, args).catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
