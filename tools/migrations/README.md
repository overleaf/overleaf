# Migrations

Migrations for the app environment live in this folder, and use the [East](https://github.com/okv/east) migration
framework.

We have a yarn script which wraps east: `yarn run migrations ...`

For example:

```shell
yarn run migrations list -t 'server-ce'
```

**Note:** don't put a `--` between `migrations` and the east arguments. npm strips a lone `--` before forwarding args to
a script, but Yarn 4 (which this repo uses) does not. Instead, it forwards the literal `--` straight into `east`'s
argv, which breaks its subcommand parsing (e.g. `list -t 'saas'` becomes `Unrecognized status "-t"`).

**Note:** run this against the dev-env Mongo from inside the docker network (e.g. via `bin/run web ...`), not directly
from the host. The dev-env Mongo is a single-node replica set whose member is advertised as `mongo:27017`, which only
resolves inside the compose network. `make services/web/migrate` takes care of this but for anything other than a
simple run of outstanding migrations, such as a rollback, you'll need this.

For SAAS, use the rake tasks for staging/production:

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

### Other tags

Besides the environment tags, two more tags change how a migration is handled:

#### `auxiliary`

Use the `auxiliary` tag when the migration operates on collections that live on the auxiliary Mongo
cluster (`mongo.auxUrl`). The tag doesn't affect how the migration reaches those collections: the
handles exported by `lib/mongodb.mjs` already point at whichever cluster holds them, so an
`auxiliary` migration uses the same `db.<collection>` as any other migration.

What the tag controls is where the adapter records the migration, namely the `migrations` collection
on the auxiliary cluster. This is what makes a migration that already ran against the main cluster,
before the auxiliary cluster was provisioned, run again once the auxiliary cluster is configured.
When no auxiliary cluster is configured, the main cluster holds both the collections and the
execution record.

#### `nonblocking`

Deployments are gated on pending migrations: the `scripts/check_blocking.mjs` predeploy hook fails
the rollout when a migration the released image expects hasn't been applied yet. Tagging a migration
`nonblocking` exempts it from that gate, so the deployment goes through even while the migration is
still pending.

Use it for migrations the new code doesn't depend on — for instance adding an index that only
improves performance, or a data cleanup that can trail the deploy. Anything the released code needs
in place to work correctly should stay blocking.

### Creating new migrations

To create a new migration, run:

```shell
yarn run migrations create <migration name>
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
yarn run migrations migrate -t 'server-ce'
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

**Note:** Running `east rollback` without any arguments rolls back _all_ migrations, which you may well not want.
