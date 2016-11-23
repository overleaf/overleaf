# require("coffee-script")

# fs = require("fs")
# _ = require("underscore")

# if not process.argv[2]
#     console.log "Usage: coffee project_size.coffee user_files_path"
# else
#     dirPath = process.argv[2]
#     if not fs.lstatSync(dirPath).isDirectory()
#         console.log dirPath + " directory not exist"
#     else
#         fs.readdir dirPath, (err, files)->
#             projects = []
#             files.forEach (file)->
#                 project_id = file.split("_")[0]
#                 if !projects[project_id]
#                     projects[project_id] = 0
#                 projects[project_id] += fs.lstatSync(dirPath+"/"+file).size

#             ids = _.keys projects
#             console.log "project \t size"
#             ids.forEach (id)->
#                 console.log id + "\t" + projects[id]
