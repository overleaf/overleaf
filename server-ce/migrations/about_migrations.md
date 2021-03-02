If migration is stopped mid way it will start at the beginning next time

To see the run migrations do db.getCollection('_migrations').find() you can't do db._migrations.find()

When testing, to roll back a migration run:

```
./node_modules/east/bin/east rollback 5 --adapter east-mongo --url mongodb://localhost:27017/sharelatex
```
