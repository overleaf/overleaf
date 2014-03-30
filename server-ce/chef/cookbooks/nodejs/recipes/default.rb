#
# Cookbook Name:: nodejs
# Recipe:: default
#
# Copyright 2014, ShareLaTeX
#

# See https://launchpad.net/~chris-lea/+archive/nodejs
apt_repository 'node.js' do
  uri          'http://ppa.launchpad.net/chris-lea/node.js/ubuntu'
  distribution node['lsb']['codename']
  components   ['main']
  keyserver    'keyserver.ubuntu.com'
  key          'C7917B12'
end

package 'nodejs' do
  action :install
end

execute 'install grunt' do
  command "npm install -g grunt-cli"
  not_if "npm --no-color -g ls 'grunt-cli' 2> /dev/null | grep 'grunt-cli'"
end