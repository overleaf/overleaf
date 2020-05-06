module.exports = {
	combineProjectIdAndDocId(project_id, doc_id) { return `${project_id}:${doc_id}`; },
	splitProjectIdAndDocId(project_and_doc_id) { return project_and_doc_id.split(":"); }
};
