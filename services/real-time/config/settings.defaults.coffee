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
			user: "sharelatex"
			pass: "password"
			
	apis:
		web:
			url: "http://localhost:3000"
			user: "sharelatex"
			pass: "password"
		documentupdater:
			url: "http://localhost:3003"
			
	security:
		sessionSecret: "secret-please-change"
		
	cookieName:"sharelatex.sid"
	
	max_doc_length: 2 * 1024 * 1024 # 2mb