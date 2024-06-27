/**
 * Helper function for throttling clicks on the recompile button to avoid hitting server side rate limits.
 * The naive approach is waiting a fixed a mount of time (3s) just before clicking the button.
 * This helper takes into account that other UI interactions take time. We can deduce that latency from the fixed delay (3s minus other latency). This can bring down the effective waiting time to 0s.
 */
export function throttledRecompile() {
  let lastCompile = 0
  function queueReset() {
    cy.then(() => {
      lastCompile = Date.now()
    })
  }

  queueReset()
  return () =>
    cy.then(() => {
      cy.log('Recompile without hitting rate-limit')
      const msSinceLastCompile = Date.now() - lastCompile
      cy.wait(Math.max(0, 1_000 - msSinceLastCompile))
      cy.findByText('Recompile').click()
      queueReset()
      cy.log('Wait for recompile to finish')
      cy.findByText('Recompile')
    })
}
