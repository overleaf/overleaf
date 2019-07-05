# overleaf-error-type

Make custom error types that:
- pass `instanceof` checks,
- have stack traces,
- support custom messages and properties (`info`), and
- can wrap internal errors (causes) like [VError](https://github.com/joyent/node-verror).

## For ES6

ES6 classes make it easy to define custom errors by subclassing `Error`. Subclassing `OErrors.OError` adds a few extra helpers.

### Usage

#### Throw an error directly

```js
const OErrors = require('overleaf-error-type')

function doSomethingBad () {
  throw new OErrors.OError({
    message: 'did something bad',
    info: { thing: 'foo' }
  })
}
doSomethingBad()
// =>
// { ErrorTypeError: did something bad
//    at doSomethingBad (repl:2:9) <-- stack trace
//    name: 'ErrorTypeError',      <-- default name
//    info: { thing: 'foo' } }     <-- attached info
```

#### Custom error class

```js
class FooError extends OErrors.OError {
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

#### Wrapping an inner error (cause)

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
  console.log(OErrors.getFullStack(err))
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

## For ES5

For backward compatibility, the following ES5-only interface is still supported.

The approach is based mainly on https://gist.github.com/justmoon/15511f92e5216fa2624b; it just tries to DRY it up a bit.

### Usage

#### Define a standalone error class

```js
const errorType = require('overleaf-error-type')

const CustomError = errorType.define('CustomError')

function doSomethingBad () {
  throw new CustomError()
}
doSomethingBad()
// =>
// CustomError                        <-- correct name
//    at doSomethingBad (repl:2:9)    <-- stack trace
```

#### Define an error subclass

```js
const SubCustomError = errorType.extend(CustomError, 'SubCustomError')

try {
  throw new SubCustomError()
} catch (err) {
  console.log(err.name) // => SubCustomError
  console.log(err instanceof SubCustomError) // => true
  console.log(err instanceof CustomError) // => true
  console.log(err instanceof Error) // => true
}
```

#### Add custom message and/or properties

```js
const UserNotFoundError = errorType.define('UserNotFoundError',
  function (userId) {
    this.message = `User not found: ${userId}`
    this.userId = userId
  })

throw new UserNotFoundError(123)
// => UserNotFoundError: User not found: 123
```

#### Add custom Error types under an existing class

```js
class User {
  static lookup (userId) {
    throw new User.UserNotFoundError(userId)
  }
}

errorType.defineIn(User, 'UserNotFoundError', function (userId) {
  this.message = `User not found: ${userId}`
  this.userId = userId
})

User.lookup(123)
// =>
// UserNotFoundError: User not found: 123
//    at Function.lookup (repl:3:11)
```

## References

General:

- [MDN: Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
- [Error Handling in Node.js](https://www.joyent.com/node-js/production/design/errors)
- [verror](https://github.com/joyent/node-verror)

For ES6:

- [Custom JavaScript Errors in ES6](https://medium.com/@xjamundx/custom-javascript-errors-in-es6-aa891b173f87)
- [Custom errors, extending Error](https://javascript.info/custom-errors)

For ES5:

- https://gist.github.com/justmoon/15511f92e5216fa2624b
