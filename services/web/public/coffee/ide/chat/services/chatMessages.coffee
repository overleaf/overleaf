define [
	"base"
], (App) ->
	App.factory "chatMessages", ($http, ide) ->
		MESSAGES_URL = "/project/#{ide.project_id}/messages"
		MESSAGE_LIMIT = 50
		CONNECTED_USER_URL = "/project/#{ide.project_id}/connected_users"

		chat = {
			state:
				messages: []
				loading: false
				atEnd: false
				errored:false
				nextBeforeTimestamp: null
				newMessage: null
		}
		
		justSent = false	
		ide.socket.on "new-chat-message", (message) =>
			if message?.user?.id == ide.$scope.user.id and justSent
				# Nothing to do
			else
				ide.$scope.$apply () ->
					appendMessage(message)
			justSent = false
			
		chat.sendMessage = (message) ->
			body = 
				content: message
				_csrf : window.csrfToken
			justSent = true
			appendMessage({
				user: ide.$scope.user
				content: message
				timestamp: Date.now()
			})
			return $http.post(MESSAGES_URL, body)
			
		chat.loadMoreMessages = () ->
			return if chat.state.atEnd
			return if chat.state.errored
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
					if !messages.reverse?
						Raven?.captureException(new Error("messages has no reverse property #{JSON.stringify(messages)}"))
					if typeof messages.reverse isnt 'function'
						Raven?.captureException(new Error("messages.reverse not a function #{typeof(messages.reverse)} #{JSON.stringify(messages)}"))
						chat.state.errored = true
					else
						messages.reverse()
						prependMessages(messages)
						chat.state.nextBeforeTimestamp = chat.state.messages[0]?.timestamp
		
		TIMESTAMP_GROUP_SIZE = 5 * 60 * 1000 # 5 minutes
		
		prependMessage = (message) ->
			firstMessage = chat.state.messages[0]
			shouldGroup = firstMessage? and
				firstMessage.user.id == message?.user?.id and
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
			chat.state.newMessage = message
			
			lastMessage = chat.state.messages[chat.state.messages.length - 1]
			shouldGroup = lastMessage? and
				lastMessage.user.id == message?.user?.id and
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
					
		return chat