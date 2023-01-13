Scripts in this directory were used when we cleaned up the global blobs table,
ensuring that it only contained global blobs. The scripts are meant to be run in this order:

* `01-create-blob-hashes-table.sql`
* `02-set-global-flag.sql`
* `03-create-global-blobs-table.sql`
* `04-swap-global-blob-tables.sql`

The `rollback.sql` can be run to reverse the effect of `03-swap-global-blob-tables.sql`.
