// @ts-check

import { NotFoundError } from '../Features/Errors/Errors.js'

import {
  parseReq as parseReqBase,
  z,
  zz,
  ParamsError,
} from '@overleaf/validation-tools'

export { z, zz } from '@overleaf/validation-tools'

export const parseReq = (req, schema) => {
  try {
    return parseReqBase(req, schema)
  } catch (err) {
    if (err instanceof ParamsError) {
      // convert into a NotFoundError that web understands
      throw new NotFoundError('Not found').withCause(err)
    }
    throw err
  }
}

export default {
  parseReq,
  z,
  zz,
}
