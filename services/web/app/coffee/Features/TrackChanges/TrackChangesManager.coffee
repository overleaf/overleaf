Project = require("../../models/Project").Project

module.exports = TrackChangesManager =
	toggleTrackChanges: (project_id, track_changes_on, callback = (error) ->) ->
		Project.update {_id: project_id}, {track_changes: track_changes_on}, callback
