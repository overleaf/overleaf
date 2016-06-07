module.exports =
	combineProjectIdAndDocId: (project_id, doc_id) -> "#{project_id}:#{doc_id}"
	splitProjectIdAndDocId: (project_and_doc_id) -> project_and_doc_id.split(":")
