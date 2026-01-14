import { parseReq } from '../../../parseReq'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Request } from 'express'
import { zz } from '../../../zodHelpers'

describe('parseReq', () => {
  describe('with a request that is valid for the schema', () => {
    it('should return the parsed request', () => {
      const req = {
        params: {
          id: '507f1f77bcf86cd799439011',
        },
        body: {
          name: 'Valid Name',
        },
      } as Request<{ id: string }, any, { name: string }>

      const schema = z.object({
        params: z.object({
          id: zz.objectId(),
        }),
        body: z.object({
          name: z.string(),
        }),
      })

      const result = parseReq(req, schema)

      expect(result).toEqual({
        params: {
          id: '507f1f77bcf86cd799439011',
        },
        body: {
          name: 'Valid Name',
        },
      })
    })
  })
  describe('with a request that is not valid for the schema', () => {
    it('should throw NotFoundError if params are invalid', () => {
      const req = {
        params: {
          id: 'invalid-object-id',
        },
      } as Request<{ id: string }>

      expect(() =>
        parseReq(
          req,
          z.object({
            params: z.object({
              id: zz.objectId(),
            }),
          })
        )
      ).toThrowError(expect.objectContaining({ name: 'ParamsError' }))
    })

    it('should throw an error containing issues if the schema is invalid', () => {
      const req = {
        body: {
          name: 1234,
        },
      } as Request

      expect(() =>
        parseReq(
          req,
          z.object({
            body: z.object({
              name: z.string(),
            }),
          })
        )
      ).toThrowError(
        expect.objectContaining({
          issues: expect.arrayContaining([
            expect.objectContaining({ path: ['body', 'name'] }),
          ]),
        })
      )
    })
  })
})
