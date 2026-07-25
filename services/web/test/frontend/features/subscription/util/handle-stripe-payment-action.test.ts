import sinon from 'sinon'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import * as stripeModule from '@stripe/stripe-js/pure'
import { FetchError } from '@/infrastructure/fetch-json'
import handleStripePaymentAction from '../../../../../frontend/js/features/subscription/util/handle-stripe-payment-action'

describe('handleStripePaymentAction', function () {
  let sandbox: sinon.SinonSandbox
  let confirmPaymentStub: sinon.SinonStub

  beforeEach(function () {
    sandbox = sinon.createSandbox()

    confirmPaymentStub = sandbox.stub()
    sandbox.stub(stripeModule, 'loadStripe').resolves({
      confirmPayment: confirmPaymentStub,
    } as any)

    window.history.pushState(
      {},
      '',
      '/user/subscription/preview?planCode=professional-annual'
    )

    window.metaAttributesCache.set('ol-ExposedSettings', {
      siteUrl: 'https://www.overleaf.com',
    })
  })

  afterEach(function () {
    sandbox.restore()
    fetchMock.removeRoutes().clearHistory()
    window.history.pushState({}, '', '/')
  })

  describe('when error has no clientSecret or publicKey', function () {
    it('returns { handled: false } without calling Stripe', async function () {
      const error = new FetchError('error', 'url', undefined, undefined, {})
      const result = await handleStripePaymentAction(error)
      expect(result).to.deep.equal({ handled: false })
      sinon.assert.notCalled(
        stripeModule.loadStripe as unknown as sinon.SinonStub
      )
    })
  })

  describe('when error has clientSecret and publicKey', function () {
    let error: FetchError

    beforeEach(function () {
      error = new FetchError(
        'Payment action required',
        'url',
        undefined,
        undefined,
        {
          clientSecret: 'cs_test_123',
          publicKey: 'pk_test_abc',
        }
      )
    })

    it('passes return_url with full path including query string', async function () {
      confirmPaymentStub.resolves({})
      fetchMock.post('/user/subscription/sync', 200)

      await handleStripePaymentAction(error)

      sinon.assert.calledOnce(confirmPaymentStub)
      const { confirmParams } = confirmPaymentStub.firstCall.args[0]
      const returnUrl = new URL(confirmParams.return_url)
      expect(returnUrl.searchParams.get('path')).to.equal(
        '/user/subscription/preview?planCode=professional-annual'
      )
    })

    it('includes successPath in return_url when provided', async function () {
      confirmPaymentStub.resolves({})
      fetchMock.post('/user/subscription/sync', 200)

      await handleStripePaymentAction(error, {
        successPath: '/user/subscription/thank-you?upgrade=true',
      })

      const { confirmParams } = confirmPaymentStub.firstCall.args[0]
      const returnUrl = new URL(confirmParams.return_url)
      expect(returnUrl.searchParams.get('successPath')).to.equal(
        '/user/subscription/thank-you?upgrade=true'
      )
    })

    it('uses redirect: if_required', async function () {
      confirmPaymentStub.resolves({})
      fetchMock.post('/user/subscription/sync', 200)

      await handleStripePaymentAction(error)

      expect(confirmPaymentStub.firstCall.args[0].redirect).to.equal(
        'if_required'
      )
    })

    describe('when confirmPayment succeeds', function () {
      it('returns { handled: true }', async function () {
        confirmPaymentStub.resolves({})
        fetchMock.post('/user/subscription/sync', 200)

        const result = await handleStripePaymentAction(error)

        expect(result).to.deep.equal({ handled: true })
      })
    })

    describe('when confirmPayment returns an error', function () {
      it('returns { handled: false }', async function () {
        confirmPaymentStub.resolves({
          error: { payment_intent: { id: 'pi_test_456' } },
        })
        fetchMock.post(
          '/user/subscription/void-change?payment_intent_id=pi_test_456',
          200
        )

        const result = await handleStripePaymentAction(error)

        expect(result).to.deep.equal({ handled: false })
      })
    })
  })
})
