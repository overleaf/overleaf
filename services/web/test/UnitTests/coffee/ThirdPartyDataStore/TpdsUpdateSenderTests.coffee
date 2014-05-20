SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsUpdateSender.js'
sinon = require('sinon')
ath = require('path')
project_id = "project_id_here"
user_id = "user_id_here"
read_only_ref_1 = "read_only_ref_1_id_here"
collaberator_ref_1 = "collaberator_ref_1_here"
project_name = "project_name_here"

thirdPartyDataStoreApiUrl = "http://third-party-json-store.herokuapp.com"
httpUsername = "user"
httpPass = "pass"
siteUrl = "http://www.localhost:3000"
httpAuthSiteUrl = "http://#{httpUsername}:#{httpPass}@www.localhost:3000"
filestoreUrl = "filestore.sharelatex.com"

describe 'TpdsUpdateSender', ->
	beforeEach ->
		@requestQueuer = regist:(queue, meth, opts, callback)->
		project = {owner_ref:user_id,readOnly_refs:[read_only_ref_1], collaberator_refs:[collaberator_ref_1]}
		@Project = findById:sinon.stub().callsArgWith(2, null, project)
		@docstoreUrl = "docstore.sharelatex.env"
		@updateSender = SandboxedModule.require modulePath, requires:
			'fairy':{connect:=>{queue:=>@requestQueuer}}
			"settings-sharelatex": 
				siteUrl:siteUrl
				httpAuthSiteUrl:httpAuthSiteUrl,
				apis: 
					thirdPartyDataStore: {url: thirdPartyDataStoreApiUrl}
					filestore:
						url: filestoreUrl
					docstore:
						url: @docstoreUrl
				redis:fairy:{}
			"logger-sharelatex":{log:->}
			'../../models/Project': Project:@Project
			'request':->{pipe:->}

	describe 'sending updates', ->

		it 'ques a post the file with user and file id', (done)->
			file_id = '4545345'
			path = '/some/path/here.jpg'
			@requestQueuer.enqueue = (uid, method, job, callback)->
				uid.should.equal project_id
				job.method.should.equal "post"
				job.streamOrigin.should.equal "#{filestoreUrl}/project/#{project_id}/file/#{file_id}"
				expectedUrl = "#{thirdPartyDataStoreApiUrl}/user/#{user_id}/entity/#{encodeURIComponent(project_name)}#{encodeURIComponent(path)}"
				job.uri.should.equal expectedUrl
				job.headers.sl_all_user_ids.should.eql(JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id]))
				done()
			@updateSender.addFile {project_id:project_id, file_id:file_id, path:path, project_name:project_name}, ->

		it 'post doc with stream origin of docstore', (done)->
			doc_id = "4545345"
			path = "/some/path/here.tex"
			lines = ["line1", "line2", "line3"]

			@requestQueuer.enqueue = (uid, method, job, callback)=>
				uid.should.equal project_id
				job.method.should.equal "post"
				expectedUrl = "#{thirdPartyDataStoreApiUrl}/user/#{user_id}/entity/#{encodeURIComponent(project_name)}#{encodeURIComponent(path)}"
				job.uri.should.equal expectedUrl
				job.streamOrigin.should.equal "#{@docstoreUrl}/project/#{project_id}/doc/#{doc_id}/raw"
				job.headers.sl_all_user_ids.should.eql(JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id]))
				done()
			@updateSender.addDoc {project_id:project_id, doc_id:doc_id, path:path, docLines:lines,project_name:project_name}

		it 'deleting entity', (done)->
			path = "/path/here/t.tex"
			@requestQueuer.enqueue = (uid, method, job, callback)->
				uid.should.equal project_id
				job.method.should.equal "DELETE"
				expectedUrl = "#{thirdPartyDataStoreApiUrl}/user/#{user_id}/entity/#{encodeURIComponent(project_name)}#{encodeURIComponent(path)}"
				job.headers.sl_all_user_ids.should.eql(JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id]))
				job.uri.should.equal expectedUrl
				done()
			@updateSender.deleteEntity {project_id:project_id, path:path, project_name:project_name}

		it 'moving entity', (done)->
			startPath = "staring/here/file.tex"
			endPath = "ending/here/file.tex"
			@requestQueuer.enqueue = (uid, method, job, callback)->
				uid.should.equal project_id
				job.method.should.equal "put"
				job.uri.should.equal "#{thirdPartyDataStoreApiUrl}/user/#{user_id}/entity"
				job.json.startPath.should.equal "/#{project_name}/#{startPath}"
				job.json.endPath.should.equal "/#{project_name}/#{endPath}"
				job.headers.sl_all_user_ids.should.eql(JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id]))
				done()
			@updateSender.moveEntity {project_id:project_id, startPath:startPath, endPath:endPath, project_name:project_name}

		it 'should be able to rename a project using the move entity func', (done)->
			oldProjectName = "/oldProjectName/"
			newProjectName = "/newProjectName/"
			@requestQueuer.enqueue = (uid, method, job, callback)->
				uid.should.equal project_id
				job.method.should.equal "put"
				job.uri.should.equal "#{thirdPartyDataStoreApiUrl}/user/#{user_id}/entity"
				job.json.startPath.should.equal oldProjectName
				job.json.endPath.should.equal newProjectName
				job.headers.sl_all_user_ids.should.eql(JSON.stringify([collaberator_ref_1, read_only_ref_1, user_id]))
				done()
			@updateSender.moveEntity {project_id:project_id, project_name:oldProjectName, newProjectName:newProjectName}
