'use strict'

const _ = require('lodash')

const ChangeNote = require('./change_note')
const ChangeRequest = require('./change_request')
const Chunk = require('./chunk')
const Operation = require('./operation')

/**
 * Operational Transformation client.
 *
 * See OT.md for explanation.
 */
class OtClient {
  constructor(_projectId, _editor, _blobStore, _socket) {
    const STATE_DISCONNECTED = 0
    const STATE_LOADING = 1
    const STATE_READY = 2
    const STATE_WAITING = 3

    let _version = null
    let _state = STATE_DISCONNECTED
    const _buffer = []
    let _ackVersion = null
    let _outstanding = []
    let _pending = []
    const _waiting = []

    this.connect = function otClientConnect() {
      switch (_state) {
        case STATE_DISCONNECTED:
          _state = STATE_LOADING
          _socket.emit('authenticate', {
            projectId: _projectId,
            token: 'letmein',
          })
          break
        default:
          throw new Error('connect in state ' + _state)
      }
    }

    /**
     * The latest project version number for which the client can construct the
     * project content.
     *
     * @return {number} non-negative
     */
    this.getVersion = function () {
      return _version
    }

    _socket.on('load', function otClientOnLoad(data) {
      switch (_state) {
        case STATE_LOADING: {
          const chunk = Chunk.fromRaw(data)
          const snapshot = chunk.getSnapshot()
          snapshot.applyAll(chunk.getChanges(), { strict: true })
          _version = chunk.getEndVersion()
          // TODO: we can get remote changes here, so it's not correct to wait for
          // the editor to load before transitioning to the READY state
          _editor.load(snapshot).then(function () {
            _state = STATE_READY
          })
          break
        }
        default:
          throw new Error('loaded in state ' + _state)
      }
    })

    //
    // Local Operations
    //

    function sendOutstandingChange() {
      const changeRequest = new ChangeRequest(_version, _outstanding)
      _socket.emit('change', changeRequest.toRaw())
      _state = STATE_WAITING
    }

    function sendLocalOperation(operation) {
      _outstanding.push(operation)
      sendOutstandingChange()
    }

    function queueLocalOperation(operation) {
      _pending.push(operation)
    }

    this.handleLocalOperation = function otClientHandleLocalOperation(
      operation
    ) {
      switch (_state) {
        case STATE_READY:
          sendLocalOperation(operation)
          break
        case STATE_WAITING:
          queueLocalOperation(operation)
          break
        default:
          throw new Error('local operation in state ' + _state)
      }
    }

    /**
     * A promise that resolves when the project reaches the given version.
     *
     * @param {number} version non-negative
     * @return {Promise}
     */
    this.waitForVersion = function otClientWaitForVersion(version) {
      if (!_waiting[version]) _waiting[version] = []
      return new Promise(function (resolve, reject) {
        _waiting[version].push(resolve)
      })
    }

    function resolveWaitingPromises() {
      for (const version in _waiting) {
        if (!Object.prototype.hasOwnProperty.call(_waiting, version)) continue
        if (version > _version) continue
        _waiting[version].forEach(function (resolve) {
          resolve()
        })
        delete _waiting[version]
      }
    }

    //
    // Messages from Server
    //

    function advanceIfReady() {
      if (_ackVersion !== null && _version === _ackVersion) {
        _version += 1
        _ackVersion = null
        handleAckReady()
        advanceIfReady()
        return
      }
      const changeNotes = _.remove(_buffer, function (changeNote) {
        return changeNote.getBaseVersion() === _version
      })
      if (changeNotes.length === 1) {
        handleRemoteChangeReady(changeNotes[0].getChange())
        _version += 1
        advanceIfReady()
        return
      }
      if (changeNotes.length !== 0) {
        throw new Error('multiple remote changes in client version ' + _version)
      }
    }

    function bufferRemoteChangeNote(changeNote) {
      const version = changeNote.getBaseVersion()
      if (_.find(_buffer, 'baseVersion', version)) {
        throw new Error('multiple changes in version ' + version)
      }
      if (version === _ackVersion) {
        throw new Error('received change that was acked in ' + _ackVersion)
      }
      _buffer.push(changeNote)
    }

    function handleAckReady() {
      // console.log('handleAckReady')
      if (_outstanding.length === 0) {
        throw new Error('ack complete without outstanding change')
      }
      if (_state !== STATE_WAITING) {
        throw new Error('ack complete in state ' + _state)
      }
      _editor.handleChangeAcknowledged()
      resolveWaitingPromises()
      if (_pending.length > 0) {
        _outstanding = _pending
        _pending = []
        sendOutstandingChange()
      } else {
        _outstanding = []
        _state = STATE_READY
      }
    }

    function handleRemoteChangeReady(change) {
      if (_pending.length > 0) {
        if (_outstanding.length === 0) {
          throw new Error('pending change without outstanding change')
        }
      }

      Operation.transformMultiple(_outstanding, change.getOperations())
      Operation.transformMultiple(_pending, change.getOperations())

      _editor.applyRemoteChange(change)
    }

    _socket.on('ack', function otClientOnAck(data) {
      switch (_state) {
        case STATE_WAITING: {
          const changeNote = ChangeNote.fromRaw(data)
          _ackVersion = changeNote.getBaseVersion()
          advanceIfReady()
          break
        }
        default:
          throw new Error('ack in state ' + _state)
      }
    })

    _socket.on('change', function otClientOnChange(data) {
      switch (_state) {
        case STATE_READY:
        case STATE_WAITING:
          bufferRemoteChangeNote(ChangeNote.fromRaw(data))
          advanceIfReady()
          break
        default:
          throw new Error('remote change in state ' + _state)
      }
    })

    //
    // Connection State
    // TODO: socket.io error handling
    //

    _socket.on('disconnect', function () {
      _state = STATE_DISCONNECTED
      // eslint-disable-next-line no-console
      console.log('disconnected') // TODO: how do we handle disconnect?
    })
  }
}

module.exports = OtClient
