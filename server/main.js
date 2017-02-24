//  Import the .env file and set process.env.
require('dotenv').config();

var fs = require("fs"),
    path = require("path"),
    sql = require("sql.js"),
    multer = require("multer"); // Handles file uploads.

//  The embedded database belongs in the root directory (one folder up).
var dbPath = path.resolve(__dirname, "..", "embedded.sqlite");

//  If it doesn't exist, create it per the schema.
if (!fs.existsSync(dbPath))
  require("./createDB")(dbPath);

//  Load the database and save it every sixty seconds (in case of a bad exit).
var db = new sql.Database(fs.readFileSync(dbPath));
setInterval(function() {
  fs.writeFileSync(dbPath, new Buffer(db.export()));
}, 60000);

//  The framework used to create the API.
var express = require("express");
var app = express();

//  Parse JSON objects stored as querystrings.
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));

//  Load the authentication module and intialize it.
var auth = require('./authentication');
var authObj = auth.initialize(app, db);

//  Make sure that all requests are authenticated (ie deny users who are not signed
//  in and are not in the system.)
app.all("/*", auth.ensureAuthenticated);

//  Serve the public directory as the root.
app.use("/", express.static("public"));

//  Instead of an index.html in the root, forward to the appropriate app depending
//  on user type.
app.get("/", function(req, res) {
  if (req.user.type === 0)
    res.redirect("/admin");
  else if (req.user.type === 1)
    res.redirect("/teacher");
  else if (req.user.type === 2)
    res.redirect("/student");
});

//  Create API routes.
require("./api/users").createRoutes(app, db);
require("./api/classrooms").createRoutes(app, db);
require("./api/groups").createRoutes(app, db);
require("./api/userMappings").createRoutes(app, db);
require("./api/classroom_sessions").createRoutes(app, db);
require("./api/media").createRoutes(app, db);



//  verifyClient takes a http upgrade request and ensures that it is authenticated.
var verifyClient = function(req, done) {
  authObj.cookies(req, {}, function() {
    //  No passport object: not authenticated.
    if (!req.session.passport || typeof req.session.passport.user === "undefined")
      return done(1);

    //  Try to look up the user in the database.
    var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
      ":id": req.session.passport.user
    });

    //  If the user is not there, callback with error.
    if (!stmt.step())
      return done(1);

    //  If the user is there, callback with the user object.
    var user = stmt.getAsObject();
    stmt.free();

    done(null, user);
  });
};

//  Starting the HTTP server listening.
//  Use the HTTP server as a parameter for the WebSocket server so upgrade events
//  can be listened for.
var httpServer = app.listen(parseInt(process.env.PORT));

//  Create the synchronized state server.
var synchronizedStateServer = require("./synchronizedState/main").server(
  httpServer,
  path.resolve(__dirname, "..", "stores"),
  verifyClient
);

function exitHandler(err) {
    if (err) console.log(err.stack);
    fs.writeFileSync(dbPath, new Buffer(db.export()));
    synchronizedStateServer.close(process.exit);
}

//do something when app is closing
process.on('exit', exitHandler.bind(null, 0));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, 1));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, 1));
