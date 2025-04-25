describe('AbortSignal polyfills', function () {
  before(function () {
    // @ts-expect-error deleting a required method
    delete AbortSignal.any
    // @ts-expect-error deleting a required method
    delete AbortSignal.timeout
    // this polyfill provides the required methods
    cy.wrap(import('@/utils/abortsignal-polyfill'))
  })

  describe('AbortSignal.any', function () {
    it('aborts the new signal immediately if one of the signals is aborted already', function () {
      const controller1 = new AbortController()
      const controller2 = new AbortController()

      controller1.abort()
      const signal = AbortSignal.any([controller1.signal, controller2.signal])

      cy.wrap(signal.aborted).should('be.true')
    })

    it('aborts the new signal asynchronously if one of the signals is aborted later', function () {
      const controller1 = new AbortController()
      const controller2 = new AbortController()

      const signal = AbortSignal.any([controller1.signal, controller2.signal])
      controller1.abort()

      cy.wrap(signal.aborted).should('be.true')
    })
  })

  describe('AbortSignal.timeout', function () {
    it('aborts the signal after the timeout', function () {
      cy.clock().then(clock => {
        const signal = AbortSignal.timeout(1000)
        cy.wrap(signal.aborted).should('be.false')
        clock.tick(1000)
        cy.wrap(signal.aborted).should('be.true')
      })
    })
  })
})
