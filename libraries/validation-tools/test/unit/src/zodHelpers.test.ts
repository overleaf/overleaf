import { zz } from '../../../zodHelpers'
import { describe, expect, it } from 'vitest'
import mongodb from 'mongodb'

const { ObjectId } = mongodb

describe('zodHelpers', () => {
  describe('objectId', () => {
    it('fails to parse when provided with an invalid ObjectId', () => {
      const parsed = zz.objectId().safeParse('aa')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid Mongo ObjectId',
        }),
      ])
    })

    it('parses successfully when provided with a valid ObjectId', () => {
      const parsed = zz.objectId().safeParse('507f1f77bcf86cd799439011')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('507f1f77bcf86cd799439011')
    })
  })
  describe('coercedObjectId', () => {
    it('fails to parse when provided with an invalid ObjectId', () => {
      const parsed = zz.coercedObjectId().safeParse('aa')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid Mongo ObjectId',
        }),
      ])
    })
    it('parses to an ObjectId when provided with a valid ObjectId string', () => {
      const parsed = zz.coercedObjectId().safeParse('507f1f77bcf86cd799439011')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBeInstanceOf(ObjectId)
      expect(parsed.data?.toString()).toBe('507f1f77bcf86cd799439011')
    })
  })
})
