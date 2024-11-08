const { expect } = require('chai')
const { promisify } = require('node:util')

const OError = require('..')

const {
  expectError,
  expectFullStackWithoutStackFramesToEqual,
} = require('./support')

describe('utils', function () {
  describe('OError.tag', function () {
    it('tags errors thrown from an async function', async function () {
      const delay = promisify(setTimeout)

      async function foo() {
        await delay(10)
        throw new Error('foo error')
      }

      async function bar() {
        try {
          await foo()
        } catch (error) {
          throw OError.tag(error, 'failed to bar', { bar: 'baz' })
        }
      }

      async function baz() {
        try {
          await bar()
        } catch (error) {
          throw OError.tag(error, 'failed to baz', { baz: 'bat' })
        }
      }

      try {
        await baz()
        expect.fail('should have thrown')
      } catch (error) {
        expectError(error, {
          name: 'Error',
          klass: Error,
          message: 'Error: foo error',
          firstFrameRx: /at foo/,
        })
        expectFullStackWithoutStackFramesToEqual(error, [
          'Error: foo error',
          'TaggedError: failed to bar',
          'TaggedError: failed to baz',
        ])
        expect(OError.getFullInfo(error)).to.eql({
          bar: 'baz',
          baz: 'bat',
        })
      }
    })

    it('tags errors thrown from a promise rejection', async function () {
      function foo() {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('foo error'))
          }, 10)
        })
      }

      async function bar() {
        try {
          await foo()
        } catch (error) {
          throw OError.tag(error, 'failed to bar', { bar: 'baz' })
        }
      }

      async function baz() {
        try {
          await bar()
        } catch (error) {
          throw OError.tag(error, 'failed to baz', { baz: 'bat' })
        }
      }

      try {
        await baz()
        expect.fail('should have thrown')
      } catch (error) {
        expectError(error, {
          name: 'Error',
          klass: Error,
          message: 'Error: foo error',
          firstFrameRx: /_onTimeout/,
        })
        expectFullStackWithoutStackFramesToEqual(error, [
          'Error: foo error',
          'TaggedError: failed to bar',
          'TaggedError: failed to baz',
        ])
        expect(OError.getFullInfo(error)).to.eql({
          bar: 'baz',
          baz: 'bat',
        })
      }
    })

    it('tags errors yielded through callbacks', function (done) {
      function foo(cb) {
        setTimeout(() => {
          cb(new Error('foo error'))
        }, 10)
      }

      function bar(cb) {
        foo(err => {
          if (err) {
            return cb(OError.tag(err, 'failed to bar', { bar: 'baz' }))
          }
          cb()
        })
      }

      function baz(cb) {
        bar(err => {
          if (err) {
            return cb(OError.tag(err, 'failed to baz', { baz: 'bat' }))
          }
          cb()
        })
      }

      baz(err => {
        if (err) {
          expectError(err, {
            name: 'Error',
            klass: Error,
            message: 'Error: foo error',
            firstFrameRx: /_onTimeout/,
          })
          expectFullStackWithoutStackFramesToEqual(err, [
            'Error: foo error',
            'TaggedError: failed to bar',
            'TaggedError: failed to baz',
          ])
          expect(OError.getFullInfo(err)).to.eql({
            bar: 'baz',
            baz: 'bat',
          })
          return done()
        }
        expect.fail('should have yielded an error')
      })
    })

    it('is not included in the stack trace if using capture', function () {
      if (!Error.captureStackTrace) return this.skip()
      const err = new Error('test error')
      OError.tag(err, 'test message')
      const stack = OError.getFullStack(err)
      expect(stack).to.match(/TaggedError: test message\n\s+at/)
      expect(stack).to.not.match(/TaggedError: test message\n\s+at [\w.]*tag/)
    })

    describe('without Error.captureStackTrace', function () {
      /* eslint-disable mocha/no-hooks-for-single-case */
      before(function () {
        this.originalCaptureStackTrace = Error.captureStackTrace
        Error.captureStackTrace = null
      })
      after(function () {
        Error.captureStackTrace = this.originalCaptureStackTrace
      })

      it('still captures a stack trace, albeit including itself', function () {
        const err = new Error('test error')
        OError.tag(err, 'test message')
        expectFullStackWithoutStackFramesToEqual(err, [
          'Error: test error',
          'TaggedError: test message',
        ])
        const stack = OError.getFullStack(err)
        expect(stack).to.match(/TaggedError: test message\n\s+at [\w.]*tag/)
      })
    })

    describe('with limit on the number of tags', function () {
      before(function () {
        this.originalMaxTags = OError.maxTags
        OError.maxTags = 3
      })
      after(function () {
        OError.maxTags = this.originalMaxTags
      })

      it('should not tag more than that', function () {
        const err = new Error('test error')
        OError.tag(err, 'test message 1')
        OError.tag(err, 'test message 2')
        OError.tag(err, 'test message 3')
        OError.tag(err, 'test message 4')
        OError.tag(err, 'test message 5')
        expectFullStackWithoutStackFramesToEqual(err, [
          'Error: test error',
          'TaggedError: test message 1',
          'TaggedError: ... dropped tags',
          'TaggedError: test message 4',
          'TaggedError: test message 5',
        ])
      })

      it('should handle deep recursion', async function () {
        async function recursiveAdd(n) {
          try {
            if (n === 0) throw new Error('deep error')
            const result = await recursiveAdd(n - 1)
            return result + 1
          } catch (err) {
            throw OError.tag(err, `at level ${n}`)
          }
        }

        try {
          await recursiveAdd(10)
        } catch (err) {
          expectFullStackWithoutStackFramesToEqual(err, [
            'Error: deep error',
            'TaggedError: at level 0',
            'TaggedError: ... dropped tags',
            'TaggedError: at level 9',
            'TaggedError: at level 10',
          ])
        }
      })

      it('should handle a singleton error', function (done) {
        const err = new Error('singleton error')

        function endpoint(callback) {
          helper(err => callback(err && OError.tag(err, 'in endpoint')))
        }

        function helper(callback) {
          libraryFunction(err => callback(err && OError.tag(err, 'in helper')))
        }

        function libraryFunction(callback) {
          callback(err)
        }

        endpoint(() => {
          endpoint(err => {
            expect(err).to.exist
            expectFullStackWithoutStackFramesToEqual(err, [
              'Error: singleton error',
              'TaggedError: in helper',
              'TaggedError: ... dropped tags',
              'TaggedError: in helper',
              'TaggedError: in endpoint',
            ])
            done()
          })
        })
      })
    })
  })

  describe('OError.getFullInfo', function () {
    it('works when given null', function () {
      expect(OError.getFullInfo(null)).to.deep.equal({})
    })

    it('works on a normal error', function () {
      const err = new Error('foo')
      expect(OError.getFullInfo(err)).to.deep.equal({})
    })

    it('works on an error with tags', function () {
      const err = OError.tag(new Error('foo'), 'bar', { userId: 123 })
      expect(OError.getFullInfo(err)).to.deep.equal({ userId: 123 })
    })

    it('merges info from an error and its tags', function () {
      const err = new OError('foo').withInfo({ projectId: 456 })
      OError.tag(err, 'failed to foo', { userId: 123 })
      expect(OError.getFullInfo(err)).to.deep.equal({
        projectId: 456,
        userId: 123,
      })
    })

    it('merges info from a cause', function () {
      const err1 = new Error('foo')
      const err2 = new Error('bar')
      err1.cause = err2
      err2.info = { userId: 123 }
      expect(OError.getFullInfo(err1)).to.deep.equal({ userId: 123 })
    })

    it('merges info from a nested cause', function () {
      const err1 = new Error('foo')
      const err2 = new Error('bar')
      const err3 = new Error('baz')
      err1.cause = err2
      err2.info = { userId: 123 }
      err2.cause = err3
      err3.info = { foo: 42 }
      expect(OError.getFullInfo(err1)).to.deep.equal({
        userId: 123,
        foo: 42,
      })
    })

    it('merges info from cause with duplicate keys', function () {
      const err1 = new Error('foo')
      const err2 = new Error('bar')
      err1.info = { userId: 42, foo: 1337 }
      err1.cause = err2
      err2.info = { userId: 1 }
      expect(OError.getFullInfo(err1)).to.deep.equal({
        userId: 42,
        foo: 1337,
      })
    })

    it('merges info from tags with duplicate keys', function () {
      const err1 = OError.tag(new Error('foo'), 'bar', { userId: 123 })
      const err2 = OError.tag(err1, 'bat', { userId: 456 })
      expect(OError.getFullInfo(err2)).to.deep.equal({ userId: 456 })
    })

    it('works on an error with .info set to a string', function () {
      const err = new Error('foo')
      err.info = 'test'
      expect(OError.getFullInfo(err)).to.deep.equal({})
    })
  })

  describe('OError.getFullStack', function () {
    it('works when given null', function () {
      expect(OError.getFullStack(null)).to.equal('')
    })

    it('works on a normal error', function () {
      const err = new Error('foo')
      const fullStack = OError.getFullStack(err)
      expect(fullStack).to.match(/^Error: foo$/m)
      expect(fullStack).to.match(/^\s+at /m)
    })

    it('works on an error with a cause', function () {
      const err1 = new Error('foo')
      const err2 = new Error('bar')
      err1.cause = err2

      const fullStack = OError.getFullStack(err1)
      expect(fullStack).to.match(/^Error: foo$/m)
      expect(fullStack).to.match(/^\s+at /m)
      expect(fullStack).to.match(/^caused by:\n\s+Error: bar$/m)
    })

    it('works on both tags and causes', async function () {
      // Here's the actual error.
      function tryToFoo() {
        try {
          throw Error('foo')
        } catch (error) {
          throw OError.tag(error, 'failed to foo', { foo: 1 })
        }
      }

      // Inside another function that wraps it.
      function tryToBar() {
        try {
          tryToFoo()
        } catch (error) {
          throw new OError('failed to bar').withCause(error)
        }
      }

      // And it is in another try.
      try {
        try {
          tryToBar()
          expect.fail('should have thrown')
        } catch (error) {
          throw OError.tag(error, 'failed to bat', { bat: 1 })
        }
      } catch (error) {
        // We catch the wrapping error.
        expectError(error, {
          name: 'OError',
          klass: OError,
          message: 'OError: failed to bar',
          firstFrameRx: /tryToBar/,
        })

        // But the stack contains all of the errors and tags.
        expectFullStackWithoutStackFramesToEqual(error, [
          'OError: failed to bar',
          'TaggedError: failed to bat',
          'caused by:',
          '    Error: foo',
          '    TaggedError: failed to foo',
        ])

        // The info from the wrapped cause should be picked up for logging.
        expect(OError.getFullInfo(error)).to.eql({ bat: 1, foo: 1 })

        // But it should still be recorded.
        expect(OError.getFullInfo(error.cause)).to.eql({ foo: 1 })
      }
    })

    it('works when given non Error', function () {
      expect(OError.getFullStack({ message: 'Foo' })).to.equal('Foo')
    })

    it('works when given non Error with tags', function () {
      const error = OError.tag({ message: 'Foo: bar' }, 'baz')
      expectFullStackWithoutStackFramesToEqual(error, [
        'Foo: bar',
        'TaggedError: baz',
      ])
    })
  })
})
