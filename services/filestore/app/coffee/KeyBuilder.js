/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require("settings-sharelatex");

module.exports = {


	getConvertedFolderKey(key){
		return key = `${key}-converted-cache/`;
	},

	addCachingToKey(key, opts){
		key = this.getConvertedFolderKey(key);
		if ((opts.format != null) && (opts.style == null)) {
			key = `${key}format-${opts.format}`;
		}
		if ((opts.style != null) && (opts.format == null)) {
			key = `${key}style-${opts.style}`;
		}
		if ((opts.style != null) && (opts.format != null)) {
			key = `${key}format-${opts.format}-style-${opts.style}`;
		}
		return key;
	},


	userFileKey(req, res, next){
		const {project_id, file_id} = req.params;
		req.key = `${project_id}/${file_id}`;
		req.bucket = settings.filestore.stores.user_files;
		return next();
	},
		
	publicFileKey(req, res, next){
		const {project_id, public_file_id} = req.params;
		if ((settings.filestore.stores.public_files == null)) {
			return res.status(501).send("public files not available");
		} else {
			req.key = `${project_id}/${public_file_id}`;
			req.bucket = settings.filestore.stores.public_files;
			return next();
		}
	},

	templateFileKey(req, res, next){
		const {template_id, format, version, sub_type} = req.params;
		req.key = `${template_id}/v/${version}/${format}`;
		if (sub_type != null) {
			req.key = `${req.key}/${sub_type}`;
		}
		req.bucket = settings.filestore.stores.template_files;
		req.version = version;
		const opts = req.query;
		return next();
	},

	publicProjectKey(req, res, next){
		const {project_id} = req.params;
		req.project_id = project_id;
		req.bucket = settings.filestore.stores.user_files;
		return next();
	}
};
	
