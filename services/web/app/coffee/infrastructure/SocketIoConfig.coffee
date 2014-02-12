SocketIoRedisStore = require('socket.io/lib/stores/redis')

module.exports =
	configure: (io)->
		io.configure ->
			io.enable('browser client minification')
			io.enable('browser client etag')

			# Fix for Safari 5 error of "Error during WebSocket handshake: location mismatch"
			# See http://answers.dotcloud.com/question/578/problem-with-websocket-over-ssl-in-safari-with
			io.set('match origin protocol', true)

			# gzip uses a Node 0.8.x method of calling the gzip program which
			# doesn't work with 0.6.x
			#io.enable('browser client gzip')
			io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling'])
			io.set('log level', 1)

		io.configure 'production', ->
			io.set('log level', 1)
