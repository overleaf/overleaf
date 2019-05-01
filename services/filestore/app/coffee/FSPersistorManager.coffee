logger = require("logger-sharelatex")
fs = require("fs")
LocalFileWriter = require("./LocalFileWriter")
Errors = require('./Errors')
rimraf = require("rimraf")
_ = require "underscore"

filterName = (key) ->
  return key.replace /\//g, "_"


module.exports =
  sendFile: ( location, target, source, callback = (err)->) ->
    filteredTarget = filterName target
    logger.log location:location, target:filteredTarget, source:source, "sending file"
    done = _.once (err) ->
      if err?
        logger.err err:err, location:location, target:filteredTarget, source:source, "Error on put of file"
      callback(err)
    # actually copy the file (instead of moving it) to maintain consistent behaviour
    # between the different implementations
    sourceStream = fs.createReadStream source
    sourceStream.on 'error', done
    targetStream = fs.createWriteStream "#{location}/#{filteredTarget}"
    targetStream.on 'error', done
    targetStream.on 'finish', () ->
      done()
    sourceStream.pipe targetStream

  sendStream: ( location, target, sourceStream, callback = (err)->) ->
    logger.log location:location, target:target, "sending file stream"
    sourceStream.on "error", (err)->
      logger.err location:location, target:target, err:err "error on stream to send"
    LocalFileWriter.writeStream sourceStream, null, (err, fsPath)=>
      if err?
        logger.err  location:location, target:target, fsPath:fsPath, err:err, "something went wrong writing stream to disk"
        return callback err
      @sendFile location, target, fsPath, (err) -> 
        # delete the temporary file created above and return the original error
        LocalFileWriter.deleteFile fsPath, () ->
          callback(err)

  # opts may be {start: Number, end: Number}
  getFileStream: (location, name, opts, _callback = (err, res)->) ->
    callback = _.once _callback
    filteredName = filterName name
    logger.log location:location, filteredName:filteredName, "getting file"
    sourceStream = fs.createReadStream "#{location}/#{filteredName}", opts
    sourceStream.on 'error', (err) ->
      logger.err err:err, location:location, filteredName:name, "Error reading from file"
      if err.code == 'ENOENT'
        return callback new Errors.NotFoundError(err.message), null
      else
        return callback err, null
    sourceStream.on 'readable', () ->
      # This can be called multiple times, but the callback wrapper
      # ensures the callback is only called once
      return callback null, sourceStream


  copyFile: (location, fromName, toName, callback = (err)->)->
    filteredFromName=filterName fromName
    filteredToName=filterName toName
    logger.log location:location, fromName:filteredFromName, toName:filteredToName, "copying file"
    sourceStream = fs.createReadStream "#{location}/#{filteredFromName}"
    sourceStream.on 'error', (err) ->
      logger.err err:err, location:location, key:filteredFromName, "Error reading from file"
      callback err
    targetStream = fs.createWriteStream "#{location}/#{filteredToName}"
    targetStream.on 'error', (err) ->
      logger.err err:err, location:location, key:filteredToName, "Error writing to file"
      callback err
    targetStream.on 'finish', () ->
      callback null
    sourceStream.pipe targetStream

  deleteFile: (location, name, callback)->
    filteredName = filterName name
    logger.log location:location, filteredName:filteredName, "delete file"
    fs.unlink "#{location}/#{filteredName}", (err) ->
      if err?
        logger.err err:err, location:location, filteredName:filteredName, "Error on delete."
        callback err
      else
        callback()

  deleteDirectory: (location, name, callback = (err)->)->
    filteredName = filterName name.replace(/\/$/,'')
    rimraf "#{location}/#{filteredName}", (err) ->
      if err?
        logger.err err:err, location:location, filteredName:filteredName, "Error on rimraf rmdir."
        callback err
      else
        callback()

  checkIfFileExists:(location, name, callback = (err,exists)->)->
    filteredName = filterName name
    logger.log location:location, filteredName:filteredName, "checking if file exists"
    fs.exists "#{location}/#{filteredName}", (exists) ->
      logger.log location:location, filteredName:filteredName, exists:exists, "checked if file exists"
      callback null, exists

  directorySize:(location, name, callback)->
    filteredName = filterName name.replace(/\/$/,'')
    logger.log location:location, filteredName:filteredName, "get project size in file system"
    fs.readdir "#{location}/#{filteredName}", (err, files) ->
      if err?
        logger.err err:err, location:location, filteredName:filteredName, "something went wrong listing prefix in aws"
        return callback(err)
      totalSize = 0
      _.each files, (entry)->
        fd = fs.openSync "#{location}/#{filteredName}/#{entry}", 'r'
        fileStats = fs.fstatSync(fd)
        totalSize += fileStats.size
        fs.closeSync fd
      logger.log totalSize:totalSize, "total size", files:files
      callback null, totalSize
