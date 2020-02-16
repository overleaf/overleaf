/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
    assert
} = require("chai");
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const modulePath = "../../../app/js/DocArchiveManager.js";
const SandboxedModule = require('sandboxed-module');
const {
    ObjectId
} = require("mongojs");
const Errors = require("../../../app/js/Errors");
const crypto = require("crypto");

describe("DocArchiveManager", function() {

	beforeEach(function() {

		this.settings = {
			docstore: {
				s3: {
					secret: "secret",
					key: "this_key",
					bucket:"doc-archive-unit-test"
				}
			}
		};

		this.request = { 
			put: {},
			get: {},
			del: {}
		};

		this.archivedDocs = [{
			_id: ObjectId(),
			inS3:true,
			rev: 2
		}, {
			_id: ObjectId(),
			inS3:true,
			rev: 4
		}, {
			_id: ObjectId(),
			inS3:true,
			rev: 6
		}];

		this.mongoDocs = [{
			_id: ObjectId(),
			lines: ["one", "two", "three"],
			rev: 2
		}, {
			_id: ObjectId(),
			lines: ["aaa", "bbb", "ccc"],
			rev: 4
		}, {
			_id: ObjectId(),
			inS3: true,
			rev: 6
		}, {
			_id: ObjectId(),
			inS3: true,
			rev: 6
		}, {
			_id: ObjectId(),
			lines: ["111", "222", "333"],
			rev: 6
		}];

		this.unarchivedDocs = [{
			_id: ObjectId(),
			lines: ["wombat", "potato", "banana"],
			rev: 2
		}, {
			_id: ObjectId(),
			lines: ["llama", "turnip", "apple"],
			rev: 4
		}, {
			_id: ObjectId(),
			lines: ["elephant", "swede", "nectarine"],
			rev: 6
		}];

		this.mixedDocs = this.archivedDocs.concat(this.unarchivedDocs);

		this.MongoManager = {
			markDocAsArchived: sinon.stub().callsArgWith(2, null),
			upsertIntoDocCollection: sinon.stub().callsArgWith(3, null),
			getProjectsDocs: sinon.stub().callsArgWith(3, null, this.mongoDocs),
			getArchivedProjectDocs: sinon.stub().callsArgWith(2, null, this.mongoDocs)
		};

		this.requires = { 
			"settings-sharelatex": this.settings,
			"./MongoManager": this.MongoManager,
			"request": this.request,
			"./RangeManager": (this.RangeManager = {}),
			"logger-sharelatex": {
				log() {},
				err() {}
			}
		};
		this.globals =
			{JSON};

		this.error = "my errror";
		this.project_id = ObjectId().toString();
		this.stubbedError = new Errors.NotFoundError("Error in S3 request");
		return this.DocArchiveManager = SandboxedModule.require(modulePath, {requires: this.requires, globals: this.globals});
	});

	describe("archiveDoc", function() {

		it("should use correct options", function(done){
			this.request.put = sinon.stub().callsArgWith(1,  null, {statusCode:200,headers:{etag:""}});
			return this.DocArchiveManager.archiveDoc(this.project_id, this.mongoDocs[0], err=> {
				const opts = this.request.put.args[0][0];
				assert.deepEqual(opts.aws, {key:this.settings.docstore.s3.key, secret:this.settings.docstore.s3.secret, bucket:this.settings.docstore.s3.bucket});
				opts.body.should.equal(JSON.stringify({
					lines: this.mongoDocs[0].lines,
					ranges: this.mongoDocs[0].ranges,
					schema_v: 1
				})
				);
				opts.timeout.should.equal((30*1000));
				opts.uri.should.equal(`https://${this.settings.docstore.s3.bucket}.s3.amazonaws.com/${this.project_id}/${this.mongoDocs[0]._id}`);
				return done();
			});
		});

		it("should return no md5 error", function(done){
			const data = JSON.stringify({
				lines: this.mongoDocs[0].lines,
				ranges: this.mongoDocs[0].ranges,
				schema_v: 1
			});
			this.md5 = crypto.createHash("md5").update(data).digest("hex");
			this.request.put = sinon.stub().callsArgWith(1,  null, {statusCode:200,headers:{etag:this.md5}});
			return this.DocArchiveManager.archiveDoc(this.project_id, this.mongoDocs[0], err=> {
				should.not.exist(err);
				return done();
			});
		});

		return it("should return the error", function(done){
			this.request.put = sinon.stub().callsArgWith(1, this.stubbedError, {statusCode:400,headers:{etag:""}});
			return this.DocArchiveManager.archiveDoc(this.project_id, this.mongoDocs[0], err=> {
				should.exist(err);
				return done();
			});
		});
	});

	describe("unarchiveDoc", function() {

		it("should use correct options", function(done){
			this.request.get = sinon.stub().callsArgWith(1, null, {statusCode:200}, this.mongoDocs[0].lines);
			this.request.del = sinon.stub().callsArgWith(1, null, {statusCode:204}, {});
			return this.DocArchiveManager.unarchiveDoc(this.project_id, this.mongoDocs[0]._id, err=> {
				const opts = this.request.get.args[0][0];
				assert.deepEqual(opts.aws, {key:this.settings.docstore.s3.key, secret:this.settings.docstore.s3.secret, bucket:this.settings.docstore.s3.bucket});
				opts.json.should.equal(true);
				opts.timeout.should.equal((30*1000));
				opts.uri.should.equal(`https://${this.settings.docstore.s3.bucket}.s3.amazonaws.com/${this.project_id}/${this.mongoDocs[0]._id}`);
				return done();
			});
		});

		it("should return the error", function(done){
			this.request.get = sinon.stub().callsArgWith(1, this.stubbedError, {}, {});
			return this.DocArchiveManager.unarchiveDoc(this.project_id, this.mongoDocs[0], err=> {
				should.exist(err);
				return done();
			});
		});

		return it("should error if the doc lines are a string not an array", function(done){
			this.request.get = sinon.stub().callsArgWith(1, null, {statusCode:200}, "this is a string");
			this.request.del = sinon.stub();
			return this.DocArchiveManager.unarchiveDoc(this.project_id, this.mongoDocs[0], err=> {
				should.exist(err);
				this.request.del.called.should.equal(false);
				return done();
			});
		});
	});

	describe("archiveAllDocs", function() {

		it("should archive all project docs which are not in s3", function(done){
			this.MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, this.mongoDocs);
			this.DocArchiveManager.archiveDoc = sinon.stub().callsArgWith(2, null);

			return this.DocArchiveManager.archiveAllDocs(this.project_id, err=> {
				this.DocArchiveManager.archiveDoc.calledWith(this.project_id, this.mongoDocs[0]).should.equal(true);
				this.DocArchiveManager.archiveDoc.calledWith(this.project_id, this.mongoDocs[1]).should.equal(true);
				this.DocArchiveManager.archiveDoc.calledWith(this.project_id, this.mongoDocs[4]).should.equal(true);

				this.DocArchiveManager.archiveDoc.calledWith(this.project_id, this.mongoDocs[2]).should.equal(false);
				this.DocArchiveManager.archiveDoc.calledWith(this.project_id, this.mongoDocs[3]).should.equal(false);
				
				should.not.exist(err);
				return done();
			});
		});

		it("should return error if have no docs", function(done){
			this.MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, null);

			return this.DocArchiveManager.archiveAllDocs(this.project_id, err=> {
				should.exist(err);
				return done();
			});
		});

		it("should return the error", function(done){
			this.MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, this.error, null);

			return this.DocArchiveManager.archiveAllDocs(this.project_id, err=> {
				err.should.equal(this.error);
				return done();
			});
		});

		return describe("when most have been already put in s3", function() {

			beforeEach(function() {
				let numberOfDocs = 10 * 1000;
				this.mongoDocs = [];
				while (--numberOfDocs !== 0) {
					this.mongoDocs.push({inS3:true, _id: ObjectId()});
				}

				this.MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, this.mongoDocs);
				return this.DocArchiveManager.archiveDoc = sinon.stub().callsArgWith(2, null);
			});	

			return it("should not throw and error", function(done){
				return this.DocArchiveManager.archiveAllDocs(this.project_id, err=> {
					should.not.exist(err);
					return done();
				});
			});
		});
	});


	describe("unArchiveAllDocs", function() {

		it("should unarchive all inS3 docs", function(done){
			this.MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, this.archivedDocs);
			this.DocArchiveManager.unarchiveDoc = sinon.stub().callsArgWith(2, null);
			return this.DocArchiveManager.unArchiveAllDocs(this.project_id, err=> {
				for (let doc of Array.from(this.archivedDocs)) {
					this.DocArchiveManager.unarchiveDoc.calledWith(this.project_id, doc._id).should.equal(true);
				}
				should.not.exist(err);
				return done();
			});
		});

		it("should return error if have no docs", function(done){
			this.MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, null, null);
			return this.DocArchiveManager.unArchiveAllDocs(this.project_id, err=> {
				should.exist(err);
				return done();
			});
		});

		return it("should return the error", function(done){
			this.MongoManager.getArchivedProjectDocs = sinon.stub().callsArgWith(1, this.error, null);
			return this.DocArchiveManager.unArchiveAllDocs(this.project_id, err=> {
				err.should.equal(this.error);
				return done();
			});
		});
	});

	describe("destroyAllDocs", function() {
		beforeEach(function() {
			this.request.del = sinon.stub().callsArgWith(1, null, {statusCode:204}, {});
			this.MongoManager.getProjectsDocs = sinon.stub().callsArgWith(3, null, this.mixedDocs);
			this.MongoManager.findDoc = sinon.stub().callsArgWith(3, null, null);
			this.MongoManager.destroyDoc = sinon.stub().yields();
			return Array.from(this.mixedDocs).map((doc) =>
				this.MongoManager.findDoc.withArgs(this.project_id, doc._id).callsArgWith(3, null, doc));
		});

		it("should destroy all the docs", function(done){
			this.DocArchiveManager.destroyDoc = sinon.stub().callsArgWith(2, null);
			return this.DocArchiveManager.destroyAllDocs(this.project_id, err=> {
				for (let doc of Array.from(this.mixedDocs)) {
					this.DocArchiveManager.destroyDoc.calledWith(this.project_id, doc._id).should.equal(true);
				}
				should.not.exist(err);
				return done();
			});
		});

		it("should only the s3 docs from s3", function(done){
			const docOpts = doc => {
				return JSON.parse(JSON.stringify({
					aws: {key:this.settings.docstore.s3.key, secret:this.settings.docstore.s3.secret, bucket:this.settings.docstore.s3.bucket},
					json: true,
					timeout: 30 * 1000,
					uri:`https://${this.settings.docstore.s3.bucket}.s3.amazonaws.com/${this.project_id}/${doc._id}`
				}));
			};

			return this.DocArchiveManager.destroyAllDocs(this.project_id, err=> {
				let doc;
				expect(err).not.to.exist;

				for (doc of Array.from(this.archivedDocs)) {
					sinon.assert.calledWith(this.request.del, docOpts(doc));
				}
				for (doc of Array.from(this.unarchivedDocs)) {
					expect(this.request.del.calledWith(docOpts(doc))).to.equal(false);
				}  // no notCalledWith

				return done();
			});
		});

		return it("should remove the docs from mongo", function(done){
			this.DocArchiveManager.destroyAllDocs(this.project_id, err=> {
				return expect(err).not.to.exist;
			});

			for (let doc of Array.from(this.mixedDocs)) {
				sinon.assert.calledWith(this.MongoManager.destroyDoc, doc._id);
			}

			return done();
		});
	});
	
	describe("_s3DocToMongoDoc", function() {
		describe("with the old schema", () => it("should return the docs lines", function(done) {
            return this.DocArchiveManager._s3DocToMongoDoc(["doc", "lines"], function(error, doc) {
                expect(doc).to.deep.equal({
                    lines: ["doc", "lines"]
                });
                return done();
            });
        }));
		
		describe("with the new schema", function() {
			it("should return the doc lines and ranges", function(done) {
				this.RangeManager.jsonRangesToMongo = sinon.stub().returns({"mongo": "ranges"});
				return this.DocArchiveManager._s3DocToMongoDoc({
					lines: ["doc", "lines"],
					ranges: {"json": "ranges"},
					schema_v: 1
				}, function(error, doc) {
					expect(doc).to.deep.equal({
						lines: ["doc", "lines"],
						ranges: {"mongo": "ranges"}
					});
					return done();
				});
			});
					
			return it("should return just the doc lines when there are no ranges", function(done) {
				return this.DocArchiveManager._s3DocToMongoDoc({
					lines: ["doc", "lines"],
					schema_v: 1
				}, function(error, doc) {
					expect(doc).to.deep.equal({
						lines: ["doc", "lines"]
					});
					return done();
				});
			});
		});
		
		return describe("with an unrecognised schema", () => it("should return an error", function(done) {
            return this.DocArchiveManager._s3DocToMongoDoc({
                schema_v: 2
            }, function(error, doc) {
                expect(error).to.exist;
                return done();
            });
        }));
	});
	
	return describe("_mongoDocToS3Doc", function() {
		describe("with a valid doc", () => it("should return the json version", function(done) {
            let doc;
            return this.DocArchiveManager._mongoDocToS3Doc((doc = {
                lines: ["doc", "lines"],
                ranges: { "mock": "ranges" }
            }), function(err, s3_doc) {
                expect(s3_doc).to.equal(JSON.stringify({
                    lines: ["doc", "lines"],
                    ranges: { "mock": "ranges" },
                    schema_v: 1
                })
                );
                return done();
            });
        }));
			
		describe("with null bytes in the result", function() {
			beforeEach(function() {
				this._stringify = JSON.stringify;
				return JSON.stringify = sinon.stub().returns('{"bad": "\u0000"}');
			});
			
			afterEach(function() {
				return JSON.stringify = this._stringify;
			});
				
			return it("should return an error", function(done) {
				return this.DocArchiveManager._mongoDocToS3Doc({
					lines: ["doc", "lines"],
					ranges: { "mock": "ranges" }
				}, function(err, s3_doc) {
					expect(err).to.exist;
					return done();
				});
			});
		});
		
		return describe("without doc lines", () => it("should return an error", function(done) {
            return this.DocArchiveManager._mongoDocToS3Doc({}, function(err, s3_doc) {
                expect(err).to.exist;
                return done();
            });
        }));
	});
});
			
			
