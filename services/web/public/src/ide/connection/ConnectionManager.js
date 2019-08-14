/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

define([], function() {
  let ConnectionManager
  const ONEHOUR = 1000 * 60 * 60
  return (ConnectionManager = (function() {
    ConnectionManager = class ConnectionManager {
      static initClass() {
        this.prototype.disconnectAfterMs = ONEHOUR * 24

        this.prototype.lastUserAction = new Date()

        this.prototype.MIN_RETRY_INTERVAL = 1000 // ms, rate limit on reconnects for user clicking "try now"
        this.prototype.BACKGROUND_RETRY_INTERVAL = 5 * 1000

        this.prototype.RECONNECT_GRACEFULLY_RETRY_INTERVAL = 5000 // ms
        this.prototype.MAX_RECONNECT_GRACEFULLY_INTERVAL = 60 * 5 * 1000
      }

      constructor(ide, $scope) {
        this.ide = ide
        this.$scope = $scope
        this.wsUrl = ide.wsUrl || null // websocket url (if defined)
        if (typeof io === 'undefined' || io === null) {
          console.error(
            'Socket.io javascript not loaded. Please check that the real-time service is running and accessible.'
          )
          this.ide.socket = { on() {} }
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

        this.$scope.connection = {
          reconnecting: false,
          // If we need to force everyone to reload the editor
          forced_disconnect: false,
          inactive_disconnect: false
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
          if (!this.connected && e.target.id !== 'try-reconnect-now-button') {
            // user is editing, try to reconnect
            return this.tryReconnectWithRateLimit()
          }
        })

        this.ide.socket = io.connect(
          this.wsUrl,
          {
            reconnect: false,
            'connect timeout': 30 * 1000,
            'force new connection': true
          }
        )

        // handle network-level websocket errors (e.g. failed dns lookups)

        let connectionErrorHandler = err => {
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
          // remove connection error handler when connected, avoid unwanted fallbacks
          this.ide.socket.removeListener('error', connectionErrorHandler)
          return sl_console.log('[socket.io connect] Connected')
        })

        // The next event we should get is an authentication response
        // from the server, either "connectionAccepted" or
        // "connectionRejected".

        this.ide.socket.on('connectionAccepted', message => {
          sl_console.log('[socket.io connectionAccepted] allowed to connect')
          this.connected = true
          this.gracefullyReconnecting = false
          this.ide.pushEvent('connected')

          this.$scope.$apply(() => {
            this.$scope.connection.reconnecting = false
            this.$scope.connection.inactive_disconnect = false
            if (this.$scope.state.loading) {
              return (this.$scope.state.load_progress = 70)
            }
          })

          // we have passed authentication so we can now join the project
          return setTimeout(() => {
            return this.joinProject()
          }, 100)
        })

        this.ide.socket.on('connectionRejected', err => {
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

          this.$scope.$apply(() => {
            return (this.$scope.connection.reconnecting = false)
          })

          if (
            !this.$scope.connection.forced_disconnect &&
            !this.userIsInactive &&
            !this.gracefullyReconnecting
          ) {
            return this.startAutoReconnectCountdown()
          }
        })

        // Site administrators can send the forceDisconnect event to all users

        this.ide.socket.on('forceDisconnect', message => {
          this.$scope.$apply(() => {
            this.$scope.permissions.write = false
            return (this.$scope.connection.forced_disconnect = true)
          })
          this.ide.socket.disconnect()
          this.ide.showGenericMessageModal(
            'Please Refresh',
            `\
We're performing maintenance on Overleaf and you need to refresh the editor.
Sorry for any inconvenience.
The editor will refresh in automatically in 10 seconds.\
`
          )
          return setTimeout(() => location.reload(), 10 * 1000)
        })

        this.ide.socket.on('reconnectGracefully', () => {
          sl_console.log('Reconnect gracefully')
          return this.reconnectGracefully()
        })
      }

      // Error reporting, which can reload the page if appropriate

      reportConnectionError(err) {
        sl_console.log('[socket.io] reporting connection error')
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

      joinProject() {
        sl_console.log('[joinProject] joining...')
        // Note: if the "joinProject" message doesn't reach the server
        // (e.g. if we are in a disconnected state at this point) the
        // callback will never be executed
        const data = {
          project_id: this.ide.project_id
        }
        if (window.anonymousAccessToken) {
          data.anonymousAccessToken = window.anonymousAccessToken
        }
        return this.ide.socket.emit(
          'joinProject',
          data,
          (err, project, permissionsLevel, protocolVersion) => {
            if (err != null || project == null) {
              return this.reportConnectionError(err)
            }

            if (
              this.$scope.protocolVersion != null &&
              this.$scope.protocolVersion !== protocolVersion
            ) {
              location.reload(true)
            }

            return this.$scope.$apply(() => {
              this.$scope.protocolVersion = protocolVersion
              this.$scope.project = project
              this.$scope.permissionsLevel = permissionsLevel
              this.$scope.state.load_progress = 100
              this.$scope.state.loading = false
              return this.$scope.$broadcast('project:joined')
            })
          }
        )
      }

      reconnectImmediately() {
        this.disconnect()
        return this.tryReconnect()
      }

      disconnect() {
        if (this.ide.socket.socket && !this.ide.socket.socket.connected) {
          sl_console.log(
            '[socket.io] skipping disconnect because socket.io has not connected'
          )
          return
        }
        sl_console.log('[socket.io] disconnecting client')
        return this.ide.socket.disconnect()
      }

      startAutoReconnectCountdown() {
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
          return (this.$scope.connection.reconnection_countdown = countdown)
        })

        return setTimeout(() => {
          if (!this.connected) {
            return (this.timeoutId = setTimeout(
              () => this.decreaseCountdown(),
              1000
            ))
          }
        }, 200)
      }

      cancelReconnect() {
        // clear timeout and set to null so we know there is no countdown running
        if (this.timeoutId != null) {
          sl_console.log(
            '[ConnectionManager] cancelling existing reconnect timer'
          )
          clearTimeout(this.timeoutId)
          return (this.timeoutId = null)
        }
      }

      decreaseCountdown() {
        this.timeoutId = null
        if (this.$scope.connection.reconnection_countdown == null) {
          return
        }
        sl_console.log(
          '[ConnectionManager] decreasing countdown',
          this.$scope.connection.reconnection_countdown
        )
        this.$scope.$apply(() => {
          return this.$scope.connection.reconnection_countdown--
        })

        if (this.$scope.connection.reconnection_countdown <= 0) {
          return this.$scope.$apply(() => {
            return this.tryReconnect()
          })
        } else {
          return (this.timeoutId = setTimeout(
            () => this.decreaseCountdown(),
            1000
          ))
        }
      }

      tryReconnect() {
        sl_console.log('[ConnectionManager] tryReconnect')
        this.cancelReconnect()
        delete this.$scope.connection.reconnection_countdown
        if (this.connected) {
          return
        }
        this.$scope.connection.reconnecting = true
        // use socket.io connect() here to make a single attempt, the
        // reconnect() method makes multiple attempts
        this.ide.socket.socket.connect()
        // record the time of the last attempt to connect
        this.lastConnectionAttempt = new Date()
        return setTimeout(() => {
          if (!this.connected) {
            return this.startAutoReconnectCountdown()
          }
        }, 2000) // ms, rate limit on reconnects for other user activity (e.g. cursor moves)
      }

      tryReconnectWithRateLimit(options) {
        // bail out if the reconnect is already in progress
        if (
          this.$scope.connection != null
            ? this.$scope.connection.reconnecting
            : undefined
        ) {
          return
        }
        // bail out if we are going to reconnect soon anyway
        const reconnectingSoon =
          (this.$scope.connection != null
            ? this.$scope.connection.reconnection_countdown
            : undefined) != null &&
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
          return
        }
        return this.tryReconnect()
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
      reconnectGracefully() {
        if (this.reconnectGracefullyStarted == null) {
          this.reconnectGracefullyStarted = new Date()
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
          return this._reconnectGracefullyNow()
        } else {
          sl_console.log(
            '[reconnectGracefully] User is working, will try again in 5 seconds'
          )
          return setTimeout(() => {
            return this.reconnectGracefully()
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
  })())
})
