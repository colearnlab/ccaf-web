var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
    app.route("/api/v1/activity")
    .get(function(req, res) {
        res.status(501).json({data: "unimplemented"});
    })
    .post(function(req, res) {
        // Create a new activity

        if(!accessAllowed(req, "activity")) {
            res.status(403).json({data:{status:403}});
            return;
        }

        // params: req.params
        // fields: req.body

        // TODO validate?
        // TODO use session info to check user permissions and identify user type?


        // TODO sort out pages
        var pages = JSON.parse(req.body.pages);

        try {
            db.run("PRAGMA foreign_keys = ON");
            db.run("INSERT INTO activities VALUES(NULL, :title, :time, :teacherId)", {
                ":title": req.body.title,
                ":time": (+ new Date()),
                ":teacherId": req.body.owner
            });

            var activityId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

            for(var i = 0, len = pages.length; i < len; i++) {
                var pagei = pages[i];
                db.run("UPDATE activity_pages SET owner=:owner, originalFilename=:originalFilename, timeUploaded=:timeUploaded, filename=:filename, numPages=:numPages, metadata=:metadata WHERE id=:id;", {
                    ":owner": pagei.owner,
                    ":originalFilename": pagei.originalFilename,
                    ":timeUploaded": pagei.timeUploaded,
                    ":filename": pagei.filename,
                    ":numPages": pagei.numPages || 1,
                    ":metadata": JSON.stringify(pagei.metadata),
                    ":id": pagei.id
                });
                db.run("INSERT INTO activity_page_mapping VALUES (:activityId, :pageId, :pageNumber);", {
                    ":activityId": activityId,
                    ":pageId": pagei.id,
                    ":pageNumber": i
                });
            }

            res.json({
                data: {
                    id: activityId
                }
            });
        } catch(e) {
            console.log(e);
            res.status(400).json({data:{status:400}});
        }
    });

    app.route("/api/v1/activity/:activityId")
    .get(function(req, res) {
        if(!accessAllowed(req, "activity")) {
            res.status(403).json({data:{status:403}});
            return;
        }

        var activityId = req.params.activityId;
        // Get activity row and all associated pages in order
        var stmt = db.prepare("SELECT * FROM activities WHERE id=:id;", {
            ":id": activityId
        });

        if(!stmt.step()) {
            res.status(404).json({data:{status:404}});
        } else {
            var data = stmt.getAsObject();
            
            // Get information about all pages belonging to the activity
            data.pages = [];
            db.each("SELECT * FROM activity_pages "
                + "INNER JOIN activity_page_mapping ON activity_page_mapping.pageId=activity_pages.id "
                + "WHERE activity_page_mapping.activityId=:id;",
                {":id": activityId},
                function(row) {
                    data.pages[row.pageNumber] = {
                        owner: row.owner,
                        id: row.id,
                        pageNumber: row.pageNumber,
                        timeUploaded: row.timeUploaded,
                        originalFilename: row.originalFilename,
                        filename: row.filename,
                        numPages: row.numPages || 1,
                        metadata: JSON.parse(row.metadata)
                    };
                }
            );
            
            res.status(200).json({data: data});
        }
    })
    .put(function(req, res) {
        if(!accessAllowed(req, "activity")) {
            res.status(403).json({data:{status:403}});
            return;
        }

        // TODO pages!!
        var params = {
            ":id": req.params.activityId,
            ":timeUpdated": (+ new Date()),
            ":title": req.body.title,
            ":owner": req.body.owner
        };

        var pages = JSON.parse(req.body.pages);

        // TODO deal with sql injection vulnerability
        var insertString = [];
        for (var p in params) {
            if (p === "id")
                continue;
            else if (typeof params[p] !== "undefined")
                insertString.push(p.slice(1) + "=" + p);
            else
                delete params[p];
        }

        try {
            db.run("PRAGMA foreign_keys = ON");
            db.run("UPDATE activities SET " + insertString.join(", ") + " WHERE id=:id", params);
            
            // Get rid of old page mappings
            db.run("DELETE FROM activity_page_mapping WHERE activityId=:activityId;", {
                ":activityId": req.params.activityId
            });

            // Insert correct page mappings
            for(var i = 0, len = pages.length; i < len; i++) {
                var pagei = pages[i];
                db.run("UPDATE activity_pages SET owner=:owner, originalFilename=:originalFilename, timeUploaded=:timeUploaded, filename=:filename, numPages=:numPages, metadata=:metadata WHERE id=:id;", {
                    ":owner": pagei.owner,
                    ":originalFilename": pagei.originalFilename,
                    ":timeUploaded": pagei.timeUploaded,
                    ":filename": pagei.filename,
                    ":numPages": pagei.numPages || 1,
                    ":metadata": JSON.stringify(pagei.metadata),
                    ":id": pagei.id
                });
                db.run("INSERT INTO activity_page_mapping VALUES (:activityId, :pageId, :pageNumber);", {
                        ":activityId": req.params.activityId,
                        ":pageId": pagei.id,
                        ":pageNumber": i
                    }
                );


            }

            if (db.getRowsModified() === 1)
                res.status(200).json({data:{status:200}});
            else
                res.status(404).json({data:{status:404}});
        } catch (e) {
            console.log(e);
            res.status(400).json({data:{status:400}});
        }
    })
    .delete(function(req, res) {
        if(!accessAllowed(req, "activity")) {
            res.status(403).json({data:{status:403}});
            return;
        }
        try {
            db.run("PRAGMA foreign_keys = ON");
            db.run("DELETE FROM activities WHERE id=:id", {
                ":id": req.params.activityId
            });

            if (db.getRowsModified() === 1)
                res.status(200).json({data:{status:200}});
            else
                res.status(404).json({data:{status:404}});
        } catch (e) {
            console.log(e);
            res.status(400).json({data:{status:400}});
        }
    });

    app.route("/api/v1/activities")
        .get(function(req, res) {
            if(!accessAllowed(req, "activities")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            // Get all activities belonging to user :ownerId
            var activities = [];
            db.each("SELECT * FROM activities ORDER BY timeUpdated DESC;", 
                {},
                function(row) {
                    activities.push(row);
                }
            );

            // TODO 404 on bad ownerId, or just return an empty array?
            res.status(200).json({data: activities});
        });

    app.route("/api/v1/activities/:ownerId")
    .get(function(req, res) {
        if(!accessAllowed(req, "activities")) {
            res.status(403).json({data:{status:403}});
            return;
        }

        // Get all activities belonging to user :ownerId
        var activities = [];
        db.each("SELECT * FROM activities WHERE owner=:ownerId ORDER BY timeUpdated DESC;", 
            {":ownerId": req.params.ownerId},
            function(row) {
                activities.push(row);
            }
        );

        // TODO 404 on bad ownerId, or just return an empty array?
        res.status(200).json({data: activities});
    });

};
