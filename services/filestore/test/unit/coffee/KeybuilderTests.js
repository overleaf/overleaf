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
const modulePath = "../../../app/js/KeyBuilder.js";
const SandboxedModule = require('sandboxed-module');

describe("LocalFileWriter", function() {

	beforeEach(function() {

		this.keyBuilder = SandboxedModule.require(modulePath, { requires: {
			"logger-sharelatex": {
				log() {},
				err() {}
			}
		}
	}
		);
		return this.key = "123/456";
	});
		
	return describe("cachedKey", function() {

		it("should add the fomat on", function() {
			const opts =
				{format: "png"};
			const newKey = this.keyBuilder.addCachingToKey(this.key, opts);
			return newKey.should.equal(`${this.key}-converted-cache/format-png`);
		});

		it("should add the style on", function() {
			const opts =
				{style: "thumbnail"};
			const newKey = this.keyBuilder.addCachingToKey(this.key, opts);
			return newKey.should.equal(`${this.key}-converted-cache/style-thumbnail`);
		});

		return it("should add format on first", function() {
			const opts = {
				style: "thumbnail",
				format: "png"
			};
			const newKey = this.keyBuilder.addCachingToKey(this.key, opts);
			return newKey.should.equal(`${this.key}-converted-cache/format-png-style-thumbnail`);
		});
	});
});
