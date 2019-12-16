/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
  assert
} = require("chai");
const sinon = require('sinon');
const chai = require('chai');
const {
  should
} = chai;
const {
  expect
} = chai;
const modulePath = "../../../app/js/FSPersistorManager.js";
const SandboxedModule = require('sandboxed-module');
const fs = require("fs");
const response = require("response");

describe("FSPersistorManagerTests", function() {

  beforeEach(function() {
    this.Fs = {
      rename:sinon.stub(),
      createReadStream:sinon.stub(),
      createWriteStream:sinon.stub(),
      unlink:sinon.stub(),
      rmdir:sinon.stub(),
      exists:sinon.stub(),
      readdir:sinon.stub(),
      open:sinon.stub(),
      openSync:sinon.stub(),
      fstatSync:sinon.stub(),
      closeSync:sinon.stub(),
      stat:sinon.stub()
    };
    this.Rimraf = sinon.stub();
    this.LocalFileWriter = {
      writeStream: sinon.stub(),
      deleteFile: sinon.stub()
    };
    this.requires = {
      "./LocalFileWriter":this.LocalFileWriter,
      "fs":this.Fs,
      "logger-sharelatex": {
        log() {},
        err() {}
      },
      "response":response,
      "rimraf":this.Rimraf,
      "./Errors": (this.Errors =
        {NotFoundError: sinon.stub()})
    };
    this.location = "/tmp";
    this.name1 = "530f2407e7ef165704000007/530f838b46d9a9e859000008";
    this.name1Filtered ="530f2407e7ef165704000007_530f838b46d9a9e859000008";
    this.name2 = "second_file";
    this.error = "error_message";
    return this.FSPersistorManager = SandboxedModule.require(modulePath, {requires: this.requires});
  });

  describe("sendFile", function() {
    beforeEach(function() {
      return this.Fs.createReadStream = sinon.stub().returns({
        on() {},
        pipe() {}
      });
    });

    it("should copy the file", function(done) {
      this.Fs.createWriteStream =sinon.stub().returns({
        on(event, handler) {
          if (event === 'finish') { return process.nextTick(handler); }
        }
      });
      return this.FSPersistorManager.sendFile(this.location, this.name1, this.name2, err=> {
        this.Fs.createReadStream.calledWith(this.name2).should.equal(true);
        this.Fs.createWriteStream.calledWith(`${this.location}/${this.name1Filtered}` ).should.equal(true);
        return done();
      });
    });

    return it("should return an error if the file cannot be stored", function(done) {
      this.Fs.createWriteStream =sinon.stub().returns({
        on: (event, handler) => {
         if (event === 'error') {
          return process.nextTick(() => {
            return handler(this.error);
          });
        }
       }
      });
      return this.FSPersistorManager.sendFile(this.location, this.name1, this.name2, err=> {
        this.Fs.createReadStream.calledWith(this.name2).should.equal(true);
        this.Fs.createWriteStream.calledWith(`${this.location}/${this.name1Filtered}` ).should.equal(true);
        err.should.equal(this.error);
        return done();
      });
    });
  });

  describe("sendStream", function() {
    beforeEach(function() {
      this.FSPersistorManager.sendFile = sinon.stub().callsArgWith(3);
      this.LocalFileWriter.writeStream.callsArgWith(2, null, this.name1);
      this.LocalFileWriter.deleteFile.callsArg(1);
      return this.SourceStream =
        {on() {}};
    });

    it("should sent stream to LocalFileWriter", function(done){
      return this.FSPersistorManager.sendStream(this.location, this.name1, this.SourceStream, () => {
        this.LocalFileWriter.writeStream.calledWith(this.SourceStream).should.equal(true);
        return done();
      });
    });

    it("should return the error from LocalFileWriter", function(done){
      this.LocalFileWriter.writeStream.callsArgWith(2, this.error);
      return this.FSPersistorManager.sendStream(this.location, this.name1, this.SourceStream, err=> {
        err.should.equal(this.error);
        return done();
      });
    });

    return it("should send the file to the filestore", function(done){
      this.LocalFileWriter.writeStream.callsArgWith(2);
      return this.FSPersistorManager.sendStream(this.location, this.name1, this.SourceStream, err=> {
        this.FSPersistorManager.sendFile.called.should.equal(true);
        return done();
      });
    });
  });

  describe("getFileStream", function() {
    beforeEach(function() {
      return this.opts = {};});

    it("should use correct file location", function(done) {
      this.FSPersistorManager.getFileStream(this.location, this.name1, this.opts, (err,res) => {});
      this.Fs.open.calledWith(`${this.location}/${this.name1Filtered}`).should.equal(true);
      return done();
    });

    describe("with start and end options", function() {

      beforeEach(function() {
        this.fd = 2019;
        this.opts_in = {start: 0, end: 8};
        this.opts = {start: 0, end: 8, fd: this.fd};
        return this.Fs.open.callsArgWith(2, null, this.fd);
      });

      return it('should pass the options to createReadStream', function(done) {
        this.FSPersistorManager.getFileStream(this.location, this.name1, this.opts_in, (err,res)=> {});
        this.Fs.createReadStream.calledWith(null, this.opts).should.equal(true);
        return done();
      });
    });

    return describe("error conditions", function() {

      describe("when the file does not exist", function() {

        beforeEach(function() {
          this.fakeCode = 'ENOENT';
          const err = new Error();
          err.code = this.fakeCode;
          return this.Fs.open.callsArgWith(2, err, null);
        });

        return it("should give a NotFoundError", function(done) {
          return this.FSPersistorManager.getFileStream(this.location, this.name1, this.opts, (err,res)=> {
            expect(res).to.equal(null);
            expect(err).to.not.equal(null);
            expect(err instanceof this.Errors.NotFoundError).to.equal(true);
            return done();
          });
        });
      });

      return describe("when some other error happens", function() {

        beforeEach(function() {
          this.fakeCode = 'SOMETHINGHORRIBLE';
          const err = new Error();
          err.code = this.fakeCode;
          return this.Fs.open.callsArgWith(2, err, null);
        });

        return it("should give an Error", function(done) {
          return this.FSPersistorManager.getFileStream(this.location, this.name1, this.opts, (err,res)=> {
            expect(res).to.equal(null);
            expect(err).to.not.equal(null);
            expect(err instanceof Error).to.equal(true);
            return done();
          });
        });
      });
    });
  });

  describe("getFileSize", function() {
    it("should return the file size", function(done) {
      const expectedFileSize = 75382;
      this.Fs.stat.yields(new Error("fs.stat got unexpected arguments"));
      this.Fs.stat.withArgs(`${this.location}/${this.name1Filtered}`)
        .yields(null, { size: expectedFileSize });

      return this.FSPersistorManager.getFileSize(this.location, this.name1, (err, fileSize) => {
        if (err != null) {
          return done(err);
        }
        expect(fileSize).to.equal(expectedFileSize);
        return done();
      });
    });

    it("should throw a NotFoundError if the file does not exist", function(done) {
      const error = new Error();
      error.code = "ENOENT";
      this.Fs.stat.yields(error);

      return this.FSPersistorManager.getFileSize(this.location, this.name1, (err, fileSize) => {
        expect(err).to.be.instanceof(this.Errors.NotFoundError);
        return done();
      });
    });

    return it("should rethrow any other error", function(done) {
      const error = new Error();
      this.Fs.stat.yields(error);

      return this.FSPersistorManager.getFileSize(this.location, this.name1, (err, fileSize) => {
        expect(err).to.equal(error);
        return done();
      });
    });
  });

  describe("copyFile", function() {
    beforeEach(function() {
      this.ReadStream= {
        on() {},
        pipe:sinon.stub()
      };
      this.WriteStream=
        {on() {}};
      this.Fs.createReadStream.returns(this.ReadStream);
      return this.Fs.createWriteStream.returns(this.WriteStream);
    });

    it("Should open the source for reading", function(done) {
      this.FSPersistorManager.copyFile(this.location, this.name1, this.name2, function() {});
      this.Fs.createReadStream.calledWith(`${this.location}/${this.name1Filtered}`).should.equal(true);
      return done();
    });

    it("Should open the target for writing", function(done) {
      this.FSPersistorManager.copyFile(this.location, this.name1, this.name2, function() {});
      this.Fs.createWriteStream.calledWith(`${this.location}/${this.name2}`).should.equal(true);
      return done();
    });

    return it("Should pipe the source to the target", function(done) {
      this.FSPersistorManager.copyFile(this.location, this.name1, this.name2, function() {});
      this.ReadStream.pipe.calledWith(this.WriteStream).should.equal(true);
      return done();
    });
  });

  describe("deleteFile", function() {
    beforeEach(function() {
      return this.Fs.unlink.callsArgWith(1,this.error);
    });

    it("Should call unlink with correct options", function(done) {
      return this.FSPersistorManager.deleteFile(this.location, this.name1, err => {
        this.Fs.unlink.calledWith(`${this.location}/${this.name1Filtered}`).should.equal(true);
        return done();
      });
    });

    return it("Should propogate the error", function(done) {
      return this.FSPersistorManager.deleteFile(this.location, this.name1, err => {
        err.should.equal(this.error);
        return done();
      });
    });
  });


  describe("deleteDirectory", function() {
    beforeEach(function() {
      return this.Rimraf.callsArgWith(1,this.error);
    });

    it("Should call rmdir(rimraf) with correct options", function(done) {
      return this.FSPersistorManager.deleteDirectory(this.location, this.name1, err => {
        this.Rimraf.calledWith(`${this.location}/${this.name1Filtered}`).should.equal(true);
        return done();
      });
    });

    return it("Should propogate the error", function(done) {
      return this.FSPersistorManager.deleteDirectory(this.location, this.name1, err => {
        err.should.equal(this.error);
        return done();
      });
    });
  });

  describe("checkIfFileExists", function() {
    beforeEach(function() {
      return this.Fs.exists.callsArgWith(1,true);
    });

    it("Should call exists with correct options", function(done) {
      return this.FSPersistorManager.checkIfFileExists(this.location, this.name1, exists => {
        this.Fs.exists.calledWith(`${this.location}/${this.name1Filtered}`).should.equal(true);
        return done();
      });
    });

    // fs.exists simply returns false on any error, so...
    it("should not return an error", function(done) {
      return this.FSPersistorManager.checkIfFileExists(this.location, this.name1, (err,exists) => {
        expect(err).to.be.null;
        return done();
      });
    });

    it("Should return true for existing files", function(done) {
      this.Fs.exists.callsArgWith(1,true);
      return this.FSPersistorManager.checkIfFileExists(this.location, this.name1, (err,exists) => {
        exists.should.be.true;
        return done();
      });
    });

    return it("Should return false for non-existing files", function(done) {
      this.Fs.exists.callsArgWith(1,false);
      return this.FSPersistorManager.checkIfFileExists(this.location, this.name1, (err,exists) => {
        exists.should.be.false;
        return done();
      });
    });
  });

  return describe("directorySize", function() {

    it("should propogate the error", function(done) {
      this.Fs.readdir.callsArgWith(1, this.error);
      return this.FSPersistorManager.directorySize(this.location, this.name1, (err, totalsize) => {
        err.should.equal(this.error);
        return done();
      });
    });

    return it("should sum directory files size", function(done) {
      this.Fs.readdir.callsArgWith(1, null, [ {'file1': 'file1'}, {'file2': 'file2'} ]);
      this.Fs.fstatSync.returns({size : 1024});
      return this.FSPersistorManager.directorySize(this.location, this.name1, (err, totalsize) => {
        expect(totalsize).to.equal(2048);
        return done();
      });
    });
  });
});
