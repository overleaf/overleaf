class MockRequest
	param: (param) -> @params[param]
	session:
		destroy:->

	params: {}
	query: {}
	body: {}
	_parsedUrl:{}
	i18n:
		translate: (str)-> str
	route:
		path: ''

module.exports = MockRequest

