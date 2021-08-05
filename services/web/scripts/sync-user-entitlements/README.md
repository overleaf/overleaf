# Sync User Entitlements

Entitlement information for insitutional (university) sso users is stored in
both the mongo users collection and the postgres v2_user_universities table.
The mongo users collection is authoratative but these need to be in sync for
everything to work properly.

This script takes exports from both mongo and postgres, finds mismatches, and
then corrects the data in postgres so that it matches mongo.

## Exporting users data from mongo

Follow the directions in `google-ops/README.md` for exporting data from mongo
and copying the files to your local machine.

Run the following user export command.
```
mongoexport --uri $READ_ONLY_MONGO_CONNECTION_STRING --collection users --fields '_id,email,emails,samlIdentifiers' --query '{"samlIdentifiers.providerId": {"$exists": 1}}' --out user-entitlements.json
```

**Note: this file contains PII and caution must be exercised to insure that it
is never transferred or stored insecurely and that it is deleted ASAP**

## Exporting data from postgres

Connect to postgres by running `heroku psql -a electric-leaf-4093`

Run the following v2_user_universities export comand.
```
\copy (select uu.user_id, uu.email, uu.cached_entitlement, ud.university_id from v2_user_universities uu LEFT JOIN university_domains ud ON uu.university_domain_id = ud.id WHERE uu.removed_at IS NULL) to 'cached-entitlements.csv' with csv;
```

**Note: this file contains PII and caution must be exercised to insure that it
is never transferred or stored insecurely and that it is deleted ASAP**

## Run sync

```
node scripts/sync-user-entitlements/sync-user-entitlements --user-entitlements user-entitlements.json --cached-entitlements cached-entitlements.csv --commit
```
