BASE_URL = "http://#{process.env["HTTP_TEST_HOST"] or "localhost"}:3000"
module.exports = require("request").defaults({
	baseUrl: BASE_URL,
	followRedirect: false
})