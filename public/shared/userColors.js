define(["exports"], function(exports) {

  var userColors = ["#FF0000", "#00FF00", "#0000FF", "#F0F000", "#00F0F0"];

  exports.getColor = function(userList, id) {
    var userIdx = userList
      .map(function(user) {
        return user.id;
      })
      .sort()
      .indexOf(id);

    return userColors[userIdx];
  };
});
