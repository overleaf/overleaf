assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should
expect = chai.expect
modulePath = "../../../app/js/FSPersistorManager.js"
SandboxedModule = require('sandboxed-module')
fs = require("fs")

describe "FSPersistorManagerTests", ->

  beforeEach ->
    @Fs =
      rename:sinon.stub()
      createReadStream:sinon.stub()
      createWriteStream:sinon.stub()
      unlink:sinon.stub()
      rmdir:sinon.stub()
      exists:sinon.stub()
    @LocalFileWriter =
      writeStream: sinon.stub()
    @requires =
      "./LocalFileWriter":@LocalFileWriter
      "fs":@Fs
      "logger-sharelatex":
        log:->
        err:->
    @location = "/tmp"
    @name1 = "530f2407e7ef165704000007/530f838b46d9a9e859000008"
    @name1Filtered ="530f2407e7ef165704000007_530f838b46d9a9e859000008"
    @name2 = "second_file"
    @error = "error_message"
    @FSPersistorManager = SandboxedModule.require modulePath, requires: @requires

  describe "sendFile", ->
    it "should put the file", (done) ->
      @Fs.rename.callsArgWith(2,@error)
      @FSPersistorManager.sendFile @location, @name1, @name2, (err)=>
        @Fs.rename.calledWith( @name2, "#{@location}/#{@name1Filtered}" ).should.equal true
        err.should.equal @error
        done()

  describe "sendStream", ->
    beforeEach ->
      @FSPersistorManager.sendFile = sinon.stub().callsArgWith(3)
      @LocalFileWriter.writeStream.callsArgWith(2, null, @name1)
      @SourceStream =
        on:->

    it "should sent stream to LocalFileWriter", (done)->
      @FSPersistorManager.sendStream @location, @name1, @SourceStream, =>
        @LocalFileWriter.writeStream.calledWith(@SourceStream).should.equal true
        done()

    it "should return the error from LocalFileWriter", (done)->
      @LocalFileWriter.writeStream.callsArgWith(2, @error)
      @FSPersistorManager.sendStream @location, @name1, @SourceStream, (err)=>
        err.should.equal @error
        done()

    it "should send the file to the filestore", (done)->
      @LocalFileWriter.writeStream.callsArgWith(2)
      @FSPersistorManager.sendStream @location, @name1, @SourceStream, (err)=>
        @FSPersistorManager.sendFile.called.should.equal true
        done()

  describe "getFileStream", ->
    it "should use correct file location", (done) ->
      @Fs.createReadStream.returns(
        on:->
      )
      @FSPersistorManager.getFileStream @location, @name1, (err,res)=>
        @Fs.createReadStream.calledWith("#{@location}/#{@name1Filtered}").should.equal.true
        done()

  describe "copyFile", ->
    beforeEach ->
      @ReadStream=
        on:->
        pipe:sinon.stub()
      @WriteStream=
        on:->
      @Fs.createReadStream.returns(@ReadStream)
      @Fs.createWriteStream.returns(@WriteStream)

    it "Should open the source for reading", (done) ->
      @FSPersistorManager.copyFile @location, @name1, @name2, ->
      @Fs.createReadStream.calledWith("#{@location}/#{@name1}").should.equal.true
      done()

    it "Should open the target for writing", (done) ->
      @FSPersistorManager.copyFile @location, @name1, @name2, ->
      @Fs.createWriteStream.calledWith("#{@location}/#{@name2}").should.equal.true
      done()

    it "Should pipe the source to the target", (done) ->
      @FSPersistorManager.copyFile @location, @name1, @name2, ->
      @ReadStream.pipe.calledWith(@WriteStream).should.equal.true
      done()

  describe "deleteFile", ->
    beforeEach ->
      @Fs.unlink.callsArgWith(1,@error)

    it "Should call unlink with correct options", (done) ->
      @FSPersistorManager.deleteFile @location, @name1, (err) =>
        @Fs.unlink.calledWith("#{@location}/#{@name1}").should.equal.true
        done()

    it "Should propogate the error", (done) ->
      @FSPersistorManager.deleteFile @location, @name1, (err) =>
        err.should.equal @error
        done()


  describe "deleteDirectory", ->
    beforeEach ->
      @Fs.rmdir.callsArgWith(1,@error)

    it "Should call rmdir with correct options", (done) ->
      @FSPersistorManager.deleteDirectory @location, @name1, (err) =>
        @Fs.rmdir.calledWith("#{@location}/#{@name1}").should.equal.true
        done()

    it "Should propogate the error", (done) ->
      @FSPersistorManager.deleteDirectory @location, @name1, (err) =>
        err.should.equal @error
        done()

  describe "checkIfFileExists", ->
    beforeEach ->
      @Fs.exists.callsArgWith(1,true)

    it "Should call exists with correct options", (done) ->
      @FSPersistorManager.checkIfFileExists @location, @name1, (exists) =>
        @Fs.exists.calledWith("#{@location}/#{@name1}").should.equal.true
        done()

    # fs.exists simply returns false on any error, so...
    it "should not return an error", (done) ->
      @FSPersistorManager.checkIfFileExists @location, @name1, (err,exists) =>
        expect(err).to.be.null
        done()

    it "Should return true for existing files", (done) ->
      @Fs.exists.callsArgWith(1,true)
      @FSPersistorManager.checkIfFileExists @location, @name1, (err,exists) =>
        exists.should.be.true
        done()

    it "Should return false for non-existing files", (done) ->
      @Fs.exists.callsArgWith(1,false)
      @FSPersistorManager.checkIfFileExists @location, @name1, (err,exists) =>
        exists.should.be.false
        done()


