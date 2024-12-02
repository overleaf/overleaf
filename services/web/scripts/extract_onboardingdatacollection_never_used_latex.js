const csv = require('csv')
const fs = require('fs')
const minimist = require('minimist')
const {
  OnboardingDataCollection,
} = require('../app/src/models/OnboardingDataCollection')
const { User } = require('../app/src/models/User')
const SubscriptionLocator = require('../app/src/Features/Subscription/SubscriptionLocator')
const Settings = require('@overleaf/settings')
const { fetchJson } = require('@overleaf/fetch-utils')

/**
 * This script extracts ODC data with some extra fields, and filters on registration date and LaTeX experience
 *
 *  It will:
 *    — filter for used_latex=never
 *    — augment rows with user registered date and email addresses
 *    — filter on users registered after a certain date
 *    — export updated CSV
 *
 * Usage:
 *   - Locally:
 *     - docker compose exec web bash
 *     - node scripts/extract_onboardingdatacollection_never_used_latex.js
 *   - On the server:
 *     - rake connect:app[staging,web]
 *     - node scripts/extract_onboardingdatacollection_never_used_latex.js
 *     - exit
 *     - kubectl cp web-standalone-prod-XXXXX:/tmp/odc_neverUsedLatex.csv ~/odc_neverUsedLatex.csv
 */

function usage() {
  console.log(
    `
    Onboarding Data Collection extraction, outputs to /tmp/odc_neverUsedLatex.csv

    Usage:
      node scripts/extract_onboardingdatacollection_never_used_latex.js [--registeredBefore=<date>] [--studentsOnly] [--includeSignUpDate] [--includeCountry] [--includePlanCode]

    Options:
    --help                    Show this screen

    --registeredBefore=<date> Limit to users registered before ISO 8601 date (eg. 2024-08-01)

    --studentsOnly            Only include users whose primary occupation is 'university' or 'school'

    --includeSignUpDate       Include signUpDate column

    --includeCountry          Include countryCode column (inferred from institution and possibly missing)

    --includePlanCode         Include planCode column
    `
  )
}

function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string: ['registeredBefore'],
    bool: [
      'help',
      'studentsOnly',
      'includeSignUpDate',
      'includeCountry',
      'includePlanCode',
    ],
    default: {
      help: false,
      studentsOnly: false,
      includeSignUpDate: false,
      includeCountry: false,
      includePlanCode: false,
      registeredBefore: '2024-02-18',
    },
  })

  if (argv.help) {
    usage()
    process.exit(0)
  }
  return argv
}

async function getEmails(userIds, { registeredBefore }) {
  const userEmails = await User.find(
    { _id: { $in: userIds }, signUpDate: { $lte: new Date(registeredBefore) } },
    { email: 1, signUpDate: 1 }
  ).exec()
  return userEmails.map(({ email, signUpDate }) => ({
    email,
    signUpDate: new Date(signUpDate).toISOString(),
  }))
}

async function getUsers({ studentsOnly }) {
  const odcCriteria = { usedLatex: 'never' }
  if (studentsOnly) {
    odcCriteria.primaryOccupation = 'university'
  }

  const cursor = OnboardingDataCollection.find(odcCriteria).cursor()

  const userIds = []
  const institutionNames = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    userIds.push(doc._id.toString())
    institutionNames.push(doc.institutionName)
  }

  return { userIds, institutionNames }
}

async function getUserPlanCodes(users) {
  const planCodes = []
  for await (const user of users) {
    const subscription =
      await SubscriptionLocator.promises.getUsersSubscription(user)
    planCodes.push(subscription?.planCode || 'free')
  }
  return planCodes
}

// inferred from institution so will not always be available or accurate
async function getUserCountries(institutions) {
  const countryCodes = []
  // cache any institutions we lookup to avoid making duplicate calls
  const institutionLookups = {}
  for await (const inst of institutions) {
    if (!inst) {
      countryCodes.push(undefined)
      continue
    }
    if (institutionLookups[inst]) {
      countryCodes.push(institutionLookups[inst])
      continue
    }
    try {
      const url = `${Settings.apis.web.url}/institutions/search?search=${encodeURIComponent(inst)}&max_results=1`
      const response = await fetchJson(url)
      countryCodes.push(response[0]?.country_code)
      institutionLookups[inst] = response[0]?.country_code
    } catch (e) {
      // if institution search fails just move on
      console.log(`Error when looking up institution ${inst}: ${e.message}`)
      countryCodes.push(undefined)
    }
  }
  return countryCodes
}

async function runScript() {
  const columns = ['email']

  const args = parseArgs()

  if (args.includeSignUpDate) {
    columns.push('signUpDate')
  }

  const users = await getUsers(args)
  let userEmails = await getEmails(users.userIds, args)

  if (args.includePlanCode) {
    columns.push('planCode')
    const planCodes = await getUserPlanCodes(users.userIds)
    userEmails = userEmails.map((user, index) => {
      user.planCode = planCodes[index]
      return user
    })
  }

  if (args.includeCountry) {
    columns.push('country')
    const countryCodes = await getUserCountries(users.institutionNames)
    userEmails = userEmails.map((user, index) => {
      user.country = countryCodes[index]
      return user
    })
  }

  console.log('Starting to write to csv file...')

  csv.stringify(
    userEmails,
    {
      header: true,
      columns,
    },
    function (err, output) {
      fs.writeFileSync('/tmp/odc_neverUsedLatex.csv', output)
      if (err) {
        console.log('error writing csv output: ', err)
        process.exit(1)
      }
      process.exit()
    }
  )
}

runScript().catch(err => {
  console.error(err)
  process.exit(1)
})
