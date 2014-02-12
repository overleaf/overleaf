define [
	"underscore"
	"libs/backbone"
], () ->
	class SocketIoMock
		constructor: () ->
	_.extend(SocketIoMock::, Backbone.Events)
	SocketIoMock::emit = () -> @trigger.apply(@, arguments)

	return SocketIoMock: SocketIoMock
