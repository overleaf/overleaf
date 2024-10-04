const csv = require('csv')
const fs = require('fs')
const {
  OnboardingDataCollection,
} = require('../app/src/models/OnboardingDataCollection')
const { User } = require('../app/src/models/User')

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

const getEmails = async userIds => {
  const userEmails = await User.find(
    { _id: { $in: userIds }, signUpDate: { $gte: new Date(2024, 1, 18) } },
    { email: 1, signUpDate: 1 }
  ).exec()
  return userEmails.map(({ email, signUpDate }) => ({
    email,
    signUpDate: new Date(signUpDate).toISOString(),
  }))
}

const getUsers = async () => {
  const cursor = OnboardingDataCollection.find({ usedLatex: 'never' }).cursor()

  const userIds = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    userIds.push(doc._id.toString())
  }

  return userIds
}

const runScript = async () => {
  const users = await getUsers()
  const userEmails = await getEmails(users)

  console.log('Starting to write to csv file...')

  csv.stringify(
    userEmails,
    {
      header: true,
      columns: ['email', 'signUpDate'],
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
