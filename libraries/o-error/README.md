# @overleaf/o-error

[![CircleCI](https://circleci.com/gh/overleaf/o-error.svg?style=svg)](https://circleci.com/gh/overleaf/o-error)

Make custom error classes that:
- pass `instanceof` checks,
- have stack traces,
- support custom messages and properties (`info`), and
- can wrap internal errors (causes) like [VError](https://github.com/joyent/node-verror).

ES6 classes make it easy to define custom errors by subclassing `Error`. Subclassing `OError` adds a few extra helpers.

## Usage

### Throw an error directly

```js
const OError = require('@overleaf/o-error')

function doSomethingBad () {
  throw new OError({
    message: 'did something bad',
    info: { thing: 'foo' }
  })
}
doSomethingBad()
// =>
// { OError: did something bad
//    at doSomethingBad (repl:2:9) <-- stack trace
//    name: 'OError',              <-- default name
//    info: { thing: 'foo' } }     <-- attached info
```

### Custom error class

```js
class FooError extends OError {
  constructor (options) {
    super({ message: 'failed to foo', ...options })
  }
}

function doFoo () {
  throw new FooError({ info: { foo: 'bar' } })
}
doFoo()
// =>
// { FooError: failed to foo
//    at doFoo (repl:2:9)      <-- stack trace
//    name: 'FooError',        <-- correct name
//    info: { foo: 'bar' } }   <-- attached info
```

### Wrapping an inner error (cause)

```js
function doFoo2 () {
  try {
    throw new Error('bad')
  } catch (err) {
    throw new FooError({ info: { foo: 'bar' } }).withCause(err)
  }
}

doFoo2()
// =>
// { FooError: failed to foo: bad   <-- combined message
//     at doFoo2 (repl:5:11)        <-- stack trace
//   name: 'FooError',              <-- correct name
//   info: { foo: 'bar' },          <-- attached info
//   cause:                         <-- the cause (inner error)
//    Error: bad                    <-- inner error message
//        at doFoo2 (repl:3:11)     <-- inner error stack trace
//        at repl:1:1
//        ...

try {
  doFoo2()
} catch (err) {
  console.log(OError.getFullStack(err))
}
// =>
// FooError: failed to foo: bad
//     at doFoo2 (repl:5:11)
//     at repl:2:3
//     ...
// caused by: Error: bad
//     at doFoo2 (repl:3:11)
//     at repl:2:3
//     ...
```

## References

- [MDN: Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
- [Error Handling in Node.js](https://www.joyent.com/node-js/production/design/errors)
- [verror](https://github.com/joyent/node-verror)
- [Custom JavaScript Errors in ES6](https://medium.com/@xjamundx/custom-javascript-errors-in-es6-aa891b173f87)
- [Custom errors, extending Error](https://javascript.info/custom-errors)
- https://gist.github.com/justmoon/15511f92e5216fa2624b (some tests are based largely on this gist)
