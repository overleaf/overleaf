## Database migrations

The history service uses knex to manage PostgreSQL migrations.

To create a new migrations, run:
```
npx knex migrate:make migration_name
```

To apply migrations, run:
```
npx knex migrate:latest
```

For more information, consult the [knex migrations
guide](https://knexjs.org/guide/migrations.html#migration-cli).

## Global blobs

Global blobs are blobs that are shared between projects. The list of global
blobs is stored in the projectHistoryGlobalBlobs Mongo collection and is read
when the service starts. Changing the list of global blobs needs to be done
carefully.

### Adding a blob to the global blobs list

If we identify a blob that appears in many projects, we might want to move that
blob to the global blobs list.

1. Add a record for the blob to the projectHistoryGlobalBlobs collection.
2. Restart the history service.
3. Delete any corresponding project blobs.

### Removing a blob from the global blobs list

Removing a blob from the global blobs list is trickier. As soon as the global
blob is made unavailable, every project that needs the blob will have to get
its own copy. To avoid disruptions, follow these steps:

1. In the projectHistoryGlobalBlobs collection, set the `demoted` property to
   `false` on the global blob to remove. This will make the history system
   write new instances of this blob to project blobs, but still read from the
   global blob.

2. Restart the history service.

3. Copy the blob to all projects that need it.

4. Remove the blob from the projectHistoryGlobalBlobs collection.

5. Restart the history service.
