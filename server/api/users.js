var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db) {
  /* Users */
  app.route("/api/v1/users")
    .get(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var users = [];

      db.each("SELECT * FROM users",
        {},
        function(user) {
          users.push(user);
        },
        function() {
          res.json({data: users});
        });
    })
    .post(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");
        db.run("INSERT INTO users VALUES(NULL, :name, :email, :type)", {
          ":name": req.body.name,
          ":email": req.body.email,
          ":type": req.body.type
        });

        res.json({
          data: {
            id: db.exec("SELECT last_insert_rowid()")[0].values[0][0]
          }
        });
      } catch(e) {
        var stmt = db.prepare("SELECT * FROM users WHERE email=:email", {
          ":email": req.body.email
        });
        if (!stmt.step())
          res.status(400).json({data: {status: 400}});
        else
          res.status(400).json({data: {status: 409, supplement: stmt.getAsObject()}});
        stmt.free();
      }
    });
  app.route("/api/v1/users/me")
    .get(function(req, res) {
      res.json({data: req.user});
    });
  app.route("/api/v1/users/:userId")
    .get(function(req, res) {
      var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
        ":id": req.params.userId
      });

      if (!stmt.step())
        return res.status(404).json({data:{status:404}});

      res.json({data: stmt.getAsObject()});
      stmt.free();
    })
    .put(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var params = {
        ":id": req.params.userId,
        ":name": req.body.name,
        ":email": req.body.email,
        ":type": req.body.type
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
        db.run("UPDATE users SET " + insertString.join(", ") + " WHERE id=:id", params);
        if (db.getRowsModified() === 1)
          res.status(200).json({data:{status:200}});
        else
          res.status(404).json({data:{status:404}});
      } catch (e) {
        res.status(400).json({data:{status:400}});
      }
    })
    .delete(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      try {
        db.run("PRAGMA foreign_keys = ON");
        db.run("DELETE FROM users WHERE id=:id", {
          ":id": req.params.userId
        });

        if (db.getRowsModified() === 1)
          res.status(200).json({data:{status:200}});
        else
          res.status(404).json({data:{status:404}});
      } catch (e) {
        res.status(400).json({data:{status:400}});
      }
    });
  app.route("/api/v1/users/:userId/classrooms")
    .get(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var classrooms = [];

      var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
        ":id": req.params.userId
      });

      if (!stmt.step())
        return res.status(404).json({data:{status:404}});

      var user = stmt.getAsObject();
      stmt.free();

      var query;
        /*
      if (user.type === 2)
        query = "SELECT id, title, owner FROM classroom_user_mapping LEFT JOIN classrooms ON classroom_user_mapping.classroom = classrooms.id WHERE user=:user";
      else
        query = "SELECT * FROM classrooms WHERE owner=:user";
        */
        query = "SELECT id, title, owner FROM classroom_user_mapping "
            + "LEFT JOIN classrooms ON "
            + "classroom_user_mapping.classroom = classrooms.id "
            + "WHERE user=:user OR owner=:user";

      db.each(query, {
          ":user": user.id
        },
        function(classroom) {
          classrooms.push(classroom);
        },
        function() {
          res.json({data: classrooms});
        });
    });
  app.route("/api/v1/users/:userId/ownclassrooms")
    .get(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var classrooms = [];

      var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
        ":id": req.params.userId
      });

      if (!stmt.step())
        return res.status(404).json({data:{status:404}});

      var user = stmt.getAsObject();
      stmt.free();

      var query;
        /*
      if (user.type === 2)
        query = "SELECT id, title, owner FROM classroom_user_mapping LEFT JOIN classrooms ON classroom_user_mapping.classroom = classrooms.id WHERE user=:user";
      else
        query = "SELECT * FROM classrooms WHERE owner=:user";
        */
        query = "SELECT id, title, owner FROM classroom_user_mapping "
            + "INNER JOIN classrooms ON "
            + "classroom_user_mapping.classroom = classrooms.id "
            + "WHERE owner=:user";

      db.each(query, {
          ":user": user.id
        },
        function(classroom) {
          classrooms.push(classroom);
        },
        function() {
          res.json({data: classrooms});
        });
    });

  app.route("/api/v1/users/:userId/groups")
    .get(function(req, res) {
        if(!accessAllowed(req, "users")) {
            res.status(403).json({data:{status:403}});
            return;
        }
      var groups = [];

      db.each("SELECT id, title, classroom FROM group_user_mapping LEFT JOIN groups ON group_user_mapping.groupId = groups.id WHERE user=:user", {
          ":user": req.params.userId
        },
        function(group) {
          groups.push(group);
        },
        function() {
          res.json({data: groups});
        });
    });
};
