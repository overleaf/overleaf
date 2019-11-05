/* eslint-disable
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
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'crypto-js/md5'], (App, CryptoJS) =>
  App.factory('chatMessages', function($http, ide) {
    const MESSAGES_URL = `/project/${ide.project_id}/messages`
    const MESSAGE_LIMIT = 50
    const CONNECTED_USER_URL = `/project/${ide.project_id}/connected_users`

    const chat = {
      state: {
        messages: [],
        loading: false,
        atEnd: false,
        errored: false,
        nextBeforeTimestamp: null,
        newMessage: null
      }
    }

    let justSent = false
    ide.socket.on('new-chat-message', message => {
      if (
        __guard__(message != null ? message.user : undefined, x => x.id) ===
          ide.$scope.user.id &&
        justSent
      ) {
        // Nothing to do
      } else {
        ide.$scope.$apply(() => appendMessage(message))
      }
      return (justSent = false)
    })

    chat.sendMessage = function(message) {
      const body = {
        content: message,
        _csrf: window.csrfToken
      }
      justSent = true
      appendMessage({
        user: ide.$scope.user,
        content: message,
        timestamp: Date.now()
      })
      return $http.post(MESSAGES_URL, body)
    }

    chat.loadMoreMessages = function() {
      if (chat.state.atEnd) {
        return
      }
      if (chat.state.errored) {
        return
      }
      let url = MESSAGES_URL + `?limit=${MESSAGE_LIMIT}`
      if (chat.state.nextBeforeTimestamp != null) {
        url += `&before=${chat.state.nextBeforeTimestamp}`
      }
      chat.state.loading = true
      return $http.get(url).then(function(response) {
        const messages = response.data != null ? response.data : []
        chat.state.loading = false
        if (messages.length < MESSAGE_LIMIT) {
          chat.state.atEnd = true
        }
        if (messages.reverse == null) {
          if (typeof Raven !== 'undefined' && Raven !== null) {
            Raven.captureException(
              new Error(`messages has no reverse property ${typeof messages}`)
            )
          }
        }
        if (typeof messages.reverse !== 'function') {
          if (typeof Raven !== 'undefined' && Raven !== null) {
            Raven.captureException(
              new Error(
                `messages.reverse not a function ${typeof messages.reverse} ${typeof messages}`
              )
            )
          }
          return (chat.state.errored = true)
        } else {
          messages.reverse()
          prependMessages(messages)
          return (chat.state.nextBeforeTimestamp =
            chat.state.messages[0] != null
              ? chat.state.messages[0].timestamp
              : undefined)
        }
      })
    }

    const TIMESTAMP_GROUP_SIZE = 5 * 60 * 1000 // 5 minutes

    const prependMessage = function(message) {
      const firstMessage = chat.state.messages[0]
      const shouldGroup =
        firstMessage != null &&
        firstMessage.user.id ===
          __guard__(message != null ? message.user : undefined, x => x.id) &&
        firstMessage.timestamp - message.timestamp < TIMESTAMP_GROUP_SIZE
      if (shouldGroup) {
        firstMessage.timestamp = message.timestamp
        return firstMessage.contents.unshift(message.content)
      } else {
        return chat.state.messages.unshift({
          user: formatUser(message.user),
          timestamp: message.timestamp,
          contents: [message.content]
        })
      }
    }

    var prependMessages = messages =>
      Array.from(messages.slice(0).reverse()).map(message =>
        prependMessage(message)
      )

    var appendMessage = function(message) {
      chat.state.newMessage = message

      const lastMessage = chat.state.messages[chat.state.messages.length - 1]
      const shouldGroup =
        lastMessage != null &&
        lastMessage.user.id ===
          __guard__(message != null ? message.user : undefined, x => x.id) &&
        message.timestamp - lastMessage.timestamp < TIMESTAMP_GROUP_SIZE
      if (shouldGroup) {
        lastMessage.timestamp = message.timestamp
        return lastMessage.contents.push(message.content)
      } else {
        return chat.state.messages.push({
          user: formatUser(message.user),
          timestamp: message.timestamp,
          contents: [message.content]
        })
      }
    }

    var formatUser = function(user) {
      const hash = CryptoJS(user.email.toLowerCase())
      user.gravatar_url = `//www.gravatar.com/avatar/${hash}`
      return user
    }

    return chat
  }))
function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
