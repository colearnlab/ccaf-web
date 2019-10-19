var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
  app.route(["/api/v1/groups/:groupId/users/:userId", "/api/v1/users/:userId/groups/:groupId"])
    .put(function(req, res) {
        if(!accessAllowed(req, "groups")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");

        var stmt = db.prepare("SELECT * FROM groups WHERE id=:id", {
          ":id": req.params.groupId
        });

        if (!stmt.step())
          res.status(404).json({data: {status: 404}});

        var group = stmt.getAsObject();
        var classroom = group.classroom;

        stmt.free();
        stmt = db.prepare("SELECT * FROM group_user_mapping JOIN groups ON group_user_mapping.groupId = groups.id WHERE groups.classroom=:classroom and user=:user", {
          ":classroom": classroom,
          ":user": req.params.userId
        });

        if (stmt.step()) {
          var oldGroup = stmt.getAsObject().groupId;
          db.run("DELETE FROM group_user_mapping WHERE user=:user and groupId=:groupId", {
            ":user": req.params.userId,
            ":groupId": oldGroup
          });
        }

        stmt.free();

        db.run("INSERT INTO group_user_mapping VALUES(:group, :user)", {
          ":group": req.params.groupId,
          ":user": req.params.userId
        });
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
        if(!accessAllowed(req, "groups")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");
        db.run("DELETE FROM group_user_mapping WHERE groupId=:group and user=:user", {
          ":group": req.params.groupId,
          ":user": req.params.userId
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

  app.route(["/api/v1/classrooms/:classroomId/users/:userId", "/api/v1/users/:userId/classrooms/:classroomId"])
    .put(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");
        db.run("INSERT INTO classroom_user_mapping VALUES(:classroom, :user)", {
          ":classroom": req.params.classroomId,
          ":user": req.params.userId
        });
        if (db.getRowsModified() === 1)
          res.status(200).json({data:{status:200}});
        else
          res.status(404).json({data:{status:404}});
      } catch (e) {
        res.status(400).json({data:{status:400}});
      }
    })
    .delete(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");
        db.run("DELETE FROM classroom_user_mapping WHERE classroom=:classroom and user=:user", {
          ":classroom": req.params.classroomId,
          ":user": req.params.userId
        });

        if (db.getRowsModified() === 1)
          res.status(200).json({data:{status:200}});
        else
          res.status(404).json({data:{status:404}});
      } catch (e) {
        res.sendStatus(400);
      }
    });
};
