import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { Request } from 'express'
import {
  parseReq,
  setLogger,
  setReqValidationModeForTests,
  resetReqValidationLoggingForTests,
} from '../../../parseReq'
import { zz } from '../../../zodHelpers'
import serializers from '@overleaf/logger/serializers'

const RAW_BODY = Symbol.for('overleaf.lockdown.rawBody')
const RAW_QUERY = Symbol.for('overleaf.lockdown.rawQuery')
const RAW_PARAMS = Symbol.for('overleaf.lockdown.rawParams')
const INSTALLED = Symbol.for('overleaf.lockdown.installed')

// Replicates what the patched express does to a request in warn/throw mode
// (see lockdown.test.ts): parsed input lives in symbol-keyed fields, the
// public properties throw.
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

type WarnCall = [Record<string, any>, string]

// Mirrors what a real bunyan logger does to each field before writing a log
// line -- warnMock only records the raw ctx, so assertions on the logged
// output must run it through the same serializers to see what would actually
// reach the log (e.g. the req serializer drops req.body).
function serializedLogOutput(calls: WarnCall[]) {
  return JSON.stringify(
    calls.map(([ctx, msg]) => [
      Object.fromEntries(
        Object.entries(ctx).map(([key, value]) => [
          key,
          key in serializers
            ? (serializers as Record<string, (v: unknown) => unknown>)[key](
                value
              )
            : value,
        ])
      ),
      msg,
    ])
  )
}

describe('parseReq log-only rollout', () => {
  // This block intentionally runs before anything else in the file calls
  // setLogger(), so the module-level logger is still unset here.
  describe('without an injected logger', () => {
    beforeEach(() => {
      resetReqValidationLoggingForTests()
      setReqValidationModeForTests('log')
    })

    afterEach(() => {
      setReqValidationModeForTests(null)
    })

    it('is a no-op: a logOnly failure still returns the raw input without throwing', () => {
      const req = { body: { name: 1234 } } as Request
      const schema = z.object({ body: z.object({ name: z.string() }) })

      let result: unknown
      expect(() => {
        result = parseReq(req, schema, { logOnly: true })
      }).not.toThrow()
      expect(result).toEqual({ body: { name: 1234 } })
    })

    it('is a no-op in enforce-log mode too: the failure still throws', () => {
      setReqValidationModeForTests('enforce-log')
      const req = { body: { name: 1234 } } as Request
      const schema = z.object({ body: z.object({ name: z.string() }) })

      expect(() => parseReq(req, schema, { logOnly: true })).toThrowError(
        expect.objectContaining({ name: 'InvalidRequestError' })
      )
    })
  })

  describe('with an injected logger', () => {
    let warnMock: ReturnType<typeof vi.fn<(ctx: any, msg: string) => void>>

    beforeEach(() => {
      warnMock = vi.fn<(ctx: any, msg: string) => void>()
      setLogger({ warn: warnMock })
      resetReqValidationLoggingForTests()
    })

    afterEach(() => {
      setReqValidationModeForTests(null)
    })

    describe('enforce mode', () => {
      beforeEach(() => {
        setReqValidationModeForTests('enforce')
      })

      it('throws even when opts is fully populated -- opts are inert in enforce mode', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        expect(() =>
          parseReq(req, schema, { logOnly: true, fallbackSchema: z.any() })
        ).toThrowError(expect.objectContaining({ name: 'InvalidRequestError' }))
        expect(warnMock).not.toHaveBeenCalled()
      })

      it('still classifies params failures as InvalidParamsError with opts set', () => {
        const req = { params: { id: 'nope' } } as Request<{ id: string }>
        const schema = z.object({
          params: z.object({ id: z.string().regex(/^[0-9]+$/) }),
        })

        expect(() =>
          parseReq(req, schema, { logOnly: true, fallbackSchema: z.any() })
        ).toThrowError(expect.objectContaining({ name: 'InvalidParamsError' }))
        expect(warnMock).not.toHaveBeenCalled()
      })
    })

    describe('enforce-log mode (throw+log)', () => {
      beforeEach(() => {
        setReqValidationModeForTests('enforce-log')
      })

      it('logs the failure and then throws, with logOnly set', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        expect(() => parseReq(req, schema, { logOnly: true })).toThrowError(
          expect.objectContaining({ name: 'InvalidRequestError' })
        )
        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx, msg] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.kind).toBe('enforced')
        expect(msg).toBe(
          'req-validation: request failed schema and was rejected'
        )
        expect(ctx.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: 'body.name' }),
          ])
        )
      })

      it('logs and then throws InvalidParamsError for a params failure', () => {
        const req = { params: { id: 'nope' } } as Request<{ id: string }>
        const schema = z.object({
          params: z.object({ id: z.string().regex(/^[0-9]+$/) }),
        })

        expect(() => parseReq(req, schema, { logOnly: true })).toThrowError(
          expect.objectContaining({ name: 'InvalidParamsError' })
        )
        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.kind).toBe('enforced')
      })

      it('logs nothing and throws when no opts are passed', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        expect(() => parseReq(req, schema)).toThrowError(
          expect.objectContaining({ name: 'InvalidRequestError' })
        )
        expect(warnMock).not.toHaveBeenCalled()
      })

      it('returns the parsed data and logs nothing on success', () => {
        const req = { body: { name: 'ok' } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        const result = parseReq(req, schema, {
          logOnly: true,
          fallbackSchema: z.any(),
        })

        expect(result).toEqual({ body: { name: 'ok' } })
        expect(warnMock).not.toHaveBeenCalled()
      })

      it('logs enforced-fallback-passed but still throws when the fallback would have passed', () => {
        const req = { body: { count: '5' } } as Request
        const primary = z.object({ body: z.object({ count: z.number() }) })
        const fallback = z.object({
          body: z.object({ count: z.coerce.number().default(0) }),
        })

        expect(() =>
          parseReq(req, primary, { fallbackSchema: fallback })
        ).toThrowError(expect.objectContaining({ name: 'InvalidRequestError' }))
        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.kind).toBe('enforced-fallback-passed')
      })

      it('classifies from the primary error, not the fallback error, when both fail', () => {
        const req = {
          params: { id: 'not-a-number' },
          body: { name: 'ok' },
        } as Request<{ id: string }, any, { name: string }>
        // Fails on body (name is a string, not a number).
        const primary = z.object({
          params: z.object({ id: z.string() }),
          body: z.object({ name: z.number() }),
        })
        // Fails on params (id is a string, not a number).
        const fallback = z.object({
          params: z.object({ id: z.number() }),
          body: z.object({ name: z.string() }),
        })

        // Log mode throws InvalidParamsError here, from the fallback's error.
        expect(() =>
          parseReq(req, primary, { fallbackSchema: fallback, logOnly: true })
        ).toThrowError(expect.objectContaining({ name: 'InvalidRequestError' }))
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.kind).toBe('enforced')
      })

      it('resolves logFields into failingValues', () => {
        const req = { body: { zipUrl: '/bad/path' } } as Request
        const schema = z.object({
          body: z.object({ zipUrl: z.string().url() }),
        })

        expect(() =>
          parseReq(req, schema, { logOnly: true, logFields: ['body.zipUrl'] })
        ).toThrow()

        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues).toEqual({ 'body.zipUrl': '/bad/path' })
      })

      it('never leaks a sentinel value present in the request', () => {
        const req = { body: { name: 'SECRET_VALUE_123' } } as Request
        const schema = z.object({ body: z.object({ name: z.number() }) })

        expect(() => parseReq(req, schema, { logOnly: true })).toThrow()

        expect(serializedLogOutput(warnMock.mock.calls)).not.toContain(
          'SECRET_VALUE_123'
        )
      })

      it('logs exactly once for a repeated identical failure against the same schema', () => {
        const schema = z.strictObject({
          body: z.strictObject({ name: z.string() }),
        })
        const req = { body: { name: 1234 } } as Request

        expect(() => parseReq(req, schema, { logOnly: true })).toThrow()
        expect(() => parseReq(req, schema, { logOnly: true })).toThrow()

        expect(warnMock).toHaveBeenCalledTimes(1)
      })

      it('logs again when the same schema fails a different way', () => {
        const schema = z.strictObject({
          body: z.strictObject({ name: z.string() }),
        })
        const req1 = { body: { name: 1234 } } as Request
        const req2 = { body: { name: 'ok', extra: true } } as Request

        expect(() => parseReq(req1, schema, { logOnly: true })).toThrow()
        expect(() => parseReq(req2, schema, { logOnly: true })).toThrow()

        expect(warnMock).toHaveBeenCalledTimes(2)
      })
    })

    // NOTE: the task description's spec text says "Default (unset OR any
    // invalid value) is 'log'" for REQ_VALIDATION_MODE (repeated for
    // setReqValidationModeForTests: "coerced the same way the real getter
    // would"), which is also the only reading consistent with the rollout's
    // safety goal (fail open to logging, not enforcing, when a service
    // hasn't configured the var). We test that documented behavior here.
    describe('an invalid REQ_VALIDATION_MODE value', () => {
      beforeEach(() => {
        setReqValidationModeForTests('bogus')
      })

      it('behaves as log mode (the documented default for unset/invalid values)', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        const result = parseReq(req, schema, { logOnly: true })
        expect(result).toEqual({ body: { name: 1234 } })
        expect(warnMock).toHaveBeenCalledTimes(1)
      })
    })

    describe('log mode', () => {
      beforeEach(() => {
        setReqValidationModeForTests('log')
      })

      it('still throws when no opts are passed, and logs nothing', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        expect(() => parseReq(req, schema)).toThrowError(
          expect.objectContaining({ name: 'InvalidRequestError' })
        )
        expect(warnMock).not.toHaveBeenCalled()
      })

      describe('logOnly', () => {
        it('returns the raw, un-coerced request input on failure', () => {
          const req = { body: { name: 1234 } } as Request
          const schema = z.object({ body: z.object({ name: z.string() }) })

          const result = parseReq(req, schema, { logOnly: true })
          expect(result).toBe(req)
          expect(result).toEqual({ body: { name: 1234 } })
        })

        it('logs exactly once for a repeated identical failure against the same schema', () => {
          const schema = z.strictObject({
            body: z.strictObject({ name: z.string() }),
          })
          const req = { body: { name: 1234 } } as Request

          parseReq(req, schema, { logOnly: true })
          parseReq(req, schema, { logOnly: true })

          expect(warnMock).toHaveBeenCalledTimes(1)
        })

        it('logs again when the issues differ, against the same schema', () => {
          const schema = z.strictObject({
            body: z.strictObject({ name: z.string() }),
          })
          const req1 = { body: { name: 1234 } } as Request
          const req2 = { body: { name: 'ok', extra: true } } as Request

          parseReq(req1, schema, { logOnly: true })
          parseReq(req2, schema, { logOnly: true })

          expect(warnMock).toHaveBeenCalledTimes(2)
        })

        it('logs again for a different schema object, even with identical issues (per-schema dedup)', () => {
          const schemaA = z.strictObject({
            body: z.strictObject({ name: z.string() }),
          })
          const schemaB = z.strictObject({
            body: z.strictObject({ name: z.string() }),
          })
          const req = { body: { name: 1234 } } as Request

          parseReq(req, schemaA, { logOnly: true })
          parseReq(req, schemaB, { logOnly: true })

          expect(warnMock).toHaveBeenCalledTimes(2)
        })
      })

      describe('with the request-input lockdown installed', () => {
        it('returns the raw, unwrapped params/query/body on a logOnly failure', () => {
          const req = lockedRequest({ params: { id: 'not-an-object-id' } })
          const schema = z.object({
            params: z.strictObject({ id: zz.objectId() }),
          })

          const result = parseReq(req, schema, {
            logOnly: true,
          }) as unknown as Request

          expect(() => result.params).not.toThrow()
          expect(result.params).toEqual({ id: 'not-an-object-id' })
        })
      })

      describe('with a fallbackSchema', () => {
        it('returns the fallback output and logs the primary issues (fallback-passed) when the fallback passes', () => {
          const req = { body: { count: '5' } } as Request
          const primary = z.object({ body: z.object({ count: z.number() }) })
          const fallback = z.object({
            body: z.object({ count: z.coerce.number().default(0) }),
          })

          const result = parseReq(req, primary, { fallbackSchema: fallback })

          expect(result).toEqual({ body: { count: 5 } })
          expect(warnMock).toHaveBeenCalledTimes(1)
          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.kind).toBe('fallback-passed')
          expect(ctx.issues).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ path: 'body.count' }),
            ])
          )
        })

        it('throws classified from the fallback error when both schemas fail and logOnly is not set', () => {
          const req = {
            params: { id: 'not-a-number' },
            body: { name: 'ok' },
          } as Request<{ id: string }, any, { name: string }>
          // Fails on body (name is a string, not a number).
          const primary = z.object({
            params: z.object({ id: z.string() }),
            body: z.object({ name: z.number() }),
          })
          // Fails on params (id is a string, not a number).
          const fallback = z.object({
            params: z.object({ id: z.number() }),
            body: z.object({ name: z.string() }),
          })

          expect(() =>
            parseReq(req, primary, { fallbackSchema: fallback })
          ).toThrowError(
            expect.objectContaining({ name: 'InvalidParamsError' })
          )
          expect(warnMock).not.toHaveBeenCalled()
        })

        it('returns raw input and logs once (log-only) when both schemas fail and logOnly is set', () => {
          const req = { body: { name: 1234 } } as Request
          const primary = z.object({ body: z.object({ name: z.string() }) })
          const fallback = z.object({
            body: z.object({ name: z.string().min(10) }),
          })

          const result = parseReq(req, primary, {
            fallbackSchema: fallback,
            logOnly: true,
          })

          expect(result).toEqual({ body: { name: 1234 } })
          expect(warnMock).toHaveBeenCalledTimes(1)
          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.kind).toBe('log-only')
        })
      })

      describe('issue sanitization', () => {
        it('never leaks a sentinel value present in the request', () => {
          const req = { body: { name: 'SECRET_VALUE_123' } } as Request
          const schema = z.object({ body: z.object({ name: z.number() }) })

          parseReq(req, schema, { logOnly: true })

          expect(serializedLogOutput(warnMock.mock.calls)).not.toContain(
            'SECRET_VALUE_123'
          )
        })

        it('includes an unrecognized key NAME but never its value', () => {
          const req = {
            body: { name: 'ok', extraSecretField: 'TOP_SECRET_VALUE' },
          } as Request
          const schema = z.strictObject({
            body: z.strictObject({ name: z.string() }),
          })

          parseReq(req, schema, { logOnly: true })

          const logged = serializedLogOutput(warnMock.mock.calls)
          expect(logged).toContain('extraSecretField')
          expect(logged).not.toContain('TOP_SECRET_VALUE')
        })

        it('truncates a >64-char path segment to exactly 64 chars', () => {
          const longKey = 'x'.repeat(65)
          const req = { body: { [longKey]: 'irrelevant' } } as Request
          const schema = z.object({
            body: z.object({ [longKey]: z.number() }),
          })

          parseReq(req, schema, { logOnly: true })

          const logged = serializedLogOutput(warnMock.mock.calls)
          expect(logged).toContain(longKey.slice(0, 64))
          expect(logged).not.toContain(longKey)
        })

        it('truncates a >200-char message to exactly 200 chars', () => {
          const longMessage = 'y'.repeat(250)
          const req = { body: { name: 'short' } } as Request
          const schema = z.object({
            body: z.object({
              name: z.string().refine(() => false, { message: longMessage }),
            }),
          })

          parseReq(req, schema, { logOnly: true })

          const logged = JSON.stringify(warnMock.mock.calls)
          expect(logged).toContain(longMessage.slice(0, 200))
          expect(logged).not.toContain(longMessage)
        })
      })

      describe('logFields', () => {
        it('omits failingValues when logFields is not set', () => {
          const req = { body: { name: 1234 } } as Request
          const schema = z.object({ body: z.object({ name: z.string() }) })

          parseReq(req, schema, { logOnly: true })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues).toBeUndefined()
        })

        it('includes the resolved value at each listed dotted path', () => {
          const req = { body: { relativePath: '../../etc/passwd' } } as Request
          const schema = z.object({
            body: z.object({
              relativePath: z.string().refine(s => !s.includes('..'), {
                message: 'path traversal detected',
              }),
            }),
          })

          parseReq(req, schema, {
            logOnly: true,
            logFields: ['body.relativePath'],
          })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues).toEqual({
            'body.relativePath': '../../etc/passwd',
          })
        })

        it('resolves listed fields regardless of which field actually failed validation', () => {
          const req = {
            body: { name: 1234, relativePath: 'folder/main.tex' },
          } as Request
          const schema = z.object({
            body: z.object({ name: z.string(), relativePath: z.string() }),
          })

          parseReq(req, schema, {
            logOnly: true,
            logFields: ['body.relativePath'],
          })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues).toEqual({
            'body.relativePath': 'folder/main.tex',
          })
        })

        it('resolves to undefined for a path missing from the input', () => {
          const req = { body: { name: 1234 } } as Request
          const schema = z.object({ body: z.object({ name: z.string() }) })

          parseReq(req, schema, {
            logOnly: true,
            logFields: ['body.doesNotExist'],
          })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues['body.doesNotExist']).toBeUndefined()
        })

        it('truncates a >200-char string value to exactly 200 chars', () => {
          const longValue = 'z'.repeat(250)
          const req = { body: { name: longValue } } as Request
          const schema = z.object({ body: z.object({ name: z.number() }) })

          parseReq(req, schema, { logOnly: true, logFields: ['body.name'] })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues['body.name']).toBe(longValue.slice(0, 200))
        })

        it('resolves the raw, unwrapped value when the request-input lockdown is installed', () => {
          const req = lockedRequest({ body: { relativePath: 'a/../b' } })
          const schema = z.object({
            body: z.object({
              relativePath: z.string().refine(s => !s.includes('..'), {
                message: 'path traversal detected',
              }),
            }),
          })

          parseReq(req, schema, {
            logOnly: true,
            logFields: ['body.relativePath'],
          })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues).toEqual({
            'body.relativePath': 'a/../b',
          })
        })

        it('passes a non-string value through unsanitized, including whole objects', () => {
          const req = {
            body: { meta: { secret: 'NESTED_SECRET' }, name: 1234 },
          } as Request
          const schema = z.object({
            body: z.object({ meta: z.unknown(), name: z.string() }),
          })

          parseReq(req, schema, { logOnly: true, logFields: ['body.meta'] })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          expect(ctx.failingValues).toEqual({
            'body.meta': { secret: 'NESTED_SECRET' },
          })
        })
      })

      describe('invalid_union sanitization', () => {
        it('recursively sanitizes nested union member issues without leaking sentinel values', () => {
          const req = {
            body: { value: { secret: 'UNION_SECRET_VALUE' } },
          } as Request
          const schema = z.object({
            body: z.object({ value: z.union([z.string(), z.number()]) }),
          })

          parseReq(req, schema, { logOnly: true })

          expect(warnMock).toHaveBeenCalledTimes(1)
          const [ctx] = warnMock.mock.calls[0] as WarnCall
          const unionIssue = ctx.issues.find(
            (issue: any) => issue.code === 'invalid_union'
          )
          expect(unionIssue).toBeDefined()
          expect(Array.isArray(unionIssue.errors)).toBe(true)
          expect(unionIssue.errors.length).toBeGreaterThan(0)

          expect(serializedLogOutput(warnMock.mock.calls)).not.toContain(
            'UNION_SECRET_VALUE'
          )
        })

        it('expands a union nested 3 levels deep inside other unions', () => {
          // Mirrors overleaf-editor-core's rawOperation -> rawFile ->
          // rawFileMetadata shape: a union of objects, one of whose fields is
          // itself a union of objects, one of whose fields is itself a union.
          const level3 = z.union([
            z.strictObject({ a: z.literal('a') }),
            z.strictObject({ b: z.literal('b') }),
          ])
          const level2 = z.union([
            z.strictObject({ inner: level3 }),
            z.strictObject({ other: z.string() }),
          ])
          const level1 = z.union([
            z.strictObject({ mid: level2 }),
            z.strictObject({ different: z.string() }),
          ])
          const req = {
            body: { value: { mid: { inner: { c: 'nope' } } } },
          } as Request
          const schema = z.object({ body: z.object({ value: level1 }) })

          parseReq(req, schema, { logOnly: true })

          const [ctx] = warnMock.mock.calls[0] as WarnCall
          // Walk down: top union (value) -> level1 branch (mid) -> level2
          // union (inner) -> level3 union, whose own branch errors (unknown
          // keys "a"/"b" not satisfied by "c") must have survived.
          const top = ctx.issues.find((i: any) => i.code === 'invalid_union')
          const level1Errors = top.errors[0] // the "mid" branch
          const level2Issue = level1Errors.find(
            (i: any) => i.code === 'invalid_union'
          )
          const level2Errors = level2Issue.errors[0] // the "inner" branch
          const level3Issue = level2Errors.find(
            (i: any) => i.code === 'invalid_union'
          )
          expect(level3Issue.errors).toBeDefined()
          expect(level3Issue.errors.length).toBeGreaterThan(0)
        })
      })
    })

    describe('logFields', () => {
      it('resolves a dotted path and includes it in failingValues (logOnly)', () => {
        const req = { body: { zipUrl: '/bad/path' } } as Request
        const schema = z.object({
          body: z.object({ zipUrl: z.string().url() }),
        })

        parseReq(req, schema, {
          logOnly: true,
          logFields: ['body.zipUrl'],
        })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues).toEqual({ 'body.zipUrl': '/bad/path' })
      })

      it('resolves a dotted path and includes it in failingValues (fallback-passed)', () => {
        const req = { body: { zipUrl: '/bad/path' } } as Request
        const primary = z.object({
          body: z.object({ zipUrl: z.string().url() }),
        })
        const fallback = z.object({
          body: z.object({ zipUrl: z.string() }),
        })

        parseReq(req, primary, {
          fallbackSchema: fallback,
          logFields: ['body.zipUrl'],
        })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.kind).toBe('fallback-passed')
        expect(ctx.failingValues).toEqual({ 'body.zipUrl': '/bad/path' })
      })

      it('uses <missing> for a path that does not exist in the input', () => {
        const req = { body: {} } as Request
        const schema = z.object({
          body: z.object({ zipUrl: z.string() }),
        })

        parseReq(req, schema, {
          logOnly: true,
          logFields: ['body.zipUrl'],
        })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues).toEqual({ 'body.zipUrl': undefined })
      })

      it('uses <missing> when an intermediate segment is missing', () => {
        const req = { body: undefined } as unknown as Request
        const schema = z.object({
          body: z.object({ zipUrl: z.string() }),
        })

        parseReq(req, schema, {
          logOnly: true,
          logFields: ['body.zipUrl'],
        })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues).toEqual({ 'body.zipUrl': '<missing>' })
      })

      it('truncates string values longer than 200 chars', () => {
        const longValue = 'z'.repeat(250)
        const req = { body: { zipUrl: longValue } } as Request
        const schema = z.object({
          body: z.object({ zipUrl: z.string().url() }),
        })

        parseReq(req, schema, {
          logOnly: true,
          logFields: ['body.zipUrl'],
        })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues['body.zipUrl']).toHaveLength(200)
        expect(ctx.failingValues['body.zipUrl']).toBe(longValue.slice(0, 200))
      })

      it('omits failingValues when logFields is not set', () => {
        const req = { body: { name: 1234 } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        parseReq(req, schema, { logOnly: true })

        expect(warnMock).toHaveBeenCalledTimes(1)
        const [ctx] = warnMock.mock.calls[0] as WarnCall
        expect(ctx.failingValues).toBeUndefined()
      })
    })

    describe('success path', () => {
      it('enforce mode: returns the parsed data and logs nothing, even with opts set', () => {
        setReqValidationModeForTests('enforce')
        const req = { body: { name: 'ok' } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        const result = parseReq(req, schema, {
          logOnly: true,
          fallbackSchema: z.any(),
        })

        expect(result).toEqual({ body: { name: 'ok' } })
        expect(warnMock).not.toHaveBeenCalled()
      })

      it('log mode: returns the parsed data and logs nothing, even with opts set', () => {
        setReqValidationModeForTests('log')
        const req = { body: { name: 'ok' } } as Request
        const schema = z.object({ body: z.object({ name: z.string() }) })

        const result = parseReq(req, schema, {
          logOnly: true,
          fallbackSchema: z.any(),
        })

        expect(result).toEqual({ body: { name: 'ok' } })
        expect(warnMock).not.toHaveBeenCalled()
      })
    })
  })
})
