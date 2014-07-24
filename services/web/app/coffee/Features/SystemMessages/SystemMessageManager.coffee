SystemMessage = require("../../models/SystemMessage").SystemMessage

module.exports = SystemMessageManager =
	getMessages: (callback = (error, messages) ->) ->
		if @_cachedMessages?
			return callback null, @_cachedMessages
		else
			@getMessagesFromDB (error, messages) =>
				return callback(error) if error?
				@_cachedMessages = messages
				return callback null, messages
				
	getMessagesFromDB: (callback = (error, messages) ->) ->
		SystemMessage.find {}, callback
				
	clearMessages: (callback = (error) ->) ->
		SystemMessage.remove {}, callback
		
	createMessage: (content, callback = (error) ->) ->
		message = new SystemMessage { content: content }
		message.save callback
				
	clearCache: () ->
		delete @_cachedMessages
				
CACHE_TIMEOUT = 5 * 60 * 1000 # 5 minutes		
setInterval () ->
	SystemMessageManager.clearCache()
, CACHE_TIMEOUT