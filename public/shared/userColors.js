define(["exports"], function(exports) {

  //var userColors = ["#FF0000", "#00FF00", "#0000FF", "#F0F000", "#00F0F0"];
  var userColors = ["#ac63a5", "#face57", "#e98039", "#6ab1b6", "#7f7f7f", "#cccccc"];

  exports.userColors = userColors;
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
