define("main", ["exports", "mithril", "synchronizedStateClient", "models"], function(exports, m, synchronizedStateClient, models) {
  var User = models.User;
  var wsAddress = 'ws://' + window.location.host;

  var appPath = "whiteboard";
  var groupSession = 0;
  User.me().then(function(user) {
    require(["/apps/" + appPath + "/main.js"], function(app) {
      var connection = synchronizedStateClient.connect(wsAddress, function() {
        connection.sync(groupSession);
        app.load(connection, document.body, {
          pdf: "/media/sample.pdf",
          user: user
        });
      });
    });
  });
});
