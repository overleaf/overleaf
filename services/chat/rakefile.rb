namespace "run" do
end

namespace "test" do
	desc "Run the unit tests"
	task :unit => ["compile:unittests"] do
		puts "Running unit tests"
		featurePath = ENV['feature']
		puts featurePath
		if featurePath.nil?
			featurePath = ''
		elsif featurePath.include? '/'
		elsif !featurePath.include? '/'
			featurePath +='/'
		else
			featurePath = ''
		end
		runner = ENV['MOCHA_RUNNER'] || "spec"
		sh %{mocha -R #{runner} test/unit/js/#{featurePath}* --ignore-leaks} do |ok, res|
			if ! ok
				raise "error running unit tests : #{res}"
			end
		end
		
	end
end

namespace "compile" do
	desc "Compile server and client coffeescript files"
	task :app => ["compile:serverApp", "compile:clientApp"]

	desc "Compile the main serverside app folder"
	task :serverApp do
		puts "Compiling app"
		sh %{coffee -o app/js/ -c app/coffee/} do |ok, res|
			if ! ok
				raise "error compiling app folder: #{res}"
			end
			puts 'Finished server app compile'
		end
		sh %{coffee -c app.coffee} do |ok, res|
			if ! ok
				raise "error compiling app file: #{res}"
			end
			puts 'Finished app.coffee compile'
		end
	end

	desc "Compile the main client app folder"
	task :clientApp do
		puts "Compiling client app"
		sh %{coffee -o public/js/ -c public/coffee/} do |ok, res|
			if ! ok
				raise "error compiling client app folder: #{res}"
			end
		end
		sh %{mkdir -p public/js/html}
		sh %{mkdir -p public/js/css}
		sh %{jade < public/jade/templates.jade > public/js/html/templates.html} do |ok, res|
			if !ok
				raise "error compiling jade templates: #{res}"
			end
		end
		sh %{lessc - < public/less/chat.less > public/js/css/chat.css} do |ok, res|
			if !ok
				raise "error compiling css: #{res}"
			end
		end
	end

	desc "compress the js"
	task :compressAndCompileJs do
		sh %{node public/js/r.js -o public/app.build.js} do |ok, res|
			if ! ok
				raise "error compiling client app folder: #{res}"
			end
		end
		puts "Finished client app compile"
	end

	desc "Compile the unit tests folder"
	task :unittests => ["compile:serverApp"] do
		puts "Compiling Unit Tests to JS"
		sh %{coffee -c -o test/unit/js/ test/unit/coffee/} do |ok, res|
			if ! ok
				raise "error compiling Unit tests : #{res}"
			end
		end
	end
end

namespace 'bootstrap' do
	desc "Creates a new Feature and module, and corresponding test framework file"
	task :feature, :feature_name, :module_name do |task, args|
		feature_name = args[:feature_name]
		module_name  = args[:module_name]
		FileUtils.mkdir_p("app/coffee/Features/#{feature_name}")
		File.open("app/coffee/Features/#{feature_name}/#{module_name}.coffee", "w") { |f|
			f.write(<<-EOS
module.exports = #{module_name} =
			EOS
			)
		}
		FileUtils.mkdir_p("test/unit/coffee/#{feature_name}")
		File.open("test/unit/coffee/#{feature_name}/#{module_name}Tests.coffee", "w") { |f|
			f.write(<<-EOS
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/#{feature_name}/#{module_name}.js"
SandboxedModule = require('sandboxed-module')
events = require "events"


describe "#{module_name}", ->
	beforeEach ->
		@#{module_name} = SandboxedModule.require modulePath, requires:

			EOS
			)
		}
	end
end
