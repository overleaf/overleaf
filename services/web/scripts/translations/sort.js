const fs = require('fs')
const Path = require('path')

const LOCALES = Path.join(__dirname, '../../locales')
const CHECK = process.argv.includes('--check')

async function main() {
  for (const locale of await fs.promises.readdir(LOCALES)) {
    if (locale === 'README.md') continue
    const path = Path.join(LOCALES, locale)
    const input = await fs.promises.readFile(path, 'utf-8')
    const parsed = JSON.parse(input)
    const sorted = JSON.stringify(parsed, Object.keys(parsed).sort(), 2) + '\n'
    if (input === sorted) {
      continue
    }
    if (CHECK) {
      console.warn('---')
      console.warn(
        locale,
        'is not sorted. Try running:\n\n',
        '  web$ make sort_locales',
        '\n'
      )
      console.warn('---')
      throw new Error(locale + ' is not sorted')
    }
    console.log('Storing sorted version of', locale)
    await fs.promises.writeFile(path, sorted)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
