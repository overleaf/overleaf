import RecurlyWrapper from '../../app/src/Features/Subscription/RecurlyWrapper.mjs'
import minimist from 'minimist'
import logger from '@overleaf/logger'
import { fileURLToPath } from 'node:url'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const waitMs =
  fileURLToPath(import.meta.url) === process.argv[1]
    ? timeout => new Promise(resolve => setTimeout(() => resolve(), timeout))
    : () => Promise.resolve()

// NOTE: Errors are not propagated to the caller
const handleAPIError = async (source, id, error) => {
  logger.warn(`Errors in ${source} with id=${id}`, error)
  if (typeof error === 'string' && error.match(/429$/)) {
    return waitMs(1000 * 60 * 5)
  }
  await waitMs(80)
}

/**
 * @returns {Promise<{
 *   INVOICES_COLLECTED: string[],
 *   INVOICES_COLLECTED_SUCCESS: string[],
 *   USERS_COLLECTED: string[],
 * }>}
 */
export async function collectPastDueInvoices(DRY_RUN = false) {
  const attemptInvoiceCollection = async invoice => {
    const isPaypal = await isAccountUsingPaypal(invoice)

    if (!isPaypal) {
      return
    }
    const accountId = invoice.account.url.match(/accounts\/(.*)/)[1]
    if (USERS_COLLECTED.indexOf(accountId) > -1) {
      logger.warn(`Skipping duplicate user ${accountId}`)
      return
    }
    INVOICES_COLLECTED.push(invoice.invoice_number)
    USERS_COLLECTED.push(accountId)
    if (DRY_RUN) {
      return
    }
    try {
      await RecurlyWrapper.promises.attemptInvoiceCollection(
        invoice.invoice_number
      )
      INVOICES_COLLECTED_SUCCESS.push(invoice.invoice_number)
      await waitMs(80)
    } catch (error) {
      return handleAPIError(
        'attemptInvoiceCollection',
        invoice.invoice_number,
        error
      )
    }
  }

  const isAccountUsingPaypal = async invoice => {
    const accountId = invoice.account.url.match(/accounts\/(.*)/)[1]
    try {
      const response = await RecurlyWrapper.promises.getBillingInfo(accountId)
      await waitMs(80)
      return !!response.billing_info.paypal_billing_agreement_id
    } catch (error) {
      return handleAPIError('billing info', accountId, error)
    }
  }

  const attemptInvoicesCollection = async () => {
    let getPage = await RecurlyWrapper.promises.getPaginatedEndpointIterator(
      'invoices',
      { state: 'past_due' }
    )

    while (getPage) {
      const { items, getNextPage } = await getPage()
      logger.info('invoices', items?.length)
      for (const invoice of items) {
        await attemptInvoiceCollection(invoice)
      }
      getPage = getNextPage
    }
  }

  const INVOICES_COLLECTED = []
  const INVOICES_COLLECTED_SUCCESS = []
  const USERS_COLLECTED = []

  try {
    await attemptInvoicesCollection()

    const diff = INVOICES_COLLECTED.length - INVOICES_COLLECTED_SUCCESS.length
    if (diff !== 0) {
      logger.warn(`Invoices collection failed for ${diff} invoices`)
    }

    return {
      INVOICES_COLLECTED,
      INVOICES_COLLECTED_SUCCESS,
      USERS_COLLECTED,
    }
  } finally {
    logger.info(
      {
        INVOICES_COLLECTED,
        INVOICES_COLLECTED_SUCCESS,
        USERS_COLLECTED,
      },
      `DONE (DRY_RUN=${DRY_RUN}). ${INVOICES_COLLECTED.length} invoices collection attempts for ${USERS_COLLECTED.length} users. ${INVOICES_COLLECTED_SUCCESS.length} successful collections`
    )
  }
}

async function main() {
  const argv = minimist(process.argv.slice(2))
  const DRY_RUN = argv.n !== undefined
  await collectPastDueInvoices(DRY_RUN)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await scriptRunner(main)
    logger.info('Done.')
    process.exit(0)
  } catch (error) {
    logger.error({ error }, 'Error')
    process.exit(1)
  }
}
