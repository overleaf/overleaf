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
		rooms_by_id = {}
		for room in rooms
			rooms_by_id[room._id.toString()] = room

		threads = {}
		getThread = (room) ->
			thread_id = room.thread_id.toString()
			if threads[thread_id]?
				return threads[thread_id]
			else
				thread = { messages: [] }
				if room.resolved?
					thread.resolved = true
					thread.resolved_at = room.resolved.ts
					thread.resolved_by_user = UserFormatter.formatUserForClientSide(room.resolved.user)
				threads[thread_id] = thread
				return thread
			
		for message in messages
			room = rooms_by_id[message.room_id.toString()]
			if room?
				thread = getThread(room)
				thread.messages.push MessageFormatter.formatMessageForClientSide(message)
		
		for thread_id, thread of threads
			thread.messages.sort (a,b) -> a.timestamp - b.timestamp
		
		return threads