# Get the base container running
docker build -t base .

CONTAINER_NAME=new

# Start the container
docker run -t -i --entrypoint /bin/bash --name $CONTAINER_NAME base

# Clean any existing directories
rm -rf /tmp/{a,b}

# Take snapshot of initial container
mkdir /tmp/a ; docker export $CONTAINER_NAME | tar --exclude node_modules -x -C /tmp/a --strip-components=1 overleaf

# In the container, run the following commands
docker exec -i  $CONTAINER_NAME /bin/bash <<'EOF'
npm install -g json
json -I -f package.json -c 'this.overrides["swagger-tools"].multer="2.0.2"'
json -I -f package.json -c 'this.overrides["request@2.88.2"]["form-data"]="2.5.5"'
json -I -f package.json -c 'this.overrides["superagent@7.1.6"] ??= {}'
json -I -f package.json -c 'this.overrides["superagent@7.1.6"]["form-data"]="4.0.4"'
json -I -f package.json -c 'this.overrides["superagent@3.8.3"] ??= {}'
json -I -f package.json -c 'this.overrides["superagent@3.8.3"]["form-data"]="2.5.5"'

npm uninstall -w libraries/metrics @google-cloud/opentelemetry-cloud-trace-exporter @google-cloud/profiler
npm uninstall -w libraries/logger @google-cloud/logging-bunyan
npm uninstall -w services/web @slack/webhook contentful @contentful/rich-text-types @contentful/rich-text-html-renderer
npm uninstall -w services/history-v1 @google-cloud/secret-manager

npm uninstall -w services/web "@node-saml/passport-saml"
npm install -w services/web "@node-saml/passport-saml@^5.1.0"

npm uninstall -w services/web multer
npm install -w services/web "multer@2.0.2"

npm uninstall -w services/history-v1 swagger-tools
npm install -w services/history-v1 swagger-tools@0.10.4

npm uninstall -w services/clsi request
npm install -w services/clsi request@2.88.2
npm install

npm audit --audit-level=high
EOF

# Take snapshot of final container
mkdir /tmp/b ; docker export $CONTAINER_NAME | tar --exclude node_modules -x -C /tmp/b --strip-components=1 overleaf

# Find the diff excluding node modules directories
# The sec_ prefix ensures it applies after pr_* patches.
(cd /tmp ; diff -u -x 'node_modules' -r a/ b/) > sec-npm.patch

# In the docker file we also need to remove linux-libc-dev
apt remove -y linux-libc-dev
