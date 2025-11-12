import { scriptRunner } from './lib/ScriptRunner.mjs'
import * as csv from 'csv'
import fs from 'node:fs'
import { OnboardingDataCollection } from '../app/src/models/OnboardingDataCollection.mjs'

/**
 * This script extracts the OnboardingDataCollection collection from the database
 * and writes it to a CSV file.
 *
 * Usage:
 *   - Locally:
 *     - docker compose exec web bash
 *     - node services/web/scripts/extract_onboardingdatacollection_csv.js
 *   - On the server:
 *     - rake connect:app[staging,web]
 *     - node web/scripts/extract_onboardingdatacollection_csv.js
 *     - exit
 *     - kubectl cp web-standalone-prod-XXXXX:/tmp/onboardingDataCollection.csv ~/onboardingDataCollection.csv
 *
 */

const mapFields = doc => {
  return {
    primaryOccupation: doc.primaryOccupation,
    usedLatex: doc.usedLatex,
    companyDivisionDepartment: doc.companyDivisionDepartment,
    companyJobTitle: doc.companyJobTitle,
    governmentJobTitle: doc.governmentJobTitle,
    institutionName: doc.institutionName,
    otherJobTitle: doc.otherJobTitle,
    nonprofitDivisionDepartment: doc.nonprofitDivisionDepartment,
    nonprofitJobTitle: doc.nonprofitJobTitle,
    role: doc.role,
    subjectArea: doc.subjectArea,
    updatedAt: new Date(doc.updatedAt).toISOString(),
    userId: doc._id.toString(), // _id is set as the userId
    firstName: Boolean(doc.firstName).toString(),
    lastName: Boolean(doc.lastName).toString(),
  }
}

const runScript = async () => {
  console.time('CSV Writing Duration')

  console.log('Starting to write to csv file...')

  const cursor = OnboardingDataCollection.find().cursor()

  const csvWriter = csv.stringify({
    header: true,
    columns: [
      'primaryOccupation',
      'usedLatex',
      'companyDivisionDepartment',
      'companyJobTitle',
      'governmentJobTitle',
      'institutionName',
      'otherJobTitle',
      'nonprofitDivisionDepartment',
      'nonprofitJobTitle',
      'role',
      'subjectArea',
      'updatedAt',
      'userId',
      'firstName',
      'lastName',
    ],
  })

  const writeStream = fs.createWriteStream('/tmp/onboardingDataCollection.csv')

  csvWriter.pipe(writeStream)

  let lineCount = 0
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    lineCount++
    csvWriter.write(mapFields(doc))
  }

  csvWriter.end()

  writeStream.on('finish', () => {
    console.log(`Done writing to csv file. Total lines written: ${lineCount}`)
    console.timeEnd('CSV Writing Duration')
    process.exit()
  })

  writeStream.on('error', err => console.error('Write Stream Error:', err))
  csvWriter.on('error', err => console.error('CSV Writer Error:', err))
}

scriptRunner(runScript).catch(err => {
  console.error(err)
  process.exit(1)
})
