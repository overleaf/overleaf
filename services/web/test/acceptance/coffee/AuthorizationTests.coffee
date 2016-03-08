request = require("request")
expect = require("chai").expect

count = 0
BASE_URL = "http://localhost:3000"

request = request.defaults({
	baseUrl: BASE_URL,
	followRedirect: false
})

class User
	constructor: (options = {}) ->
		@email = "acceptance-test-#{count}@example.com"
		@password = "acceptance-test-#{count}-password"
		count++
		@jar = request.jar()
		@request = request.defaults({
			jar: @jar
		})
	
	login: (callback = (error) ->) ->
		@getCsrfToken (error) =>
			return callback(error) if error?
			@request.post {
				url: "/register" # Register will log in, but also ensure user exists
				json:
					email: @email
					password: @password
			}, (error, response, body) =>
				return callback(error) if error?
				callback()
	
	createProject: (name, callback = (error, project_id) ->) ->
		@request.post {
			url: "/project/new",
			json:
				projectName: name
		}, (error, response, body) ->
			return callback(error) if error?
			callback(null, body.project_id)
	
	getCsrfToken: (callback = (error) ->) ->
		@request.get {
			url: "/register"
		}, (err, response, body) =>
			return callback(error) if error?
			csrfMatches = body.match("window.csrfToken = \"(.*?)\";")
			if !csrfMatches?
				return callback(new Error("no csrf token found"))
			@request = @request.defaults({
				headers:
					"x-csrf-token": csrfMatches[1]
			})
			callback()

describe "Authorization", ->
	describe "private project", ->
		before (done) ->
			@owner = new User()
			@other = new User()
			@owner.login (error) =>
				return done(error) if error?
				@other.login (error) =>
					return done(error) if error?
					@owner.createProject "private-project", (error, project_id) =>
						return done(error) if error?
						@project_id = project_id
						done()
				
		it "should allow the owner to access it", (done) ->
			@owner.request.get "/project/#{@project_id}", (error, response, body) ->
				expect(response.statusCode).to.equal 200
				done()
			
		it "should not allow another user to access it", (done) ->
			@other.request.get "/project/#{@project_id}", (error, response, body) ->
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.equal "/restricted"
				done()
			
		it "should not allow anonymous user to access it", (done) ->
			request.get "/project/#{@project_id}", (error, response, body) ->
				expect(response.statusCode).to.equal 302
				expect(response.headers.location).to.equal "/login"
				done()