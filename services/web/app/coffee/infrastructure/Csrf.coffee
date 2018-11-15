csurf = require('csurf')
csrf = csurf()

# Wrapper for `csurf` middleware that provides a list of routes that can be excluded from csrf checks.
#
# Include with `Csrf = require('./Csrf')`
#
# Add the middleware to the router with:
#   myRouter.csrf = new Csrf()
#   myRouter.use webRouter.csrf.middleware
# When building routes, specify a route to exclude from csrf checks with:
#   myRouter.csrf.disableDefaultCsrfProtection "/path" "METHOD"
#
# To validate the csrf token in a request to ensure that it's valid, you can use `validateRequest`, which takes a
# request object and calls a callback with either true or false.

module.exports = class Csrf
	constructor: ->
		@excluded_routes = {}

	disableDefaultCsrfProtection: (route, method) ->
		@excluded_routes[route] = {} unless @excluded_routes[route]
		@excluded_routes[route][method] = 1

	middleware: (req, res, next) =>
		# We want to call the middleware for all routes, even if excluded, because csurf sets up a csrfToken() method on
		# the request, to get a new csrf token for any rendered forms. For excluded routes we'll then ignore a 'bad csrf
		# token' error from csurf and continue on...

		# check whether the request method is excluded for the specified route
		if @excluded_routes[req.path]?[req.method] == 1
			# ignore the error if it's due to a bad csrf token, and continue
			csrf req, res, (err) =>
				if (err && err.code != 'EBADCSRFTOKEN')
					next(err)
				else
					next()
		else
			csrf req, res, next

	@validateRequest: (req, cb = (valid)->) ->
		# run a dummy csrf check to see if it returns an error
		csrf req, null, (err) ->
			cb(!err?)
