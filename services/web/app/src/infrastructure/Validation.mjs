// @ts-check

import { NotFoundError } from '../Features/Errors/Errors.js'

import {
  validateReq as validateReqBase,
  z,
  zz,
  ParamsError,
} from '@overleaf/validation-tools'

export { z, zz } from '@overleaf/validation-tools'

export const validateReq = (req, schema) => {
  try {
    return validateReqBase(req, schema)
  } catch (err) {
    if (err instanceof ParamsError) {
      // convert into a NotFoundError that web understands
      throw new NotFoundError('Not found').withCause(err)
    }
    throw err
  }
}

export default {
  validateReq,
  z,
  zz,
}
