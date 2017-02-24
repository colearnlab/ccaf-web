//  This module provides authentication services for HTTP and WebSocket
//  connections. It uses passport to log users in with Google using the OAuth2
//  protocol.

//  Filesystem operations.
var fs = require("fs");

//  File path operations.
var path = require("path");

//  Main authentication module.
var passport = require("passport");

//  Store sessions with cookies.
var cookieSession = require("cookie-session");

//  Google login plugin for passport.
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;

//  initialize: set up Google authentication, add routes to facilitate
//    authentication, and provide an authentication function for use by other
//    routes in the main app.
//  Parameters:
//    app: the express app so we can add routes.
//    db: the sql.js sqlite database to check and update users.
exports.initialize = function(app, db) {
  //  Key rotation. We use a cookie session, which means we place a cookie on the
  //  user's browser that identifies them and allows them to navigate to pages
  //  without logging in every time they load a page. The advantage of a cookie
  //  session is that it allows us to precisely specify the time that the user
  //  stays logged in.

  //  The cookie session needs a list of keys, which are stored in
  //  cookieKeyList.txt. When the server is restarted, a key is randomly picked
  //  to sign all new cookies. Keys can be managed (replaced, etc) in the cookie
  //  list file.
  var keys;

  //  Try to read the file; if it fails throw an informative error message.
  try {
    var keyList = fs.readFileSync(path.resolve(__dirname, "cookieKeyList.txt"), {
      encoding: "utf8"
    });

    //  Read the newline-delimited file and throw out empty lines. (Text editors
    //  have a tendancy to add a empty line as the last line in a file.)
    var tmp = keyList.split("\n").filter(function(key) {
      return key.length > 0;
    });

    //  Make sure that we have at least one key.
    if (tmp.length === 0)
      throw new Error();

    //  Pick a random key to use and append the remaining keys so we cookies
    //  signed with other keys will still work.
    keys = tmp.splice(Math.floor(Math.random() * tmp.length));
    keys = keys.concat(tmp);
  } catch (e) {
    throw new Error("Couldn't load cookie key list. Ensure that a list is in the server/ folder and has at least one entry.");
  }

  //  The session manager. Max login length is set in ms and specified in .env.
  var cookies = cookieSession({
    name: 'session',
    keys: keys,
    maxAge: parseInt(process.env.MAX_LOGIN_LENGTH)
  });

  //  Set up cookies with the main express app.
  app.use(cookies);

  //  Set up passport with the main express app.
  app.use(passport.initialize());
  app.use(passport.session());

  //  Set up our login with the client ID and secret, which identifies our
  //  application to Google's servers. IDs and secrets can be managed at
  //  https://console.developers.google.com/.

  //  It is also important that the origin URL (which is the URL of the server)
  //  and the callback URL (which is the URL of the server + /oauth2callback)
  //  are properly set on the Google developer console. In addition, the
  //  callback url root (which is the URL of the server) must be set in the .env
  //  file.

  //  Lastly, we have a callback function that takes the information returned
  //  from the Google authentication and checks whether that user is in the
  //  database.
  passport.use(new GoogleStrategy({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL_ROOT + "oauth2callback"
    },
    //  This function checks to see whether the authenticated user is in our
    //  system. If they are not, we reject them. done is a callback that takes
    //  two parameters. The first parameter is an error message (or false-y if
    //  no error), and the second parameter is our information about the user.
    function(accessToken, refreshToken, profile, done) {
      //  A Google profile can have multiple emails listed. We are interested in
      //  finding the "account" email, which is the main one and of which there
      //  should be only one.
      var acctEmail;
      profile.emails.forEach(function(email) {
        if (email.type === "account") {
          acctEmail = email.value;
        }
      });

      //  We didn't find an account email... this shouldn't happen.
      if (!acctEmail)
        done("Couldn't find account email.");

      //  If we find the account email, check if it's in our database.
      var stmt = db.prepare("SELECT * FROM users WHERE email=:email", {
        ":email": acctEmail
      });

      //  This will be false if there is no record returned. If this is the case
      //  then the user is not in our system so we reject them. Otherwise,
      //  process the user.
      if (!stmt.step()) {
        done("User not in system.");
      } else {
        //  Retrieve the user record from the database.
        var user = stmt.getAsObject();

        //  If they don't have their name filled out, populate it from the Google
        //  profile. Also, update our local copy of the record.
        if (!user.name || user.name.length === 0) {
          db.run("UPDATE users SET name=:name WHERE id=:id", {
            ":id": user.id,
            ":name": profile.displayName
          });

          user.name = profile.displayName;
        }

        //  Finish with no error message and submitting our user information.
        done(null, user);
      }

      //  Release the memory of this statement.
      stmt.free();
    }
  ));

  //  serializeUser: return a unique piece of information of that user, to be
  //  associated with the session ID stored in that user's cookie. Later, when
  //  the user loads something we can find their information with that unique
  //  information. In this case, the user's ID is unique so we return that.
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  //  deserializeUser: given that piece of information returned by serializeUser,
  //  find and return the user's information.
  passport.deserializeUser(function(id, done) {
    var stmt = db.prepare("SELECT * FROM users WHERE id=:id", {
      ":id": id
    });

    if (!stmt.step())
      done("Could not find user.");

    var user = stmt.getAsObject();
    done(null, user);

    stmt.free();
  });

  //  Main login route. In the future, this path can be replaced by a screen
  //  that allows users to select between multiple authentication types.
  //  For now, we only need Google authentication.
  app.get("/login", function(req, res) {
    res.redirect("/auth/google");
  });

  //  Main Google authentication route. We request the user's email and name
  //  information. This means that the first time the user logs in, they'll have
  //  to authorize that we can get this information.
  app.get("/auth/google", passport.authenticate("google", {
      scope: ["https://www.googleapis.com/auth/userinfo.email",
              "https://www.googleapis.com/auth/userinfo.profile"],
      approvalPrompt: "auto"
    })
  );

  //  Once a user is sent to Google authentication, they are returned to here.
  //  We simply check to see if they are correctly authenticated and forward them
  //  to the appropriate route. The main route, "/", will forward to the right
  //  app (admin, teacher or student) depending on the user type.
  app.get("/oauth2callback", passport.authenticate("google", {
      successReturnToOrRedirect: "/",
      failureRedirect: "/fail"
    })
  );

  //  Our cookie session manager, so we can manually look up a session (in the
  //  case of WebSockets.
  return {
    cookies: cookies
  };
};

//  A simple helper function that checks if a user is authenticated, and if not
//  brings them to the login page.
exports.ensureAuthenticated = function(req, res, next) {
    if (req.isAuthenticated())
      next();
    else
      res.redirect("/login");
};
