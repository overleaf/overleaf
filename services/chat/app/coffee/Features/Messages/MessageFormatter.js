/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MessageFormatter;
module.exports = (MessageFormatter = {
	formatMessageForClientSide(message) {
		if (message._id != null) {
			message.id = message._id.toString();
			delete message._id;
		}
		const formattedMessage = {
			id: message.id,
			content: message.content,
			timestamp: message.timestamp,
			user_id: message.user_id
		};
		if (message.edited_at != null) {
			formattedMessage.edited_at = message.edited_at;
		}
		return formattedMessage;
	},

	formatMessagesForClientSide(messages) {
		return (Array.from(messages).map((message) => this.formatMessageForClientSide(message)));
	},
	
	groupMessagesByThreads(rooms, messages) {
		let room, thread;
		const rooms_by_id = {};
		for (room of Array.from(rooms)) {
			rooms_by_id[room._id.toString()] = room;
		}

		const threads = {};
		const getThread = function(room) {
			const thread_id = room.thread_id.toString();
			if (threads[thread_id] != null) {
				return threads[thread_id];
			} else {
				const thread = { messages: [] };
				if (room.resolved != null) {
					thread.resolved = true;
					thread.resolved_at = room.resolved.ts;
					thread.resolved_by_user_id = room.resolved.user_id;
				}
				threads[thread_id] = thread;
				return thread;
			}
		};
			
		for (let message of Array.from(messages)) {
			room = rooms_by_id[message.room_id.toString()];
			if (room != null) {
				thread = getThread(room);
				thread.messages.push(MessageFormatter.formatMessageForClientSide(message));
			}
		}
		
		for (let thread_id in threads) {
			thread = threads[thread_id];
			thread.messages.sort((a,b) => a.timestamp - b.timestamp);
		}
		
		return threads;
	}
});