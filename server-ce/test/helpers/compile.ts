/**
 * Helper function for throttling clicks on the recompile button to avoid hitting server side rate limits.
 * The naive approach is waiting a fixed a mount of time (3s) just before clicking the button.
 * This helper takes into account that other UI interactions take time. We can deduce that latency from the fixed delay (3s minus other latency). This can bring down the effective waiting time to 0s.
 */
export function throttledRecompile() {
  const { queueReset, recompile } = prepareWaitForNextCompileSlot()
  queueReset()
  return recompile
}

export function prepareWaitForNextCompileSlot() {
  let lastCompile = 0
  function queueReset() {
    cy.then(() => {
      lastCompile = Date.now()
    })
  }
  function waitForCompileRateLimitCoolOff(triggerCompile: () => void) {
    cy.then(() => {
      cy.log('Wait for recompile rate-limit to cool off')
      const msSinceLastCompile = Date.now() - lastCompile
      cy.wait(Math.max(0, 1_000 - msSinceLastCompile))
      queueReset()
      triggerCompile()
      cy.log('Wait for compile to finish')
      cy.findByText('Recompile').should('be.visible')
    })
  }
  function recompile() {
    waitForCompileRateLimitCoolOff(() => {
      cy.findByText('Recompile').click()
    })
  }
  return {
    queueReset,
    waitForCompileRateLimitCoolOff,
    recompile,
  }
}
