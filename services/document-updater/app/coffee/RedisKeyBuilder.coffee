ALLDOCSKEY = "AllDocIds"
PROJECTKEY = "ProjectId"
BLOCKINGKEY = "Blocking"
CHANGEQUE = "ChangeQue"
DOCSINPROJECT = "DocsIn"
PENDINGUPDATESKEY = "PendingUpdates"
DOCLINES = "doclines"
DOCOPS = "DocOps"
DOCVERSION = "DocVersion"
DOCIDSWITHPENDINGUPDATES = "DocsWithPendingUpdates"
DOCSWITHHISTORYOPS = "DocsWithHistoryOps"
UNCOMPRESSED_HISTORY_OPS = "UncompressedHistoryOps"

module.exports =

	allDocs : ALLDOCSKEY
	docLines : (op)-> DOCLINES+":"+op.doc_id
	docOps : (op)-> DOCOPS+":"+op.doc_id
	uncompressedHistoryOp: (op) -> UNCOMPRESSED_HISTORY_OPS + ":" + op.doc_id
	docVersion : (op)-> DOCVERSION+":"+op.doc_id
	projectKey : (op)-> PROJECTKEY+":"+op.doc_id
	blockingKey : (op)-> BLOCKINGKEY+":"+op.doc_id
	changeQue : (op)-> CHANGEQUE+":"+op.project_id
	docsInProject : (op)-> DOCSINPROJECT+":"+op.project_id
	pendingUpdates : (op)-> PENDINGUPDATESKEY+":"+op.doc_id
	docsWithPendingUpdates : DOCIDSWITHPENDINGUPDATES
	combineProjectIdAndDocId: (project_id, doc_id) -> "#{project_id}:#{doc_id}"
	splitProjectIdAndDocId: (project_and_doc_id) -> project_and_doc_id.split(":")
	docsWithHistoryOps: (op) -> DOCSWITHHISTORYOPS + ":" + op.project_id
	now : (key)->
		d = new Date()
		d.getDate()+":"+(d.getMonth()+1)+":"+d.getFullYear()+":"+key
