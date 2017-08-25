var fs = require('fs'),
	path = require('path');

exports.createRoutes = function(app, db) {

    // Get all snapshots ever created for a student
    app.route("/api/v1/snapshot/:userId")
    .get(function(req, res) {
        // Prevent access by another user
        if(req.params.userId != req.user.id) {
            res.status(403).json({data:{status:403}});
            return;
        }

        var snapshots = [];
        db.each("SELECT * from snapshots WHERE userId=:userId;", {
                ":userId": req.params.userId
            }, 
            snapshots.push.bind(snapshots)
        );

        res.status(200).json({data: snapshots});
    });

    // Get snapshots from one session
    app.route("/api/v1/snapshot/:sessionId/:userId")
    .get(function(req, res) {
        // Prevent access by another user
        if(req.params.userId != req.user.id) {
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
    .post(function(req, res) {
        // Prevent access by another user
        if(req.params.userId != req.user.id) {
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
		var imageData = req.body.dataUrl.replace(/^data:image\/png;base64,/, ''),
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
        db.run('INSERT INTO snapshots VALUES (NULL, :filename, :sessionId, :userId, :docNum, :pageNum);', {
            ":filename": filename,
            ":sessionId": req.params.sessionId,
            ":userId": req.params.userId,
            ":docNum": req.params.docNum,
            ":pageNum": req.params.pageNum
        });

        res.status(200).json({data:{status:200}});
    });
};

