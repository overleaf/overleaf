const RecurlyWrapper = require('../../app/src/Features/Subscription/RecurlyWrapper')
const async = require('async')
const minimist = require('minimist')
const logger = require('@overleaf/logger')

const slowCallback =
  require.main === module
    ? (callback, error, data) => setTimeout(() => callback(error, data), 80)
    : (callback, error, data) => callback(error, data)

// NOTE: Errors are not propagated to the caller
const handleAPIError = (source, id, error, callback) => {
  logger.warn(`Errors in ${source} with id=${id}`, error)
  if (typeof error === 'string' && error.match(/429$/)) {
    return setTimeout(callback, 1000 * 60 * 5)
  }
  slowCallback(callback)
}

/**
 * @returns {Promise<{
 *   INVOICES_COLLECTED: string[],
 *   INVOICES_COLLECTED_SUCCESS: string[],
 *   USERS_COLLECTED: string[],
 * }>}
 */
const main = async () => {
  const attemptInvoiceCollection = (invoice, callback) => {
    isAccountUsingPaypal(invoice, (error, isPaypal) => {
      if (error || !isPaypal) {
        return callback(error)
      }
      const accountId = invoice.account.url.match(/accounts\/(.*)/)[1]
      if (USERS_COLLECTED.indexOf(accountId) > -1) {
        logger.warn(`Skipping duplicate user ${accountId}`)
        return callback()
      }
      INVOICES_COLLECTED.push(invoice.invoice_number)
      USERS_COLLECTED.push(accountId)
      if (DRY_RUN) {
        return callback()
      }
      RecurlyWrapper.attemptInvoiceCollection(
        invoice.invoice_number,
        (error, response) => {
          if (error) {
            return handleAPIError(
              'attemptInvoiceCollection',
              invoice.invoice_number,
              error,
              callback
            )
          }
          INVOICES_COLLECTED_SUCCESS.push(invoice.invoice_number)
          slowCallback(callback, null)
        }
      )
    })
  }

  const isAccountUsingPaypal = (invoice, callback) => {
    const accountId = invoice.account.url.match(/accounts\/(.*)/)[1]
    RecurlyWrapper.getBillingInfo(accountId, (error, response) => {
      if (error) {
        return handleAPIError('billing info', accountId, error, callback)
      }
      if (response.billing_info.paypal_billing_agreement_id) {
        return slowCallback(callback, null, true)
      }
      slowCallback(callback, null, false)
    })
  }

  const attemptInvoicesCollection = callback => {
    RecurlyWrapper.getPaginatedEndpoint(
      'invoices',
      { state: 'past_due' },
      (error, invoices) => {
        logger.info('invoices', invoices?.length)
        if (error) {
          return callback(error)
        }
        async.eachSeries(invoices, attemptInvoiceCollection, callback)
      }
    )
  }
  const argv = minimist(process.argv.slice(2))
  const DRY_RUN = argv.n !== undefined
  const INVOICES_COLLECTED = []
  const INVOICES_COLLECTED_SUCCESS = []
  const USERS_COLLECTED = []

  return new Promise((resolve, reject) => {
    attemptInvoicesCollection(error => {
      logger.info(
        `DONE (DRY_RUN=${DRY_RUN}). ${INVOICES_COLLECTED.length} invoices collection attempts for ${USERS_COLLECTED.length} users. ${INVOICES_COLLECTED_SUCCESS.length} successful collections`
      )
      console.dir(
        {
          INVOICES_COLLECTED,
          INVOICES_COLLECTED_SUCCESS,
          USERS_COLLECTED,
        },
        { maxArrayLength: null }
      )

      if (error) {
        reject(error)
      }

      if (INVOICES_COLLECTED_SUCCESS.length === 0) {
        reject(new Error('No invoices collected'))
      }

      resolve({
        INVOICES_COLLECTED,
        INVOICES_COLLECTED_SUCCESS,
        USERS_COLLECTED,
      })
    })
  })
}

if (require.main === module) {
  main()
    .then(() => {
      logger.error('Done.')
      process.exit(0)
    })
    .catch(err => {
      logger.error('Error', err)
      process.exit(1)
    })
}

module.exports = { main }
