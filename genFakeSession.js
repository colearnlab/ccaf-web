require('dotenv').config();

var sqljs = require("sql.js"),
    fs = require("fs");

var main = function(db, uid, stats) {
    // create a bunch of fake students, randomly generate activity
    var timenow = Date.now();

    // create class
    db.run("PRAGMA foreign_keys = ON");
    db.run("INSERT INTO classrooms VALUES(NULL, :title, :owner)", {
      ":title": "Fake Class " + timenow,
      ":owner": uid,
    });
    var classId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    var nstudents = 24;
    var groupIds = [];
    for(var i = 0; i < (nstudents / 4); i++) {
        db.run("INSERT INTO groups VALUES(NULL, :title, :classroom)", {
          ":title": "fake group " + i,
          ":classroom": classId
        });
        groupIds.push(db.exec("SELECT last_insert_rowid()")[0].values[0][0])
    }

    var studentIds = [];
    for(var i = 0; i < nstudents; i++) {

        // create student
        db.run("INSERT INTO users VALUES(NULL, :name, :email, :type)", {
          ":name": "fake student " + i,
          ":email": "student" + i + "@fake" + timenow + ".com",
          ":type": 2
        });

        studentIds.push(db.exec("SELECT last_insert_rowid()")[0].values[0][0]);
        
        // add to fake group
        db.run("INSERT INTO group_user_mapping VALUES(:group, :user)", {
          ":group": groupIds[Math.floor(i / 4)],
          ":user": studentIds[i]
        });
    }
    
    var delayMean = 100,
        delayDev = 33;
    var endtime = Date.now();
    var starttime = endtime - 60 * 60 * 1000;

    // TODO query database for some pdf rather than hard code
    // start session
    db.run("INSERT INTO classroom_sessions VALUES(NULL, :title, :classroom, :startTime, NULL, :metadata)", {
        ":title": "fake session " + timenow,
        ":classroom": classId,
        ":startTime": timenow,
        ":metadata": JSON.stringify({"pdf":{"filename":"33dd0bccdf7c0eae26476382b956be52"},"app":"whiteboard"})
    });
    
    var sessionId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    console.log("session: " + sessionId + ", groups: " + groupIds);

    // group_sessions
    for(var gid in groupIds) {
        console.log(groupIds[gid]);
        db.run("INSERT INTO group_sessions VALUES (NULL, :title, :sessionId, :groupId);", {
            ":title": "fake group " + groupIds[gid],
            ":sessionId": sessionId,
            ":groupId": groupIds[gid]
        });
    }


    var randn_bm = function(mean, sd) {
        var u = 1 - Math.random(); // Subtraction to flip [0, 1) to (0, 1].
        var v = 1 - Math.random();
        return sd * Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v ) + mean;
    };

    // TODO make more realistic group update frequency
    var co = 0, nextsummarytime = starttime, origtime = starttime;
    while(starttime < endtime) {
        // Random student generates a point
        var studentId = studentIds[Math.floor(Math.random() * nstudents)];

        // generate point
        stats.update(starttime, {pages: {u: studentId, s: sessionId}});
        //console.log(endtime - starttime, co);

        // add to group histories every once in a while
        if(starttime >= nextsummarytime) {
            stats.updateGroupActivity(sessionId, starttime);
            nextsummarytime += parseInt(process.env.VISINTERVAL);
            
            var t = new Date(starttime - origtime);
            console.log("" + (t.getHours() - 18) + ":" + ('0' + t.getMinutes()).substr(-2));
        }
        
        // simulate random delay
        starttime += Math.floor(randn_bm(delayMean, delayDev));

        co++;
    }

    // Mark session finished
    db.run("UPDATE classroom_sessions SET endTime=:endTime WHERE id=:id", {
        ":endTime": endtime,
        ":id": sessionId
    });

    // TODO cause the student stats tracker to load the fake session data
    //stats.loadSession(sessionId);
};


var argv = process.argv;
var dbfile = argv[2];
var uid = parseInt(argv[3]);
var db = new sqljs.Database(fs.readFileSync(dbfile));

var stats = require("./server/studentStats").createstats(db);

// make changes
main(db, uid, stats);

// write out
fs.writeFileSync(dbfile, new Buffer(db.export()));

console.log("Done.");

