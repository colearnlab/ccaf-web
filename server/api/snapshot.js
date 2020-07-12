var fs = require('fs'),
    multer = require("multer"),
    express = require("express"),
	path = require('path');

var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
    var upload = multer({
        dest: "snapshots/",
        limits: {
            fieldSize: 25 * 1024 * 1024
        }
    });

    // Get all snapshots ever created for a student
    app.route("/api/v1/snapshot/:userId")
    .get(function(req, res) {
        // Prevent access by another user
        if((req.params.userId != req.user.id) || !(accessAllowed(req, "snapshots"))) {
            res.status(403).json({data:{status:403}});
            return;
        }

        var snapshotRows = [];
        db.each("SELECT DISTINCT classroom_sessions.id AS sessionId, title, docNum, pageNum, filename, userId, startTime, endTime "
                + "FROM snapshots INNER JOIN classroom_sessions ON snapshots.sessionId=classroom_sessions.id "
                + "WHERE userId=:userId "
                + "ORDER BY snapshots.id ASC;", {
                ":userId": req.params.userId
            }, 
            snapshotRows.push.bind(snapshotRows)
        );

        var snapshots = {};
        for(var i = 0, len = snapshotRows.length; i < len; i++) {
            var row = snapshotRows[i],
                snapshot = snapshots[row.sessionId]
            if(snapshot) {
                snapshot.pages.push({
                    doc: row.docNum,
                    page: row.pageNum,
                    file: row.filename
                });
            } else {
                snapshots[row.sessionId] = {
                    title: row.title,
                    startTime: row.startTime,
                    endTime: row.endTime,
                    pages: [{
                        doc: row.docNum,
                        page: row.pageNum,
                        file: row.filename
                    }]
                };
            }
        }

        // Sort links and files
        var snapshotsArray = [];
        for(var sessionId in snapshots) {
            snapshots[sessionId].pages.sort(function(a, b) {
                return (a.docNum * 100 + a.pageNum) - (b.docNum * 100 + b.pageNum);
            });
            snapshotsArray.push(snapshots[sessionId]);
        }

        // Sort by end time
        snapshotsArray.sort(function(a, b) {
            return a.endTime - b.endTime;
        });

        res.status(200).json({data: snapshotsArray});
    });

    // Get snapshots from one session
    app.route("/api/v1/snapshot/:sessionId/:userId")
    .get(function(req, res) {
        // Prevent access by another user
        if((req.params.userId != req.user.id) || !(accessAllowed(req, "snapshots"))) {
            res.status(403).json({data:{status:403}});
            return;
        }

        var snapshots = [];
        db.each("SELECT * from snapshots WHERE sessionId=:sessionId AND userId=:userId;", {
                ":sessionId": req.params.sessionId,
                ":userId": req.params.userId
            }, 
            snapshots.push.bind(snapshots)
        );

        res.status(200).json({data: snapshots});
    });

    app.route("/api/v1/snapshot/:sessionId/:userId/:docNum/:pageNum")
    .post(upload.single("upload"), function(req, res) {
        // Prevent access by another user
        if((req.params.userId != req.user.id) || !(accessAllowed(req, "snapshots"))) {
            res.status(403).json({data:{status:403}});
            return;
        }

        // Get session name, user name
        var stmt = db.prepare("SELECT title, email "
                + "FROM classroom_sessions INNER JOIN users "
                + "WHERE users.id=:userId AND classroom_sessions.id=:sessionId;", {
            ":userId": req.params.userId,
            ":sessionId": req.params.sessionId
        });

        // TODO check that doc and page numbers are valid

        if(!stmt.step()) {
            res.status(404).json({data:{status:404}});
            return;
        }

        var info = stmt.getAsObject(),
            netid = info.email.split('@')[0];

        // save image
		var imageData = req.body.upload.replace(/^data:image\/png;base64,/, ''),
            filename = netid + '-' + info.title.replace(/\W/g, '') + '-' + req.params.docNum + '-' + req.params.pageNum + '.png';
		fs.writeFileSync(
			path.resolve(__dirname, '../../snapshots/' + filename), 
			imageData, 
            'base64', 
            function(err) {
                if (err) 
                    throw err;
            }
        );

        // Update database
        db.run('INSERT INTO snapshots VALUES(NULL, :filename, :sessionId, :userId, :docNum, :pageNum);', {
            ":filename": filename,
            ":sessionId": req.params.sessionId,
            ":userId": req.params.userId,
            ":docNum": req.params.docNum,
            ":pageNum": req.params.pageNum
        });

        console.log("uploaded snapshot (user " + req.params.userId + ", session " + req.params.sessionId + ", " + req.params.docNum + "." + req.params.pageNum + ")");

        res.status(200).json({data:{status:200}});
    });
    
    app.use("/snapshots", function(req, res, next) {  
      // Check whether user should have access
        if(!accessAllowed(req, "snapshots")) {
            res.status(403).json({data:{status:403}});
            return;
        }

        // Check that this snapshot belongs to this user
        var filename = req.path.split("/")[1];
        if(!filename) {
            res.status(404).json({data:{status:404}});
            return;
        }

        var email = filename.split("-")[0],
            stmt = db.prepare("SELECT email FROM users WHERE id=:userId", {
                ":userId": req.user.id
            });

        if(!stmt.step() || (stmt.getAsObject().email.split('@')[0] != email)) {
            res.status(403).json({data:{status:403}});
            return;
        }            

      //res.setHeader("Content-Type", "application/gzip");
      //res.setHeader("Content-Disposition", 'attachment; filename="log' + req.path + '.txt.gz"');
      next();
    }, express.static("snapshots"));
};

