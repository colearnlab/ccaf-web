exports.createRoutes = function(app, db, pointcounts) {
    app.route("/api/v1/visualize/:sessionId")
        .get(function(req, res) {
            // GET: if the session exists, give a bunch of information to be drawn on the 
            // visualization page
            
            var sessionId = req.params.sessionId;

            // var pdfthumbs64 = null;
            var grouplist = [];

            // If the session doesn't exist, respond with 404
            if(!db.prepare("SELECT * FROM classroom_sessions WHERE id=:id", { ":id": sessionId }).step()) {
                res.status(404).json({data:{status:404}});
            }

            

            db.each("SELECT groupId FROM group_session WHERE classroom_session=:sessionId",
                {":sessionId": sessionId},
                function(groupId) {

                    // per-group data:
                    //  activity ratings at different times (for line plot)
                    //  

                    // count the total number of points drawn by the group
                    var group_points = 0;
                    var per_user_points = {};
                    
                    db.each("SELECT user FROM group_user_mapping WHERE groupId=:groupId",
                        {":groupId": groupId},
                        function(userId) {
                            // get contribution/position/points etc.
                            per_user_points[userId] = pointcounts[sessionId][userId];
                            group_points += per_user_points[userId];
                        },
                        null;
                    )

                    grouplist.push({total: group_points, members: per_user_points});
                },
                function() {
                    res.json({groups: grouplist});
                }
            );

            // TODO get groups and their users from database
            // groups[] <- SELECT groupId FROM group_session WHERE classroom_session=:sessionId;
            // for each group:
            //      studentIds[] <- SELECT user FROM group_user_mapping WHERE groupId=:groupId;
            //      Get total number of points drawn for group 
            //      student contribution is individual's number of points / total
            //
            res.json({

                groups: grouplist
                // document thumbnails?
            });
        })
};
