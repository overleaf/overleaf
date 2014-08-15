UserFormatter = require "../Users/UserFormatter"

module.exports = MessageFormatter =
	formatMessageForClientSide: (message) ->
		if message._id?
			message.id = message._id.toString()
			delete message._id
		formattedMessage =
			id: message.id
			content: message.content
			timestamp: message.timestamp
			user: UserFormatter.formatUserForClientSide(message.user)
		return formattedMessage

	formatMessagesForClientSide: (messages) ->
		(@formatMessageForClientSide(message) for message in messages)
