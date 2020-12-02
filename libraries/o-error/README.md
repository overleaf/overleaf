# @overleaf/o-error

[![npm version](https://badge.fury.io/js/%40overleaf%2Fo-error.svg)](https://badge.fury.io/js/%40overleaf%2Fo-error)
[![CircleCI](https://circleci.com/gh/overleaf/o-error.svg?style=svg)](https://circleci.com/gh/overleaf/o-error)
[![Coverage Status](https://coveralls.io/repos/github/overleaf/o-error/badge.svg?branch=master)](https://coveralls.io/github/overleaf/o-error?branch=master)

Light-weight helpers for handling JavaScript Errors in node.js and the browser.

- Get long stack traces across async functions and callbacks with `OError.tag`.
- Easily make custom `Error` subclasses.
- Wrap internal errors, preserving the original errors for logging as `causes`.
- Play nice with error logging services by keeping data in attached `info` objects instead of the error message.

## Table of Contents

<!-- toc -->

- [Long Stack Traces with `OError.tag`](#long-stack-traces-with-oerrortag)
  * [The Problem](#the-problem)
  * [The Solution](#the-solution)
  * [Adding More Info](#adding-more-info)
  * [`async`/`await`](#asyncawait)
  * [Better Async Stack Traces in Node 12+](#better-async-stack-traces-in-node-12)
  * [Caveat: Shared Error Instances](#caveat-shared-error-instances)
- [Create Custom Error Classes](#create-custom-error-classes)
  * [Attaching Extra Info](#attaching-extra-info)
  * [Wrapping an Internal Error](#wrapping-an-internal-error)
- [OError API Reference](#oerror-api-reference)
  * [new OError(message, [info], [cause])](#new-oerrormessage-info-cause)
  * [oError.withInfo(info) ⇒ this](#oerrorwithinfoinfo--this)
  * [oError.withCause(cause) ⇒ this](#oerrorwithcausecause--this)
  * [OError.maxTags : Number](#oerrormaxtags--number)
  * [OError.tag(error, [message], [info]) ⇒ Error](#oerrortagerror-message-info--error)
  * [OError.getFullInfo(error) ⇒ Object](#oerrorgetfullinfoerror--object)
  * [OError.getFullStack(error) ⇒ string](#oerrorgetfullstackerror--string)
- [References](#references)

<!-- tocstop -->

## Long Stack Traces with `OError.tag`

### The Problem

While JavaScript errors have stack traces, they only go back to the start of the latest tick, so they are often not very useful. For example:

```js
const demoDatabase = {
  findUser(id, callback) {
    process.nextTick(() => {
      // return result asynchronously
      if (id === 42) {
        callback(null, { name: 'Bob' })
      } else {
        callback(new Error('not found'))
      }
    })
  },
}

function sayHi1(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(err)
    callback(null, 'Hi ' + user.name)
  })
}

sayHi1(43, (err, result) => {
  if (err) {
    console.error(err)
  } else {
    console.log(result)
  }
})
```

The resulting error's stack trace doesn't make any mention of our `sayHi1` function; it starts at the `nextTick` built-in:

```
Error: not found
    at process.nextTick (repl:8:18)
    at process._tickCallback (internal/process/next_tick.js:61:11)
```

In practice, it's often even worse, like

```
DBError: socket connection refused
    at someObscureLibraryFunction (...)
    at ...
```

### The Solution

Before passing the error to a callback, call the `OError.tag` function to capture a stack trace at the call site:

```js
const OError = require('.')

function sayHi2(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(OError.tag(err))
    callback(null, 'Hi ' + user.name)
  })
}

sayHi2(43, (err, result) => {
  if (err) {
    console.error(OError.getFullStack(OError.tag(err)))
  } else {
    console.log(result)
  }
})
```

And use `OError.getFullStack` to reconstruct the full stack, including the tagged errors:

```
Error: not found
    at process.nextTick (repl:8:18)
    at process._tickCallback (internal/process/next_tick.js:61:11)
TaggedError
    at demoDatabase.findUser (repl:3:37)
    at process.nextTick (repl:8:9)
    at process._tickCallback (internal/process/next_tick.js:61:11)
TaggedError
    at sayHi2 (repl:3:46)
    at demoDatabase.findUser (repl:3:21)
    at process.nextTick (repl:8:9)
    at process._tickCallback (internal/process/next_tick.js:61:11)
```

The full stack contains the original error's stack and also the `TaggedError` stacks. There's some redundancy, but it's better to have too much information than too little.

### Adding More Info

You can add more information at each `tag` call site: a message and an `info` object with custom properties.

```js
function sayHi3(userId, callback) {
  demoDatabase.findUser(userId, (err, user) => {
    if (err) return callback(OError.tag(err, 'failed to find user', { userId }))
    callback(null, 'Hi ' + user.name)
  })
}

sayHi3(43, (err, result) => {
  if (err) {
    OError.tag(err, 'failed to say hi')
    console.error(OError.getFullStack(err))
    console.error(OError.getFullInfo(err))
  } else {
    console.log(result)
  }
})
```

The `OError.getFullInfo` property merges all of the `info`s from the tags together into one object. This logs a full stack trace with `failed to ...` annotations and an `info` object that contains the `userId` that it failed to find:

```
Error: not found
    at process.nextTick (repl:8:18)
    at process._tickCallback (internal/process/next_tick.js:61:11)
TaggedError: failed to find user
    at demoDatabase.findUser (repl:3:37)
    at process.nextTick (repl:8:9)
    at process._tickCallback (internal/process/next_tick.js:61:11)
TaggedError: failed to say hi
    at sayHi3 (repl:3:12)
    at demoDatabase.findUser (repl:3:21)
    at process.nextTick (repl:8:9)
    at process._tickCallback (internal/process/next_tick.js:61:11)

{ userId: 43 }
```

Logging this information (or reporting it to an error monitoring service) hopefully gives you a good start to figuring out what went wrong.

### `async`/`await`

The `OError.tag` approach works with both async/await and callback-oriented code. When using async/await, the pattern is to catch an error, tag it and rethrow:

```js
const promisify = require('util').promisify
demoDatabase.findUserAsync = promisify(demoDatabase.findUser)

async function sayHi4(userId) {
  try {
    const user = await demoDatabase.findUserAsync(userId)
    return `Hi ${user.name}`
  } catch (error) {
    throw OError.tag(error, 'failed to find user', { userId })
  }
}

async function main() {
  try {
    await sayHi4(43)
  } catch (error) {
    OError.tag(error, 'failed to say hi')
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
  }
}
main()
```

The resulting full stack trace points to `sayHi4` in `main`, as expected:

```
Error: not found
    at process.nextTick (repl:8:18)
    at process._tickCallback (internal/process/next_tick.js:61:11)
TaggedError: failed to find user
    at sayHi4 (repl:6:18)
    at process._tickCallback (internal/process/next_tick.js:68:7)
TaggedError: failed to say hi
    at main (repl:5:12)
    at process._tickCallback (internal/process/next_tick.js:68:7)

{ userId: 43 }
```

### Better Async Stack Traces in Node 12+

The above output is from node 10. Node 12 has improved stack traces for async code that uses native promises. However, until your whole stack, including all libraries, is using async/await and native promises, you're still likely to get unhelpful stack traces. So, the tagging approach still adds value, even in node 12. (And the `info` from tagging can add value even to a good stack trace, because it can contain clues about the input the caused the error.)

### Caveat: Shared Error Instances

Some libraries, such as `ioredis`, may return the same `Error` instance to multiple callbacks. In this case, the tags may be misleading, because they will be a mixture of the different 'stacks' that lead to the error. You can either accept this or choose to instead wrap the errors from these libraries with new `OError` instances using `withCause`.

In the worst case, a library that always returns a single instance of an error could cause a resource leak. To prevent this, `OError` will only add up to `OError.maxTags` (default 100) tags to a single Error instance.

## Create Custom Error Classes

Broadly speaking, there are two kinds of errors: those we try to recover from, and those for which we give up (i.e. a 5xx response in a web application). For the latter kind, we usually just want to log a message and stack trace useful for debugging, which `OError.tag` helps with.

To recover from an error, we usually need to know what kind of error it was and perhaps to check some of its properties. Defining a custom Error subclass is a good way to do this. Callers can check the type of the error either with `instanceof` or using a custom property, such as `code`.

With ES6 classes, creating a custom error subclass is mostly as simple as `extends Error`. One extra line is required to set the error's `name` appropriately, and inheriting from `OError` handles this implementation detail. Here's an example:

```js
class UserNotFoundError extends OError {
  constructor() {
    super('user not found')
  }
}

try {
  throw new UserNotFoundError()
} catch (error) {
  console.error(`instanceof Error: ${error instanceof Error}`)
  console.error(
    `instanceof UserNotFoundError: ${error instanceof UserNotFoundError}`
  )
  console.error(error.stack)
}
```

```
instanceof Error: true
instanceof UserNotFoundError: true
UserNotFoundError: user not found
    at repl:2:9
    ...
```

### Attaching Extra Info

Whether for helping with error recovery or just for debugging, it is often helpful to include some of the state that caused the error in the error. One way to do this is to put it in the message, but this has a few problems:

- Even if the error is later handled and recovered from, we spend time stringifying the state to add it to the error message.
- Error monitoring systems often look at the message when trying to group similar errors together, and they can get confused by the ever-changing messages.
- When using structured logging, you lose the ability to easily query or filter the logs based on the state; instead clever regexes may be required to get it out of the messages.

Instead, `OError`s (and subclasses) support an `info` object that can contain arbitrary data. Using `info`, we might write the above example as:

```js
class UserNotFoundError extends OError {
  constructor(userId) {
    super('user not found', { userId })
  }
}

try {
  throw new UserNotFoundError(123)
} catch (error) {
  console.error(OError.getFullStack(error))
  console.error(OError.getFullInfo(error))
}
```

```
UserNotFoundError: user not found
    at repl:2:9
    ...
{ userId: 123 }
```

The `OError.getFullInfo` helper merges the `info` on custom errors and any info added with `OError.tag` on its way up the stack. It is intended for use when logging errors. If trying to recover from an error that is known to be a `UserNotFoundError`, it is usually better to interrogate `error.info.userId` directly.

### Wrapping an Internal Error

Detecting a condition like 'user not found' in the example above often starts with an internal database error. It is possible to just let the internal database error propagate all the way up through the stack, but this makes the code more coupled to the internals of the database (or database driver). It is often cleaner to handle and wrap the internal error in one that is under your control. Tying up the examples above:

```js
async function sayHi5(userId) {
  try {
    const user = await demoDatabase.findUserAsync(userId)
    return `Hi ${user.name}`
  } catch (error) {
    if (error.message === 'not found') {
      throw new UserNotFoundError(userId).withCause(error)
    }
  }
}

async function main() {
  try {
    await sayHi5(43)
  } catch (error) {
    OError.tag(error, 'failed to say hi')
    console.error(OError.getFullStack(error))
    console.error(OError.getFullInfo(error))
  }
}
main()
```

The output includes the wrapping error, the tag and the cause, together with the info:

```
UserNotFoundError: user not found
    at sayHi5 (repl:7:13)
    at process._tickCallback (internal/process/next_tick.js:68:7)
TaggedError: failed to say hi
    at main (repl:5:12)
    at process._tickCallback (internal/process/next_tick.js:68:7)
caused by:
    Error: not found
        at process.nextTick (repl:8:18)
        at process._tickCallback (internal/process/next_tick.js:61:11)
{ userId: 43 }
```

## OError API Reference

<a name="OError"></a>
* [OError](#OError)
    * [new OError(message, [info], [cause])](#new_OError_new)
    * _instance_
        * [.withInfo(info)](#OError+withInfo) ⇒ <code>this</code>
        * [.withCause(cause)](#OError+withCause) ⇒ <code>this</code>
    * _static_
        * [.maxTags](#OError.maxTags) : <code>Number</code>
        * [.tag(error, [message], [info])](#OError.tag) ⇒ <code>Error</code>
        * [.getFullInfo(error)](#OError.getFullInfo) ⇒ <code>Object</code>
        * [.getFullStack(error)](#OError.getFullStack) ⇒ <code>string</code>

<a name="new_OError_new"></a>

### new OError(message, [info], [cause])

| Param | Type | Description |
| --- | --- | --- |
| message | <code>string</code> | as for built-in Error |
| [info] | <code>Object</code> | extra data to attach to the error |
| [cause] | <code>Error</code> | the internal error that caused this error |

<a name="OError+withInfo"></a>

### oError.withInfo(info) ⇒ <code>this</code>
Set the extra info object for this error.

**Kind**: instance method of [<code>OError</code>](#OError)  

| Param | Type | Description |
| --- | --- | --- |
| info | <code>Object</code> | extra data to attach to the error |

<a name="OError+withCause"></a>

### oError.withCause(cause) ⇒ <code>this</code>
Wrap the given error, which caused this error.

**Kind**: instance method of [<code>OError</code>](#OError)  

| Param | Type | Description |
| --- | --- | --- |
| cause | <code>Error</code> | the internal error that caused this error |

<a name="OError.maxTags"></a>

### OError.maxTags : <code>Number</code>
Maximum number of tags to apply to any one error instance. This is to avoid
a resource leak in the (hopefully unlikely) case that a singleton error
instance is returned to many callbacks. If tags have been dropped, the full
stack trace will include a placeholder tag `... dropped tags`.

Defaults to 100. Must be at least 1.

**Kind**: static property of [<code>OError</code>](#OError)  
<a name="OError.tag"></a>

### OError.tag(error, [message], [info]) ⇒ <code>Error</code>
Tag debugging information onto any error (whether an OError or not) and
return it.

**Kind**: static method of [<code>OError</code>](#OError)  
**Returns**: <code>Error</code> - the modified `error` argument  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>Error</code> | the error to tag |
| [message] | <code>string</code> | message with which to tag `error` |
| [info] | <code>Object</code> | extra data with wich to tag `error` |

**Example** *(An error in a callback)*  
```js
function findUser(name, callback) {
  fs.readFile('/etc/passwd', (err, data) => {
    if (err) return callback(OError.tag(err, 'failed to read passwd'))
    // ...
  })
}
```
**Example** *(A possible error in a callback)*  
```js
function cleanup(callback) {
  fs.unlink('/tmp/scratch', (err) => callback(err && OError.tag(err)))
}
```
**Example** *(An error with async/await)*  
```js
async function cleanup() {
  try {
    await fs.promises.unlink('/tmp/scratch')
  } catch (err) {
    throw OError.tag(err, 'failed to remove scratch file')
  }
}
```
<a name="OError.getFullInfo"></a>

### OError.getFullInfo(error) ⇒ <code>Object</code>
The merged info from any `tag`s and causes on the given error.

If an info property is repeated, the last one wins.

**Kind**: static method of [<code>OError</code>](#OError)  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>Error</code> \| <code>null</code> \| <code>undefined</code> | any error (may or may not be an `OError`) |

<a name="OError.getFullStack"></a>

### OError.getFullStack(error) ⇒ <code>string</code>
Return the `stack` property from `error`, including the `stack`s for any
tagged errors added with `OError.tag` and for any `cause`s.

**Kind**: static method of [<code>OError</code>](#OError)  

| Param | Type | Description |
| --- | --- | --- |
| error | <code>Error</code> \| <code>null</code> \| <code>undefined</code> | any error (may or may not be an `OError`) |
<!-- END API REFERENCE -->

## References

- [MDN: Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)
- [Error Handling in Node.js](https://www.joyent.com/node-js/production/design/errors)
- [verror](https://github.com/joyent/node-verror)
- [Custom JavaScript Errors in ES6](https://medium.com/@xjamundx/custom-javascript-errors-in-es6-aa891b173f87)
- [Custom errors, extending Error](https://javascript.info/custom-errors)
- https://gist.github.com/justmoon/15511f92e5216fa2624b (some tests are based largely on this gist)
