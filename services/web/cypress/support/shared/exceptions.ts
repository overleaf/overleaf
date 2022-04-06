Cypress.on('uncaught:exception', err => {
  // don't fail the test for ResizeObserver error messages
  if (err.message.includes('ResizeObserver')) {
    return false
  }
})
