#
# Cookbook Name:: sharelatex
# Recipe:: default
#
# Copyright 2014, ShareLaTeX
#

directory "/etc/sharelatex"

template "/etc/sharelatex/settings.coffee" do
	mode 0400
	user "www-data"
end

sharelatex_app "web-sharelatex" do
	repository "https://github.com/sharelatex/web-sharelatex.git"
	revision   "master"
end

sharelatex_app "document-updater-sharelatex" do
	repository "https://github.com/sharelatex/document-updater-sharelatex.git"
	revision   "master"
end

sharelatex_app "filestore-sharelatex" do
	repository "https://github.com/sharelatex/filestore-sharelatex.git"
	revision   "master"
end

sharelatex_app "track-changes-sharelatex" do
	repository "https://github.com/sharelatex/track-changes-sharelatex.git"
	revision   "master"
end

sharelatex_app "clsi-sharelatex" do
	repository "https://github.com/sharelatex/clsi-sharelatex.git"
	revision   "master"
end