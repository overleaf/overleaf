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
  describe('datetime', () => {
    it('parses valid ISO 8601 datetime strings', () => {
      const parsed = zz.datetime().safeParse('2024-01-01T12:00:00Z')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00Z'))
    })

    it('parses a valid ISO 8601 datetime with offset', () => {
      const parsed = zz
        .datetime({ offset: true })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00+00:00'))
    })

    it('parses a valid Date object', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const parsed = zz.datetime().safeParse(date)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(date)
    })

    it('fails to parse datetime with offset when offset option is false', () => {
      const parsed = zz
        .datetime({ offset: false })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })

    it('fails to parse null when schema is not nullable', () => {
      const parsed = zz.datetime().safeParse(null)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.message).toContain(
        'Invalid input: expected date, received null'
      )
    })

    it('fails to parse invalid datetime strings', () => {
      const parsed = zz.datetime().safeParse('invalid-datetime')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })
  })
  describe('datetimeNullable', () => {
    it('parses valid ISO 8601 datetime strings', () => {
      const parsed = zz.datetimeNullable().safeParse('2024-01-01T12:00:00Z')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00Z'))
    })

    it('parses a valid ISO 8601 datetime with offset', () => {
      const parsed = zz
        .datetimeNullable({ offset: true })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00+00:00'))
    })

    it('parses a valid Date object', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const parsed = zz.datetimeNullable().safeParse(date)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(date)
    })

    it('fails to parse datetime with offset when offset option is false', () => {
      const parsed = zz
        .datetimeNullable({ offset: false })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })

    it('parses null when schema is nullable and input is null', () => {
      const parsed = zz.datetimeNullable().safeParse(null)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBeNull()
    })

    it('fails to parse invalid datetime strings', () => {
      const parsed = zz.datetimeNullable().safeParse('invalid-datetime')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })
  })
  describe('datetimeNullish', () => {
    it('parses valid ISO 8601 datetime strings', () => {
      const parsed = zz.datetimeNullish().safeParse('2024-01-01T12:00:00Z')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00Z'))
    })

    it('parses a valid ISO 8601 datetime with offset', () => {
      const parsed = zz
        .datetimeNullish({ offset: true })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(new Date('2024-01-01T12:00:00+00:00'))
    })

    it('parses a valid Date object', () => {
      const date = new Date('2024-01-01T12:00:00Z')
      const parsed = zz.datetimeNullish().safeParse(date)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(date)
    })

    it('parses null when schema is nullable and input is null', () => {
      const parsed = zz.datetimeNullish().safeParse(null)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBeNull()
    })

    it('parses undefined when schema is nullish and input is undefined', () => {
      const parsed = zz.datetimeNullish().safeParse(undefined)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBeUndefined()
    })

    it('fails to parse datetime with offset when offset option is false', () => {
      const parsed = zz
        .datetimeNullish({ offset: false })
        .safeParse('2024-01-01T12:00:00+00:00')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })

    it('fails to parse invalid datetime strings', () => {
      const parsed = zz.datetimeNullish().safeParse('invalid-datetime')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          message: 'Invalid ISO datetime',
        }),
      ])
    })
  })
})
