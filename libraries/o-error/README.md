# overleaf-error-type

Make custom error types that pass `instanceof` checks, have stack traces and support custom messages and properties.

The approach is based mainly on https://gist.github.com/justmoon/15511f92e5216fa2624b; it just tries to DRY it up a bit.

## Usage

### Define a standalone error class

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

### Define an error subclass

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

### Add custom message and/or properties

```js
const UserNotFoundError = errorType.define('UserNotFoundError',
  function (userId) {
    this.message = `User not found: ${userId}`
    this.userId = userId
  })

throw new UserNotFoundError(123)
// => UserNotFoundError: User not found: 123
```

### Add custom Error types under an existing class

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

- https://gist.github.com/justmoon/15511f92e5216fa2624b
- [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
