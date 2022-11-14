// Creates data for localizedPlanPricing object in settings.overrides.saas.js
// and plans object in main/plans.js

const xlsx = require('xlsx')
const fs = require('fs')
const path = require('path')
const [fileName, sheetName] = process.argv.slice(2)

// Pick the xlsx file
const filePath = path.resolve(__dirname, fileName)
const file = xlsx.readFile(filePath)

if (!file.SheetNames.includes(sheetName)) {
  throw new Error('Sheet not found!')
}

const workSheet = Object.values(file.Sheets)[file.SheetNames.indexOf(sheetName)]
// Convert to JSON
const workSheetJSON = xlsx.utils.sheet_to_json(workSheet)

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
}

const buildCurrencyValue = (amount, currency) => {
  return currency.placement === 'before'
    ? `${currency.symbol}${amount}`
    : `${amount}${currency.symbol}`
}

// localizedPlanPricing object for settings.overrides.saas.js
let localizedPlanPricing = {}
// plans object for main/plans.js
let plans = {}

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
    const monthlyPlan = workSheetJSON.find(data => data.plan_code === actualKey)

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

// removes quotes from object keys
const format = obj => JSON.stringify(obj, null, 2).replace(/"([^"]+)":/g, '$1:')
const dir = './output'

localizedPlanPricing = format(localizedPlanPricing)
plans = format(plans)

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir)
}
fs.writeFileSync(`${dir}/localizedPlanPricing.json`, localizedPlanPricing)
fs.writeFileSync(`${dir}/plans.json`, plans)

console.log('Completed!')
