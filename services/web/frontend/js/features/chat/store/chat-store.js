import EventEmitter from '../../../utils/EventEmitter'
import { appendMessage, prependMessages } from './message-list-appender'
import { getJSON, postJSON } from '../../../infrastructure/fetch-json'

export const MESSAGE_LIMIT = 50

export class ChatStore {
  constructor() {
    this.messages = []
    this.loading = false
    this.atEnd = false

    this._nextBeforeTimestamp = null
    this._justSent = false

    this._emitter = new EventEmitter()

    window._ide.socket.on('new-chat-message', message => {
      const messageIsFromSelf =
        message && message.user && message.user.id === window.user.id
      if (!messageIsFromSelf || !this._justSent) {
        this.messages = appendMessage(this.messages, message)
        this._emitter.emit('updated')
        this._emitter.emit('message-received', message)
        window.dispatchEvent(
          new CustomEvent('Chat.MessageReceived', { detail: { message } })
        )
      }
      this._justSent = false
    })
  }

  on(event, fn) {
    this._emitter.on(event, fn)
  }

  off(event, fn) {
    this._emitter.off(event, fn)
  }

  loadMoreMessages() {
    if (this.atEnd) {
      return
    }

    this.loading = true
    this._emitter.emit('updated')

    let url = `/project/${window.project_id}/messages?limit=${MESSAGE_LIMIT}`
    if (this._nextBeforeTimestamp) {
      url += `&before=${this._nextBeforeTimestamp}`
    }

    return getJSON(url).then(response => {
      const messages = response || []
      this.loading = false
      if (messages.length < MESSAGE_LIMIT) {
        this.atEnd = true
      }
      messages.reverse()
      this.messages = prependMessages(this.messages, messages)
      this._nextBeforeTimestamp = this.messages[0]
        ? this.messages[0].timestamp
        : undefined
      this._emitter.emit('updated')
    })
  }

  sendMessage(message) {
    if (!message) {
      return
    }
    const body = {
      content: message,
      _csrf: window.csrfToken
    }
    this._justSent = true
    this.messages = appendMessage(this.messages, {
      user: window.user,
      content: message,
      timestamp: Date.now()
    })
    const url = `/project/${window.project_id}/messages`
    this._emitter.emit('updated')
    return postJSON(url, { body })
  }
}
