// Creates data for groups.json

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

const output = JSON.stringify(result, null, 2)
const dir = './output'

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir)
}
fs.writeFileSync(`${dir}/groups.json`, output)

console.log('Completed!')
