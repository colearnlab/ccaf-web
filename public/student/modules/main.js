define("main", ["exports", "mithril", "synchronizedStateClient", "models", "multicast"], function(exports, m, synchronizedStateClient, models, multicast) {
  var User = models.User;
  var wsAddress = 'ws://' + window.location.host + "/ws";

  window.multicast = multicast;

  var appPath = "whiteboard";
  var groupSession = 0;
  User.me().then(function(user) {
    require(["/apps/" + appPath + "/main.js"], function(app) {
      var connection = synchronizedStateClient.connect(wsAddress, function() {
        connection.sync(groupSession);
        connection.userList.addObserver(function(users) {
          console.log("Connected users", users);
        });
        app.load(connection, document.body, {
          pdf: "/media/sample.pdf",
          user: user
        });
      });
    });
  });
});
