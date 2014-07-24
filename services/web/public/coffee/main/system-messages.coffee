define [
	"base"
], (App) ->
	App.controller "SystemMessagesController", ($scope) ->
		$scope.messages = window.systemMessages;
		
	App.controller "SystemMessageController", ($scope, $sce) ->
		$scope.hidden = $.localStorage("systemMessage.hide.#{$scope.message._id}")
		$scope.htmlContent = $sce.trustAsHtml $scope.message.content
		
		$scope.hide = () ->
			$scope.hidden = true
			$.localStorage("systemMessage.hide.#{$scope.message._id}", true)