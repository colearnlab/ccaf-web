exports.createRoutes = function(app, db) {
    app.route("/api/v1/visualize/:sessionId")
        .get(function(req, res) {
            // GET: if the session exists, give a bunch of information to be drawn on the 
            // visualization page
            
            // var pdfthumbs64 = null;
            var grouplist = [];


            db.each("SELECT groupId FROM group_session WHERE classroom_session=:sessionId",
                {":sessionId": req.params.sessionId},
                function(groupId) {

                    // per-group data:
                    //  activity ratings at different times (for line plot)
                    //  

                    // count the total number of points drawn by the group
                    var group_points = 0;
                    
                    db.each("SELECT user FROM group_user_mapping WHERE groupId=:groupId",
                        {":groupId": groupId},
                        function(userId) {
                            // get contribution/position/points etc.
                            
                            
                            
                        },
                        function() {
                            // TODO condense all info and respond
                        }
                    )

                    //users.push(user);
                },
                function() {
                    res.json({data: users});
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
