// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// A synchronous processing queue. The queue calls process on the arguments,
// ensuring that process() is only executing once at a time.
//
// process(data, callback) _MUST_ eventually call its callback.
//
// Example:
//
// queue = require 'syncqueue'
//
// fn = queue (data, callback) ->
//     asyncthing data, ->
//         callback(321)
//
// fn(1)
// fn(2)
// fn(3, (result) -> console.log(result))
//
//   ^--- async thing will only be running once at any time.

module.exports = function (process) {
  if (typeof process !== 'function') {
    throw new Error('process is not a function')
  }
  const queue = []

  const enqueue = function (data, callback) {
    queue.push([data, callback])
    return flush()
  }

  enqueue.busy = false

  function flush() {
    if (enqueue.busy || queue.length === 0) {
      return
    }

    enqueue.busy = true
    const [data, callback] = Array.from(queue.shift())
    return process(data, function (...result) {
      // TODO: Make this not use varargs - varargs are really slow.
      enqueue.busy = false
      // This is called after busy = false so a user can check if enqueue.busy is set in the callback.
      if (callback) {
        callback.apply(null, result)
      }
      return flush()
    })
  }

  return enqueue
}
