app = angular.module 'ErrorCatcher', []

app.config ['$provide', ($provide) ->
	$provide.decorator '$exceptionHandler', ['$log', '$delegate', ($log, $delegate) ->
		return (exception, cause) ->
			if (Raven?.captureException?)
				Raven.captureException exception;
			$delegate(exception, cause)
	]
]

# Interceptor to check auth failures in all $http requests
# http://bahmutov.calepin.co/catch-all-errors-in-angular-app.html

app.factory 'unAuthHttpResponseInterceptor', ['$q','$location', ($q, $location) ->
		responseError: (response) ->
			# redirect any unauthorised or forbidden responses back to /login
			#
			# set disableAutoLoginRedirect:true in the http request config
			# to disable this behaviour
			if response.status in [401, 403] and not response.config?.disableAutoLoginRedirect
				# for /project urls set the ?redir parameter to come back here
				# otherwise just go to the login page
				if window.location.pathname.match(/^\/project/)
					window.location = "/login?redir=#{encodeURI(window.location.pathname)}"
				else
					window.location = "/login"
			# pass the response back to the original requester
			return $q.reject(response)
]

app.config ['$httpProvider', ($httpProvider) ->
	$httpProvider.interceptors.push 'unAuthHttpResponseInterceptor'
]
