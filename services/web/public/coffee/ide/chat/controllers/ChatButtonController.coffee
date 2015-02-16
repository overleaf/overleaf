define [
	"base"
], (App) ->
	App.controller "ChatButtonController", ($scope, ide) ->
		$scope.toggleChat = () ->
			$scope.ui.chatOpen = !$scope.ui.chatOpen
			$scope.resetUnreadMessages()
			
		$scope.unreadMessages = 0
		$scope.resetUnreadMessages = () ->
			$scope.unreadMessages = 0
			
		$scope.$on "chat:resetUnreadMessages", (e) ->
			$scope.resetUnreadMessages()
			
		$scope.$on "chat:newMessage", (e, message) ->
			if message?
				if message?.user?.id != ide.$scope.user.id
					if !$scope.ui.chatOpen
						$scope.unreadMessages += 1
					flashTitle()

		focussed = true
		newMessageNotificationTimeout = null
		originalTitle = null
		$(window).on "focus", () ->
			clearNewMessageNotification()
			focussed = true
		$(window).on "blur", () ->
			focussed = false

		flashTitle = () ->
			if !focussed and !newMessageNotificationTimeout?
				originalTitle ||= window.document.title
				do changeTitle = () =>
					if window.document.title == originalTitle
						window.document.title = "New Message"
					else
						window.document.title = originalTitle
					newMessageNotificationTimeout = setTimeout changeTitle, 800

		clearNewMessageNotification = () ->
			clearTimeout newMessageNotificationTimeout
			newMessageNotificationTimeout = null
			if originalTitle?
				window.document.title = originalTitle
