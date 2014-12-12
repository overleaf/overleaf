app = angular.module 'ErrorCatcher', []

app.config ['$provide', ($provide) ->
	$provide.decorator '$exceptionHandler', ['$log', '$delegate', ($log, $delegate) ->
		return (exception, cause) ->
			if (Raven?.captureException?)
				Raven.captureException exception;
			$delegate(exception, cause)
	]
]

# TODO: add support for an errorHttpInterceptor to catch failing ajax
# requests as described at
# http://bahmutov.calepin.co/catch-all-errors-in-angular-app.html
