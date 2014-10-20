chai = require('chai')
should = chai.should()

modulePath = "../../../../app/js/Features/Project/ProjectEditorHandler"
SandboxedModule = require('sandboxed-module')

describe "ProjectEditorHandler", ->
	beforeEach ->
		@project =
			_id        : "project-id"
			name       : "Project Name"
			rootDoc_id : "file-id"
			publicAccesLevel : "private"
			deletedByExternalDataSource: false
			rootFolder : [{
				_id      : "root-folder-id"
				name     : ""
				docs     : []
				fileRefs : []
				folders  : [{
					_id      : "sub-folder-id"
					name     : "folder"
					docs     : [{
						_id   : "doc-id"
						name  : "main.tex"
						lines : @lines = [
							"line 1"
							"line 2"
							"line 3"
						]
					}]
					fileRefs : [{
						_id     : "file-id"
						name    : "image.png"
						created : new Date()
						size    : 1234
					}]
					folders  : []
				}]
			}]
			owner_ref :
				_id: "owner-id"
				first_name : "Owner"
				last_name  : "ShareLaTeX"
				email      : "owner@sharelatex.com"
			readOnly_refs: [{
				_id: "read-only-id"
				first_name : "Read"
				last_name  : "Only"
				email      : "read-only@sharelatex.com"
			}]
			collaberator_refs: [{
				_id: "read-write-id"
				first_name : "Read"
				last_name  : "Write"
				email      : "read-write@sharelatex.com"
			}]
			deletedDocs: [{
				_id: "deleted-doc-id"
				name: "main.tex"
			}]
		@handler = SandboxedModule.require modulePath

	describe "buildProjectModelView", ->
		describe "with owner and members included", ->
			beforeEach ->
				@result = @handler.buildProjectModelView @project

			it "should include the id", ->
				should.exist @result._id
				@result._id.should.equal "project-id"

			it "should include the name", ->
				should.exist @result.name
				@result.name.should.equal "Project Name"

			it "should include the root doc id", ->
				should.exist @result.rootDoc_id
				@result.rootDoc_id.should.equal "file-id"

			it "should include the public access level", ->
				should.exist @result.publicAccesLevel
				@result.publicAccesLevel.should.equal "private"

			it "should include the owner", ->
				should.exist @result.owner
				@result.owner._id.should.equal "owner-id"
				@result.owner.email.should.equal "owner@sharelatex.com"
				@result.owner.first_name.should.equal "Owner"
				@result.owner.last_name.should.equal "ShareLaTeX"
				@result.owner.privileges.should.equal "owner"

			it "should include the deletedDocs", ->
				should.exist @result.deletedDocs
				@result.deletedDocs.should.equal @project.deletedDocs
				
			it "should gather readOnly_refs and collaberators_refs into a list of members", ->
				findMember = (id) =>
					for member in @result.members
						return member if member._id == id
					return null

				@result.members.length.should.equal 2

				should.exist findMember("read-only-id")
				findMember("read-only-id").privileges.should.equal "readOnly"
				findMember("read-only-id").first_name.should.equal "Read"
				findMember("read-only-id").last_name.should.equal "Only"
				findMember("read-only-id").email.should.equal "read-only@sharelatex.com"

				should.exist findMember("read-write-id")
				findMember("read-write-id").privileges.should.equal "readAndWrite"
				findMember("read-write-id").first_name.should.equal "Read"
				findMember("read-write-id").last_name.should.equal "Write"
				findMember("read-write-id").email.should.equal "read-write@sharelatex.com"

			it "should include folders in the project", ->
				@result.rootFolder[0]._id.should.equal "root-folder-id"
				@result.rootFolder[0].name.should.equal ""

				@result.rootFolder[0].folders[0]._id.should.equal "sub-folder-id"
				@result.rootFolder[0].folders[0].name.should.equal "folder"

			it "should not duplicate folder contents", ->
				@result.rootFolder[0].docs.length.should.equal 0
				@result.rootFolder[0].fileRefs.length.should.equal 0

			it "should include files in the project", ->
				@result.rootFolder[0].folders[0].fileRefs[0]._id.should.equal "file-id"
				@result.rootFolder[0].folders[0].fileRefs[0].name.should.equal "image.png"
				should.not.exist @result.rootFolder[0].folders[0].fileRefs[0].created
				should.not.exist @result.rootFolder[0].folders[0].fileRefs[0].size

			it "should include docs in the project but not the lines", ->
				@result.rootFolder[0].folders[0].docs[0]._id.should.equal "doc-id"
				@result.rootFolder[0].folders[0].docs[0].name.should.equal "main.tex"
				should.not.exist @result.rootFolder[0].folders[0].docs[0].lines

		describe "deletedByExternalDataSource", ->

			it "should set the deletedByExternalDataSource flag to false when it is not there", ->
				delete @project.deletedByExternalDataSource
				result = @handler.buildProjectModelView @project
				result.deletedByExternalDataSource.should.equal false

			it "should set the deletedByExternalDataSource flag to false when it is false", ->
				result = @handler.buildProjectModelView @project
				result.deletedByExternalDataSource.should.equal false

			it "should set the deletedByExternalDataSource flag to true when it is true", ->
				@project.deletedByExternalDataSource = true
				result = @handler.buildProjectModelView @project
				result.deletedByExternalDataSource.should.equal true

		describe "features", ->
			beforeEach ->
				@project.owner_ref.features =
					versioning: true
					collaborators: 3
					compileGroup:"priority"
					compileTimeout: 96
				@result = @handler.buildProjectModelView @project
			
			it "should copy the owner features to the project", ->
				@result.features.versioning.should.equal @project.owner_ref.features.versioning
				@result.features.collaborators.should.equal @project.owner_ref.features.collaborators
				@result.features.compileGroup.should.equal @project.owner_ref.features.compileGroup
				@result.features.compileTimeout.should.equal @project.owner_ref.features.compileTimeout


		describe "without owners and members", ->
			beforeEach ->
				@result = @handler.buildProjectModelView @project, includeUsers: false
			
			it "should not include the owner", ->
				should.not.exist @result.owner

			it "should not include the members", ->
				should.not.exist @result.members
			
