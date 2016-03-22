BASE_URL = "http://localhost:3000"
module.exports = require("request").defaults({
	baseUrl: BASE_URL,
	followRedirect: false
})