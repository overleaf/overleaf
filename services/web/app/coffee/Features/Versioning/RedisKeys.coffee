module.exports =
	buildLastUpdatedKey: (project_id) -> "project_last_updated:#{project_id}"
	buildLastSnapshotKey: (project_id) -> "project_last_snapshot:#{project_id}"
	projectsToSnapshotKey: "projects_to_snapshot"
	usersToPollTpdsForUpdates: "users_with_active_projects"
