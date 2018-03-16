var accessAllowed = require("./apiPermissions").accessAllowed;

exports.createRoutes = function(app, db, stats) {
    app.route("/api/v1/visualize/:sessionId")
        .get(function(req, res) {
            if(!accessAllowed(req, "visualize")) {
                res.status(403).json({data:{status:403}});
                return;
            }
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
            var response = stats.sessionStats[sessionId].reportAll(null);

            // send response
            res.status(200).json(response);
        })
};
