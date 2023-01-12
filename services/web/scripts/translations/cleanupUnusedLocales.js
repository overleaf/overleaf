const fs = require('fs')
const Path = require('path')
const { execSync } = require('child_process')

const EN_JSON = Path.join(__dirname, '../../locales/en.json')
const CHECK = process.argv.includes('--check')

async function main() {
  const locales = JSON.parse(await fs.promises.readFile(EN_JSON, 'utf-8'))

  const src = execSync(
    // - find all the app source files in web
    //   - exclude data files
    //   - exclude locales files
    //   - exclude public assets
    //   - exclude third-party dependencies
    // - read all the source files
    `
    find . -type f \
      -not -path './data/*' \
      -not -path './locales/*' \
      -not -path './public/*' \
      -not -path '*node_modules/*' \
      -not -path ./scripts/ukamf/ukfederation-metadata.xml \
    | xargs cat
    `,
    {
      // run from services/web directory
      cwd: Path.join(__dirname, '../../'),
      // 1GB
      maxBuffer: 1024 * 1024 * 1024,
      // Docs: https://nodejs.org/docs/latest-v16.x/api/child_process.html#child_process_options_stdio
      // Entries are [stdin, stdout, stderr]
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  ).toString()

  const found = new Set([
    // Month names
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',

    // Notifications created in third-party-datastore
    'dropbox_email_not_verified',
    'dropbox_unlinked_because_access_denied',
    'dropbox_unlinked_because_full',

    // Actually used without the spurious space.
    // TODO: fix the space and upload the changed locales
    'the_file_supplied_is_of_an_unsupported_type ',
  ])
  const matcher = new RegExp(
    `\\b(${Object.keys(locales)
      // Sort by length in descending order to match long, compound keys with
      //  special characters (space or -) before short ones.
      // Examples:
      // - `\b(x|x-and-y)\b` will match `t('x-and-y')` as 'x'.
      //    This is leaving 'x-and-y' as seemingly unused. Doh!
      // - `\b(x-and-y|x)\b` will match `t('x-and-y')` as 'x-and-y'. Yay!
      .sort((a, b) => (a.length < b.length ? 1 : -1))
      .join('|')})\\b`,
    'g'
  )
  let m
  while ((m = matcher.exec(src))) {
    found.add(m[0])
  }

  const unusedKeys = []
  for (const key of Object.keys(locales)) {
    if (!found.has(key)) {
      unusedKeys.push(key)
    }
  }
  if (unusedKeys.length === 0) {
    return
  }

  console.warn('---')
  console.warn(
    `Found ${unusedKeys.length} unused translations keys:\n${unusedKeys
      .map(s => ` - '${s}'`)
      .join('\n')}`
  )
  console.warn('---')

  if (CHECK) {
    console.warn('---')
    console.warn(
      'Try running:\n\n',
      '   web$ make cleanup_unused_locales',
      '\n'
    )
    console.warn('---')
    throw new Error('found unused translations keys')
  }
  console.log('Deleting unused translations keys')
  for (const key of unusedKeys) {
    delete locales[key]
  }
  const sorted = JSON.stringify(locales, Object.keys(locales).sort(), 2) + '\n'
  await fs.promises.writeFile(EN_JSON, sorted)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
