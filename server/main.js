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
/* Classrooms */
app.route("/api/v1/classrooms")
.get(function(req, res) {
  classroomdb.find({}, function(err, docs) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
      return;
    }

    res.json({data: docs});
  });
})
.post(function(req, res) {
  classroomdb.update({_id: req.body._id}, {$set: req.body}, {returnUpdatedDocs: true, upsert: true}, function(err, numAffected, affectedDoc) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
      return;
    }

    res.json({data: affectedDoc});
  });
})
.delete(function(req, res) {
  userdb.remove({_id: req.body._id}, function(err) {
    if (err) {
      console.log(err);
      res.sendStatus(500);
      return;
    }

    res.sendStatus(200);
  });
});

/* Users */
app.route("/api/v1/users")
  .get(function(req, res) {
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
    userdb.update({_id: req.body._id}, {$set: req.body}, {returnUpdatedDocs: true, upsert: true}, function(err, numAffected, affectedDoc) {
      if (err) {
        console.log(err);
        res.sendStatus(err.errorType === "uniqueViolated" ? 400 : 500);
        return;
      }

      res.json({data: affectedDoc});
    });
  })
  .delete(function(req, res) {
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
