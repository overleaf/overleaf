#
# Cookbook Name:: apt
# Library:: helpers
#
# Copyright 2013 Opscode, Inc.
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

module Apt
  # Helpers for apt
  module Helpers
    # Determines if apt is installed on a system.
    #
    # @return [Boolean]
    def apt_installed?
      !which('apt-get').nil?
    end

    # Finds a command in $PATH
    #
    # @return [String, nil]
    def which(cmd)
      paths = (ENV['PATH'].split(::File::PATH_SEPARATOR) + %w(/bin /usr/bin /sbin /usr/sbin))

      paths.each do |path|
        possible = File.join(path, cmd)
        return possible if File.executable?(possible)
      end

      nil
    end
  end
end

Chef::Recipe.send(:include, ::Apt::Helpers)
Chef::Resource.send(:include, ::Apt::Helpers)
Chef::Provider.send(:include, ::Apt::Helpers)
