class MockRequest
	param: (param) -> @params[param]
	session:
		destroy:->

	params: {}
	query: {}
	_parsedUrl:{}
	i18n:
		translate:->

module.exports = MockRequest

