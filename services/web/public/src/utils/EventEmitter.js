/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([], function() {
  // Simple event emitter implementation, but has a slightly unusual API for
  // removing specific listeners. If a specific listener needs to be removed
  // (instead of all listeners), then it needs to use a "namespace":
  // Create a listener on the foo event with bar namespace: .on 'foo.bar'
  // Trigger all events for the foo event (including namespaces): .trigger 'foo'
  // Remove all listeners for the foo event (including namespaces): .off 'foo'
  // Remove a listener for the foo event with the bar namespace: .off 'foo.bar'
  let EventEmitter
  return (EventEmitter = class EventEmitter {
    on(event, callback) {
      let namespace
      if (!this.events) {
        this.events = {}
      }
      ;[event, namespace] = Array.from(event.split('.'))
      if (!this.events[event]) {
        this.events[event] = []
      }
      return this.events[event].push({
        callback,
        namespace
      })
    }

    off(event) {
      if (!this.events) {
        this.events = {}
      }
      if (event != null) {
        let namespace
        ;[event, namespace] = Array.from(event.split('.'))
        if (namespace == null) {
          // Clear all listeners for event
          return delete this.events[event]
        } else {
          // Clear only namespaced listeners
          const remaining_events = []
          for (let callback of Array.from(this.events[event] || [])) {
            if (callback.namespace !== namespace) {
              remaining_events.push(callback)
            }
          }
          return (this.events[event] = remaining_events)
        }
      } else {
        // Remove all listeners
        return (this.events = {})
      }
    }

    trigger(event, ...args) {
      if (!this.events) {
        this.events = {}
      }
      return Array.from(this.events[event] || []).map(callback =>
        callback.callback(...Array.from(args || []))
      )
    }

    emit(...args) {
      return this.trigger(...Array.from(args || []))
    }
  })
})
