#
# Cookbook Name:: mongodb
# Recipe:: default
#
# Copyright 2014, ShareLaTeX
#

# See http://docs.mongodb.org/manual/tutorial/install-mongodb-on-ubuntu/
apt_repository 'mongodb-10gen' do
  uri          'http://downloads-distro.mongodb.org/repo/ubuntu-upstart'
  distribution 'dist'
  components   ['10gen']
  keyserver    'keyserver.ubuntu.com'
  key          '7F0CEB10'
end

package 'mongodb-10gen' do
  action :install
end