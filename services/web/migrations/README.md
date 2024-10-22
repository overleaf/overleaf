# Migrations

Migrations for the app environment live in this folder, and use the [East](https://github.com/okv/east) migration
framework.

We have a npm script which wraps east: `npm run migrations -- ...`

For example:

```shell
npm run migrations -- list -t 'server-ce'
```

For SAAS, use the rake tasks for staging/production
```shell
rake deploy:migrations:list[staging]
```

### Environments and Tags

Overleaf is deployed in three different environments:

- `server-ce`: community edition installations (the base system)
- `server-pro`: server pro installations
- `saas`: the production overleaf site

All migrations are tagged with the environments they should run in.
For example, a migration that should run in every environment would be tagged with `['server-ce', 'server-pro', 'saas']`.

When invoking east, we specify the relevant tags with the `-t` or `--tags` flag.
Our adapter will refuse to run if this flag is not set.


### Creating new migrations

To create a new migration, run:

```shell
npm run migrations -- create <migration name>
```

This command will create a new migration file in the migrations folder, based on a template. The template provides
`migrate` and `rollback` methods, which are run by the `east` binary when running the migrations. `rollback` should
undo the changes made in `migrate`.

#### Running scripts as a migration

To run a script in a migration file, look at `migrations/20190730093801_script_example.js`, which runs the script
`scripts/example/script_for_migration.mjs`. This uses a method where the script can be run standalone via `node`, or
through the migrations' mechanism.

### Running migrations

To run all migrations in a server-ce environment:
```shell
npm run migrations -- migrate -t 'server-ce'
# Note: They are run by default on container start.
```

To run all migrations in a SAAS environment use the rake task:
```shell
# list first and check that only your newly added migration is shown. If not, ask in the dev channel for help.
rake deploy:migrations:list[staging]
# After confirming the listing, run the migrations
rake deploy:migrations[staging]
```

To run all migrations in the dev-env:
```shell
make services/web/migrate
# Note: "make install" will pick them up as well
```

The `-t` flag also works with other `east` commands like `rollback`, and `list`.

For other options, or for information on how to roll migrations back, take a look at the
[East](https://github.com/okv/east) documentation.

### Tips

Try to use Mongo directly via the `db` object instead of using Mongoose models. Migrations will need to run in the
future, and model files can change. It's unwise to make the migrations depend on code which might change.

**Note:** Running `east rollback` without any arguments rolls back *all* migrations, which you may well not want.
