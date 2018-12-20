/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {ObjectId} = require("../../../app/js/mongojs");
const { expect } = require("chai");
const crypto = require("crypto");

const ChatClient = require("./helpers/ChatClient");
const ChatApp = require("./helpers/ChatApp");

describe("Deleting a thread", function() {
	before(function(done) {
		this.project_id = ObjectId().toString();
		this.user_id = ObjectId().toString();
		return ChatApp.ensureRunning(done);
	});

	return describe("with a thread that is deleted", function() {
		before(function(done) {
			this.thread_id = ObjectId().toString();
			this.content = "deleted thread message";
			return ChatClient.sendMessage(this.project_id, this.thread_id, this.user_id, this.content, (error, response, body) => {
				expect(error).to.be.null;
				expect(response.statusCode).to.equal(201);
				return ChatClient.deleteThread(this.project_id, this.thread_id, (error, response, body) => {
					expect(error).to.be.null;
					expect(response.statusCode).to.equal(204);
					return done();
				});
			});
		});
		
		return it("should then not list the thread for the project", function(done) {
			return ChatClient.getThreads(this.project_id, (error, response, threads) => {
				expect(error).to.be.null;
				expect(response.statusCode).to.equal(200);
				expect(Object.keys(threads).length).to.equal(0);
				return done();
			});
		});
	});
});
