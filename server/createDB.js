exports.mkdb = function(dbPath) {
  var fs = require("fs");
  var sql = require("sql.js");
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
    "CREATE TABLE classroom_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER REFERENCES classrooms(id) ON DELETE SET NULL, startTime INTEGER, endTime INTEGER, activityId INTEGER REFERENCES activities(id) ON DELETE SET NULL, metadata TEXT)",
    "CREATE TABLE group_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom_session INTEGER REFERENCES classroom_sessions(id) ON DELETE SET NULL, groupId INTEGER REFERENCES groups(id) ON DELETE SET NULL)",
    "CREATE TABLE user_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, group_session INTEGER REFERENCES group_sessions(id), user INTEGER REFERENCES users(id))",
    "CREATE TABLE media(owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, filename TEXT UNIQUE PRIMARY KEY NOT NULL, mime TEXT, metadata TEXT)",
    //"CREATE TABLE student_points_drawn(timestamp INTEGER NOT NULL, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sessionId INTEGER NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE)",
    //"CREATE TABLE group_points_drawn(timestamp INTEGER NOT NULL, count INTEGER NOT NULL, groupSessionId INTEGER NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE)",
    //"CREATE TABLE scroll_position(position REAL NOT NULL, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sessionId INTEGER NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE)",
    //"CREATE TABLE page_complete(complete INTEGER NOT NULL, pagenumber INTEGER NOT NULL, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, sessionId INTEGER NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE)",
  
      // For saving/restoring data in the student stats module
      "CREATE TABLE stats_events(type TEXT NOT NULL, timestamp INTEGER NOT NULL, data TEXT NOT NULL, meta TEXT NOT NULL, sessionId INTEGER NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE)",


      // Tables to store multi-document activities
    "CREATE TABLE activities(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT NOT NULL, timeUpdated INTEGER NOT NULL, owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE activity_pages(id INTEGER UNIQUE PRIMARY KEY NOT NULL, owner INTEGER NOT NULL REFERENCES users(id), originalFilename TEXT NOT NULL, timeUploaded INTEGER NOT NULL, filename TEXT NOT NULL, numPages INTEGER NOT NULL, metadata TEXT)",
    "CREATE TABLE activity_page_mapping(activityId INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE, pageId INTEGER NOT NULL REFERENCES activity_pages(id) ON DELETE CASCADE, pageNumber INTEGER NOT NULL)"
  
  ].join("; ") + "; ";

  newdb.exec(sqlstr);

    // If user quick list exists, add everyone
    var res = fs.readFileSync("accounts.csv", {encoding: 'utf8', flag: 'r'});
    if(res) {
        var lines = res.split('\n');
        for(var i = 0, len = lines.length; i < len; i++) {
            var vals = lines[i].split(',');
            if(vals.length < 3)
                continue;

            newdb.run("INSERT INTO users VALUES(NULL, :name, :email, :type);", {
                    ":name": vals[0],
                    ":email": vals[1],
                    ":type": vals[2]
                }
            );
        }
    }

  fs.writeFileSync(dbPath, new Buffer(newdb.export()));

};
