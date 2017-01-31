require('dotenv').config();

var fs = require("fs");
var path = require("path");
var async = require("async");

var Datastore = require("nedb");

var userdb = new Datastore({
  filename: path.resolve(__dirname, "..", "db", "users.db"),
  autoload: true
});
userdb.ensureIndex({fieldName: "email", unique: true});

var classroomdb = new Datastore({
  filename: path.resolve(__dirname, "..", "db", "classrooms.db"),
  autoload: true
});

var express = require("express");
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));

var auth = require('./authentication');
auth.initialize(app, userdb);

app.all("/api/*", auth.ensureAuthenticated);

/* === API === */
/* Classrooms
 *  {
 *    title: the name of the classroom.
 *    users: an array of user references and access levels
 *      {
 *        _id: the users _id
 *        role: one of "owner", "sharedWith", "student"
 *      }
 *  }
 */
app.route("/api/v1/classrooms/:classroomId?")
  // GET classrooms
  // administrator: return a list of all classrooms
  // teacher: return a list of classrooms owned or shared with this teacher
  // student: return a list of classrooms the student is a member of, stripped of sensitive data
  .get(function(req, res) {
    var query;

    if (req.user.type == "administrator") {
      query = {};
    } else if (req.user.type == "teacher" || req.user.type == "student") {
      query = {
        users: {
          $elemMatch: {_id: req.user._id}
        }
      };
    } else {
      return res.sendStatus(404);
    }

    if (typeof req.params.classroomId !== "undefined")
      query._id = req.params.classroomId;

    classroomdb.find(query, function(err, docs) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      if (req.user.type == "student") {
        docs = docs.map(function(doc) {
          return {
            _id: doc._id,
            title: doc.title
          };
        });
      }

      if (typeof req.params.classroomId !== "undefined") {
        if (docs.length === 0)
          res.sendStatus(404);
        else {
          docs = docs[0];
          async.map(docs.users, function(item, callback) {
            userdb.findOne({_id: item._id}, function(err, user) {
              user.role = item.role;
              callback(err, user);
            });
          }, function(err, results) {
            docs.users = results;
            res.json({data: docs});
            return;
          });
        }
      } else {
        res.json({data: docs});
      }

    });
  })
  // POST classrooms
  // create a new classroom.
  .post(function(req, res) {
    if (req.user.type != "administrator" && req.user.type != "teacher")
      return res.sendStatus(404);

    req.body.users = req.body.users || [];
    delete req.body._id;

    classroomdb.insert(req.body, function(err, doc) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      res.json({data: doc});
    });
  })
  .put(function(req, res) {
    var query = {
      _id: req.body._id
    };

    if (req.user.type == "teacher") {
      query.users = {
        $elemMatch: {
          _id: req.user._id
        }
      };
    } else if (req.user.type != "administrator") {
      return res.sendStatus(404);
    }

    classroomdb.update(query, {$set: req.body}, {returnUpdatedDocs: true}, function(err, numChanged, updatedDoc) {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      } else if (numChanged === 0) {
        return res.sendStatus(404);
      }

      res.json({data: updatedDoc});
    });
  })
  .delete(function(req, res) {
    var query = {
      _id: req.body._id
    };

    if (req.user.type == "teacher") {
      query.users = {
        $elemMatch: {
          _id: req.user._id,
          role: "owner"
        }
      };
    } else if (req.user.type != "administrator") {
      return res.sendStatus(404);
    }

    classroomdb.remove(query, {}, function(err, numRemoved) {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      } else if (numRemoved === 0) {
        return res.sendStatus(404);
      }

      res.sendStatus(200);
    });
  });

/* Users */
app.route("/api/v1/users/me")
  .get(function(req, res) {
    res.json({data: req.user});
  });

app.route("/api/v1/users")
  .get(function(req, res) {
    if (req.user.type != "administrator" && req.user.type != "teacher")
      return res.sendStatus(404);

    userdb.find({}, function(err, docs) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      res.json({data: docs});
    });
  })
  .post(function(req, res) {
    if (req.user.type != "administrator" && req.user.type != "teacher")
      return res.sendStatus(404);

    if (req.user.type == "teacher" && req.body.type != "student")
      return res.sendStatus(400);

    userdb.insert(req.body, function(err, doc) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      res.json({data: doc});
    });
  })
  .put(function(req, res) {
    if (req.user.type != "administrator" && req.user._id != req.body._id)
      return res.sendStatus(400);

    userdb.update({_id: req.body._id}, {$set: req.body}, {returnUpdatedDocs: true}, function(err, numChanged, updatedDoc) {
      if (err) {
        console.log(err);
        return res.sendStatus(500);
      } else if (numChanged === 0) {
        return res.sendStatus(404);
      }

      res.json({data: updatedDoc});
    });
  })
  .delete(function(req, res) {
    if (req.user.type != "administrator")
      return res.sendStatus(400);

    userdb.remove({_id: req.body._id}, function(err) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      res.sendStatus(200);
    });
  });

/* Apps */
app.get("/api/v1/apps", function(req, res) {
  var appsPath = path.resolve(__dirname, "public", "apps");

  // Read the contents of the apps directory.
  fs.readdir(appsPath, function(err, files) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
      return;
    }

    // processApp will take the folder name and read the package.json file within.
    var processApp = function(file, callback) {
      var fullPath = path.resolve(__dirname, "public", "apps", file, "package.json");
      fs.readFile(fullPath, function(err, contents) {
        if (err) {
          console.log(err);
          return;
        }

        // Parse the contents of the package.json file and append it to the array.
        var package = JSON.parse(contents);
        package.name = file;

        callback(null, package);
      });
    };

    // Retrieve package.json files and append them to the array.
    async.map(files, processApp, function(err, apps) {
      if (err) {
        console.log(err);
        res.sendStatus(500);
        return;
      }

      // Return our array.
      res.json(apps);
    });
  });
});

app.use("/", [auth.ensureAuthenticated, express.static("public")]);
app.listen(3000);
