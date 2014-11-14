describe "leaveProject", ->
	describe "with other clients in the project", ->
		it "should emit a disconnect message to the room"
	
		it "should no longer list the client in connected users"
		
		it "should not flush the project to the document updater"
		
		it "should not flush the project in track changes"

	describe "with no other clients in the project", ->
		it "should flush the project to the document updater"
		
		it "should flush the project in track changes"
		
		