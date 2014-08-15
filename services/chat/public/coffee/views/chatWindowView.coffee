define [
	"libs/underscore"
	"libs/backbone"
	"views/userMessageBlockView"
	"views/timeMessageBlockView"
], (_, Backbone, UserMessageBlockView, TimeMessageBlockView) ->
	FIVE_MINS = 5 * 60 * 1000
	ONE_HOUR = 60 * 60 * 1000
	TWELVE_HOURS = ONE_HOUR * 12
	ONE_DAY = ONE_HOUR * 24

	ChatWindowView = Backbone.View.extend
		events:
			"keydown textarea"              : "_onTextAreaKeyDown"
			"click .js-load-older-messages" : "_loadOlderMessages"
			"click .js-minimize-toggle"     : "_toggleMinimizeState"
			"click h3"                      : "_toggleMinimizeState"
			"click .js-new-message-alert"   : "_toggleMinimizeState"
			"click"                         : "_removeNotification"

		initialize: () ->
			@template = $("#chatWindowTemplate").html()
			@chat = @options.chat
			@room = @options.room
			@listenTo @room.get("messages"), "add", (model, collection) -> @_onNewMessage(model, collection)
			@listenTo @room.get("messages"), "noMoreMessages", () -> @$(".js-loading").hide()
			@listenTo @room.get("connectedUsers"), "add", (user, collection) -> @_renderConnectedUsers()
			@listenTo @room.get("connectedUsers"), "remove", (user, collection) -> @_renderConnectedUsers()
			@listenTo @room.get("connectedUsers"), "change", (user, collection) -> @_renderConnectedUsers()
			@listenTo @room, "joined", -> @_onJoin()
			@listenTo @room, "disconnected", -> @_onDisconnect()
			@listenTo @room, "afterMessagesPreloaded", -> @_scrollToBottomOfMessages()

		render: () ->
			@setElement($(@template))
			$(document.body).append(@$el)
			@_renderConnectedUsers()
			@_initializeMinimizedState()

		_onJoin: () ->
			if !@rendered?
				@render()
				@rendered = true
			@$el.removeClass("disconnected")
			@$("textarea").removeAttr("disabled")

		_onDisconnect: () ->
			@$el.addClass("disconnected")
			@$("textarea").attr("disabled", "disabled")

		_onNewMessage: (message, collection) ->
			@_renderMessage(message, collection)
			@_notifyAboutNewMessage(message)

		_renderMessage: (message, collection) ->

			@messageBlocks ||= []
			scrollEl = @$(".sent-message-area")

			isOldestMessage = (message, collection)->
				collection.indexOf(message) == 0

			ismessageFromNewUser = (messageView, message)->
				!messageView? or messageView.user != message.get("user")

			isTimeForNewBlockBackwards = (message, previousUserMessageBlockView)->
				if !message? or !previousUserMessageBlockView?
					return true

				timeSinceMessageWasSent = new Date().getTime() - message.get("timestamp")

				if timeSinceMessageWasSent < ONE_HOUR
					timeBlockSize = FIVE_MINS
				else if timeSinceMessageWasSent > ONE_HOUR and timeSinceMessageWasSent < (ONE_DAY + TWELVE_HOURS)
					timeBlockSize = ONE_HOUR
				else
					timeBlockSize = ONE_DAY

				timeSinceLastPrinted = previousUserMessageBlockView.getTime() - message.get("timestamp")

				if timeSinceLastPrinted > timeBlockSize
					return true
				else
					return false


			isTimeForNewBlock = (message, previousUserMessageBlockView)->
				(message.get("timestamp") - previousUserMessageBlockView.getTime()) > FIVE_MINS


			if isOldestMessage(message, collection)
				oldScrollTopFromBottom = scrollEl[0].scrollHeight - scrollEl.scrollTop()

				userMessageBlockView = @messageBlocks[0]
				if ismessageFromNewUser(userMessageBlockView, message) or isTimeForNewBlockBackwards(message, userMessageBlockView)
					userMessageBlockView = new UserMessageBlockView(user: message.get("user"))
					@$(".sent-messages").prepend(userMessageBlockView.$el)
					@messageBlocks.unshift userMessageBlockView

				userMessageBlockView.prependMessage(message)

				scrollEl.scrollTop(scrollEl[0].scrollHeight - oldScrollTopFromBottom)
			else
				oldScrollBottom = @_getScrollBottom()
				userMessageBlockView = @messageBlocks[@messageBlocks.length - 1]

				if ismessageFromNewUser(userMessageBlockView, message) or isTimeForNewBlock(message, userMessageBlockView)
					userMessageBlockView = new UserMessageBlockView(user: message.get("user"))
					@$(".sent-messages").append(userMessageBlockView.$el)
					@messageBlocks.push userMessageBlockView

				userMessageBlockView.appendMessage(message)

				if oldScrollBottom <= 0
					@_scrollToBottomOfMessages()

	
		_renderConnectedUsers: () ->
			users = @room.get("connectedUsers")
			names = users
				.reject((user) => user == @chat.user)
				.map((user) -> "#{user.get("first_name")} #{user.get("last_name")}")
			if names.length == 0
				text = "No one else is online :("
			else if names.length == 1
				text = "#{names[0]} is also online"
			else
				text = "#{names.slice(0, -1).join(", ")} and #{names[names.length - 1]} are also online"
			@$(".js-connected-users").text(text)
			@_resizeSentMessageArea()

		_resizeSentMessageArea: () ->
			marginTop = @$(".js-header").outerHeight() + @$(".js-connected-users").outerHeight()
			@$(".js-sent-message-area").css({
				top: marginTop + "px"
			})

		_getScrollBottom: () ->
			scrollEl = @$(".sent-message-area")
			return scrollEl[0].scrollHeight - scrollEl.scrollTop() - scrollEl.innerHeight()

		_scrollToBottomOfMessages: () ->
			scrollEl = @$(".sent-message-area")
			doScroll = ->
				return scrollEl.scrollTop(scrollEl[0].scrollHeight - scrollEl.innerHeight())
			MathJax.Hub.Queue(["Typeset", doScroll])

		_notifyAboutNewMessage: (message) ->
			isMessageNewToUser = message.get("user") != @chat.user and !message.get("preloaded")
			isTextAreaFocused = @$("textarea").is(":focus")
			if !isTextAreaFocused and isMessageNewToUser
				@unseenMessages ||= 0
				@unseenMessages += 1
				@$el.addClass("new-messages")
				@$(".new-message-alert").text(@unseenMessages)

		_removeNotification: () ->
			@unseenMessages = 0
			@$el.removeClass("new-messages")
			@$(".new-message-alert").text("")

		_onTextAreaKeyDown: (e) ->
			if e.keyCode == 13 # Enter
				e.preventDefault()
				message = @$("textarea").val()
				@$("textarea").val("")
				@_sendMessage(message)

		_loadOlderMessages: (e) ->
			e.preventDefault()
			@room.get("messages").fetchMoreMessages()

		_sendMessage: (content) ->
			@room.sendMessage(content)

		isMinimized: () ->
			minimized = $.localStorage "chat.rooms.project-chat.minimized"
			if !minimized?
				minimized = false
			return minimized

		_setMinimizedState: (state) ->
			$.localStorage "chat.rooms.project-chat.minimized", state

		_initializeMinimizedState: () ->
			minimized = @isMinimized()
			if minimized
				@_minimize(false)

		_toggleMinimizeState: (e) ->
			e.preventDefault()
			minimized = @isMinimized()
			if !minimized
				@_setMinimizedState(true)
				@_minimize()
			else
				@_setMinimizedState(false)
				@_unminimize()

		_minimize: (animate = true) ->
			@$(".new-message-area").hide()
			@$(".js-connected-users").hide()
			@$el.addClass("minimized")
			if animate
				@$el.animate height: 20, width: 80
			else
				@$el.css height: 20, width: 80

		_unminimize: () ->
			@$(".new-message-area").show()
			@$(".js-connected-users").show()
			@$el.removeClass("minimized")
			@$el.animate height: 260, width: 220, () =>
				@_resizeSentMessageArea()
			@_scrollToBottomOfMessages()




