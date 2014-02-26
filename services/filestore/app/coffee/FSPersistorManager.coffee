logger = require("logger-sharelatex")
fs = require("fs")
LocalFileWriter = require("./LocalFileWriter")

module.exports =

  sendFile: ( location, target, source, callback = (err)->) ->
    logger.log location:location, target:target, source:source, "sending file"
    fs.rename source, "#{location}/#{target}", (err) ->
      logger.err err:err, location:location, target:target, source:source, "Error on put of file"
      callback err

  sendStream: ( location, target, sourceStream, callback = (err)->) ->
    logger.log location:location, target:target, source:sourceStream, "sending file stream"
    sourceStream.on "error", (err)->
      logger.err location:location, target:target, source:sourceStream, err:err "error on stream to send"
    LocalFileWriter.writeStream sourceStream, null, (err, fsPath)=>
      if err?
        logger.err  location:location, target:target, fsPath:fsPath, err:err, "something went wrong writing stream to disk"
        return callback err
      @sendFile location, target, fsPath, callback

  getFileStream: (location, name, callback = (err, res)->)->
    logger.log location:location, name:name, "getting file"
    sourceStream = fs.createReadStream "#{location}/#{name}"
    sourceStream.on 'error', (err) ->
      logger.err err:err, location:location, name:name, "Error reading from file"
      callback err
    callback null,sourceStream


  copyFile: (location, fromName, toName, callback = (err)->)->
    logger.log location:location, fromName:fromName, toName:toName, "copying file"
    sourceStream = fs.createReadStream "#{location}/#{fromName}"
    sourceStream.on 'error', (err) ->
      logger.err err:err, location:location, key:fromName, "Error reading from file"
      callback err
    targetStream = fs.createWriteStream "#{location}/#{toName}"
    targetStream.on 'error', (err) ->
      logger.err err:err, location:location, key:targetKey, "Error writing to file"
      callback err
    sourceStream.pipe targetStream

  deleteFile: (location, name, callback)->
    logger.log location:location, name:name, "delete file"
    fs.unlink "#{location}/#{name}", (err) ->
      logger.err err:err, location:location, name:name, "Error on delete."
      callback err

  deleteDirectory: (location, name, callback = (err)->)->
    fs.rmdir "#{location}/#{name}", (err) ->
      logger.err err:err, location:location, name:name, "Error on rmdir."
      callback err

  checkIfFileExists:(location, name, callback = (err,exists)->)->
    logger.log location:location, name:name, "checking if file exists"
    fs.exists "#{location}/#{name}", (exists) ->
      logger.log location:location, name:name, exists:exists, "checked if file exists"
      callback null, exists
