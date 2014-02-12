# This is an implementation of the OT data backend for PostgreSQL. It requires
# that you have two tables defined in your schema: one for the snapshots
# and one for the operations. You must also install the 'pg' package.
#
#
# Example usage:
#
#     var connect = require('connect');
#     var share   = require('share').server;
#
#     var server = connect(connect.logger());
#
#     var options = {
#       db: {
#         type: 'pg',
#         uri:  'tcp://josh:@localhost/sharejs',
#         create_tables_automatically: true
#       }
#     };
#
#     share.attach(server, options);
#     server.listen(9000);
#
# You can run bin/setup_pg to create the SQL tables initially.

pg = require('pg').native

defaultOptions =
  schema: 'sharejs'
  create_tables_automatically: true
  operations_table: 'ops'
  snapshot_table: 'snapshots'

module.exports = PgDb = (options) ->
  return new Db if !(this instanceof PgDb)

  options ?= {}
  options[k] ?= v for k, v of defaultOptions

  client = new pg.Client options.uri
  client.connect()

  snapshot_table = options.schema and "#{options.schema}.#{options.snapshot_table}" or options.snapshot_table
  operations_table = options.schema and "#{options.schema}.#{options.operations_table}" or options.operations_table

  @close = ->
    client.end()

  @initialize = (callback) ->
    console.warn 'Creating postgresql database tables'

    sql = """
      CREATE SCHEMA #{options.schema};

      CREATE TABLE #{snapshot_table} (
        doc text NOT NULL,
        v int4 NOT NULL,
        type text NOT NULL,
        snapshot text NOT NULL,
        meta text NOT NULL,
        created_at timestamp(6) NOT NULL,
        CONSTRAINT snapshots_pkey PRIMARY KEY (doc, v)
      );

      CREATE TABLE #{operations_table} (
        doc text NOT NULL,
        v int4 NOT NULL,
        op text NOT NULL,
        meta text NOT NULL,
        CONSTRAINT operations_pkey PRIMARY KEY (doc, v)
      );
    """
    client.query sql, (error, result) ->
      callback? error?.message

  # This will perminantly delete all data in the database.
  @dropTables = (callback) ->
    sql = "DROP SCHEMA #{options.schema} CASCADE;"
    client.query sql, (error, result) ->
      callback? error.message

  @create = (docName, docData, callback) ->
    sql = """
      INSERT INTO #{snapshot_table} ("doc", "v", "snapshot", "meta", "type", "created_at")
        VALUES ($1, $2, $3, $4, $5, now())
    """
    values = [docName, docData.v, JSON.stringify(docData.snapshot), JSON.stringify(docData.meta), docData.type]
    client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else if error.toString().match "duplicate key value violates unique constraint"
        callback? "Document already exists"
      else
        callback? error?.message

  @delete = (docName, dbMeta, callback) ->
    sql = """
      DELETE FROM #{operations_table}
      WHERE "doc" = $1
      RETURNING *
    """
    values = [docName]
    client.query sql, values, (error, result) ->
      if !error?
        sql = """
          DELETE FROM #{snapshot_table}
          WHERE "doc" = $1
          RETURNING *
        """
        client.query sql, values, (error, result) ->
          if !error? and result.rows.length > 0
            callback?()
          else if !error?
            callback? "Document does not exist"
          else
            callback? error?.message
      else
        callback? error?.message

  @getSnapshot = (docName, callback) ->
    sql = """
      SELECT *
      FROM #{snapshot_table}
      WHERE "doc" = $1
      ORDER BY "v" DESC
      LIMIT 1
    """
    values = [docName]
    client.query sql, values, (error, result) ->
      if !error? and result.rows.length > 0
        row = result.rows[0]
        data =
          v:        row.v
          snapshot: JSON.parse(row.snapshot)
          meta:     JSON.parse(row.meta)
          type:     row.type
        callback? null, data
      else if !error?
        callback? "Document does not exist"
      else
        callback? error?.message

  @writeSnapshot = (docName, docData, dbMeta, callback) ->
    sql = """
      UPDATE #{snapshot_table}
      SET "v" = $2, "snapshot" = $3, "meta" = $4
      WHERE "doc" = $1
    """
    values = [docName, docData.v, JSON.stringify(docData.snapshot), JSON.stringify(docData.meta)]
    client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else
        callback? error?.message

  @getOps = (docName, start, end, callback) ->
    end = if end? then end - 1 else 2147483647
    sql = """
      SELECT *
      FROM #{operations_table}
      WHERE "v" BETWEEN $1 AND $2
      AND "doc" = $3
      ORDER BY "v" ASC
    """
    values = [start, end, docName]
    client.query sql, values, (error, result) ->
      if !error?
        data = result.rows.map (row) ->
          return {
            op:   JSON.parse row.op
            # v:    row.version
            meta: JSON.parse row.meta
          }
        callback? null, data
      else
        callback? error?.message

  @writeOp = (docName, opData, callback) ->
    sql = """
      INSERT INTO #{operations_table} ("doc", "op", "v", "meta")
        VALUES ($1, $2, $3, $4)
    """
    values = [docName, JSON.stringify(opData.op), opData.v, JSON.stringify(opData.meta)]
    client.query sql, values, (error, result) ->
      if !error?
        callback?()
      else
        callback? error?.message

  # Immediately try and create the database tables if need be. Its possible that a query
  # which happens immediately will happen before the database has been initialized.
  #
  # But, its not really a big problem.
  if options.create_tables_automatically
    client.query "SELECT * from #{snapshot_table} LIMIT 0", (error, result) =>
      @initialize() if error?.message.match "does not exist"

  this
