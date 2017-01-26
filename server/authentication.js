exports.initialize = function(app, userdb) {
  var passport = require("passport");
  var session = require('express-session');
  var cookieSession = require("cookie-session");
  var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
  var googleConfig = {
    CLIENT_ID: process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    CALLBACK_URL: "http://localhost:3000/oauth2callback"
  };

  //app.use(session({ secret: Math.random().toString() }));
  app.use(cookieSession({
    name: 'session',
    keys: ["testingOnly"],
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
            userdb.findOne({email: email.value}, function(err, user) {
              // If the user is in our database and their name is not set, we retrieve and set their name.
              if (user && typeof user.name === "undefined") {
                userdb.update({email: email.value}, {$set: {name: profile.displayName}}, {}, function(err) {
                  done(null, user);
                });
              } else {
                // Otherwise, we return an error if the user is not in the system or continue if they are.
                return done(user ? null : "User not in system.", user);
              }
            });
          }
        });
      });
    }
  ));

  passport.serializeUser(function(user, done) {
      done(null, user._id);
  });

  passport.deserializeUser(function(_id, done) {
      userdb.findOne({_id: _id}, function(err, user) {
          done(err, user);
      });
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
