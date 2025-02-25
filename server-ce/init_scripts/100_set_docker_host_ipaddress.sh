#!/bin/bash
set -e -o pipefail

# See the bottom of http://stackoverflow.com/questions/24319662/from-inside-of-a-docker-container-how-do-i-connect-to-the-localhost-of-the-mach
echo "$(route -n | awk '/UG[ \t]/{print $2}') dockerhost" >> /etc/hosts
