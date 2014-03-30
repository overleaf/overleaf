#
# Cookbook Name:: redis
# Recipe:: default
#
# Copyright 2014, ShareLaTeX
#

# See https://launchpad.net/~chris-lea/+archive/redis-server
apt_repository 'redis-server' do
  uri          'http://ppa.launchpad.net/chris-lea/redis-server/ubuntu'
  distribution node['lsb']['codename']
  components   ['main']
  keyserver    'keyserver.ubuntu.com'
  key          'C7917B12'
end

package 'redis-server' do
  action :upgrade
  options "--force-yes"
end