// Separated out to make this more accessable from the server side.
exports.getStoreId = function(db, sessionId, groupId, userId) {
        
    var stmt = db.prepare("SELECT * FROM group_sessions WHERE classroom_session=:classroom_session and groupId=:groupId", {
      ":classroom_session": sessionId,
      ":groupId": groupId
    });

    var storeId;

    if (!stmt.step()) {
      stmt.free();
      stmt = db.prepare("SELECT * FROM groups WHERE id=:id", {
        ":id": groupId
      });
      if (!stmt.step()) {
        res.status(400).json({data: {status:400}});
        stmt.free();
        return {status: 1};
      }

      var group = stmt.getAsObject();
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO group_sessions VALUES(NULL, :title, :classroom_session, :groupId)", {
        ":title": group.title,
        ":classroom_session": sessionId,
        ":groupId": groupId
      });

      storeId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    } else {
      storeId = stmt.getAsObject().id;
    }

    return {storeId: storeId, status: 0};
};

exports.createRoutes = function(app, db) {
  app.route("/api/v1/classroom_sessions")
    .get(function(req, res) {
      var sessions = [];

      db.each("SELECT * FROM classroom_sessions",
        {},
        function(session) {
          sessions.push(session);
        },
        function() {
          res.json({data: sessions});
        });
    })
    .post(function(req, res) {
      console.log(req.body);
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO classroom_sessions VALUES(NULL, :title, :classroom, :startTime, NULL, :metadata)", {
        ":title": req.body.title,
        ":classroom": req.body.classroom,
        ":startTime": (+ new Date()),
        ":metadata": typeof req.body.metadata === "string" ? req.body.metadata : typeof req.body.metadata !== "undefined" ? JSON.stringify(req.body.metadata) : void 0
      });

      res.json({
        data: {
          id: db.exec("SELECT last_insert_rowid()")[0].values[0][0]
        }
      });
    });

  app.route("/api/v1/classroom_sessions/:classroomSessionId")
    .get(function(req, res) {
      var stmt = db.prepare("SELECT * FROM classroom_sessions WHERE id=:id", {
        ":id": req.params.classroomSessionId
      });

      if (!stmt.step()) {
        res.status(404).json({data:{status:404}});
      } else {
        res.status(200).json({data:stmt.getAsObject()});
      }

      stmt.free();
    })
    .put(function(req, res) {
      var params = {
        ":id": req.params.classroomSessionId,
        ":title": req.body.title,
        ":metadata": req.body.metadata,
        ":endTime": (+ new Date())
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
        db.run("UPDATE classroom_sessions SET " + insertString.join(", ") + " WHERE id=:id", params);
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

    });

  app.route("/api/v1/getStoreId/session/:sessionId/group/:groupId/user/:userId")
    .get(function(req, res) {
      try {
        var sessionId = req.params.sessionId;
        var groupId = req.params.groupId;
        var userId = req.params.userId;

        var result = exports.getStoreId(db, sessionId, groupId, userId);
        if(result.status == 0) {
            res.status(200).json({data: result.storeId});
        }

      } catch(e) {
        console.log(e);
        res.status(400).json({data: {status:400}});
      }
    });
};
