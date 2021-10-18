# Copybara Overleaf sync

[Copybara](https://github.com/google/copybara) is a utility for syncing one
git repository with another, while performing modifications, such as removing
directories. We use this to keep a public OSS mirror of our web repo, but with
the proprietary modules directory removed.

We also use copybara to import Pull Requests from the public mirror to our private
repo, while preserving attribution for the original contributor.


## Running a sync locally

You will need a copy of the `sharelatex/copybara` container, which can be pulled
in, or built from the [copy.bara project](
 https://github.com/google/copybara#getting-started-using-copybara):

```bash
> git clone git@github.com:google/copybara.git
> cd copybara
> docker build --rm -t sharelatex/copybara .
```

There is a `docker-compose.yml` file in this directory which configures
everything. We mount out the copybara cache directory so we don't need to do a
full git clone each time. Check the file for further instructions on running
a sync from your local machine or initialising a sync.

The `.ssh` directory in this directory should have a private key with GitHub
access placed into it have github.com pre-authorized. Your personal `.ssh` will
do the job, and changes in the target repo will maintain the original author.

## Initializing a sync

In order to initialize a sync with a new repository we'll instruct copybara to
start synchronizing from the initial commit:

```yaml
  copybara:
    ...
    environment:
      ...
      COPYBARA_OPTIONS: "--init-history"
```

**Important**: If the repository is not empty the synchronization will start by
removing all the existing content.

## Fixing a bad state

By default, copy.bara expects to find some metadata in the destination repo
commits which it wrote on the last run. This tells it where to pick up syncing
any new changes in the source repo. If things get in a bad state, you can provide
with an explicit reference to a commit in the source repo to start replaying
commits from. Add the following to the `docker-compose.yml` config:

```yaml
  copybara:
    ...
    environment:
      ...
      COPYBARA_OPTIONS: "--last-rev=COMMIT_SHA_FROM_SOURCE_REPO"
```

If the destination repo gets out of sync in some way, reset its master branch
to a point when things were in a good state, and then do a re-sync as above,
but with the last-rev set to the corresponding good commit in the source repo.

## Running a sync in CI

The same `sharelatex/copybara` image and copybara config files is used by
Jenkins to perform the sync at the end of a successful CI build of master. See
the `Jenkinsfile` in the top level directory for this.


## Importing a PR from public to private

We can import a public PR using the `importPullRequest` workflow.


### Setup

#### 1: Get a Github API key

You need a Github API key to manipulate pull requests via the Github api.

- Open https://github.com/settings/tokens
- Create a new token with the `repo` scope turned on
- Open `~/.git-credentials` and add a line like this: `https://user%40example.com:<TOKEN>@github.com`
  - Note that the `@` in the email address is encoded as `%40`

This `~/.git-credentials` file will be mounted into the copybara container by
docker-compose.


### Running the import job

Run copybara with `docker-compose run`:

```
docker-compose run \
  -e COPYBARA_WORKFLOW=importPullRequest \
  -e COPYBARA_SOURCEREF=<PR_NUMBER> \
  -e COPYBARA_OPTIONS='--github-destination-pr-branch <BRANCH_NAME>'
  copybara copybara
```

Change <PR_NUMBER> to the number of the public pull request.

Change <BRANCH_NAME> to a suitable name for the new private branch, example: 'import-pr-xyz'.
(Note, there's no `=` between the flag and the branch name)

This will create a new PR on the private repo with the content from the public PR.
When this private PR is eventually merged and synced back to the public repo, the
original public PR will close automatically, and the changes will be attributed to
the original committer.

### Merging the PR in the private repo

In order to maintain correct attribution it's **important to squash the changes**, otherwise attribution might not be reflected properly.


### Attaching the PR to a particular parent commit

The copybara process will usually figure out the appropriate place to begin the new PR from, but if you want
to specify the parent commit explicitly, you can set the following flag in `COPYBARA_OPTIONS`:

```
  --change_request_parent=<COMMIT_ID>
```


### Errors

There are a few things that can go wrong with this invocation:


#### Wrong owner or permissions on `.ssh/config`

Use `docker-compose run copybara bash -c 'chown -R root:root /root/.ssh'` to fix the ownership
of the mounted ssh key.

You may need to then reclaim ownership on the host later by running `sudo chown -R $USER:$USER ~/.ssh`


#### Can't enter ssh passphrase

Copybara can't handle ssh keys with passphrases, it just hangs at the prompt to enter the passphrase.
We can solve this by mounting our `ssh-agent` socket into the container.

Add the following options to the `docker-compose` invocation:

- `--volume $SSH_AUTH_SOCK:/ssh-agent`
- `-e SSH_AUTH_SOCK=/ssh-agent`

For example:

```
docker-compose run \
  --volume $SSH_AUTH_SOCK:/ssh-agent \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -e COPYBARA_WORKFLOW=importPullRequest \
  -e COPYBARA_SOURCEREF=<PR_NUMBER> \
  -e COPYBARA_OPTIONS='--github-destination-pr-branch <BRANCH_NAME>'
  copybara copybara
```
