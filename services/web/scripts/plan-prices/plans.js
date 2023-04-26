// Creates data for localizedPlanPricing object in settings.overrides.saas.js
// and plans object in main/plans.js

const xlsx = require('xlsx')
const csv = require('csv/sync')
const fs = require('fs')
const path = require('path')
const minimist = require('minimist')

function readXLSXFile(fileName, sheetName) {
  // Pick the xlsx file
  const filePath = path.resolve(__dirname, fileName)
  const file = xlsx.readFile(filePath)

  if (!file.SheetNames.includes(sheetName)) {
    console.error(
      `Error: sheet '${sheetName}' not found.\n` +
        `Valid sheet names are: ${file.SheetNames.join(',')}`
    )
    process.exit(1)
  }

  const workSheet = Object.values(file.Sheets)[
    file.SheetNames.indexOf(sheetName)
  ]
  // Convert to JSON
  const workSheetJSON = xlsx.utils.sheet_to_json(workSheet)
  return workSheetJSON
}

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

const currencies = {
  USD: {
    symbol: '$',
    placement: 'before',
  },
  EUR: {
    symbol: '€',
    placement: 'before',
  },
  GBP: {
    symbol: '£',
    placement: 'before',
  },
  SEK: {
    symbol: ' kr',
    placement: 'after',
  },
  CAD: {
    symbol: '$',
    placement: 'before',
  },
  NOK: {
    symbol: ' kr',
    placement: 'after',
  },
  DKK: {
    symbol: ' kr',
    placement: 'after',
  },
  AUD: {
    symbol: '$',
    placement: 'before',
  },
  NZD: {
    symbol: '$',
    placement: 'before',
  },
  CHF: {
    symbol: 'Fr ',
    placement: 'before',
  },
  SGD: {
    symbol: '$',
    placement: 'before',
  },
  INR: {
    symbol: '₹',
    placement: 'before',
  },
}

const buildCurrencyValue = (amount, currency) => {
  return currency.placement === 'before'
    ? `${currency.symbol}${amount}`
    : `${amount}${currency.symbol}`
}

function generatePlans(workSheetJSON) {
  // localizedPlanPricing object for settings.overrides.saas.js
  const localizedPlanPricing = {}
  // plans object for main/plans.js
  const plans = {}

  for (const [currency, currencyDetails] of Object.entries(currencies)) {
    localizedPlanPricing[currency] = {
      symbol: currencyDetails.symbol.trim(),
      free: {
        monthly: buildCurrencyValue(0, currencyDetails),
        annual: buildCurrencyValue(0, currencyDetails),
      },
    }
    plans[currency] = {
      symbol: currencyDetails.symbol.trim(),
    }

    for (const [outputKey, actualKey] of Object.entries(plansMap)) {
      const monthlyPlan = workSheetJSON.find(
        data => data.plan_code === actualKey
      )

      if (!monthlyPlan) throw new Error(`Missing plan: ${actualKey}`)

      const actualKeyAnnual = `${actualKey}-annual`
      const annualPlan = workSheetJSON.find(
        data => data.plan_code === actualKeyAnnual
      )

      if (!annualPlan) throw new Error(`Missing plan: ${actualKeyAnnual}`)

      const monthly = buildCurrencyValue(monthlyPlan[currency], currencyDetails)
      const monthlyTimesTwelve = buildCurrencyValue(
        monthlyPlan[currency] * 12,
        currencyDetails
      )
      const annual = buildCurrencyValue(annualPlan[currency], currencyDetails)

      localizedPlanPricing[currency] = {
        ...localizedPlanPricing[currency],
        [outputKey]: { monthly, monthlyTimesTwelve, annual },
      }
      plans[currency] = {
        ...plans[currency],
        [outputKey]: { monthly, annual },
      }
    }
  }
  return { localizedPlanPricing, plans }
}

function generateGroupPlans(workSheetJSON) {
  const groupPlans = workSheetJSON.filter(data =>
    data.plan_code.startsWith('group')
  )

  const currencies = [
    'AUD',
    'CAD',
    'CHF',
    'DKK',
    'EUR',
    'GBP',
    'INR',
    'NOK',
    'NZD',
    'SEK',
    'SGD',
    'USD',
  ]
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
  string: ['output', 'file', 'sheet'],
  alias: { o: 'output', f: 'file', s: 'sheet' },
})

let input
if (argv.file) {
  const ext = path.extname(argv.file)
  switch (ext) {
    case '.csv':
      input = readCSVFile(argv.file)
      break
    case '.xls':
    case '.xlsx':
      input = readXLSXFile(argv.file, argv.sheet)
      break
    case '.json':
      input = readJSONFile(argv.file)
      break
    default:
      console.log('Invalid file type: must be csv, xls, xlsx, or json')
  }
} else {
  console.log(
    'usage: node plans.js -f <file.xls|file.csv|file.json> [-s <sheet>] -o <dir>'
  )
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
const { localizedPlanPricing, plans } = generatePlans(input)
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
  writeFile(`${dir}/plans.json`, formatJS(plans))
  writeFile(`${dir}/groups.json`, formatJSON(groupPlans))
} else {
  console.log('PLANS', plans)
  console.log('LOCALIZED', localizedPlanPricing)
  console.log('GROUP PLANS', JSON.stringify(groupPlans, null, 2))
}

console.log('Completed!')
