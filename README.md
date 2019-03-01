# ShareLaTeX Docker Image

This is the source for building the sharelatex community-edition docker image.


## End-User Install
Please see the [offical wiki for install
guides](https://github.com/sharelatex/sharelatex/wiki/Production-Installation-Instructions)


## Development

This repo contains two dockerfiles, `Dockerfile-base`, which builds the
`sharelatex/sharelatex-base` image, and `Dockerfile` which builds the
`sharelatex/sharelatex` (or "community") image.

The Base image generally contains the basic dependencies like `wget` and
`aspell`, plus `texlive`. We split this out because it's a pretty heavy set of
dependencies, and it's nice to not have to rebuild all of that every time.

The Sharelatex image extends the base image and adds the actual sharelatex code
and services.

Use `make build-base` and `make build-community` to build these images.


### How the Sharelatex code gets here

This repo uses [the public Sharelatex
repository](https://github.com/sharelatex/sharelatex), which used to be the main
public source for the sharelatex system.

That repo is cloned down into the docker image, and a script then installs all
the services. This way of doing things predates the new dev-env, and isn't
currently tested.


### How services run inside the container

We use the [Phusion base-image](https://github.com/phusion/baseimage-docker)
(which is extended by our `base` image) to provide us with a VM-like container
in which to run the sharelatex services. Baseimage uses the `runit` service
manager to manage services, and we add our init-scripts from the `./runit`
folder.
