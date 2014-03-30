#
# Cookbook Name:: apt
# Attributes:: default
#
# Copyright 2009-2013, Opscode, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

default['apt']['cacher-client']['restrict_environment'] = false
default['apt']['cacher_dir'] = '/var/cache/apt-cacher-ng'
default['apt']['cacher_interface'] = nil
default['apt']['cacher_port'] = 3142
default['apt']['caching_server'] = false
default['apt']['compiletime'] = false
default['apt']['key_proxy'] = ''
default['apt']['cache_bypass'] = {}
default['apt']['periodic_update_min_delay'] = 86_400
