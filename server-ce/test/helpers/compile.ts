/**
 * Helper function for throttling clicks on the recompile button to avoid hitting server side rate limits.
 * The naive approach is waiting a fixed a mount of time (3s) just before clicking the button.
 * This helper takes into account that other UI interactions take time. We can deduce that latency from the fixed delay (3s minus other latency). This can bring down the effective waiting time to 0s.
 */

export function stopCompile(options: { delay?: number } = {}) {
  const { delay = 0 } = options
  cy.wait(delay)
  cy.log('Stop compile')
  cy.findByRole('button', { name: 'Toggle compile options menu' }).click()
  cy.findByRole('menuitem', { name: 'Stop compilation' }).click()
}

export function prepareWaitForNextCompileSlot() {
  let lastCompile = 0
  function queueReset() {
    cy.then(() => {
      lastCompile = Date.now()
    })
  }
  function waitForCompileRateLimitCoolOff() {
    cy.then(() => {
      cy.log('Wait for recompile rate-limit to cool off')
      const msSinceLastCompile = Date.now() - lastCompile
      cy.wait(Math.max(0, 1_000 - msSinceLastCompile))
      queueReset()
    })
  }
  function waitForCompile(triggerCompile: () => void) {
    waitForCompileRateLimitCoolOff()
    cy.then(() => {
      let compilingVisible: () => void
      const waitForCompilingVisible = new Promise<void>(resolve => {
        compilingVisible = resolve
      })
      cy.intercept(
        {
          method: 'POST',
          pathname: /\/project\/[a-fA-F0-9]{24}\/compile$/,
          times: 1,
        },
        async req => {
          await waitForCompilingVisible
          req.continue()
        }
      ).as('recompile')
      triggerCompile()
      cy.log('Wait for compile to finish')
      cy.findByRole('button', { name: 'Compiling…' }).then(() =>
        compilingVisible()
      )
      cy.wait('@recompile')
      cy.findByRole('button', { name: 'Compiling…' }).should('not.exist')
      cy.findByRole('button', { name: 'Recompile' }).should('be.visible')
    })
  }
  function recompile() {
    waitForCompile(() => {
      cy.findByRole('button', { name: 'Recompile' }).click()
    })
  }
  return {
    queueReset,
    waitForCompileRateLimitCoolOff,
    waitForCompile,
    recompile,
  }
}
