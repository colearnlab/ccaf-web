exports.createRoutes = function(app, db, stats) {
    app.route("/api/v1/visualize/:sessionId")
        .get(function(req, res) {
            // GET: if the session exists, give a bunch of information to be drawn on the 
            // visualization page
            
            var sessionId = req.params.sessionId;
            
            // ensure session exists
            var stmt = db.prepare("SELECT * FROM classroom_sessions WHERE id=:id", {
              ":id": sessionId
            });
            if(!stmt.step()) {
                res.status(404).json({data:{status:404}});
                return;
            }

            // get group activity histories
            var response = {};
            response.old = stats.groupActivityHistory[sessionId];
            if((typeof response) === "undefined") {
                response = {};
            }

            // get the current student data
            response.latest = stats.collectGroupSummaries(sessionId, Date.now());

            // send response
            res.status(200).json(response);
        })
};
