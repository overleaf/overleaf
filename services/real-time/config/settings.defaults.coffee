module.exports =
	redis:
		web:
			host: "localhost"
			port: "6379"
			password: ""
			
	internal:
		realTime:
			port: 3026
			host: "localhost"
			
	security:
		sessionSecret: "secret-please-change"
		
	cookieName:"sharelatex.sid"