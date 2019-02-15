/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'ide/colors/ColorManager',
  'libs/md5',
  'ide/online-users/controllers/OnlineUsersController'
], function(ColorManager) {
  let OnlineUsersManager
  return (OnlineUsersManager = (function() {
    OnlineUsersManager = class OnlineUsersManager {
      static initClass() {
        this.prototype.cursorUpdateInterval = 500
      }

      constructor(ide, $scope) {
        this.ide = ide
        this.$scope = $scope
        this.$scope.onlineUsers = {}
        this.$scope.onlineUserCursorHighlights = {}
        this.$scope.onlineUsersArray = []

        this.$scope.$on('cursor:editor:update', (event, position) => {
          return this.sendCursorPositionUpdate(position)
        })

        this.$scope.$on('project:joined', () => {
          return this.ide.socket.emit(
            'clientTracking.getConnectedUsers',
            (error, connectedUsers) => {
              this.$scope.onlineUsers = {}
              for (let user of Array.from(connectedUsers || [])) {
                if (user.client_id === this.ide.socket.socket.sessionid) {
                  // Don't store myself
                  continue
                }
                // Store data in the same format returned by clientTracking.clientUpdated

                this.$scope.onlineUsers[user.client_id] = {
                  id: user.client_id,
                  user_id: user.user_id,
                  email: user.email,
                  name: `${user.first_name} ${user.last_name}`,
                  doc_id:
                    user.cursorData != null
                      ? user.cursorData.doc_id
                      : undefined,
                  row:
                    user.cursorData != null ? user.cursorData.row : undefined,
                  column:
                    user.cursorData != null ? user.cursorData.column : undefined
                }
              }
              return this.refreshOnlineUsers()
            }
          )
        })

        this.ide.socket.on('clientTracking.clientUpdated', client => {
          if (client.id !== this.ide.socket.socket.sessionid) {
            // Check it's not me!
            return this.$scope.$apply(() => {
              this.$scope.onlineUsers[client.id] = client
              return this.refreshOnlineUsers()
            })
          }
        })

        this.ide.socket.on('clientTracking.clientDisconnected', client_id => {
          return this.$scope.$apply(() => {
            delete this.$scope.onlineUsers[client_id]
            return this.refreshOnlineUsers()
          })
        })

        this.$scope.getHueForUserId = user_id => {
          return ColorManager.getHueForUserId(user_id)
        }
      }

      refreshOnlineUsers() {
        this.$scope.onlineUsersArray = []

        for (var client_id in this.$scope.onlineUsers) {
          const user = this.$scope.onlineUsers[client_id]
          if (user.doc_id != null) {
            user.doc = this.ide.fileTreeManager.findEntityById(user.doc_id)
          }

          // If the user's name is empty use their email as display name
          // Otherwise they're probably an anonymous user
          if (user.name === null || user.name.trim().length === 0) {
            if (user.email) {
              user.name = user.email.trim()
            } else if (user.user_id === 'anonymous-user') {
              user.name = 'Anonymous'
            }
          }

          user.initial = user.name != null ? user.name[0] : undefined
          if (!user.initial || user.initial === ' ') {
            user.initial = '?'
          }

          this.$scope.onlineUsersArray.push(user)
        }

        this.$scope.onlineUserCursorHighlights = {}
        for (client_id in this.$scope.onlineUsers) {
          const client = this.$scope.onlineUsers[client_id]
          const { doc_id } = client
          if (doc_id == null || client.row == null || client.column == null) {
            continue
          }
          if (!this.$scope.onlineUserCursorHighlights[doc_id]) {
            this.$scope.onlineUserCursorHighlights[doc_id] = []
          }
          this.$scope.onlineUserCursorHighlights[doc_id].push({
            label: client.name,
            cursor: {
              row: client.row,
              column: client.column
            },
            hue: ColorManager.getHueForUserId(client.user_id)
          })
        }

        if (this.$scope.onlineUsersArray.length > 0) {
          delete this.cursorUpdateTimeout
          return (this.cursorUpdateInterval = 500)
        } else {
          delete this.cursorUpdateTimeout
          return (this.cursorUpdateInterval = 60 * 1000 * 5)
        }
      }

      sendCursorPositionUpdate(position) {
        if (position != null) {
          this.$scope.currentPosition = position // keep track of the latest position
        }
        if (this.cursorUpdateTimeout == null) {
          return (this.cursorUpdateTimeout = setTimeout(() => {
            const doc_id = this.$scope.editor.open_doc_id
            // always send the latest position to other clients
            this.ide.socket.emit('clientTracking.updatePosition', {
              row:
                this.$scope.currentPosition != null
                  ? this.$scope.currentPosition.row
                  : undefined,
              column:
                this.$scope.currentPosition != null
                  ? this.$scope.currentPosition.column
                  : undefined,
              doc_id
            })

            return delete this.cursorUpdateTimeout
          }, this.cursorUpdateInterval))
        }
      }
    }
    OnlineUsersManager.initClass()
    return OnlineUsersManager
  })())
})
