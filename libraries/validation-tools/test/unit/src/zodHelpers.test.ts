import { zz } from '../../../zodHelpers'
import { describe, expect, it } from 'vitest'
import mongodb from 'mongodb'
import { z } from 'zod'

const { ObjectId } = mongodb

describe('zodHelpers', () => {
  describe('optional', () => {
    it('parses a present value with the wrapped schema', () => {
      const parsed = zz.optional(z.string()).safeParse('a value')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('a value')
    })

    it('normalises null to undefined', () => {
      const parsed = zz.optional(z.string()).safeParse(null)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(undefined)
    })

    it('normalises undefined to undefined', () => {
      const parsed = zz.optional(z.string()).safeParse(undefined)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(undefined)
    })

    it('leaves a null unparsed by the wrapped schema', () => {
      // A coercing schema would otherwise turn null into a value of its own,
      // such as the 0 that Number(null) gives.
      const parsed = zz.optional(z.coerce.number()).safeParse(null)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(undefined)
    })

    it('reports a present value the wrapped schema rejects', () => {
      const parsed = zz.optional(z.string()).safeParse(7)
      expect(parsed.success).toBe(false)
    })
  })
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
  describe('buildId', () => {
    it('fails to parse when provided with an invalid buildId', () => {
      const parsed = zz.buildId().safeParse('aa')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid buildId',
        }),
      ])
    })

    it('parses successfully when provided with a valid buildId', () => {
      const parsed = zz.buildId().safeParse('19d6c341530-878fff6cdab7fb0c')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('19d6c341530-878fff6cdab7fb0c')
    })

    it('fails to parse when provided with an editorBuildId', () => {
      const parsed = zz
        .buildId()
        .safeParse(
          '03b1d773-6203-4669-b365-6a0aa5625878-19d6c341530-878fff6cdab7fb0c'
        )
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid buildId',
        }),
      ])
    })
  })

  describe('editorBuildId', () => {
    it('fails to parse when provided with an invalid buildId', () => {
      const parsed = zz.editorBuildId().safeParse('aa')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid editorId-buildId',
        }),
      ])
    })

    it('fails to parse when provided with a buildId', () => {
      const parsed = zz
        .editorBuildId()
        .safeParse('19d6c341530-878fff6cdab7fb0c')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid editorId-buildId',
        }),
      ])
    })

    it('parses successfully when provided with a valid editorId-buildId', () => {
      const parsed = zz
        .editorBuildId()
        .safeParse(
          '03b1d773-6203-4669-b365-6a0aa5625878-19d6c341530-878fff6cdab7fb0c'
        )
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(
        '03b1d773-6203-4669-b365-6a0aa5625878-19d6c341530-878fff6cdab7fb0c'
      )
    })
  })
  describe('filepath', () => {
    it('fails to parse with empty input', () => {
      const parsed = zz.filepath().safeParse('')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is empty',
        }),
      ])
    })

    it('fails to parse with absolute path', () => {
      const parsed = zz.filepath().safeParse('/output.pdf')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is absolute',
        }),
      ])
    })

    it('fails to parse when provided with path traversal', () => {
      const parsed = zz.filepath().safeParse('../output.pdf')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path traversal detected',
        }),
      ])
    })

    it('parses successfully when provided a valid path', () => {
      const parsed = zz.filepath().safeParse('output.pdf')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('output.pdf')
    })

    it('parses successfully when provided a valid nested path', () => {
      const parsed = zz.filepath().safeParse('foo/output.pdf')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('foo/output.pdf')
    })
  })

  describe('routeSegment', () => {
    it('fails to parse with empty input', () => {
      const parsed = zz.routeSegment().safeParse('')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toHaveLength(1)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment is empty',
        }),
      ])
    })

    it('fails to parse a segment containing a path separator', () => {
      const parsed = zz.routeSegment().safeParse('foo/bar')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment contains a path, query or fragment separator',
        }),
      ])
    })

    it('fails to parse a segment containing a backslash', () => {
      const parsed = zz.routeSegment().safeParse('foo\\bar')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment contains a path, query or fragment separator',
        }),
      ])
    })

    it('fails to parse a segment containing a query separator', () => {
      const parsed = zz.routeSegment().safeParse('foo?bar=1')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment contains a path, query or fragment separator',
        }),
      ])
    })

    it('fails to parse a segment containing a fragment separator', () => {
      const parsed = zz.routeSegment().safeParse('foo#bar')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment contains a path, query or fragment separator',
        }),
      ])
    })

    it('fails to parse a relative path component', () => {
      const parsed = zz.routeSegment().safeParse('..')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment is a relative path component',
        }),
      ])
    })

    it('fails to parse a single dot', () => {
      const parsed = zz.routeSegment().safeParse('.')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'route segment is a relative path component',
        }),
      ])
    })

    it('parses successfully when provided a plain segment', () => {
      const parsed = zz.routeSegment().safeParse('conversion')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('conversion')
    })

    it('parses successfully when provided a mongo ObjectId-shaped segment', () => {
      const parsed = zz.routeSegment().safeParse('507f1f77bcf86cd799439011')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('507f1f77bcf86cd799439011')
    })
  })

  describe('safePath', () => {
    it('fails to parse with empty input', () => {
      const inputPath = ''
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is empty',
        }),
      ])
    })

    it('parses successfully with an absolute (root-relative) path', () => {
      // unlike filepath(), a leading "/" is allowed -- project doc/file
      // paths are root-relative in production (see web's
      // ProjectEntityHandler.getAllEntitiesFromProject).
      const inputPath = '/output.pdf'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(inputPath)
    })

    it('fails to parse a path ending in a slash (a folder, not a file)', () => {
      const inputPath = 'foo/'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is a folder, not a file',
        }),
      ])
    })

    it('fails to parse when provided with path traversal', () => {
      const inputPath = '../output.pdf'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path traversal detected',
        }),
      ])
    })

    it('fails to parse a path that is exactly "."', () => {
      // matches SafePath.mjs's BADFILE_RX (^\.$), not just "..": a lone "."
      // component is also rejected there, cross-checked against
      // SafePath.test.mjs's isCleanFilename/isCleanPath cases.
      const inputPath = '.'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path segment is "." or has leading/trailing whitespace',
        }),
      ])
    })

    it('fails to parse a path segment with leading whitespace', () => {
      const inputPath = ' foobar.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path segment is "." or has leading/trailing whitespace',
        }),
      ])
    })

    it('fails to parse a path segment with trailing whitespace', () => {
      const inputPath = 'foobar.tex '
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path segment is "." or has leading/trailing whitespace',
        }),
      ])
    })

    it('fails to parse a path containing a null byte', () => {
      const inputPath = 'foo' + String.fromCharCode(0) + '.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path contains a disallowed character',
        }),
      ])
    })

    it('fails to parse a path containing a C1 control character', () => {
      // \x80-\x9F, per SafePath.mjs's BADCHAR_RX
      const inputPath = 'foo' + String.fromCharCode(0x90) + '.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path contains a disallowed character',
        }),
      ])
    })

    it('fails to parse a path containing a lone surrogate', () => {
      // \uD800-\uDFFF, per SafePath.mjs's BADCHAR_RX
      const inputPath = 'foo\uD800.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path contains a disallowed character',
        }),
      ])
    })

    it('fails to parse a path containing an asterisk', () => {
      const inputPath = 'foo*.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path contains a disallowed character',
        }),
      ])
    })

    it('fails to parse a path containing a backslash', () => {
      const inputPath = 'foo\\bar.tex'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path contains a disallowed character',
        }),
      ])
    })

    it('parses successfully with a nested __proto__ segment', () => {
      // web's SafePath.mjs allows a reserved name below the top level (e.g.
      // a folder literally named "__proto__" is permitted), so this schema
      // must not reject a path web itself considers valid.
      const inputPath = '__proto__/output.pdf'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(inputPath)
    })

    it('fails to parse a path that is exactly "constructor"', () => {
      const inputPath = 'constructor'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is an unsafe property name',
        }),
      ])
    })

    it('parses successfully with a nested segment matching a built-in Object.prototype method name', () => {
      // full BLOCKEDFILE_RX parity, not just the prototype-pollution subset
      // (__proto__/constructor/prototype) -- checked only against the
      // top-level path, same as SafePath.mjs's isCleanPath.
      const inputPath = 'foo/toString'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(inputPath)
    })

    it('fails to parse a path that is exactly "hasOwnProperty"', () => {
      const inputPath = 'hasOwnProperty'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path is an unsafe property name',
        }),
      ])
    })

    it('parses successfully when provided a valid nested path', () => {
      const inputPath = 'foo/output.pdf'
      const parsed = zz.safePath().safeParse(inputPath)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(inputPath)
    })
  })

  describe('projectHistoryId', () => {
    it('fails to parse an invalid id', () => {
      const parsed = zz.projectHistoryId().safeParse('not-an-id')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid project history id',
        }),
      ])
    })

    it('fails to parse a path-traversal payload', () => {
      const parsed = zz.projectHistoryId().safeParse('a/../../../../../etc')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid project history id',
        }),
      ])
    })

    it('parses successfully when provided a valid Mongo ObjectId', () => {
      const parsed = zz.projectHistoryId().safeParse('507f1f77bcf86cd799439011')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('507f1f77bcf86cd799439011')
    })

    it('parses successfully when provided a valid Postgres id', () => {
      const parsed = zz.projectHistoryId().safeParse('12345')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('12345')
    })

    it('fails to parse a Postgres id with a leading zero', () => {
      const parsed = zz.projectHistoryId().safeParse('0123')
      expect(parsed.success).toBe(false)
    })
  })

  describe('chunkId', () => {
    it('fails to parse an invalid id', () => {
      const parsed = zz.chunkId().safeParse('not-an-id')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid chunk id',
        }),
      ])
    })

    it('fails to parse a path-traversal payload', () => {
      const parsed = zz.chunkId().safeParse('a/../../../../../etc')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid chunk id',
        }),
      ])
    })

    it('parses successfully when provided a valid Mongo ObjectId', () => {
      const parsed = zz.chunkId().safeParse('507f1f77bcf86cd799439011')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('507f1f77bcf86cd799439011')
    })

    it('parses successfully when provided a valid Postgres id', () => {
      const parsed = zz.chunkId().safeParse('12345')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('12345')
    })

    it('fails to parse a Postgres id with a leading zero', () => {
      const parsed = zz.chunkId().safeParse('0123')
      expect(parsed.success).toBe(false)
    })
  })

  describe('splitTestName', () => {
    it('fails to parse a non-kebab-case name', () => {
      const parsed = zz.splitTestName().safeParse('Not_Valid')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'split test name must be kebab-case',
        }),
      ])
    })

    it('fails to parse a name shorter than 3 characters', () => {
      const parsed = zz.splitTestName().safeParse('ab')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'split test name must be at least 3 characters long',
        }),
      ])
    })

    it('fails to parse a path-traversal-shaped payload', () => {
      const parsed = zz.splitTestName().safeParse('../../etc/passwd')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'split test name must be kebab-case',
        }),
      ])
    })

    it('parses successfully when provided a valid kebab-case name', () => {
      const parsed = zz.splitTestName().safeParse('my-split-test')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('my-split-test')
    })
  })

  describe('variantName', () => {
    it('fails to parse a non-kebab-case name', () => {
      const parsed = zz.variantName().safeParse('Not_Valid')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'variant name must be kebab-case',
        }),
      ])
    })

    it('fails to parse a name shorter than 3 characters', () => {
      const parsed = zz.variantName().safeParse('ab')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'variant name must be at least 3 characters long',
        }),
      ])
    })

    it('fails to parse a path-traversal-shaped payload', () => {
      const parsed = zz.variantName().safeParse('../../etc/passwd')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'variant name must be kebab-case',
        }),
      ])
    })

    it('parses successfully when provided a valid kebab-case name', () => {
      const parsed = zz.variantName().safeParse('variant-1')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('variant-1')
    })
  })

  describe('eventName', () => {
    it('fails to parse a name containing a disallowed character', () => {
      const parsed = zz.eventName().safeParse('bad event!')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid event name',
        }),
      ])
    })

    it('fails to parse an empty string', () => {
      // both the explicit .min(1) and the regex reject an empty string, so
      // two issues are reported, each with the same message
      const parsed = zz.eventName().safeParse('')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues.length).toBeGreaterThan(0)
      for (const issue of parsed.error?.issues ?? []) {
        expect(issue).toMatchObject({ message: 'invalid event name' })
      }
    })

    it('parses successfully when provided a name with letters, digits and hyphens/underscores', () => {
      const parsed = zz.eventName().safeParse('editor-click_something-2')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('editor-click_something-2')
    })

    it('parses successfully when provided a name with upper case letter', () => {
      const parsed = zz.eventName().safeParse('For-Pages')
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe('For-Pages')
    })

    it('fails to parse a name containing dots, colons, semicolons, commas and slashes', () => {
      const parsed = zz.eventName().safeParse('I.did:something,here/now;too')
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'invalid event name',
        }),
      ])
    })

    it('parses successfully when provided a name that is exactly 240 characters long', () => {
      const name = 'a'.repeat(240)
      const parsed = zz.eventName().safeParse(name)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toBe(name)
    })

    it('fails to parse a name that is 241 characters long', () => {
      const name = 'a'.repeat(241)
      const parsed = zz.eventName().safeParse(name)
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'event name is too long',
        }),
      ])
    })
  })

  describe('uploadedFile', () => {
    const validFile = {
      fieldname: 'qqfile',
      originalname: 'paper.tex',
      encoding: '7bit',
      mimetype: 'application/x-tex',
      size: 1234,
      destination: '/tmp/uploads',
      filename: 'a1b2c3d4e5f6',
      path: '/tmp/uploads/a1b2c3d4e5f6',
    }

    it('parses a multer disk-storage file object', () => {
      const parsed = zz.uploadedFile().safeParse(validFile)
      expect(parsed.success).toBe(true)
      expect(parsed.data).toEqual(validFile)
    })

    it('parses a file object without the deprecated encoding field', () => {
      const { encoding, ...rest } = validFile
      const parsed = zz.uploadedFile().safeParse(rest)
      expect(parsed.success).toBe(true)
    })

    it('fails to parse an originalname with path traversal', () => {
      const parsed = zz
        .uploadedFile()
        .safeParse({ ...validFile, originalname: '../../etc/passwd' })
      expect(parsed.success).toBe(false)
      expect(parsed.error?.issues).toMatchObject([
        expect.objectContaining({
          message: 'path traversal detected',
        }),
      ])
    })

    it('fails to parse an absolute originalname', () => {
      const parsed = zz
        .uploadedFile()
        .safeParse({ ...validFile, originalname: '/etc/passwd' })
      expect(parsed.success).toBe(false)
    })

    it('rejects unknown keys such as a memory-storage buffer', () => {
      const parsed = zz
        .uploadedFile()
        .safeParse({ ...validFile, buffer: Buffer.alloc(1) })
      expect(parsed.success).toBe(false)
    })

    it('fails to parse a negative size', () => {
      const parsed = zz.uploadedFile().safeParse({ ...validFile, size: -1 })
      expect(parsed.success).toBe(false)
    })
  })
})
