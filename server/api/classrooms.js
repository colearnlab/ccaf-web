var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
  app.route("/api/v1/classrooms")
    .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }

      // db.run("INSERT INTO courses VALUES (1, 'Extras', 394)");

      var classrooms = [];

      var query = "";
      if (req.user.type == 0) {
        query = `
          SELECT C.id, C.title, C.owner, C.course, Co.title as course_name, Co.owner as course_owner 
          FROM classrooms C, courses Co 
          WHERE C.course = Co.id
          ORDER BY course_name
        `;
      }
      else {
        query = `
          SELECT C.id, C.title, C.owner, C.course, Co.title as course_name, Co.owner as course_owner 
          FROM classrooms C, courses Co 
          WHERE C.course = Co.id AND C.id IN 
          (SELECT id FROM classrooms WHERE owner = ${req.user.id}
          UNION
          SELECT classroom FROM classroom_user_mapping, users  where users.id = user and users.id = ${req.user.id})
          ORDER BY course_name
        `;
      }

      db.each(query,
        {},
        function(classroom) {
          classrooms.push(classroom);
        },
        function() {
          res.json({data: classrooms});
        });
    })
    .post(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {

        // Check if class is attached to new course
        if (req.body.course == -1) {
          db.run("INSERT INTO courses VALUES(NULL, :title, :owner)", {
            ":title": req.body.course_name,
            ":owner": req.body.owner,
          });
          req.body.course = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        }

        db.run("PRAGMA foreign_keys = ON");
        db.run("INSERT INTO classrooms VALUES(NULL, :title, :owner, :course)", {
          ":title": req.body.title,
          ":owner": req.body.owner,
          ":course": req.body.course
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
  app.route("/api/v1/classrooms/:classroomId")
    .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var stmt = db.prepare("SELECT * FROM classrooms WHERE id=:id", {
        ":id": req.params.classroomId
      });

      if (!stmt.step())
        return res.status(404).json({data:{status:404}});

      res.json({data: stmt.getAsObject()});
      stmt.free();
    })
    .put(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var params = {
        ":id": req.params.classroomId,
        ":title": req.body.title,
        ":owner": req.body.owner,
        ":course": req.body.course
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
        db.run("UPDATE classrooms SET " + insertString.join(", ") + " WHERE id=:id", params);
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
        db.run("DELETE FROM classrooms WHERE id=:id", {
          ":id": req.params.classroomId
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
  app.route("/api/v1/classrooms/:classroomId/users")
    .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var users = [];

      db.each("SELECT id, name, email, type FROM classroom_user_mapping LEFT JOIN users ON classroom_user_mapping.user = users.id WHERE classroom=:classroom ", {
          ":classroom": req.params.classroomId
        },
        function(user) {
          users.push(user);
        },
        function() {
          res.json({data: users});
        });
    });
  app.route("/api/v1/classrooms/:classroomId/owner")
      .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
        var stmt = db.prepare("SELECT * FROM classrooms WHERE id=:id", {
          ":id": req.params.classroomId
        });

        if (!stmt.step())
          return res.status(404).json({data:{status:404}});

        var owner = stmt.getAsObject().owner;
        stmt.free();

        stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
          ":id": owner
        });

        if (!stmt.step())
          return res.status(404).json({data:{status:404}});

        res.json({data: stmt.getAsObject()});
        stmt.free();
      });
  app.route("/api/v1/classrooms/:classroomId/groups")
    .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var groups = [];

      db.each("SELECT * FROM groups WHERE classroom=:classroom", {
          ":classroom": req.params.classroomId
        },
        function(group) {
          groups.push(group);
        },
        function() {
          res.json({data: groups});
        });
    });

  app.route("/api/v1/classrooms/:classroomId/sessions")
    .get(function(req, res) {
        if(!accessAllowed(req, "classrooms")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var sessions = [];

      db.each("SELECT * FROM classroom_sessions WHERE classroom=:classroom", {
          ":classroom": req.params.classroomId
        },
        function(session) {
          sessions.push(session);
        },
        function() {
          res.json({data: sessions});
        });
    });
};
