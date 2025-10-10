import 'express'
import RequestLogger from '@overleaf/metrics'

// Add properties to Express's Request object that are defined in JS middleware
// or controllers and expected to be present in controllers.
declare global {
  // eslint-disable-next-line no-unused-vars
  namespace Express {
    // eslint-disable-next-line no-unused-vars
    interface Request {
      logger: RequestLogger
    }
  }
}
