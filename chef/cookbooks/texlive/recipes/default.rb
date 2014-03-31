#
# Cookbook Name:: texlive
# Recipe:: default
#
# Copyright 2014, YOUR_COMPANY_NAME
#
# All rights reserved - Do Not Redistribute
#

remote_file "#{Chef::Config[:file_cache_path]}/install-tl-unx.tar.gz" do
	source "http://mirror.ctan.org/systems/texlive/tlnet/install-tl-unx.tar.gz"
	action :create_if_missing
end

directory "/install-tl-unx"
bash "extract install-tl" do
	cwd Chef::Config[:file_cache_path]
	code <<-EOH
		tar -xvf install-tl-unx.tar.gz -C /install-tl-unx --strip-components=1
	EOH
	creates "/install-tl-unx/install-tl"
end

file "/install-tl-unx/texlive.profile" do
	content "selected_scheme scheme-#{node[:texlive][:schema]}"
end

bash "install texlive" do
	cwd "/install-tl-unx"
	code <<-EOH
		/install-tl-unx/install-tl -profile /install-tl-unx/texlive.profile
	EOH
	creates "#{node[:texlive][:bin_dir]}/pdflatex"
end

bash "install latexmk" do
	environment({
		"PATH" => "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:#{node[:texlive][:bin_dir]}"
	})
	code "tlmgr install latexmk"
	creates "#{node[:texlive][:bin_dir]}/latexmk"
end