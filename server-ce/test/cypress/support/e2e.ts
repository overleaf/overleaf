import '@testing-library/cypress/add-commands'

Cypress.on('uncaught:exception', (err, runnable) => {
  if (err.message.includes('ResizeObserver')) {
    // spurious error from PDF preview
    return false
  }
  if (err.message.includes('rcube_webmail')) {
    // spurious error from mailtrap
    return false
  }
})
