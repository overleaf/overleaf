class MockRequest
	param: (param) -> @params[param]
	session:
		destroy:->

	params: {}
	query: {}
	i18n:
		translate:->

module.exports = MockRequest

