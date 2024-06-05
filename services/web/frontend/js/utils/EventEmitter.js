// Simple event emitter implementation, but has a slightly unusual API for
// removing specific listeners. If a specific listener needs to be removed
// (instead of all listeners), then it needs to use a "namespace":
// Create a listener on the foo event with bar namespace: .on 'foo.bar'
// Trigger all events for the foo event (including namespaces): .trigger 'foo'
// Remove all listeners for the foo event (including namespaces): .off 'foo'
// Remove a listener for the foo event with the bar namespace: .off 'foo.bar'

export default class EventEmitter {
  constructor() {
    this.events = {}
  }

  on(event, callback) {
    if (!this.events) {
      this.events = {}
    }
    let namespace
    ;[event, namespace] = Array.from(event.split('.'))
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push({
      callback,
      namespace,
    })
  }

  off(event, cb) {
    if (!this.events) {
      this.events = {}
    }
    if (event) {
      let namespace
      ;[event, namespace] = event.split('.')
      if (!this.events[event]) {
        this.events[event] = []
      }
      if (cb) {
        this.events[event] = this.events[event].filter(e => e.callback !== cb)
      } else if (!namespace) {
        // Clear all listeners for event
        delete this.events[event]
      } else {
        // Clear only namespaced listeners
        this.events[event] = this.events[event].filter(
          e => e.namespace !== namespace
        )
      }
    } else {
      // Remove all listeners
      this.events = {}
    }
  }

  trigger(event, ...args) {
    if (!this.events) {
      this.events = {}
    }
    if (this.events[event]) {
      this.events[event].forEach(e => e.callback(...args))
    }
  }

  emit(...args) {
    this.trigger(...args)
  }
}
