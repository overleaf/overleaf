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
  export NGINX_KEEPALIVE_TIMEOUT="${NGINX_KEEPALIVE_TIMEOUT:-65}"
  export NGINX_WORKER_CONNECTIONS="${NGINX_WORKER_CONNECTIONS:-768}"
  export NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-4}"

  echo "Nginx: generating config file from template"

  # Note the single-quotes, they are important.
  # This is a pass-list of env-vars that envsubst
  # should operate on.
  # shellcheck disable=SC2016
  envsubst '
    ${NGINX_KEEPALIVE_TIMEOUT}
    ${NGINX_WORKER_CONNECTIONS}
    ${NGINX_WORKER_PROCESSES}
  ' \
    < "${nginx_template_file}" \
    > "${nginx_config_file}"

  echo "Checking Nginx config"
  nginx -t

  echo "Nginx: reloading config"
  service nginx reload
fi
