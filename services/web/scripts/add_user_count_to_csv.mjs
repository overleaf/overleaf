// Usage: node scripts/add_user_count_to_csv.mjs [OPTS] [INPUT-FILE]
// Looks up the number of users for each domain in the input csv file and adds
// columns for the number of users in the domain, subdomains, and total.
import fs from 'node:fs'
// https://github.com/import-js/eslint-plugin-import/issues/1810
// eslint-disable-next-line import/no-unresolved
import * as csv from 'csv/sync'
import minimist from 'minimist'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'
import { db } from '../app/src/infrastructure/mongodb.mjs'
import _ from 'lodash'
import { scriptRunner } from './lib/ScriptRunner.mjs'

const argv = minimist(process.argv.slice(2), {
  string: ['domain', 'output'],
  boolean: ['help'],
  alias: {
    domain: 'd',
    output: 'o',
  },
  default: {
    domain: 'Email domain',
    output: '/dev/stdout',
  },
})

if (argv.help || argv._.length > 1) {
  console.error(`Usage: node scripts/add_user_count_to_csv.mjs [OPTS] [INPUT-FILE]
    Looks up the number of users for each domain in the input file and adds
    columns for the number of users in the domain, subdomains, and total.

    Options:

        --domain    name of the csv column containing the email domain (default: "Email domain")
        --output    output file (default: /dev/stdout)
    `)
  process.exit(1)
}

const input = fs.readFileSync(argv._[0], 'utf8')
const records = csv.parse(input, { columns: true })

if (records.length === 0) {
  console.error('No records in input file')
  process.exit(1)
}

async function main() {
  for (const record of records) {
    const domain = record[argv.domain]
    const { domainUserCount, subdomainUserCount } = await getUserCount(domain, {
      _id: 1,
    })
    record['Domain Users'] = domainUserCount
    record['Subdomain Users'] = subdomainUserCount
    record['Total Users'] = domainUserCount + subdomainUserCount
  }
  const output = csv.stringify(records, { header: true })
  fs.writeFileSync(argv.output, output)
}

async function getUserCount(domain) {
  const domainUsers = await UserGetter.promises.getUsersByHostname(domain, {
    _id: 1,
  })
  const subdomainUsers = await getUsersByHostnameWithSubdomain(domain, {
    _id: 1,
  })
  return {
    domainUserCount: domainUsers.length,
    subdomainUserCount: subdomainUsers.length,
  }
}

async function getUsersByHostnameWithSubdomain(domain, projection) {
  const reversedDomain = domain.trim().split('').reverse().join('')
  const reversedDomainRegex = _.escapeRegExp(reversedDomain)
  const query = {
    emails: { $exists: true },
    // look for users in subdomains of a domain, but not the domain itself
    // e.g. for domain 'foo.edu', match 'cs.foo.edu' but not 'foo.edu'
    // we use the reversed hostname index to do this efficiently
    // we need to escape the domain name to prevent '.' from matching any character
    'emails.reversedHostname': { $regex: '^' + reversedDomainRegex + '\\.' },
  }
  return await db.users.find(query, { projection }).toArray()
}

try {
  await scriptRunner(main)
  console.log('Done')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
