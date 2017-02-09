exports.initialize = function(app, db) {
  var passport = require("passport");
  var session = require('express-session');
  var cookieSession = require("cookie-session");
  var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
  var googleConfig = {
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    CALLBACK_URL: "http://localhost/oauth2callback"
  };

  app.use(cookieSession({
    name: 'session',
    keys: ["testing"],
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new GoogleStrategy({
      clientID: googleConfig.CLIENT_ID,
      clientSecret: googleConfig.CLIENT_SECRET,
      callbackURL: googleConfig.CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, done) {
      // This function logs in the user and updates theuser database.
      process.nextTick(function () {
        // We iterate through each email listed on the Google profile to find their account email.
        profile.emails.forEach(function(email) {
          if (email.type === "account") {
            // If we find the account email, check if it's in our database.
            var stmt = db.prepare("SELECT * FROM users WHERE email=:email", {
              ":email": email.value
            });

            if (!stmt.step()) {
              stmt.free();
              done("User not in system.", null);
              return;
            }

            console.log(user);

            var user = stmt.getAsObject();
            stmt.free();

            if (!user.name)
              db.run("UPDATE users SET name=:name WHERE id=:id", {":id": user.id, ":name": profile.displayName});

            done(null, user);
          }
        });
      });
    }
  ));

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
      ":id": id
    });

    stmt.step();
    done(null, stmt.getAsObject());
  });

  app.get("/login", function(req, res) {
    res.redirect("/auth/google");
  });

  app.get('/auth/google', passport.authenticate('google',
      { scope: ['profile', 'email'] }),
      function(req, res){} // this never gets called
  );

  app.get('/oauth2callback', passport.authenticate('google',
      { successReturnToOrRedirect: "/", failureRedirect: '/fail' }
  ));
};

exports.ensureAuthenticated = function(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    req.session.returnTo = req.path;
    res.redirect("/login");
};
