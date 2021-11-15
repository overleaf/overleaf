import { format } from 'util'

/**
 * Make tests fail when prop-types are incorrect.
 *
 * React's prop-types library logs an console.error when the types are
 * incorrect. Since this error is only in the console, tests that fail the type-
 * check will still pass.
 *
 * To ensure that type-checking is tested, monkey-patch the global console.error
 * to fail the tests when prop-types errors.
 */
const originalConsoleError = global.console.error
before(function () {
  global.console.error = (message, ...args) => {
    // Ensure we still log the error
    originalConsoleError(message, ...args)

    const formattedMessage = format(message, ...args)

    // Check if the error is from prop-types
    if (/Failed (prop|data) type/.test(formattedMessage)) {
      // Throw an error, causing the test to fail
      throw new Error(formattedMessage)
    }
  }
})

// Restore the original method
after(function () {
  global.console.error = originalConsoleError
})
