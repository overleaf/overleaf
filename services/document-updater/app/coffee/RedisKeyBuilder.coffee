# The default key schema looks like:
# 	doclines:foo
# 	DocVersion:foo
# but if we use redis cluster, we want all 'foo' keys to map to the same
# node, so we must use:
# 	doclines:{foo}
# 	DocVersion:{foo}
# since redis hashes on the contents of {...}.
# 
# To transparently support different key schemas for different clients
# (potential writing/reading to both a cluster and single instance 
# while we migrate), instead of keys, we now pass around functions which
# will build the key when passed a schema.
# 
# E.g.
# key_schema = Settings.redis.keys
# key_schema == { docLines: ({doc_id}) -> "doclines:#{doc_id}", ... }
# key_builder = RedisKeyBuilder.docLines({doc_id: "foo"})
# key_builder == (key_schema) -> key_schema.docLines({doc_id: "foo"})
# key = key_builder(key_schema)
# key == "doclines:foo"
module.exports = RedisKeyBuilder =
	blockingKey: ({doc_id}) ->
		return (key_schema) -> key_schema.blockingKey({doc_id})
	docLines: ({doc_id}) ->
		return (key_schema) -> key_schema.docLines({doc_id})
	docOps: ({doc_id}) ->
		return (key_schema) -> key_schema.docOps({doc_id})
	docVersion: ({doc_id}) ->
		return (key_schema) -> key_schema.docVersion({doc_id})
	docHash: ({doc_id}) ->
		return (key_schema) -> key_schema.docHash({doc_id})
	projectKey: ({doc_id}) ->
		return (key_schema) -> key_schema.projectKey({doc_id})
	uncompressedHistoryOp: ({doc_id}) ->
		return (key_schema) -> key_schema.uncompressedHistoryOp({doc_id})
	pendingUpdates: ({doc_id}) ->
		return (key_schema) -> key_schema.pendingUpdates({doc_id})
	ranges: ({doc_id}) ->
		return (key_schema) -> key_schema.ranges({doc_id})
	docsInProject: ({project_id}) ->
		return (key_schema) -> key_schema.docsInProject({project_id})
	docsWithHistoryOps: ({project_id}) ->
		return (key_schema) -> key_schema.docsWithHistoryOps({project_id})
