var multer = require("multer");
var express = require("express");

exports.createRoutes = function(app, db) {
  var upload = multer({dest: "media/"});
  app.route("/api/v1/media")
    .post(upload.single("upload"), function(req, res) {
    try {
      db.run("PRAGMA foreign_keys = ON");
      db.run("INSERT INTO media VALUES(:owner, :filename, :mime, :metadata)", {
        ":owner": req.user.id,
        ":filename": req.file.filename,
        ":mime": req.file.mimetype,
        ":metadata": req.body.metadata
      });

      res.json({
        data: {
          filename: req.file.filename
        }
      });
    } catch(e) {
      console.log(e);
      res.status(400).json({data:{status:400}});
    }
  });

  app.use("/media", function(req, res, next) {
      var stmt = db.prepare("SELECT * FROM media WHERE filename=:filename", {
        ":filename": req.url.slice(1)
      });

      if (!stmt.step())
        return res.status(404).json({data:{status:404}});

      var file = stmt.getAsObject();
      res.setHeader("Content-Type", file.mime);
      stmt.free();
      next();
  }, express.static("media"));
};
