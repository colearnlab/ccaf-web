/*
 * server/api/groups.js: API endpoints for group objects
 */

var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
    app.route("/api/v1/groups")
        .get(function(req, res) {
            var classrooms = [];

            db.each("SELECT * FROM groups",
                {},
                function(classroom) {
                    classrooms.push(classroom);
                },
                function() {
                    res.json({data: classrooms});
                });
        })
        .post(function(req, res) {
            if(!accessAllowed(req, "groups")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            try {
                db.run("PRAGMA foreign_keys = ON");
                db.run("INSERT INTO groups VALUES(NULL, :title, :classroom)", {
                    ":title": req.body.title,
                    ":classroom": req.body.classroom
                });

                res.json({
                    data: {
                        id: db.exec("SELECT last_insert_rowid()")[0].values[0][0]
                    }
                });
            } catch(e) {
                res.status(400).json({data:{status:400}});
            }
        });
    app.route("/api/v1/groups/:groupId")
        .get(function(req, res) {
            if(!accessAllowed(req, "groups")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var stmt = db.prepare("SELECT * FROM groups WHERE id=:id", {
                ":id": req.params.groupId
            });

            if (!stmt.step())
                return res.status(404).json({data:{status:404}});

            res.json({data: stmt.getAsObject()});
            stmt.free();
        })
        .put(function(req, res) {
            if(!accessAllowed(req, "groups")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var params = {
                ":id": req.params.groupId,
                ":title": req.body.title,
                ":classroom": req.body.classroom
            };

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
                db.run("UPDATE groups SET " + insertString.join(", ") + " WHERE id=:id", params);
                if (db.getRowsModified() === 1)
                    res.status(200).json({data:{status:200}});
                else
                    res.status(404).json({data:{status:404}});
            } catch (e) {
                res.status(400).json({data:{status:400}});
            }
        })
        .delete(function(req, res) {
            if(!accessAllowed(req, "groups")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            try {
                db.run("PRAGMA foreign_keys = ON");
                db.run("DELETE FROM groups WHERE id=:id", {
                    ":id": req.params.groupId
                });

                if (db.getRowsModified() === 1)
                    res.status(200).json({data:{status:200}});
                else
                    res.status(404).json({data:{status:404}});
            } catch (e) {
                res.status(400).json({data:{status:400}});
            }
        });
    app.route("/api/v1/groups/:groupId/users")
        .get(function(req, res) {
            if(!accessAllowed(req, "groups")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var users = [];

            db.each("SELECT id, name, email, type FROM group_user_mapping LEFT JOIN users ON group_user_mapping.user = users.id WHERE groupId=:group", {
                ":group": req.params.groupId
            },
                function(user) {
                    users.push(user);
                },
                function() {
                    res.json({data: users});
                });
        });
};
