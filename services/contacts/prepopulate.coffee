# Usage: coffee preprocess.coffee projects.json done.csv
# where projects.json is the output of 
# mongoexport <CREDENTIALS> --db sharelatex-staging --collection projects --type=json --fields owner_ref,collaberator_refs,readOnly_refs --query '{ $or: [{collaberator_refs: { $not : {$size: 0} }}, {readOnly_refs: { $not: {$size: 0}}}]}'

fs = require "fs"

projects = fs.readFileSync(process.argv[2]).toString()
projects = projects.split("\n").filter((p) -> p!="").map (p) -> JSON.parse(p)

contact_pairs = []
for project in projects
	project_id = project._id.$oid
	owner_id = project.owner_ref.$oid
	contact_ids = project.collaberator_refs.concat(project.readOnly_refs).map (r) -> r.$oid
	for contact_id in contact_ids
		contact_pairs.push [project_id, owner_id, contact_id]

# Done list is a list of pairs owner_id:contact_id
DONE_FILE = process.argv[3]
done_list = fs.readFileSync(DONE_FILE).toString()
done_contacts = {}
for done_pair in done_list.split("\n")
	done_contacts[done_pair] = true

workers = []
for contact_pair in contact_pairs
	do (contact_pair) ->
		workers.push (cb) ->
			if done_contacts[contact_pair.join(":")]
				console.log "ALREADY DONE", contact_pair.join(":"), "SKIPPING"
				cb()
			else
				[project_id, owner_id, contact_id] = contact_pair
				console.log "PINGING CONTACT API (OWNER: #{owner_id}, CONTACT: #{contact_id})..."
				require("request").post {
					url: "http://localhost:3036/user/#{owner_id}/contacts"
					json: { contact_id }
				}, (error, response, body) ->
					return cb(error) if error?
					if response.statusCode != 204
						return cb(new Error("bad status code: #{response.statusCode}"))
					console.log "DONE, WRITING TO DONE FILE..."
					fs.appendFile DONE_FILE, contact_pair.join(":") + "\n", (error) ->
						return cb(error) if error?
						console.log "WRITTEN"
						cb()

require("async").series workers, (error) ->
	console.error error if error?
	console.log "DONE"