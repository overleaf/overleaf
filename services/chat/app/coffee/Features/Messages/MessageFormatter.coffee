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
	
	groupMessagesByThreads: (rooms, messages) ->
		room_id_to_thread_id = {}
		for room in rooms
			room_id_to_thread_id[room._id.toString()] = room.thread_id.toString()
		
		threads = {}
		for message in messages
			thread_id = room_id_to_thread_id[message.room_id.toString()]
			threads[thread_id] ?= []
			threads[thread_id].push MessageFormatter.formatMessageForClientSide(message)
		
		for thread_id, messages of threads
			messages.sort (a,b) -> a.timestamp - b.timestamp
		
		return threads