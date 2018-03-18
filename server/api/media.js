/*
 * server/api/media.js: API endpoints for uploading and retrieving documents
 */

var multer = require("multer");
var express = require("express");
var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
    var upload = multer({dest: "media/"});
    app.route("/api/v1/media")
        .post(upload.single("upload"), function(req, res) {
            if(!accessAllowed(req, "media")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            try {

                // TODO eliminate media table in favor of activity_pages?
                db.run("PRAGMA foreign_keys = ON");
                db.run("INSERT INTO media VALUES(:owner, :filename, :mime, :metadata)", {
                    ":owner": req.user.id,
                    ":filename": req.file.filename,
                    ":mime": req.file.mimetype,
                    ":metadata": req.body.metadata
                });

                var nowTime = Date.now();
                // Add as an activity page as well
                db.run("INSERT INTO activity_pages VALUES(NULL, :owner, :origFilename, :time, :filename, :npages, :metadata);", {
                    ":owner": req.user.id,
                    ":origFilename": req.file.originalname,
                    ":time": nowTime,
                    ":filename": req.file.filename,
                    ":npages": 1, // TODO deal with this properly
                    ":metadata": (req.body.metadata && req.body.metadata != "undefined") ? req.body.metadata : "{}"
                });

                var activityPageId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

                res.json({
                    data: {
                        activityPageId: activityPageId,
                        filename: req.file.filename,
                        originalname: req.file.originalname,
                        owner: req.user.id,
                        timeUploaded: nowTime
                    }
                });
            } catch(e) {
                console.log(e);
                res.status(400).json({data:{status:400}});
            }
        });

    // Interface to get a list of documents by owner
    app.route("/api/v1/documents/:owner")
        .get(function(req, res) {
            if(!accessAllowed(req, "documents")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var docs = [];
            db.each("SELECT * FROM activity_pages WHERE owner=:owner "
                + "ORDER BY timeUploaded;", 
                {":owner": req.params.owner},
                function(row) {
                    docs.push(row);
                },
                function() {
                    res.json({data: docs});
                }
            );
        });

    app.use("/media", function(req, res, next) {
        if(!accessAllowed(req, "media")) {
            res.status(403).json({data:{status:403}});
            return;
        }
        var stmt = db.prepare("SELECT * FROM media WHERE filename=:filename", {
            ":filename": req.url.slice(1)
        });

        if (!stmt.step())
            return res.status(404).json({data:{status:404}});

        var file = stmt.getAsObject();
        res.setHeader("Content-Type", file.mime);
        stmt.free();
        next();
    }, express.static("media"));
};
