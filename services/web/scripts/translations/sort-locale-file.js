import fs from 'fs'

const file = process.argv[2]
if (!file) {
  console.error('Usage: node sort-locale-file.js <path>')
  process.exit(1)
}
const obj = JSON.parse(fs.readFileSync(file, 'utf8'))
fs.writeFileSync(file, JSON.stringify(obj, Object.keys(obj).sort(), 2) + '\n')
