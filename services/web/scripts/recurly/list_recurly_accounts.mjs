/**
 * List Recurly accounts and output as CSV for use with migrate_recurly_customers_to_stripe.mjs
 *
 * Useful for generating list of customers for testing purposes.
 *
 * This script can be deleted once the Recurly to Stripe migration is complete.
 *
 * Usage:
 *   node scripts/recurly/list_recurly_accounts.mjs --limit 100 --output test_customers.csv
 *
 * Options:
 *   --limit N        Number of accounts to fetch (default: 100)
 *   --output FILE    Output CSV file (required)
 *   --stripe-account Account ID to use for target_stripe_account column
 *   --verbose        Enable debug logging
 */

import Settings from '@overleaf/settings'
import recurly from 'recurly'
import minimist from 'minimist'
import fs from 'node:fs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

import { normalizeRecurlyAddressToStripe } from '../helpers/migrate_recurly_customers_to_stripe.helpers.mjs'

const recurlyApiKey =
  process.env.RECURLY_API_KEY || Settings.apis?.recurly?.apiKey
if (!recurlyApiKey) {
  throw new Error(
    'Recurly API key is not set. Set RECURLY_API_KEY env var or configure Settings.apis.recurly.apiKey'
  )
}

const client = new recurly.Client(recurlyApiKey)

function usage() {
  console.error(
    'List Recurly accounts and output as CSV for use with migrate_recurly_customers_to_stripe.mjs'
  )
  console.error('')
  console.error('Usage:')
  console.error(
    '  node scripts/recurly/list_recurly_accounts.mjs --output <file> [options]'
  )
  console.error('')
  console.error('Options:')
  console.error(
    '  --limit, -l N           Number of accounts to fetch (default: 100)'
  )
  console.error('  --output, -o FILE       Output CSV file (required)')
  console.error(
    '  --stripe-account, -s ID Target Stripe account ID for all rows'
  )
  console.error('  --verbose, -v          Enable debug logging')
  console.error('  --help, -h              Show this help message')
}

function parseArgs() {
  return minimist(process.argv.slice(2), {
    alias: {
      o: 'output',
      l: 'limit',
      s: 'stripe-account',
      v: 'verbose',
      h: 'help',
    },
    default: { limit: 100 },
    string: ['output', 'stripe-account'],
    boolean: ['verbose'],
  })
}

async function main(trackProgress) {
  const args = parseArgs()

  const DEBUG = !!args.verbose
  function debug(message, context = {}) {
    if (!DEBUG) return
    const contextStr =
      Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''
    console.log(`[DEBUG] ${message}${contextStr}`)
  }

  if (args.help || args.h) {
    usage()
    process.exit(0)
  }

  if (!args.output) {
    usage()
    console.error('')
    console.error('Error: --output is required')
    process.exit(1)
  }

  const limit = parseInt(args.limit, 10)
  const targetStripeAccount =
    args['stripe-account'] || 'REPLACE_WITH_STRIPE_ACCOUNT_ID'

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`Invalid --limit: ${args.limit}`)
  }
  if (limit < 2) {
    throw new Error(
      'Invalid --limit: must be >= 2 to satisfy VAT constraints (>=1 VAT account but <=50% VAT overall)'
    )
  }

  await trackProgress(`Fetching up to ${limit} accounts from Recurly...`)
  await trackProgress(`Target Stripe account: ${targetStripeAccount}`)
  if (DEBUG) {
    await trackProgress('Debug logging enabled')
  }

  const vatCandidates = []
  const nonVatCandidates = []

  let scanned = 0
  let acceptedWithAddress = 0
  let rejectedNoAddress = 0
  let rejectedVatOverCap = 0
  let billingInfoFetched = 0
  let billingInfoNotFound = 0
  let billingInfoOtherError = 0
  let usedBillingAddress = 0
  let usedBillingVatNumber = 0

  const vatCap = Math.floor(limit / 2)

  // List accounts with pagination - Recurly returns a Pager, need to call .each()
  // Options must be wrapped in { params: { ... } }
  const accountsPager = client.listAccounts({
    params: { limit: Math.min(limit, 200) },
  })
  for await (const account of accountsPager.each()) {
    scanned++

    const recurlyAccountCode = account.code
    const row = {
      recurly_account_code: recurlyAccountCode,
      target_stripe_account: targetStripeAccount,
      stripe_customer_id: '', // Empty - no existing Stripe customer
      email: account.email,
      state: account.state,
    }

    let address = account.address
    let vatNumber =
      typeof account.vatNumber === 'string' ? account.vatNumber : null

    // Fetch billing info only if needed for address/vat detection
    if (!normalizeRecurlyAddressToStripe(address) || !vatNumber) {
      try {
        billingInfoFetched++
        const billingInfo = await client.getBillingInfo(
          `code-${recurlyAccountCode}`
        )
        if (!address && billingInfo?.address) {
          address = billingInfo.address
          usedBillingAddress++
        }
        if (!vatNumber && billingInfo?.vatNumber) {
          vatNumber = billingInfo.vatNumber
          usedBillingVatNumber++
        }
      } catch (error) {
        if (!(error instanceof recurly.errors.NotFoundError)) {
          billingInfoOtherError++
          throw error
        }
        billingInfoNotFound++
      }
    }

    if (!normalizeRecurlyAddressToStripe(address)) {
      rejectedNoAddress++
      debug('Rejected account: no valid address', {
        scanned,
        recurlyAccountCode,
        rejectedNoAddress,
      })
      continue
    }

    acceptedWithAddress++

    const hasVat = !!(typeof vatNumber === 'string' && vatNumber.trim())
    if (hasVat) {
      // Enforce VAT upper bound while scanning.
      if (vatCandidates.length >= vatCap) {
        rejectedVatOverCap++
        debug('Rejected account: VAT over cap', {
          scanned,
          recurlyAccountCode,
          vatCandidates: vatCandidates.length,
          vatCap,
          rejectedVatOverCap,
        })
        continue
      }
      vatCandidates.push(row)
    } else {
      nonVatCandidates.push(row)
    }

    // Stop once we can satisfy constraints.
    const vatToTake = Math.min(vatCap, vatCandidates.length)
    const needsAtLeastOneVat = vatCandidates.length >= 1
    const nonVatNeeded = limit - Math.max(1, vatToTake)
    if (needsAtLeastOneVat && nonVatCandidates.length >= nonVatNeeded) {
      debug('Stopping early: constraints satisfied', {
        scanned,
        vatCandidates: vatCandidates.length,
        nonVatCandidates: nonVatCandidates.length,
        vatCap,
        nonVatNeeded,
      })
      break
    }

    if (scanned % 25 === 0) {
      await trackProgress(
        `Scanned ${scanned} accounts (acceptedWithAddress=${acceptedWithAddress}, vat=${vatCandidates.length}, nonVat=${nonVatCandidates.length})`
      )
      debug('Progress', {
        scanned,
        acceptedWithAddress,
        rejectedNoAddress,
        rejectedVatOverCap,
        vatCandidates: vatCandidates.length,
        nonVatCandidates: nonVatCandidates.length,
        billingInfoFetched,
        billingInfoNotFound,
        billingInfoOtherError,
        usedBillingAddress,
        usedBillingVatNumber,
      })
    }
  }

  if (vatCandidates.length < 1) {
    throw new Error(
      `Unable to find any accounts with VAT numbers (scanned=${scanned}, acceptedWithAddress=${acceptedWithAddress}, rejectedNoAddress=${rejectedNoAddress})`
    )
  }

  const vatToTake = Math.max(1, Math.min(vatCap, vatCandidates.length))
  const nonVatToTake = limit - vatToTake
  if (nonVatCandidates.length < nonVatToTake) {
    throw new Error(
      `Unable to satisfy VAT ratio constraint: need ${nonVatToTake} non-VAT + ${vatToTake} VAT, but have nonVat=${nonVatCandidates.length}, vat=${vatCandidates.length} (scanned=${scanned}, rejectedNoAddress=${rejectedNoAddress}, rejectedVatOverCap=${rejectedVatOverCap})`
    )
  }

  const accounts = [
    ...vatCandidates.slice(0, vatToTake),
    ...nonVatCandidates.slice(0, nonVatToTake),
  ]

  await trackProgress(
    `Selected ${accounts.length} accounts (vat=${vatToTake}, nonVat=${nonVatToTake}, scanned=${scanned}, rejectedNoAddress=${rejectedNoAddress})`
  )

  // Output CSV
  const csvHeader =
    'recurly_account_code,target_stripe_account,stripe_customer_id'
  const csvRows = accounts.map(
    a =>
      `${a.recurly_account_code},${a.target_stripe_account},${a.stripe_customer_id}`
  )
  const csvContent = [csvHeader, ...csvRows].join('\n') + '\n'

  fs.writeFileSync(args.output, csvContent)
  await trackProgress(`Wrote ${accounts.length} accounts to ${args.output}`)

  // Output a summary
  const states = {}
  accounts.forEach(a => {
    states[a.state] = (states[a.state] || 0) + 1
  })
  await trackProgress('Account states:')
  for (const [state, stateCount] of Object.entries(states)) {
    await trackProgress(`  ${state}: ${stateCount}`)
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
