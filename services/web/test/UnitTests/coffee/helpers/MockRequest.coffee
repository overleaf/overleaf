class MockRequest
	param: (param) -> @params[param]
	session:
		destroy:->

	params: {}
	query: {}
	
module.exports = MockRequest

