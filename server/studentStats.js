
exports.createstats = function(db) {
    return new StudentStats(db);
}


function StudentStats(db) {
    this.db = db;

    this.drawpoints = {};
    this.pagescomplete = {};
    this.groupActivityHistory = {};

    var currentTime = Date.now();

    // We need to be able to cancel the repeating updates when a session ends
    this.updateIntervals = {};

    // load active sessions and start group activity update cycle for each
    db.each("SELECT id, startTime FROM classroom_sessions WHERE endTime IS NULL;", {},
        (function(row) {
            // ensure active sessions are loaded
            this.loadSession(row.id);          

            // Set up repeating updates to group activity logs
            var sessionElapsedTime = currentTime - row.startTime;
            // Set initial timeout to sync with 
            setTimeout((function() {

                    // repeat every VISINTERVAL ms
                    this.updateIntervals[row.id] = setInterval(
                        (function() {
                            this.updateGroupActivity(row.id, Date.now());
                            
                            // if the session has ended, stop updating
                            var stmt = db.prepare("SELECT * FROM classroom_sessions "
                                + "WHERE id=:sessionId AND endTime IS NULL;", {":sessionId": row.id});
                            if(!stmt.step()) {
                                clearInterval(this.updateIntervals[row.id]);
                            }
                        }).bind(this),
                        process.env.VISINTERVAL
                    );
                }).bind(this),
                process.env.VISINTERVAL - (sessionElapsedTime % process.env.VISINTERVAL)
            );
        }).bind(this)
    );
}


// TODO include page completion
StudentStats.prototype.collectGroupSummaries = function(sessionId, time) {
    if((typeof time) === "undefined") {
        time = Date.now();
    }

    var windowStart = time - process.env.VISINTERVAL;

    // groupID -> student counts and total
    var groupSummaries = {total: 0};

    // TODO separate out scroll position from query
    // approach: get groups in session and their members
    this.db.each("SELECT group_sessions.groupId AS groupId, group_user_mapping.user AS userId "
        + "FROM group_sessions "
        + "INNER JOIN group_user_mapping ON group_sessions.groupId=group_user_mapping.groupId "
        + "WHERE group_sessions.classroom_session=:sessionId;",
        {":sessionId": sessionId},
        (function(row) {
            var groupId = row.groupId, userId = row.userId;
            if(!(sessionId in this.drawpoints)) {
                this.loadSession(sessionId);
            }
            if(!(userId in this.drawpoints[sessionId])) {
                this.drawpoints[sessionId][userId] = [];
            }
            var drawpoints = this.drawpoints[sessionId][userId];
            

            // Seek backwards until we're at the end of the interval
            var endidx = drawpoints.length;
            while(drawpoints[endidx - 1] > time) {
                endidx--;
            }
            var startidx = endidx - 1;
            for(var i = startidx - 1; i >= 0; i--) {
                if(drawpoints[i] < windowStart) {
                    startidx = i + 1;
                    break;
                }
            }

            // Save the count of points drawn
            if(!(groupId in groupSummaries)) {
                groupSummaries[groupId] = {total: 0}
            }
            if(!(userId in groupSummaries[groupId])) {
                groupSummaries[groupId][userId] = {};
            }
            var count = endidx - startidx - 1;

            groupSummaries[groupId][userId].count = count;
            groupSummaries[groupId].total += count;
            groupSummaries.total += count;

            // Get current scroll position
            var stmt = this.db.prepare("SELECT position FROM scroll_position "
                + "WHERE userId=:userId AND sessionId=:sessionId;",
                {":userId": userId, ":sessionId": sessionId}
            );

            if(stmt.step()) {
                groupSummaries[groupId][userId].position = stmt.getAsObject().position;
            } else {
                groupSummaries[groupId][userId].position = 0;
            }

            // Get page completion
            groupSummaries[groupId][userId].complete = {};
            this.db.each("SELECT pagenumber, complete FROM page_complete "
                + "WHERE userId=:userId AND sessionId=:sessionId;",
                {":userId": userId, ":sessionId": sessionId},
                function(row) {
                    groupSummaries[groupId][userId].complete[row.pagenumber] = (row.complete == 1);
                }
            );
        }).bind(this)
    );
    
    return {time: time, groups: groupSummaries};
};


// If the session doesn't exist in the database, this has the effect of 
// initializing all session variables empty
StudentStats.prototype.loadSession = function(sessionId) {
    // Enusre session is removed from everything before loading
    this.drawpoints[sessionId] = {};
    this.pagescomplete[sessionId] = {};
    this.groupActivityHistory[sessionId] = [];
    
    // Check that session exists; return if not
    var stmt = this.db.prepare("SELECT id FROM classroom_sessions WHERE id=:sessionId;",
        {":sessionId": sessionId});
    if(!stmt.step()) {
        return;
    }

    // Select students and their point drawing history  from the database
    this.db.each("SELECT user AS userId, timestamp FROM group_user_mapping "
        + "INNER JOIN group_sessions ON group_sessions.groupId=group_user_mapping.groupId "
        + "INNER JOIN classroom_sessions ON group_sessions.classroom_session=classroom_sessions.id "
        + "INNER JOIN student_points_drawn ON student_points_drawn.userId=user AND student_points_drawn.sessionId=classroom_sessions.id "
        + "WHERE classroom_sessions.id=:sessionId "
        + "ORDER BY timestamp;", 
        {":sessionId": sessionId},
        (function(row) {
            var userId = row.userId;
            
            // Create the student list if it doesn't exist
            if(!(userId in this.drawpoints[sessionId])) {
                this.drawpoints[sessionId][userId] = [];
            }

            // The query results are sorted so just push the timestamp onto the list
            this.drawpoints[sessionId][userId].push(row.timestamp);
        }).bind(this)
    );

    // Get group histories (don't worry about individual students here)
    var groupActivityByTimestamp = {};
    this.db.each("SELECT timestamp, groupId, count FROM group_points_drawn "
        + "INNER JOIN group_sessions ON group_sessions.id=groupSessionId "
        + "WHERE classroom_session=:sessionId "
        + "ORDER BY timestamp;",
        {":sessionId": sessionId},
        (function(row) {
            if(!(row.timestamp in groupActivityByTimestamp)) {
                groupActivityByTimestamp[row.timestamp] = {total: 0};
            }

            groupActivityByTimestamp[row.timestamp][row.groupId] = {total: row.count};
            groupActivityByTimestamp[row.timestamp].total += row.count;
        }).bind(this),
        (function() {
            // Should give the times in the correct order since they were added in order.
            for(var timestamp in groupActivityByTimestamp) {
                var finished = {time: timestamp, groups: groupActivityByTimestamp[timestamp]};
                this.groupActivityHistory[sessionId].push(finished);
            }
        }).bind(this)
    );

}


// Looks back at the last group activity interval and adds activity stats to group logs
StudentStats.prototype.updateGroupActivity = function(sessionId, time) {
    // Tally group activity from the last VISINTERVAL milliseconds
    var groupActivity = this.collectGroupSummaries(sessionId, time);

    //console.log("update group activity");
    //console.log(groupActivity);

    if(!(sessionId in this.groupActivityHistory)) {
        console.log("need to load session!");
        this.loadSession(sessionId);
    }
    this.groupActivityHistory[sessionId].push(groupActivity);

    // Add group point drawing counts to the database
    for(var groupId in groupActivity.groups) {
        groupId = parseInt(groupId);
        if(!isNaN(groupId)) {
            // get group_session id so we can add this event to the database
            var stmt = this.db.prepare("SELECT id FROM group_sessions "
                + "WHERE classroom_session=:sessionId AND groupId=:groupId;",
                {":sessionId": sessionId, ":groupId": groupId}
            );

            if(!stmt.step()) {
                // As of right now, there shouldn't be a reason to insert a row
                console.log("No entry in group_sessions for group " + groupId + " in session " + sessionId);
            } else {
                //console.log("insert group activity record");
                // Add to database
                this.db.run("INSERT INTO group_points_drawn "
                    + "VALUES (:timestamp, :count, :groupSessionId);",
                    {
                        ":timestamp": time, 
                        ":count": groupActivity.groups[groupId].total,
                        ":groupSessionId": stmt.getAsObject().id
                    }
                );
            }
        }
    }
};


// Update student and group statistics 
StudentStats.prototype.update = function(timestamp, updateobj) {
    // an update may have more than one event, so check all
    for(var updatekey in updateobj) {
        var update_event = updateobj[updatekey];

        if(updatekey.includes("pages")) {
            //console.log(updatekey, update_event);
            // This is a point-drawing event so tally the point for the user
            if(('u' in update_event) && ('s' in update_event)) {
                var userId = update_event.u, sessionId = update_event.s;
                
                // ensure the right log exists
                if(!(sessionId in this.drawpoints)) {
                    this.loadSession(sessionId);
                }
                if(!(userId in this.drawpoints[sessionId])) {
                    this.drawpoints[sessionId][userId] = [];
                }

                this.drawpoints[update_event.s][update_event.u].push(timestamp);
                
                // add to database
                this.db.run("INSERT INTO student_points_drawn "
                    + "VALUES (:timestamp, :userId, :sessionId);",
                    {":timestamp": timestamp, ":userId": userId, ":sessionId": sessionId});
            }
        } else if(updatekey.includes("scrollPositions")) {
            // maybe update student's current page
            console.log(update_event);
            

            var sessionId = update_event.s;
            for(var userId in update_event) {
                if(!isNaN(userId)) {
                    console.log("update?");
                    // Update the user's scroll position in the database
                    var params = {
                        ":pos": update_event[userId],
                        ":userId": userId,
                        ":sessionId": sessionId
                    };

                    this.db.run("UPDATE OR IGNORE scroll_position "
                        + "SET position=:pos "
                        + "WHERE userId=:userId AND sessionId=:sessionId;",
                        params
                    );

                    this.db.run("INSERT OR IGNORE INTO scroll_position "
                        + "VALUES (:pos, :userId, :sessionId);",
                        params
                    );
                }
            }
        } else if(updatekey.includes("pageComplete")) {
            //console.log(update_event);
            var params = {
                ":complete": update_event.b,
                ":pagenumber": update_event.p,
                ":userId": update_event.u,
                ":sessionId": update_event.s
            };

            this.db.run("UPDATE OR IGNORE page_complete "
                + "SET complete=:complete "
                + "WHERE pagenumber=:pagenumber AND userId=:userId AND sessionId=:sessionId;",
                params
            );

            // Insert
            this.db.run("INSERT OR IGNORE INTO page_complete "
                + "VALUES (:complete, :pagenumber, :userId, :sessionId);",
                params
            );

        }
        // TODO add other update events here
    
    }
};


