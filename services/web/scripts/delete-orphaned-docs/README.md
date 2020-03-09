# Delete Orphaned Docs

Because of the large numbers of documents and projects it is necessary to detect
orphaned docs using bulk exports of the raw data.

## Exporting Data Files

Follow the directions in `google-ops/README.md` for exporting data from mongo
and copying the files to your local machine.

### Exporting docs

Run the following doc export command to export all doc ids and their associated
project ids in batches of 10,000,000.
```
mongoexport --uri $READ_ONLY_MONGO_CONNECTION_STRING --collection docs --fields '_id,project_id' --skip 0 --limit 10000000 --type=csv --out docs.00000000.csv
```
This will produce files like:
```
_id,project_id
ObjectId(5babb6f864c952737a9a4c32),ObjectId(5b98bba5e2f38b7c88f6a625)
ObjectId(4eecaffcbffa66588e000007),ObjectId(4eecaffcbffa66588e00000d)
```
Concatenate these into a single file: `cat docs.*csv > all-docs-doc_id-project_id.csv`

For object ids the script will accept either plain hex strings or the `ObjectId(...)`
format used by mongoexport.

### Exporting Projects

Export project ids from all `projects` and `deletedProjects`
```
mongoexport --uri $READ_ONLY_MONGO_CONNECTION_STRING --collection projects --fields '_id' --type=csv --out projects.csv
mongoexport --uri $READ_ONLY_MONGO_CONNECTION_STRING --collection deletedProjects --fields 'project._id' --type=csv --out deleted-projects.csv
```
Concatenate these: `cat projects.csv deleted-projects.csv > all-projects-project_id.csv`

## Processing Exported Data

### Create a unique sorted list of project ids from docs
```
cut -d, -f 2 all-docs-doc_id-project_id.csv | sort | uniq > all-docs-project_ids.sorted.uniq.csv
```

### Create a unique sorted list of projects ids from projects
```
sort all-projects-project_id.csv | uniq > all-projects-project_id.sorted.uniq.csv
```

### Create list of project ids in docs but not in projects
```
comm --check-order -23 all-docs-project_ids.sorted.uniq.csv all-projects-project_id.sorted.uniq.csv > orphaned-doc-project_ids.csv
```

### Create list of docs ids with project ids not in projects
```
grep -F -f orphaned-doc-project_ids.csv all-docs-doc_id-project_id.csv > orphaned-doc-doc_id-project_id.csv
```

## Run doc deleter
```
node delete-orphaned-docs orphaned-doc-doc_id-project_id.csv
```

### Commit Changes

By default the script will only print the list of project ids and docs ids to be
deleted. In order to actually delete docs run with the `--commit` argument.

### Selecting Input Lines to Process

The `--limit` and `--offset` arguments can be used to specify which lines to
process. There is one doc per line so a single project will often have multiple
lines, but deletion is based on project id, so if one doc for a project is
deleted all will be deleted, even if all of the input lines are not processed.
