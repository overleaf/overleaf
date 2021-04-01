#!/bin/sh

set -e

## Generate nginx config files from templates,
## with environment variables substituted

nginx_dir='/etc/nginx'
nginx_templates_dir="${nginx_dir}/templates"

if ! [ -d "${nginx_templates_dir}" ]; then
  echo "Nginx: no template directory found, skipping"
  exit 0
fi

nginx_template_file="${nginx_templates_dir}/nginx.conf.template"
nginx_config_file="${nginx_dir}/nginx.conf"

if [ -f "${nginx_template_file}" ]; then
  export NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-4}"
  export NGINX_WORKER_CONNECTIONS="${NGINX_WORKER_CONNECTIONS:-768}"

  echo "Nginx: generating config file from template"

  # Note the single-quotes, they are important.
  # This is a pass-list of env-vars that envsubst
  # should operate on.
  envsubst '${NGINX_WORKER_PROCESSES} ${NGINX_WORKER_CONNECTIONS}' \
    < "${nginx_template_file}" \
    > "${nginx_config_file}"

  echo "Nginx: reloading config"
  service nginx reload
fi
