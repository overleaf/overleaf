export function waitUntilScrollingFinished(selector: string, start = -1) {
  const pollSlow = 100
  const pollFast = 10
  const deadline =
    performance.now() + Cypress.config('defaultCommandTimeout') - pollSlow * 2
  return cy.get(selector).then(el => {
    cy.log(
      `waiting until scrolling finished for ${selector}, starting from ${start}`
    )
    return new Cypress.Promise<number>((resolve, reject) => {
      const waitForStable = (prev: number, stableFor: number) => {
        if (performance.now() > deadline) {
          return reject(new Error('timeout waiting for scrolling to finish'))
        }
        const current = el.scrollTop()!
        if (current !== prev) {
          setTimeout(() => waitForStable(current, 0), pollFast)
        } else if (stableFor < 5) {
          setTimeout(() => waitForStable(current, stableFor + 1), pollFast)
        } else {
          resolve(current)
        }
      }

      const waitForChange = () => {
        if (performance.now() > deadline) {
          return reject(new Error('timeout waiting for scrolling to start'))
        }
        const current = el.scrollTop()!
        if (current === start) {
          setTimeout(() => waitForChange(), pollSlow)
        } else {
          setTimeout(() => waitForStable(current, 0), pollFast)
        }
      }
      waitForChange()
    })
  })
}
