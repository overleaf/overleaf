/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async');
const {
    expect
} = require('chai');
const request = require('request').defaults({
	baseUrl: 'http://localhost:3026'
});

const RealTimeClient = require("./helpers/RealTimeClient");
const FixturesManager = require("./helpers/FixturesManager");

describe('HttpControllerTests', function() {
	describe('without a user', () => it('should return 404 for the client view', function(done) {
        const client_id = 'not-existing';
        return request.get({
            url: `/clients/${client_id}`,
            json: true
        }, function(error, response, data) {
            if (error) { return done(error); }
            expect(response.statusCode).to.equal(404);
            return done();
        });
    }));

	return describe('with a user and after joining a project', function() {
		before(function(done) {
			return async.series([
				cb => {
					return FixturesManager.setUpProject({
						privilegeLevel: "owner"
					}, (error, {project_id, user_id}) => {
						this.project_id = project_id;
						this.user_id = user_id;
						return cb(error);
					});
				},

				cb => {
					return FixturesManager.setUpDoc(this.project_id, {}, (error, {doc_id}) => {
						this.doc_id = doc_id;
						return cb(error);
					});
				},

				cb => {
					this.client = RealTimeClient.connect();
					return this.client.on("connectionAccepted", cb);
				},

				cb => {
					return this.client.emit("joinProject", {project_id: this.project_id}, cb);
				},

				cb => {
					return this.client.emit("joinDoc", this.doc_id, cb);
				}
			], done);
		});

		return it('should send a client view', function(done) {
			return request.get({
				url: `/clients/${this.client.socket.sessionid}`,
				json: true
			}, (error, response, data) => {
				if (error) { return done(error); }
				expect(response.statusCode).to.equal(200);
				expect(data.connected_time).to.exist;
				delete data.connected_time;
				// .email is not set in the session
				delete data.email;
				expect(data).to.deep.equal({
					client_id: this.client.socket.sessionid,
					first_name: 'Joe',
					last_name: 'Bloggs',
					project_id: this.project_id,
					user_id: this.user_id,
					rooms: [
						this.project_id,
						this.doc_id,
					]
				});
				return done();
			});
		});
	});
});
