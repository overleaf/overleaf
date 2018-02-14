express = require("express")
app = express()

module.exports = MockUrlSource =
	app: app
	run: (callback) ->
		app.listen 6543, callback
