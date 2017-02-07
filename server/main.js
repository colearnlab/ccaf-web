require('dotenv').config();

var fs = require("fs");
var path = require("path");

var sql = require("sql.js");

var dbPath = path.resolve(__dirname, "..", "embedded.sqlite");

if (!fs.existsSync(dbPath)) {
  var newdb = new sql.Database();

  var sqlstr = [
    "PRAGMA foreign_keys = ON",
    "CREATE TABLE user_types(type_id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT)",
      "INSERT INTO user_types VALUES(0, 'administrator')",
      "INSERT INTO user_types VALUES(1, 'teacher')",
      "INSERT INTO user_types VALUES(2, 'student')",
    "CREATE TABLE users(id INTEGER UNIQUE PRIMARY KEY NOT NULL, name TEXT, email TEXT UNIQUE NOT NULL, type INTEGER NOT NULL, FOREIGN KEY(type) REFERENCES user_types(type_id))",
      "INSERT INTO users VALUES(0, '" + process.env.ADMIN_NAME + "', '" + process.env.ADMIN_EMAIL + "', 0)",
    "CREATE TABLE classrooms(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, owner INTEGER NOT NULL, FOREIGN KEY(owner) REFERENCES users(id))",
    "CREATE TABLE classroom_user_mapping(classroom INTEGER NOT NULL, user INTEGER NOT NULL, FOREIGN KEY(classroom) REFERENCES classrooms(id), FOREIGN KEY(user) REFERENCES users(id), UNIQUE(classroom, user) ON CONFLICT REPLACE)",
    "CREATE TABLE groups(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER NOT NULL, FOREIGN KEY(classroom) REFERENCES classrooms(id))",
    "CREATE TABLE group_user_mapping(group INTEGER NOT NULL, user INTEGER NOT NULL, FOREIGN KEY(group) REFERENCES groups(id), FOREIGN KEY(user) REFERENCES users(id))"
//    "CREATE TABLE recordings(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT)",
//    "CREATE TABLE group_session(id INTEGER UNIQUE PRIMARY KEY NOT NULL, recording INTEGER, FOREIGN KEY(recording) REFERENCES recordings(id))",
//    "CREATE TABLE user_session(id INTEGER UNIQUE PRIMARY KEY NOT NULL, group_session INTEGER, FOREIGN KEY(group_session) REFERENCES group_session(id))"
  ].join("; ") + "; ";

  newdb.exec(sqlstr);

  fs.writeFileSync(dbPath, new Buffer(newdb.export()));
}

var dbBuffer = fs.readFileSync(dbPath);
var db = new sql.Database(dbBuffer);

var express = require("express");
var app = express();

setInterval(function() {
  fs.writeFileSync(dbPath, new Buffer(db.export()));
}, 10000);

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));

var auth = require('./authentication');
auth.initialize(app, db);

app.all("/api/*", auth.ensureAuthenticated);

/* Users */
app.route("/api/v1/users")
  .get(function(req, res) {
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
      res.sendStatus(400);
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
      return res.sendStatus(404);

    res.json({data: stmt.getAsObject()});
    stmt.free();
  })
  .put(function(req, res) {
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
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  })
  .delete(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("DELETE FROM users WHERE id=:id", {
        ":id": req.params.userId
      });

      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  });
app.route("/api/v1/users/:userId/classrooms")
  .get(function(req, res) {
    var classrooms = [];

    var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
      ":id": req.params.userId
    });

    if (!stmt.step())
      return res.sendStatus(404);

    var user = stmt.getAsObject();
    stmt.free();

    var query;
    if (user.type === 2)
      query = "SELECT id, title, owner FROM classroom_user_mapping LEFT JOIN classrooms ON classroom_user_mapping.classroom = classrooms.id WHERE user=:user";
    else
      query = "SELECT * FROM classrooms WHERE owner=:user";

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

app.route("/api/v1/classrooms")
  .get(function(req, res) {
    var classrooms = [];

    db.each("SELECT * FROM classrooms",
      {},
      function(classroom) {
        classrooms.push(classroom);
      },
      function() {
        res.json({data: classrooms});
      });
  })
  .post(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO classrooms VALUES(NULL, :title, :owner)", {
        ":title": req.body.title,
        ":owner": req.body.owner
      });

      res.json({
        data: {
          id: db.exec("SELECT last_insert_rowid()")[0].values[0][0]
        }
      });
    } catch(e) {
      res.sendStatus(400);
    }
  });
app.route("/api/v1/classrooms/:classroomId")
  .get(function(req, res) {
    var stmt = db.prepare("SELECT * FROM classrooms WHERE id=:id", {
      ":id": req.params.classroomId
    });

    if (!stmt.step())
      return res.sendStatus(404);

    res.json({data: stmt.getAsObject()});
    stmt.free();
  })
  .put(function(req, res) {
    var params = {
      ":id": req.params.classroomId,
      ":title": req.body.title,
      ":owner": req.body.owner
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
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  })
  .delete(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("DELETE FROM classrooms WHERE id=:id", {
        ":id": req.params.classroomId
      });

      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  });
app.route("/api/v1/classrooms/:classroomId/users")
  .get(function(req, res) {
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
      var stmt = db.prepare("SELECT * FROM classrooms WHERE id=:id", {
        ":id": req.params.classroomId
      });

      if (!stmt.step())
        return res.sendStatus(404);

      var owner = stmt.getAsObject().owner;
      stmt.free();

      stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
        ":id": owner
      });

      if (!stmt.step())
        return res.sendStatus(404);

      res.json({data: stmt.getAsObject()});
      stmt.free();
    });
app.route("/api/v1/classrooms/:classroomId/groups")
  .get(function(req, res) {
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
      res.sendStatus(400);
    }
  });
app.route("/api/v1/groups/:groupId")
  .get(function(req, res) {
    var stmt = db.prepare("SELECT * FROM groups WHERE id=:id", {
      ":id": req.params.groupId
    });

    if (!stmt.step())
      return res.sendStatus(404);

    res.json({data: stmt.getAsObject()});
    stmt.free();
  })
  .put(function(req, res) {
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
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  })
  .delete(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("DELETE FROM groups WHERE id=:id", {
        ":id": req.params.classroomId
      });

      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  });
app.route("/api/v1/groups/:groupId/users")
  .get(function(req, res) {
    var users = [];

    db.each("SELECT id, name, email, type FROM group_user_mapping LEFT JOIN users ON group_user_mapping.user = users.id WHERE group=:group ", {
        ":group": req.params.groupId
      },
      function(user) {
        users.push(user);
      },
      function() {
        res.json({data: users});
      });
  });

app.route(["/api/v1/groups/:groupId/users/:userId", "/api/v1/users/:userId/groups/:groupId"])
  .put(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO group_user_mapping VALUES(:group, :user)", {
        ":group": req.params.groupId,
        ":user": req.params.userId
      });
      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  })
  .delete(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("DELETE FROM group_user_mapping WHERE group=:group and user=:user", {
        ":group": req.params.groupId,
        ":user": req.params.userId
      });

      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      console.log(e);
      res.sendStatus(400);
    }
  });
app.route(["/api/v1/classrooms/:classroomId/users/:userId", "/api/v1/users/:userId/classrooms/:classroomId"])
  .put(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO classroom_user_mapping VALUES(:classroom, :user)", {
        ":classroom": req.params.classroomId,
        ":user": req.params.userId
      });
      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      res.sendStatus(400);
    }
  })
  .delete(function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("DELETE FROM classroom_user_mapping WHERE classroom=:classroom and user=:user", {
        ":classroom": req.params.classroomId,
        ":user": req.params.userId
      });

      if (db.getRowsModified() === 1)
        res.sendStatus(200);
      else
        res.sendStatus(404);
    } catch (e) {
      console.log(e);
      res.sendStatus(400);
    }
  });


app.use("/", [express.static("public")]);
app.listen(3000);
