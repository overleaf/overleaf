# Copybara Overleaf sync

[Copybara](https://github.com/google/copybara) is a utility for syncing one
git repository with another, while performing modifications, such as removing
directories. We use this to keep a public OSS mirror of our web repo, but with
the modules directory removed. The modules directory is where we place all of
our proprietary code.

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
full git clone each time.

The `.ssh` directory in this directory should have the private key of the 
`sharelatex-ci` GitHub account placed into it (can be retrieved from Jenkins),
and have github.com pre-authorized:
```bash
> mkdir -p ./.ssh
> ssh-keyscan github.com > ./.ssh/known_hosts
> echo 'SHARELATEX_CI_PRIVATE_KEY' > ./.ssh/id_rsa
```
These are mounted into the container for use by copybara.

## Initializing or fixing a bad state

By default, copy.bara expects to find some metadata in the destination repo
commits which it wrote on the last run. This tells it where to pick up syncing
any new changes in the source repo. However, on the first run, or if things get
in a bad state, you can provide with an explicit reference to a commit in the 
source repo to start replaying commits from. Add the following to the
`docker-compose.yml` config:
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
