/* global io */

import { debugConsole } from '@/utils/debugging'
import EventEmitter from '@/utils/EventEmitter'

class SocketShimBase {
  // unused vars kept to document the interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static connect(url, options) {
    return new SocketShimBase()
  }

  constructor(socket) {
    this._socket = socket
  }

  forceDisconnectWithoutEvent() {}
}
const transparentMethods = [
  'connect',
  'disconnect',
  'emit',
  'on',
  'removeListener',
]
for (const method of transparentMethods) {
  SocketShimBase.prototype[method] = function () {
    this._socket[method].apply(this._socket, arguments)
  }
}

class SocketShimNoop extends SocketShimBase {
  static connect() {
    return new SocketShimNoop()
  }

  constructor(socket) {
    super(socket)
    this.socket = {
      get connected() {
        return false
      },
      get sessionid() {
        return undefined
      },
      get transport() {
        return {}
      },

      connect() {},
      // unused vars kept to document the interface
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disconnect(reason) {},
    }
  }

  connect() {}
  // unused vars kept to document the interface
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  disconnect(reason) {}
  emit() {}
  on() {}
  removeListener() {}
}

class SocketShimV0 extends SocketShimBase {
  static connect(url, options) {
    return new SocketShimV0(io.connect(url, options))
  }

  constructor(socket) {
    super(socket)
    this.socket = this._socket.socket
    const self = this
    Object.defineProperty(this.socket, 'transport', {
      get() {
        return self._transport
      },
      set(v) {
        self.forceDisconnectWithoutEvent()
        self._transport = v
      },
    })
  }

  forceDisconnectWithoutEvent() {
    clearTimeout(this.socket.heartbeatTimeoutTimer)
    if (this._transport) this.forceCloseTransport(this._transport)
  }

  forceCloseTransport(transport) {
    transport.clearTimeouts()
    if (transport instanceof io.Transport.websocket) {
      // retry closing
      transport.websocket.onopen = transport.websocket.onmessage = () =>
        transport.websocket.close()
      // mute close/error handler
      transport.websocket.onclose = transport.websocket.onerror = () => {}
      // disconnect
      try {
        transport.websocket.close()
      } catch {}
    } else if (transport instanceof io.Transport['xhr-polling']) {
      // mute data/close handler and block new polling GET requests
      transport.onData = transport.onClose = transport.get = () => {}
      // abort pending long-polling/POST request
      for (const xhr of [transport.xhr, transport.sendXHR]) {
        if (!xhr) continue // not pending
        // mute xhr callbacks
        xhr.onreadystatechange = xhr.onload = xhr.onerror = () => {}
        try {
          xhr.abort()
        } catch {}
      }
      transport.xhr = transport.sendXHR = null
      // Mark long-polling client as disconnected to avoid "ghost" connected client.
      fetch(transport.prepareUrl() + '/?disconnect=1', {
        // Let the request continue after navigating away from or reloading the page.
        keepalive: true,
      })
        // Avoid leaving a dangling response on the wire.
        .then(res => res.text())
        .catch(() => {})
    } else {
      try {
        transport.close()
      } catch {}
      debugConsole.warn('unexpected socket.io transport', transport)
    }
  }
}

class SocketShimV2 extends SocketShimBase {
  static connect(url, options) {
    options.forceNew = options['force new connection']
    // .resource has no leading slash, path wants to see one.
    options.path = '/' + options.resource
    options.reconnection = options.reconnect
    options.timeout = options['connect timeout']
    return new SocketShimV2(url, options)
  }

  static get EVENT_MAP() {
    // Use the v2 event names transparently to the frontend.
    const connectionFailureEvents = [
      'connect_error',
      'connect_timeout',
      'error',
    ]
    return new Map([
      ['connect_failed', connectionFailureEvents],
      ['error', connectionFailureEvents],
    ])
  }

  _on(event, handler) {
    // Keep track of our event listeners.
    // We move them to a new socket in ._replaceSocketWithNewInstance()
    if (!this._events.has(event)) {
      this._events.set(event, [handler])
    } else {
      this._events.get(event).push(handler)
    }
    this._socket.on(event, handler)
  }

  on(event, handler) {
    if (SocketShimV2.EVENT_MAP.has(event)) {
      for (const v2Event of SocketShimV2.EVENT_MAP.get(event)) {
        this._on(v2Event, handler)
      }
    } else {
      this._on(event, handler)
    }
  }

  _removeListener(event, handler) {
    // Keep track of our event listeners.
    // We move them to a new socket in ._replaceSocketWithNewInstance()
    if (this._events.has(event)) {
      const listeners = this._events.get(event)
      const pos = listeners.indexOf(handler)
      if (pos !== -1) {
        listeners.splice(pos, 1)
      }
    }
    this._socket.removeListener(event, handler)
  }

  removeListener(event, handler) {
    if (SocketShimV2.EVENT_MAP.has(event)) {
      for (const v2Event of SocketShimV2.EVENT_MAP.get(event)) {
        this._removeListener(v2Event, handler)
      }
    } else {
      this._removeListener(event, handler)
    }
  }

  static createNewSocket(url, options) {
    // open a brand new connection for the default namespace '/'
    // The old socket can still leak 'disconnect' events from the teardown
    //  of the old transport. The leaking 'disconnect' events interfere with
    //  the _new_ connection and cancel the new connect attempt.
    // Also skip the caching in these locations:
    // - `io.connect()` caches `io.Manager`s in `io.managers`
    // - `io.Manager().socket()` caches `io.Socket`s in its `this.nsps`
    return io.Manager(url, options).socket('/', options)
  }

  _replaceSocketWithNewInstance() {
    const oldSocket = this._socket
    const newSocket = SocketShimV2.createNewSocket(this._url, this._options)

    // move our existing event handlers to the new socket
    this._events.forEach((listeners, event) => {
      for (const listener of listeners) {
        oldSocket.removeListener(event, listener)
        newSocket.on(event, listener)
      }
    })

    if (oldSocket.connected) {
      // We overwrite the reference to oldSocket soon.
      // Make sure we are disconnected.
      oldSocket.disconnect()
    }
    this._socket = newSocket
  }

  connect() {
    // have the same logic behind socket.connect and socket.socket.connect
    this._replaceSocketWithNewInstance()
  }

  constructor(url, options) {
    super(SocketShimV2.createNewSocket(url, options))
    this._url = url
    this._options = options
    this._events = new Map()

    const self = this
    function _getEngine() {
      return (self._socket.io && self._socket.io.engine) || {}
    }

    this.socket = {
      get connected() {
        return self._socket.connected
      },
      get sessionid() {
        if (self._socket.id) {
          return self._socket.id
        }
        // socket.id is discarded upon disconnect
        // the id is still available in the internal state
        return _getEngine().id
      },
      get transport() {
        return _getEngine().transport
      },

      connect() {
        self._replaceSocketWithNewInstance()
      },
      disconnect(reason) {
        return self._socket.disconnect(reason)
      },
    }
  }
}

let current
if (typeof io === 'undefined' || !io) {
  debugConsole.log('[socket.io] Shim: socket.io is not loaded, returning noop')
  current = SocketShimNoop
} else if (typeof io.version === 'string' && io.version.slice(0, 1) === '0') {
  debugConsole.log('[socket.io] Shim: detected v0')
  current = SocketShimV0
} else {
  // socket.io v2 does not have a global io.version attribute.
  debugConsole.log('[socket.io] Shim: detected v2')
  current = SocketShimV2
}

export class SocketIOMock extends SocketShimBase {
  constructor() {
    super(new EventEmitter())
    this.socket = {
      get connected() {
        return false
      },
      get sessionid() {
        return undefined
      },
      get transport() {
        return {}
      },
      get transports() {
        return []
      },

      connect() {},
      // unused vars kept to document the interface
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      disconnect(reason) {},
    }
  }

  addListener(event, listener) {
    this._socket.on(event, listener)
  }

  removeListener(event, listener) {
    this._socket.off(event, listener)
  }

  disconnect() {
    this.emitToClient('disconnect')
  }

  emitToClient(...args) {
    // Round-trip through JSON.parse/stringify to simulate (de-)serializing on network layer.
    this.emit(...JSON.parse(JSON.stringify(args)))
  }

  countEventListeners(event) {
    return this._socket.events[event].length
  }
}

export default {
  SocketShimNoop,
  SocketShimV0,
  SocketShimV2,
  current,
  connect: current.connect,
  stub: () => new SocketShimNoop(),
}
