import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Request } from 'express'
import { parseReq } from '../../../parseReq'
import { getRawReqInput, isLockdownInstalled } from '../../../lockdown'
import { zz } from '../../../zodHelpers'

const RAW_BODY = Symbol.for('overleaf.lockdown.rawBody')
const RAW_QUERY = Symbol.for('overleaf.lockdown.rawQuery')
const RAW_PARAMS = Symbol.for('overleaf.lockdown.rawParams')
const INSTALLED = Symbol.for('overleaf.lockdown.installed')

// Replicates what the patched express does to a request in warn/throw mode:
// parsed input lives in symbol-keyed fields, the public properties throw.
function lockedRequest({
  params = {},
  query = {},
  body = undefined,
  ...rest
}: {
  params?: object
  query?: object
  body?: unknown
  [key: string]: unknown
}): Request {
  const req: Record<PropertyKey, unknown> = { ...rest }
  req[INSTALLED] = true
  req[RAW_PARAMS] = params
  req[RAW_QUERY] = query
  req[RAW_BODY] = body
  for (const field of ['params', 'query', 'body']) {
    Object.defineProperty(req, field, {
      configurable: true,
      enumerable: false,
      get() {
        throw new Error(`raw request input is forbidden (req.${field})`)
      },
      set(value) {
        this[
          field === 'params'
            ? RAW_PARAMS
            : field === 'query'
              ? RAW_QUERY
              : RAW_BODY
        ] = value
      },
    })
  }
  return req as unknown as Request
}

describe('parseReq with the request-input lockdown installed', () => {
  it('validates params/query/body from the raw fields without touching the public accessors', () => {
    const req = lockedRequest({
      params: { id: '507f1f77bcf86cd799439011' },
      query: { verbose: 'true' },
      body: { name: 'Valid Name' },
    })

    const schema = z.object({
      params: z.strictObject({ id: zz.objectId() }),
      query: z.strictObject({ verbose: z.stringbool() }),
      body: z.strictObject({ name: z.string() }),
    })

    expect(parseReq(req, schema)).toEqual({
      params: { id: '507f1f77bcf86cd799439011' },
      query: { verbose: true },
      body: { name: 'Valid Name' },
    })
  })

  it('lets schemas reference unlocked request fields such as headers', () => {
    const req = lockedRequest({
      params: { id: '507f1f77bcf86cd799439011' },
      headers: { range: 'bytes=0-99' },
    })

    const schema = z.object({
      params: z.strictObject({ id: zz.objectId() }),
      headers: z.object({ range: z.string() }),
    })

    expect(parseReq(req, schema)).toEqual({
      params: { id: '507f1f77bcf86cd799439011' },
      headers: { range: 'bytes=0-99' },
    })
  })

  it('throws InvalidParamsError for invalid raw params', () => {
    const req = lockedRequest({ params: { id: 'not-an-object-id' } })

    expect(() =>
      parseReq(req, z.object({ params: z.strictObject({ id: zz.objectId() }) }))
    ).toThrowError(expect.objectContaining({ name: 'InvalidParamsError' }))
  })

  it('rejects unknown keys in strict objects from the raw fields', () => {
    const req = lockedRequest({ body: { name: 'ok', extra: 'nope' } })

    expect(() =>
      parseReq(req, z.object({ body: z.strictObject({ name: z.string() }) }))
    ).toThrowError(expect.objectContaining({ name: 'InvalidRequestError' }))
  })
})

describe('isLockdownInstalled', () => {
  it('reports the lockdown state of a request', () => {
    expect(isLockdownInstalled(lockedRequest({}))).toBe(true)
    expect(isLockdownInstalled({} as Request)).toBe(false)
  })
})

describe('getRawReqInput', () => {
  it('reads the raw fields on a locked request', () => {
    const req = lockedRequest({
      params: { id: 'p' },
      query: { q: '1' },
      body: { b: 2 },
    })

    expect(getRawReqInput(req)).toEqual({
      params: { id: 'p' },
      query: { q: '1' },
      body: { b: 2 },
    })
  })

  it('reads the public properties on an unlocked request', () => {
    const req = {
      params: { id: 'p' },
      query: { q: '1' },
      body: { b: 2 },
    } as unknown as Request

    expect(getRawReqInput(req)).toEqual({
      params: { id: 'p' },
      query: { q: '1' },
      body: { b: 2 },
    })
  })
})
