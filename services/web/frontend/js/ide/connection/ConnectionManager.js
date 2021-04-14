// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

/* global io */

import SocketIoShim from './SocketIoShim'

let ConnectionManager
const ONEHOUR = 1000 * 60 * 60

export default ConnectionManager = (function () {
  ConnectionManager = class ConnectionManager {
    static initClass() {
      this.prototype.disconnectAfterMs = ONEHOUR * 24

      this.prototype.lastUserAction = new Date()

      this.prototype.MIN_RETRY_INTERVAL = 1000 // ms, rate limit on reconnects for user clicking "try now"
      this.prototype.BACKGROUND_RETRY_INTERVAL = 5 * 1000

      this.prototype.JOIN_PROJECT_RETRY_INTERVAL = 5000
      this.prototype.JOIN_PROJECT_MAX_RETRY_INTERVAL = 60000
      this.prototype.RECONNECT_GRACEFULLY_RETRY_INTERVAL = 5000 // ms
      this.prototype.MAX_RECONNECT_GRACEFULLY_INTERVAL = 45 * 1000
    }

    constructor(ide, $scope) {
      this.ide = ide
      this.$scope = $scope
      this.wsUrl = ide.wsUrl || null // websocket url (if defined)
      if (typeof io === 'undefined' || io === null) {
        if (this.wsUrl && !window.location.href.match(/ws=fallback/)) {
          // if we tried to boot from a custom real-time backend and failed,
          // try reloading and falling back to the siteUrl
          window.location = window.location.href + '?ws=fallback'
        }
        console.error(
          'Socket.io javascript not loaded. Please check that the real-time service is running and accessible.'
        )
        this.ide.socket = SocketIoShim.stub()
        this.$scope.$apply(() => {
          return (this.$scope.state.error =
            'Could not connect to websocket server :(')
        })
        return
      }

      setInterval(() => {
        return this.disconnectIfInactive()
      }, ONEHOUR)

      // trigger a reconnect immediately if network comes back online
      window.addEventListener('online', () => {
        sl_console.log('[online] browser notified online')
        if (!this.connected) {
          return this.tryReconnectWithRateLimit({ force: true })
        }
      })

      this.userIsLeavingPage = false
      window.addEventListener('beforeunload', () => {
        this.userIsLeavingPage = true
      }) // Don't return true or it will show a pop up

      this.connected = false
      this.userIsInactive = false
      this.gracefullyReconnecting = false
      this.shuttingDown = false

      this.joinProjectRetryInterval = this.JOIN_PROJECT_RETRY_INTERVAL

      this.$scope.connection = {
        debug: sl_debugging,
        reconnecting: false,
        stillReconnecting: false,
        // If we need to force everyone to reload the editor
        forced_disconnect: false,
        inactive_disconnect: false,
        jobId: 0
      }

      this.$scope.tryReconnectNow = () => {
        // user manually requested reconnection via "Try now" button
        return this.tryReconnectWithRateLimit({ force: true })
      }

      this.$scope.$on('cursor:editor:update', () => {
        this.lastUserAction = new Date() // time of last edit
        if (!this.connected) {
          // user is editing, try to reconnect
          return this.tryReconnectWithRateLimit()
        }
      })

      document.querySelector('body').addEventListener('click', e => {
        if (
          !this.shuttingDown &&
          !this.connected &&
          e.target.id !== 'try-reconnect-now-button'
        ) {
          // user is editing, try to reconnect
          return this.tryReconnectWithRateLimit()
        }
      })

      // initial connection attempt
      this.updateConnectionManagerState('connecting')
      let parsedURL
      try {
        parsedURL = new URL(this.wsUrl || '/socket.io', window.location)
      } catch (e) {
        // hello IE11
        if (
          this.wsUrl &&
          this.wsUrl.indexOf('/') !== 0 &&
          !window.location.href.match(/ws=fallback/)
        ) {
          // do not even try parsing the wsUrl, use the fallback
          window.location = window.location.href + '?ws=fallback'
        }
        parsedURL = {
          origin: null,
          pathname: this.wsUrl || '/socket.io'
        }
      }
      this.ide.socket = SocketIoShim.connect(parsedURL.origin, {
        resource: parsedURL.pathname.slice(1),
        reconnect: false,
        'connect timeout': 30 * 1000,
        'force new connection': true
      })

      // handle network-level websocket errors (e.g. failed dns lookups)

      let connectionAttempt = 1
      let connectionErrorHandler = err => {
        if (
          window.wsRetryHandshake &&
          connectionAttempt++ < window.wsRetryHandshake
        ) {
          return setTimeout(() => this.ide.socket.socket.connect(), 100)
        }
        this.updateConnectionManagerState('error')
        sl_console.log('socket.io error', err)
        if (this.wsUrl && !window.location.href.match(/ws=fallback/)) {
          // if we tried to load a custom websocket location and failed
          // try reloading and falling back to the siteUrl
          window.location = window.location.href + '?ws=fallback'
        } else {
          this.connected = false
          return this.$scope.$apply(() => {
            return (this.$scope.state.error =
              "Unable to connect, please view the <u><a href='/learn/Kb/Connection_problems'>connection problems guide</a></u> to fix the issue.")
          })
        }
      }
      this.ide.socket.on('error', connectionErrorHandler)

      // The "connect" event is the first event we get back. It only
      // indicates that the websocket is connected, we still need to
      // pass authentication to join a project.

      this.ide.socket.on('connect', () => {
        // state should be 'connecting'...
        // remove connection error handler when connected, avoid unwanted fallbacks
        this.ide.socket.removeListener('error', connectionErrorHandler)
        sl_console.log('[socket.io connect] Connected')
        this.updateConnectionManagerState('authenticating')
      })

      // The next event we should get is an authentication response
      // from the server, either "connectionAccepted" or
      // "connectionRejected".

      this.ide.socket.on('connectionAccepted', (_, publicId) => {
        this.ide.socket.publicId = publicId || this.ide.socket.socket.sessionid
        // state should be 'authenticating'...
        sl_console.log('[socket.io connectionAccepted] allowed to connect')
        this.connected = true
        this.gracefullyReconnecting = false
        this.ide.pushEvent('connected')
        this.updateConnectionManagerState('joining')

        this.$scope.$apply(() => {
          if (this.$scope.state.loading) {
            this.$scope.state.load_progress = 70
          }
        })

        // we have passed authentication so we can now join the project
        let connectionJobId = this.$scope.connection.jobId
        setTimeout(() => {
          this.joinProject(connectionJobId)
        }, 100)
      })

      this.ide.socket.on('connectionRejected', err => {
        // state should be 'authenticating'...
        sl_console.log(
          '[socket.io connectionRejected] session not valid or other connection error'
        )
        // real time sends a 'retry' message if the process was shutting down
        if (err && err.message === 'retry') {
          return this.tryReconnectWithRateLimit()
        }
        // we have failed authentication, usually due to an invalid session cookie
        return this.reportConnectionError(err)
      })

      // Alternatively the attempt to connect can fail completely, so
      // we never get into the "connect" state.

      this.ide.socket.on('connect_failed', () => {
        this.updateConnectionManagerState('error')
        this.connected = false
        return this.$scope.$apply(() => {
          return (this.$scope.state.error =
            "Unable to connect, please view the <u><a href='/learn/Kb/Connection_problems'>connection problems guide</a></u> to fix the issue.")
        })
      })

      // We can get a "disconnect" event at any point after the
      // "connect" event.

      this.ide.socket.on('disconnect', () => {
        sl_console.log('[socket.io disconnect] Disconnected')
        this.connected = false
        this.ide.pushEvent('disconnected')

        if (!this.$scope.connection.state.match(/^waiting/)) {
          if (
            !this.$scope.connection.forced_disconnect &&
            !this.userIsInactive &&
            !this.shuttingDown
          ) {
            this.startAutoReconnectCountdown()
          } else {
            this.updateConnectionManagerState('inactive')
          }
        }
      })

      // Site administrators can send the forceDisconnect event to all users

      this.ide.socket.on('forceDisconnect', (message, delay = 10) => {
        this.updateConnectionManagerState('inactive')
        this.shuttingDown = true // prevent reconnection attempts
        this.$scope.$apply(() => {
          this.$scope.permissions.write = false
          return (this.$scope.connection.forced_disconnect = true)
        })
        // flush changes before disconnecting
        this.ide.$scope.$broadcast('flush-changes')
        setTimeout(() => this.ide.socket.disconnect(), 1000)
        this.ide.showLockEditorMessageModal(
          'Please wait',
          `\
We're performing maintenance on Overleaf and you need to wait a moment.
Sorry for any inconvenience.
The editor will refresh automatically in ${delay} seconds.\
`
        )
        return setTimeout(() => location.reload(), delay * 1000)
      })

      this.ide.socket.on('reconnectGracefully', () => {
        sl_console.log('Reconnect gracefully')
        this.reconnectGracefully()
      })
    }

    updateConnectionManagerState(state) {
      this.$scope.$apply(() => {
        this.$scope.connection.jobId += 1
        let jobId = this.$scope.connection.jobId
        sl_console.log(
          `[updateConnectionManagerState ${jobId}] from ${this.$scope.connection.state} to ${state}`
        )
        this.$scope.connection.state = state

        this.$scope.connection.reconnecting = false
        this.$scope.connection.stillReconnecting = false
        this.$scope.connection.inactive_disconnect = false
        this.$scope.connection.joining = false
        this.$scope.connection.reconnection_countdown = null

        if (state === 'connecting') {
          // initial connection
        } else if (state === 'reconnecting') {
          // reconnection after a connection has failed
          this.stopReconnectCountdownTimer()
          this.$scope.connection.reconnecting = true
          // if reconnecting takes more than 1s (it doesn't, usually) show the
          // 'reconnecting...' warning
          setTimeout(() => {
            if (
              this.$scope.connection.reconnecting &&
              this.$scope.connection.jobId === jobId
            ) {
              this.$scope.connection.stillReconnecting = true
            }
          }, 1000)
        } else if (state === 'reconnectFailed') {
          // reconnect attempt failed
        } else if (state === 'authenticating') {
          // socket connection has been established, trying to authenticate
        } else if (state === 'joining') {
          // authenticated, joining project
          this.$scope.connection.joining = true
        } else if (state === 'ready') {
          // project has been joined
        } else if (state === 'waitingCountdown') {
          // disconnected and waiting to reconnect via the countdown timer
          this.stopReconnectCountdownTimer()
        } else if (state === 'waitingGracefully') {
          // disconnected and waiting to reconnect gracefully
          this.stopReconnectCountdownTimer()
        } else if (state === 'inactive') {
          // disconnected and not trying to reconnect (inactive)
        } else if (state === 'error') {
          // something is wrong
        } else {
          sl_console.log(
            `[WARN] [updateConnectionManagerState ${jobId}] got unrecognised state ${state}`
          )
        }
      })
    }

    expectConnectionManagerState(state, jobId) {
      if (
        this.$scope.connection.state === state &&
        (!jobId || jobId === this.$scope.connection.jobId)
      ) {
        return true
      }

      sl_console.log(
        `[WARN] [state mismatch] expected state ${state}${
          jobId ? '/' + jobId : ''
        } when in ${this.$scope.connection.state}/${
          this.$scope.connection.jobId
        }`
      )
      return false
    }

    // Error reporting, which can reload the page if appropriate

    reportConnectionError(err) {
      sl_console.log('[socket.io] reporting connection error')
      this.updateConnectionManagerState('error')
      if (
        (err != null ? err.message : undefined) === 'not authorized' ||
        (err != null ? err.message : undefined) === 'invalid session'
      ) {
        return (window.location = `/login?redir=${encodeURI(
          window.location.pathname
        )}`)
      } else {
        this.ide.socket.disconnect()
        return this.ide.showGenericMessageModal(
          'Something went wrong connecting',
          `\
Something went wrong connecting to your project. Please refresh if this continues to happen.\
`
        )
      }
    }

    joinProject(connectionId) {
      sl_console.log(`[joinProject ${connectionId}] joining...`)
      // Note: if the "joinProject" message doesn't reach the server
      // (e.g. if we are in a disconnected state at this point) the
      // callback will never be executed
      if (!this.expectConnectionManagerState('joining', connectionId)) {
        sl_console.log(
          `[joinProject ${connectionId}] aborting with stale connection`
        )
        return
      }
      const data = {
        project_id: this.ide.project_id
      }
      if (window.anonymousAccessToken) {
        data.anonymousAccessToken = window.anonymousAccessToken
      }
      this.ide.socket.emit(
        'joinProject',
        data,
        (err, project, permissionsLevel, protocolVersion) => {
          if (err != null || project == null) {
            err = err || {}
            if (err.code === 'ProjectNotFound') {
              // A stale browser tab tried to join a deleted project.
              // Reloading the page will render a 404.
              this.ide
                .showGenericMessageModal(
                  'Project has been deleted',
                  'This project has been deleted by the owner.'
                )
                .result.then(() => location.reload(true))
              return
            }
            if (err.code === 'TooManyRequests') {
              sl_console.log(
                `[joinProject ${connectionId}] retrying: ${err.message}`
              )
              setTimeout(
                () => this.joinProject(connectionId),
                this.joinProjectRetryInterval
              )
              if (
                this.joinProjectRetryInterval <
                this.JOIN_PROJECT_MAX_RETRY_INTERVAL
              ) {
                this.joinProjectRetryInterval += this.JOIN_PROJECT_RETRY_INTERVAL
              }
              return
            } else {
              return this.reportConnectionError(err)
            }
          }

          this.joinProjectRetryInterval = this.JOIN_PROJECT_RETRY_INTERVAL

          if (
            this.$scope.protocolVersion != null &&
            this.$scope.protocolVersion !== protocolVersion
          ) {
            location.reload(true)
          }

          this.$scope.$apply(() => {
            this.updateConnectionManagerState('ready')
            this.$scope.protocolVersion = protocolVersion
            const defaultProjectAttributes = { rootDoc_id: null }
            this.$scope.project = { ...defaultProjectAttributes, ...project }
            this.$scope.permissionsLevel = permissionsLevel
            this.ide.loadingManager.socketLoaded()
            this.$scope.$broadcast('project:joined')
          })
        }
      )
    }

    reconnectImmediately() {
      this.disconnect()
      return this.tryReconnect()
    }

    disconnect(options) {
      if (options && options.permanent) {
        sl_console.log('[disconnect] shutting down ConnectionManager')
        this.updateConnectionManagerState('inactive')
        this.shuttingDown = true // prevent reconnection attempts
      } else if (this.ide.socket.socket && !this.ide.socket.socket.connected) {
        sl_console.log(
          '[socket.io] skipping disconnect because socket.io has not connected'
        )
        return
      }
      sl_console.log('[socket.io] disconnecting client')
      return this.ide.socket.disconnect()
    }

    startAutoReconnectCountdown() {
      this.updateConnectionManagerState('waitingCountdown')
      let connectionId = this.$scope.connection.jobId
      let countdown
      sl_console.log('[ConnectionManager] starting autoreconnect countdown')
      const twoMinutes = 2 * 60 * 1000
      if (
        this.lastUserAction != null &&
        new Date() - this.lastUserAction > twoMinutes
      ) {
        // between 1 minute and 3 minutes
        countdown = 60 + Math.floor(Math.random() * 120)
      } else {
        countdown = 3 + Math.floor(Math.random() * 7)
      }

      if (this.userIsLeavingPage) {
        // user will have pressed refresh or back etc
        return
      }

      this.$scope.$apply(() => {
        this.$scope.connection.reconnecting = false
        this.$scope.connection.stillReconnecting = false
        this.$scope.connection.joining = false
        this.$scope.connection.reconnection_countdown = countdown
      })

      setTimeout(() => {
        if (!this.connected && !this.countdownTimeoutId) {
          this.countdownTimeoutId = setTimeout(
            () => this.decreaseCountdown(connectionId),
            1000
          )
        }
      }, 200)
    }

    stopReconnectCountdownTimer() {
      // clear timeout and set to null so we know there is no countdown running
      if (this.countdownTimeoutId != null) {
        sl_console.log(
          '[ConnectionManager] cancelling existing reconnect timer'
        )
        clearTimeout(this.countdownTimeoutId)
        this.countdownTimeoutId = null
      }
    }

    decreaseCountdown(connectionId) {
      this.countdownTimeoutId = null
      if (this.$scope.connection.reconnection_countdown == null) {
        return
      }
      if (
        !this.expectConnectionManagerState('waitingCountdown', connectionId)
      ) {
        sl_console.log(
          `[ConnectionManager] Aborting stale countdown ${connectionId}`
        )
        return
      }

      sl_console.log(
        '[ConnectionManager] decreasing countdown',
        this.$scope.connection.reconnection_countdown
      )
      this.$scope.$apply(() => {
        this.$scope.connection.reconnection_countdown--
      })

      if (this.$scope.connection.reconnection_countdown <= 0) {
        this.$scope.connection.reconnecting = false
        this.$scope.$apply(() => {
          this.tryReconnect()
        })
      } else {
        this.countdownTimeoutId = setTimeout(
          () => this.decreaseCountdown(connectionId),
          1000
        )
      }
    }

    tryReconnect() {
      sl_console.log('[ConnectionManager] tryReconnect')
      if (
        this.connected ||
        this.shuttingDown ||
        this.$scope.connection.reconnecting
      ) {
        return
      }
      this.updateConnectionManagerState('reconnecting')
      sl_console.log('[ConnectionManager] Starting new connection')

      const removeHandler = () => {
        this.ide.socket.removeListener('error', handleFailure)
        this.ide.socket.removeListener('connect', handleSuccess)
      }
      const handleFailure = () => {
        sl_console.log('[ConnectionManager] tryReconnect: failed')
        removeHandler()
        this.updateConnectionManagerState('reconnectFailed')
        this.tryReconnectWithRateLimit({ force: true })
      }
      const handleSuccess = () => {
        sl_console.log('[ConnectionManager] tryReconnect: success')
        removeHandler()
      }
      this.ide.socket.on('error', handleFailure)
      this.ide.socket.on('connect', handleSuccess)

      // use socket.io connect() here to make a single attempt, the
      // reconnect() method makes multiple attempts
      this.ide.socket.socket.connect()
      // record the time of the last attempt to connect
      this.lastConnectionAttempt = new Date()
    }

    tryReconnectWithRateLimit(options) {
      // bail out if the reconnect is already in progress
      if (this.$scope.connection.reconnecting || this.connected) {
        return
      }
      // bail out if we are going to reconnect soon anyway
      const reconnectingSoon =
        this.$scope.connection.reconnection_countdown != null &&
        this.$scope.connection.reconnection_countdown <= 5
      const clickedTryNow = options != null ? options.force : undefined // user requested reconnection
      if (reconnectingSoon && !clickedTryNow) {
        return
      }
      // bail out if we tried reconnecting recently
      const allowedInterval = clickedTryNow
        ? this.MIN_RETRY_INTERVAL
        : this.BACKGROUND_RETRY_INTERVAL
      if (
        this.lastConnectionAttempt != null &&
        new Date() - this.lastConnectionAttempt < allowedInterval
      ) {
        if (this.$scope.connection.state !== 'waitingCountdown') {
          this.startAutoReconnectCountdown()
        }
        return
      }
      this.tryReconnect()
    }

    disconnectIfInactive() {
      this.userIsInactive =
        new Date() - this.lastUserAction > this.disconnectAfterMs
      if (this.userIsInactive && this.connected) {
        this.disconnect()
        return this.$scope.$apply(() => {
          return (this.$scope.connection.inactive_disconnect = true)
        }) // 5 minutes
      }
    }

    reconnectGracefully(force) {
      if (this.reconnectGracefullyStarted == null) {
        this.reconnectGracefullyStarted = new Date()
      } else {
        if (!force) {
          sl_console.log(
            '[reconnectGracefully] reconnection is already in process, so skipping'
          )
          return
        }
      }
      const userIsInactive =
        new Date() - this.lastUserAction >
        this.RECONNECT_GRACEFULLY_RETRY_INTERVAL
      const maxIntervalReached =
        new Date() - this.reconnectGracefullyStarted >
        this.MAX_RECONNECT_GRACEFULLY_INTERVAL
      if (userIsInactive || maxIntervalReached) {
        sl_console.log(
          "[reconnectGracefully] User didn't do anything for last 5 seconds, reconnecting"
        )
        this._reconnectGracefullyNow()
      } else {
        sl_console.log(
          '[reconnectGracefully] User is working, will try again in 5 seconds'
        )
        this.updateConnectionManagerState('waitingGracefully')
        setTimeout(() => {
          this.reconnectGracefully(true)
        }, this.RECONNECT_GRACEFULLY_RETRY_INTERVAL)
      }
    }

    _reconnectGracefullyNow() {
      this.gracefullyReconnecting = true
      this.reconnectGracefullyStarted = null
      // Clear cookie so we don't go to the same backend server
      $.cookie('SERVERID', '', { expires: -1, path: '/' })
      return this.reconnectImmediately()
    }
  }
  ConnectionManager.initClass()
  return ConnectionManager
})()
