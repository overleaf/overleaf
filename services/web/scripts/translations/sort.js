import fs from 'fs'
import Path from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const LOCALES = Path.join(__dirname, '../../locales')
const CHECK = process.argv.includes('--check')

async function main() {
  await sortFile(
    Path.join(__dirname, '../../frontend/extracted-translations.json')
  )
  for (const locale of await fs.promises.readdir(LOCALES)) {
    if (locale === 'README.md') continue
    const path = Path.join(LOCALES, locale)
    await sortFile(path)
  }
}

async function sortFile(path) {
  const name = Path.basename(path)
  const input = await fs.promises.readFile(path, 'utf-8')
  const parsed = JSON.parse(input)
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort(), 2) + '\n'
  if (input === sorted) {
    return
  }
  if (CHECK) {
    console.warn('---')
    console.warn(
      name,
      'is not sorted. Try running:\n\n',
      '  web$ make sort_locales',
      '\n'
    )
    console.warn('---')
    throw new Error(name + ' is not sorted')
  }
  console.log('Storing sorted version of', name)
  await fs.promises.writeFile(path, sorted)
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
