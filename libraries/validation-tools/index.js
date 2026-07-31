const { InvalidParamsError, InvalidRequestError } = require('./Errors')
const { z } = require('zod')
const { zz } = require('./zodHelpers')
const {
  parseReq,
  setLogger,
  setReqValidationModeForTests,
  resetReqValidationLoggingForTests,
} = require('./parseReq')
const { validateSchema } = require('./validateSchema')
const {
  handleValidationError,
  createHandleValidationError,
} = require('./handleValidationError')
const { getRawReqInput, isLockdownInstalled } = require('./lockdown')

module.exports = {
  z,
  zz,
  validateSchema,
  parseReq,
  setLogger,
  setReqValidationModeForTests,
  resetReqValidationLoggingForTests,
  handleValidationError,
  createHandleValidationError,
  InvalidRequestError,
  InvalidParamsError,
  getRawReqInput,
  isLockdownInstalled,
}
