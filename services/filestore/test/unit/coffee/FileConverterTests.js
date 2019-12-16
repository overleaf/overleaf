/*
 * decaffeinate suggestions:
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
const modulePath = "../../../app/js/FileConverter.js";
const SandboxedModule = require('sandboxed-module');

describe("FileConverter", function() {

	beforeEach(function() {

		this.safe_exec = sinon.stub();
		this.converter = SandboxedModule.require(modulePath, { requires: {
			"./SafeExec": this.safe_exec,
			"logger-sharelatex": {
				log() {},
				err() {}
			},
			"metrics-sharelatex": { 
				inc() {},
				Timer() {
					return {done() {}};
				}
			},
			"settings-sharelatex": (this.Settings = {
				commands: {
					convertCommandPrefix: []
				}
			})
		}
	});

		this.sourcePath = "/this/path/here.eps";
		this.format = "png";
		return this.error = "Error";
	});

	describe("convert", function() {

		it("should convert the source to the requested format", function(done){
			this.safe_exec.callsArgWith(2);
			return this.converter.convert(this.sourcePath, this.format, err=> {
				const args = this.safe_exec.args[0][0];
				args.indexOf(`${this.sourcePath}[0]`).should.not.equal(-1); 
				args.indexOf(`${this.sourcePath}.${this.format}`).should.not.equal(-1); 
				return done();
			});
		});

		it("should return the dest path", function(done){
			this.safe_exec.callsArgWith(2);
			return this.converter.convert(this.sourcePath, this.format, (err, destPath)=> {
				destPath.should.equal(`${this.sourcePath}.${this.format}`);
				return done();
			});
		});

		it("should return the error from convert", function(done){
			this.safe_exec.callsArgWith(2, this.error);
			return this.converter.convert(this.sourcePath, this.format, err=> {
				err.should.equal(this.error);
				return done();
			});
		});

		it("should not accapt an non aproved format", function(done){
			this.safe_exec.callsArgWith(2);
			return this.converter.convert(this.sourcePath, "ahhhhh", err=> {
				expect(err).to.exist;
				return done();
			});
		});
		
		return it("should prefix the command with Settings.commands.convertCommandPrefix", function(done) {
			this.safe_exec.callsArgWith(2);
			this.Settings.commands.convertCommandPrefix = ["nice"];
			return this.converter.convert(this.sourcePath, this.format, err=> {
				const command = this.safe_exec.args[0][0];
				command[0].should.equal("nice");
				return done();
			});
		});
	});

	describe("thumbnail", () => it("should call converter resize with args", function(done){
        this.safe_exec.callsArgWith(2);
        return this.converter.thumbnail(this.sourcePath, err=> {
            const args = this.safe_exec.args[0][0];
            args.indexOf(`${this.sourcePath}[0]`).should.not.equal(-1); 
            return done();
        });
    }));

	return describe("preview", () => it("should call converter resize with args", function(done){
        this.safe_exec.callsArgWith(2);
        return this.converter.preview(this.sourcePath, err=> {
            const args = this.safe_exec.args[0][0];
            args.indexOf(`${this.sourcePath}[0]`).should.not.equal(-1); 
            return done();
        });
    }));
});
