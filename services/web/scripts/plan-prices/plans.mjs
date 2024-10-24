// Creates data for localizedPlanPricing object in settings.overrides.saas.js
// and plans object in main/plans.js

// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import fs from 'fs'
import path from 'path'
import minimist from 'minimist'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readCSVFile(fileName) {
  // Pick the csv file
  const filePath = path.resolve(__dirname, fileName)
  const input = fs.readFileSync(filePath, 'utf8')
  const rawRecords = csv.parse(input, { columns: true })
  return rawRecords
}

function readJSONFile(fileName) {
  const filePath = path.resolve(__dirname, fileName)
  const file = fs.readFileSync(filePath)
  const plans = JSON.parse(file)
  // convert the plans JSON from recurly to an array of
  // objects matching the spreadsheet format
  const result = []
  for (const plan of plans) {
    const newRow = { plan_code: plan.code }
    for (const price of plan.currencies) {
      newRow[price.currency] = price.unitAmount
    }
    result.push(newRow)
  }
  return result
}

// Mapping of [output_keys]:[actual_keys]
const plansMap = {
  student: 'student',
  personal: 'paid-personal',
  collaborator: 'collaborator',
  professional: 'professional',
}

const currencies = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'CLP',
  'COP',
  'DKK',
  'EUR',
  'GBP',
  'INR',
  'MXN',
  'NOK',
  'NZD',
  'PEN',
  'SEK',
  'SGD',
  'USD',
]

function generatePlans(workSheetJSON) {
  // localizedPlanPricing object for settings.overrides.saas.js
  const localizedPlanPricing = {}
  // plans object for main/plans.js

  for (const currency of currencies) {
    localizedPlanPricing[currency] = {
      free: {
        monthly: 0,
        annual: 0,
      },
    }

    for (const [outputKey, actualKey] of Object.entries(plansMap)) {
      const monthlyPlan = workSheetJSON.find(
        data => data.plan_code === actualKey
      )

      if (!monthlyPlan) throw new Error(`Missing plan: ${actualKey}`)
      if (!(currency in monthlyPlan))
        throw new Error(
          `Missing currency "${currency}" for plan "${actualKey}"`
        )

      const actualKeyAnnual = `${actualKey}-annual`
      const annualPlan = workSheetJSON.find(
        data => data.plan_code === actualKeyAnnual
      )

      if (!annualPlan) throw new Error(`Missing plan: ${actualKeyAnnual}`)
      if (!(currency in annualPlan))
        throw new Error(
          `Missing currency "${currency}" for plan "${actualKeyAnnual}"`
        )

      const monthly = Number(monthlyPlan[currency])
      const monthlyTimesTwelve = Number(monthlyPlan[currency] * 12)
      const annual = Number(annualPlan[currency])

      localizedPlanPricing[currency] = {
        ...localizedPlanPricing[currency],
        [outputKey]: { monthly, monthlyTimesTwelve, annual },
      }
    }
  }
  return { localizedPlanPricing }
}

function generateGroupPlans(workSheetJSON) {
  const groupPlans = workSheetJSON.filter(data =>
    data.plan_code.startsWith('group')
  )

  const sizes = ['2', '3', '4', '5', '10', '20', '50']

  const result = {}
  for (const type1 of ['educational', 'enterprise']) {
    result[type1] = {}
    for (const type2 of ['professional', 'collaborator']) {
      result[type1][type2] = {}
      for (const currency of currencies) {
        result[type1][type2][currency] = {}
        for (const size of sizes) {
          const planCode = `group_${type2}_${size}_${type1}`
          const plan = groupPlans.find(data => data.plan_code === planCode)

          if (!plan) throw new Error(`Missing plan: ${planCode}`)

          result[type1][type2][currency][size] = {
            price_in_cents: plan[currency] * 100,
          }
        }
      }
    }
  }
  return result
}

const argv = minimist(process.argv.slice(2), {
  string: ['output', 'file'],
  alias: { o: 'output', f: 'file' },
})

let input
if (argv.file) {
  const ext = path.extname(argv.file)
  switch (ext) {
    case '.csv':
      input = readCSVFile(argv.file)
      break
    case '.json':
      input = readJSONFile(argv.file)
      break
    default:
      console.log('Invalid file type: must be csv or json')
  }
} else {
  console.log('usage: node plans.mjs -f <file.csv|file.json> -o <dir>')
  process.exit(1)
}
// removes quotes from object keys
const formatJS = obj =>
  JSON.stringify(obj, null, 2).replace(/"([^"]+)":/g, '$1:')
const formatJSON = obj => JSON.stringify(obj, null, 2)

function writeFile(outputFile, data) {
  console.log(`Writing ${outputFile}`)
  fs.writeFileSync(outputFile, data)
}

const { localizedPlanPricing } = generatePlans(input)
const groupPlans = generateGroupPlans(input)

if (argv.output) {
  const dir = argv.output
  // check if output directory exists
  if (!fs.existsSync(dir)) {
    console.log(`Creating output directory ${dir}`)
    fs.mkdirSync(dir)
  }
  // check if output directory is a directory and report error if not
  if (!fs.lstatSync(dir).isDirectory()) {
    console.error(`Error: output dir ${dir} is not a directory`)
    process.exit(1)
  }
  writeFile(`${dir}/localizedPlanPricing.json`, formatJS(localizedPlanPricing))
  writeFile(`${dir}/groups.json`, formatJSON(groupPlans))
} else {
  console.log('LOCALIZED', localizedPlanPricing)
  console.log('GROUP PLANS', JSON.stringify(groupPlans, null, 2))
}

console.log('Completed!')
