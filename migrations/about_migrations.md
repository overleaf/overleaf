* if migration is stopped mid way it will start at the beginging next time
* to see the run migrations do db.getCollection('_migrations').find() you can't do db._migrations.find()