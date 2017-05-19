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
    "CREATE TABLE classroom_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom INTEGER REFERENCES classrooms(id) ON DELETE SET NULL, startTime INTEGER, endTime INTEGER, metadata TEXT)",
    "CREATE TABLE group_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, title TEXT, classroom_session INTEGER REFERENCES classroom_sessions(id) ON DELETE SET NULL, groupId INTEGER REFERENCES groups(id) ON DELETE SET NULL)",
    "CREATE TABLE user_sessions(id INTEGER UNIQUE PRIMARY KEY NOT NULL, group_session INTEGER REFERENCES group_session(id), user INTEGER REFERENCES users(id))",
    "CREATE TABLE media(owner INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, filename TEXT UNIQUE PRIMARY KEY NOT NULL, mime TEXT, metadata TEXT)"
  ].join("; ") + "; ";

  newdb.exec(sqlstr);

  fs.writeFileSync(dbPath, new Buffer(newdb.export()));
};
