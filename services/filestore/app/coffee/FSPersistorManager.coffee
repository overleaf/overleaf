logger = require("logger-sharelatex")
fs = require("fs")
LocalFileWriter = require("./LocalFileWriter")

filterName = (key) ->
  return key.replace /\//g, "_"
  

module.exports =
  sendFile: ( location, target, source, callback = (err)->) ->
    filteredTarget = filterName target
    logger.log location:location, target:filteredTarget, source:source, "sending file"
    fs.rename source, "#{location}/#{filteredTarget}", (err) ->
      if err!=null
        logger.err err:err, location:location, target:filteredTarget, source:source, "Error on put of file"
      callback err

  sendStream: ( location, target, sourceStream, callback = (err)->) ->
    logger.log location:location, target:target, "sending file stream"
    sourceStream.on "error", (err)->
      logger.err location:location, target:target, err:err "error on stream to send"
    LocalFileWriter.writeStream sourceStream, null, (err, fsPath)=>
      if err?
        logger.err  location:location, target:target, fsPath:fsPath, err:err, "something went wrong writing stream to disk"
        return callback err
      @sendFile location, target, fsPath, callback

  getFileStream: (location, name, callback = (err, res)->)->
    filteredName = filterName name
    logger.log location:location, name:filteredName, "getting file"
    sourceStream = fs.createReadStream "#{location}/#{filteredName}"
    sourceStream.on 'error', (err) ->
      logger.err err:err, location:location, name:name, "Error reading from file"
      callback err
    callback null,sourceStream


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
    sourceStream.pipe targetStream

  deleteFile: (location, name, callback)->
    filteredName = filterName name
    logger.log location:location, name:filteredName, "delete file"
    fs.unlink "#{location}/#{filteredName}", (err) ->
      logger.err err:err, location:location, name:filteredName, "Error on delete."
      callback err

  deleteDirectory: (location, name, callback = (err)->)->
    filteredName = filterName name
    fs.rmdir "#{location}/#{filteredName}", (err) ->
      logger.err err:err, location:location, name:filteredName, "Error on rmdir."
      callback err

  checkIfFileExists:(location, name, callback = (err,exists)->)->
    filteredName = filterName name
    logger.log location:location, name:filteredName, "checking if file exists"
    fs.exists "#{location}/#{filteredName}", (exists) ->
      logger.log location:location, name:filteredName, exists:exists, "checked if file exists"
      callback null, exists
