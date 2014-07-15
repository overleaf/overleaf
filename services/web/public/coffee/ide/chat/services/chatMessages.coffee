define [
	"base"
], (App) ->
	App.factory "chatMessages", ($http, ide) ->
		MESSAGES_URL = "/project/#{ide.project_id}/messages"
		MESSAGE_LIMIT = 3
		CONNECTED_USER_URL = "/project/#{ide.project_id}/connected_users"

		chat = {
			state:
				messages: []
				loading: false
				atEnd: false
				nextBeforeTimestamp: null
		}
			
		ide.socket.on "new-chat-message", (message) =>
			appendMessage(message)
			
		chat.loadMoreMessages = () ->
			return if chat.state.atEnd
			
			url = MESSAGES_URL + "?limit=#{MESSAGE_LIMIT}"
			if chat.state.nextBeforeTimestamp?
				url += "&before=#{chat.state.nextBeforeTimestamp}"
			
			chat.state.loading = true
			return $http
				.get(url)
				.success (messages = [])->
					chat.state.loading = false
					if messages.length < MESSAGE_LIMIT
						chat.state.atEnd = true
					messages.reverse()
					prependMessages(messages)
					chat.state.nextBeforeTimestamp = chat.state.messages[0]?.timestamp
					console.log messages, chat.state
		
		TIMESTAMP_GROUP_SIZE = 5 * 60 * 1000 # 5 minutes
		
		prependMessage = (message) ->
			firstMessage = chat.state.messages[0]
			shouldGroup = firstMessage? and
				firstMessage.user.id == message.user.id and
				firstMessage.timestamp - message.timestamp < TIMESTAMP_GROUP_SIZE
			if shouldGroup
				firstMessage.timestamp = message.timestamp
				firstMessage.contents.unshift message.content
			else
				chat.state.messages.unshift({
					user: message.user
					timestamp: message.timestamp
					contents: [message.content]
				})
				
		prependMessages = (messages) ->
			for message in messages.slice(0).reverse()
				prependMessage(message)
				
		appendMessage = (message) ->
			lastMessage = chat.state.messages[chat.state.messages.length - 1]
			shouldGroup = lastMessage? and
				lastMessage.user.id == message.user.id and
				message.timestamp - lastMessage.timestamp < TIMESTAMP_GROUP_SIZE
			if shouldGroup
				lastMessage.timestamp = message.timestamp
				lastMessage.contents.push message.content
			else
				chat.state.messages.push({
					user: message.user
					timestamp: message.timestamp
					contents: [message.content]
				})
					
		chat.sendMessage = (message) ->
			body = 
				content: message
				_csrf : window.csrfToken
			return $http.post(MESSAGES_URL, body)
					
		return chat