define [
	"libs/backbone"
	"models/message"
	"models/user"

], (Backbone, Message, User) ->

	Messages = Backbone.Collection.extend
		model: Message

		initialize: (models, options) ->
			{@chat, @room} = options

		fetchMoreMessages: (options = { preloading: false }, callback = (error) ->) ->
			limit = Messages.DEFAULT_MESSAGE_LIMIT

			@room.fetchMessages @_buildMessagesQuery(limit), (error, messages) =>
				if error?
					callback(error)
					return @chat.handleError(error)
				if messages.length < limit
					@trigger "noMoreMessages"
				@_parseAndAddMessages(messages, options)
				callback()

		_parseAndAddMessages: (messages, options) ->
			for message in messages
				user = User.findOrCreate message.user
				@add new Message(
					content   : message.content
					timestamp : message.timestamp
					user      : user
					preloaded : !!options.preloading
				), at: 0

		_buildMessagesQuery: (limit) ->
			query =
				limit: limit
			firstMessage = @at(0)
			if firstMessage?
				query.before = firstMessage.get("timestamp")
			return query
	Messages.DEFAULT_MESSAGE_LIMIT = 50

	return Messages