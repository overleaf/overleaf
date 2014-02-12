define [
	"libs/chai"
	"models/User"
	"libs/sinon"
], (chai, User) ->
	describe "User", ->
		describe "findOrBuild", ->
			describe "with an existing model", ->
				beforeEach ->
					@user = User.build "user-1"
					@user.set("email", "test@example.com")

				it "should return the same model", ->
					@newUser = User.findOrBuild "user-1", email: "new@example.com"
					@newUser.should.equal @user
					@newUser.get("email").should.equal "new@example.com"

			describe "without an existing model", ->
				it "should return new a model with the correct id", ->
					user = User.findOrBuild("user-2")
					user.id.should.equal "user-2"

			afterEach ->
				User.loadedModels = {}
