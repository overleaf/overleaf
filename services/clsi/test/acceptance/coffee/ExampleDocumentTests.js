/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Client = require("./helpers/Client");
const request = require("request");
require("chai").should();
const fs = require("fs");
const ChildProcess = require("child_process");
const ClsiApp = require("./helpers/ClsiApp");
const logger = require("logger-sharelatex");
const Path = require("path");
const fixturePath = path => Path.normalize(__dirname + "/../fixtures/" + path);
const process = require("process");
console.log(process.pid, process.ppid, process.getuid(),process.getgroups(), "PID");
try {
	console.log("creating tmp directory", fixturePath("tmp"));
	fs.mkdirSync(fixturePath("tmp"));
} catch (error) {
	const err = error;
	console.log(err, fixturePath("tmp"), "unable to create fixture tmp path");
}

const MOCHA_LATEX_TIMEOUT = 60 * 1000;

const convertToPng = function(pdfPath, pngPath, callback) {
	if (callback == null) { callback = function(error) {}; }
	const command = `convert ${fixturePath(pdfPath)} ${fixturePath(pngPath)}`;
	console.log("COMMAND");
	console.log(command);
	const convert = ChildProcess.exec(command);
	const stdout = "";
	convert.stdout.on("data", chunk => console.log("STDOUT", chunk.toString()));
	convert.stderr.on("data", chunk => console.log("STDERR", chunk.toString()));
	return convert.on("exit", () => callback());
};

const compare = function(originalPath, generatedPath, callback) {
	if (callback == null) { callback = function(error, same) {}; }
	const diff_file = `${fixturePath(generatedPath)}-diff.png`;
	const proc = ChildProcess.exec(`compare -metric mae ${fixturePath(originalPath)} ${fixturePath(generatedPath)} ${diff_file}`);
	let stderr = "";
	proc.stderr.on("data", chunk => stderr += chunk);
	return proc.on("exit", function() {
		if (stderr.trim() === "0 (0)") {
			// remove output diff if test matches expected image
			fs.unlink(diff_file, function(err) {
				if (err) {
					throw err;
				}
			});
			return callback(null, true);
		} else {
			console.log("compare result", stderr);
			return callback(null, false);
		}
	});
};

const checkPdfInfo = function(pdfPath, callback) {
	if (callback == null) { callback = function(error, output) {}; }
	const proc = ChildProcess.exec(`pdfinfo ${fixturePath(pdfPath)}`);
	let stdout = "";
	proc.stdout.on("data", chunk => stdout += chunk);
	proc.stderr.on("data", chunk => console.log("STDERR", chunk.toString()));
	return proc.on("exit", function() {
		if (stdout.match(/Optimized:\s+yes/)) {
			return callback(null, true);
		} else {
			return callback(null, false);
		}
	});
};

const compareMultiplePages = function(project_id, callback) {
	if (callback == null) { callback = function(error) {}; }
	var compareNext = function(page_no, callback) {
		const path = `tmp/${project_id}-source-${page_no}.png`;
		return fs.stat(fixturePath(path), function(error, stat) {
			if (error != null) {
				return callback();
			} else {
				return compare(`tmp/${project_id}-source-${page_no}.png`, `tmp/${project_id}-generated-${page_no}.png`, (error, same) => {
					if (error != null) { throw error; }
					same.should.equal(true);
					return compareNext(page_no + 1, callback);
				});
			}
		});
	};
	return compareNext(0, callback);
};

const comparePdf = function(project_id, example_dir, callback) {
	if (callback == null) { callback = function(error) {}; }
	console.log("CONVERT");
	console.log(`tmp/${project_id}.pdf`, `tmp/${project_id}-generated.png`);
	return convertToPng(`tmp/${project_id}.pdf`, `tmp/${project_id}-generated.png`, error => {
		if (error != null) { throw error; }
		return convertToPng(`examples/${example_dir}/output.pdf`, `tmp/${project_id}-source.png`, error => {
			if (error != null) { throw error; }
			return fs.stat(fixturePath(`tmp/${project_id}-source-0.png`), (error, stat) => {
				if (error != null) {
					return compare(`tmp/${project_id}-source.png`, `tmp/${project_id}-generated.png`, (error, same) => {
						if (error != null) { throw error; }
						same.should.equal(true);
						return callback();
					});
				} else {
					return compareMultiplePages(project_id, function(error) {
						if (error != null) { throw error; }
						return callback();
					});
				}
			});
		});
	});
};

const downloadAndComparePdf = function(project_id, example_dir, url, callback) {
	if (callback == null) { callback = function(error) {}; }
	const writeStream = fs.createWriteStream(fixturePath(`tmp/${project_id}.pdf`));
	request.get(url).pipe(writeStream);
	console.log("writing file out", fixturePath(`tmp/${project_id}.pdf`));
	return writeStream.on("close", () => {
		return checkPdfInfo(`tmp/${project_id}.pdf`, (error, optimised) => {
			if (error != null) { throw error; }
			optimised.should.equal(true);
			return comparePdf(project_id, example_dir, callback);
		});
	});
};

Client.runServer(4242, fixturePath("examples"));

describe("Example Documents", function() {
	before(done =>
		ChildProcess.exec("rm test/acceptance/fixtures/tmp/*").on("exit", () => ClsiApp.ensureRunning(done))
	);


	return Array.from(fs.readdirSync(fixturePath("examples"))).map((example_dir) =>
		(example_dir =>
			describe(example_dir, function() {
				before(function() {
					return this.project_id = Client.randomId() + "_" + example_dir;
				});

				it("should generate the correct pdf", function(done) {
					this.timeout(MOCHA_LATEX_TIMEOUT);
					return Client.compileDirectory(this.project_id, fixturePath("examples"), example_dir, 4242, (error, res, body) => {
						if (error || (__guard__(body != null ? body.compile : undefined, x => x.status) === "failure")) {
							console.log("DEBUG: error", error, "body", JSON.stringify(body));
						}
						const pdf = Client.getOutputFile(body, "pdf");
						return downloadAndComparePdf(this.project_id, example_dir, pdf.url, done);
					});
				});

				return it("should generate the correct pdf on the second run as well", function(done) {
					this.timeout(MOCHA_LATEX_TIMEOUT);
					return Client.compileDirectory(this.project_id, fixturePath("examples"), example_dir, 4242, (error, res, body) => {
						if (error || (__guard__(body != null ? body.compile : undefined, x => x.status) === "failure")) {
							console.log("DEBUG: error", error, "body", JSON.stringify(body));
						}
						const pdf = Client.getOutputFile(body, "pdf");
						return downloadAndComparePdf(this.project_id, example_dir, pdf.url, done);
					});
				});
			})
		)(example_dir));
});



function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}