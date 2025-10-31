// @ts-check

const { NotFoundError } = require('../Features/Errors/Errors')
const {
  validateReq,
  z,
  zz,
  ParamsError,
} = require('@overleaf/validation-tools')

const validateReqWeb = (req, schema) => {
  try {
    return validateReq(req, schema)
  } catch (err) {
    if (err instanceof ParamsError) {
      // convert into a NotFoundError that web understands
      throw new NotFoundError('Not found').withCause(err)
    }
    throw err
  }
}

module.exports = {
  validateReq: validateReqWeb,
  z,
  zz,
}
