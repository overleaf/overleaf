/* eslint-disable
    max-len,
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

const ChatClient = require("./helpers/ChatClient");
const ChatApp = require("./helpers/ChatApp");

describe("Deleting a message", function() {
	before(function(done) {
		this.project_id = ObjectId().toString();
		this.user_id = ObjectId().toString();
		this.thread_id = ObjectId().toString();
		return ChatApp.ensureRunning(done);
	});

	return describe("in a thread", function() {
		before(function(done) {
			return ChatClient.sendMessage(this.project_id, this.thread_id, this.user_id, "first message", (error, response, message) => {
				this.message = message;
				expect(error).to.be.null;
				expect(response.statusCode).to.equal(201);
				return ChatClient.sendMessage(this.project_id, this.thread_id, this.user_id, "deleted message", (error, response, message1) => {
					this.message = message1;
					expect(error).to.be.null;
					expect(response.statusCode).to.equal(201);
					return ChatClient.deleteMessage(this.project_id, this.thread_id, this.message.id, (error, response, body) => {
						expect(error).to.be.null;
						expect(response.statusCode).to.equal(204);
						return done();
					});
				});
			});
		});
		
		return it("should then remove the message from the threads", function(done) {
			return ChatClient.getThreads(this.project_id, (error, response, threads) => {
				expect(error).to.be.null;
				expect(response.statusCode).to.equal(200);
				expect(threads[this.thread_id].messages.length).to.equal(1);
				return done();
			});
		});
	});
});