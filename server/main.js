require('dotenv').config();

var fs = require("fs");
var path = require("path");

var sql = require("sql.js");

var dbPath = path.resolve(__dirname, "..", "embedded.sqlite");

var multer = require("multer");

if (!fs.existsSync(dbPath)) {
  var newdb = new sql.Database();

  var sqlstr = [
    "PRAGMA foreign_keys = ON",
    "CREATE TABLE user_types(type_id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT)",
      "INSERT INTO user_types VALUES(0, 'administrator')",
      "INSERT INTO user_types VALUES(1, 'teacher')",
      "INSERT INTO user_types VALUES(2, 'student')",
    "CREATE TABLE users(id INTEGER UNIQUE PRIMARY KEY NOT NULL, name TEXT, email TEXT UNIQUE NOT NULL, type INTEGER NOT NULL REFERENCES user_types(type_id))",
      "INSERT INTO users VALUES(0, '" + process.env.ADMIN_NAME + "', '" + process.env.ADMIN_EMAIL + "', 0)",
    "CREATE TABLE classrooms(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE classroom_user_mapping(classroom INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(classroom, user) ON CONFLICT REPLACE)",
    "CREATE TABLE groups(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE)",
    "CREATE TABLE group_user_mapping(groupId INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE, user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(groupId, user) ON CONFLICT REPLACE)",
    "CREATE TABLE classroom_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER REFERENCES classrooms(id) ON DELETE SET NULL, startTime INTEGER, endTime INTEGER, metadata TEXT)",
    "CREATE TABLE group_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, recording INTEGER, FOREIGN KEY(recording) REFERENCES recordings(id))",
    "CREATE TABLE user_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, group_session INTEGER, FOREIGN KEY(group_session) REFERENCES group_session(id))",
    "CREATE TABLE media(owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, filename TEXT UNIQUE PRIMARY KEY NOT NULL, mime TEXT, metadata TEXT)"
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
var authObj = auth.initialize(app, db);

//app.all("/api/*", auth.ensureAuthenticated);

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
    var classrooms = [];

    var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
      ":id": req.params.userId
    });

    if (!stmt.step())
      return res.status(404).json({data:{status:404}});

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
      res.status(400).json({data:{status:400}});
    }
  });
app.route("/api/v1/classrooms/:classroomId")
  .get(function(req, res) {
    var stmt = db.prepare("SELECT * FROM classrooms WHERE id=:id", {
      ":id": req.params.classroomId
    });

    if (!stmt.step())
      return res.status(404).json({data:{status:404}});

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
        res.status(200).json({data:{status:200}});
      else
        res.status(404).json({data:{status:404}});
    } catch (e) {
      res.status(400).json({data:{status:400}});
    }
  })
  .delete(function(req, res) {
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
      res.status(400).json({data:{status:400}});
    }
  });
app.route("/api/v1/groups/:groupId")
  .get(function(req, res) {
    var stmt = db.prepare("SELECT * FROM groups WHERE id=:id", {
      ":id": req.params.groupId
    });

    if (!stmt.step())
      return res.status(404).json({data:{status:404}});

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
        res.status(200).json({data:{status:200}});
      else
        res.status(404).json({data:{status:404}});
    } catch (e) {
      res.status(400).json({data:{status:400}});
    }
  })
  .delete(function(req, res) {
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

app.route(["/api/v1/groups/:groupId/users/:userId", "/api/v1/users/:userId/groups/:groupId"])
  .put(function(req, res) {
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
// "CREATE TABLE classroom_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER REFERENCES classrooms(id) ON DELETE SET NULL, startTime INTEGER, endTime INTEGER)",
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

  })
  .delete(function(req, res) {

  });

var upload = multer({dest: "media/"});
app.route("/api/v1/media")
  .post(upload.single("upload"), function(req, res) {
  try {
    db.run("PRAGMA foreign_keys = ON");
    db.run("INSERT INTO media VALUES(:owner, :filename, :mime, :metadata)", {
      ":owner": req.user.id,
      ":filename": req.file.filename,
      ":mime": req.file.mimetype,
      ":metadata": req.body.metadata
    });

    res.json({
      data: {
        filename: req.file.filename
      }
    });
  } catch(e) {
    console.log(e);
    res.status(400).json({data:{status:400}});
  }
});

app.use("/", [auth.ensureAuthenticated, express.static("public")]);

app.use("/media", [auth.ensureAuthenticated, function(req, res, next) {
    var stmt = db.prepare("SELECT * FROM media WHERE filename=:filename and owner=:owner", {
      ":filename": req.url.slice(1),
      ":owner": req.user.id
    });

    if (!stmt.step())
      return res.status(404).json({data:{status:404}});

    var file = stmt.getAsObject();
    res.setHeader("Content-Type", file.mime);
    stmt.free();
    next();
}, express.static("media")]);

var httpServer = app.listen(80);
var synchronizedStateServer = require("./synchronizedState").server(
  httpServer,
  path.resolve(__dirname, "..", "stores"),
  function(req, done) {
    authObj.cookies(req, {}, function() {
      if (!req.session.passport || typeof req.session.passport.user === "undefined")
        return done(false);

      var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
        ":id": req.session.passport.user
      });

      if (!stmt.step())
        return done(false);

      var user = stmt.getAsObject();
      stmt.free();

      done(true, user);
    });
  }
);

function exitHandler(options, err) {
    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);

    synchronizedStateServer.close(process.exit);
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
