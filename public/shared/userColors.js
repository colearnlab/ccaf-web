define(["exports"], function(exports) {

  //var userColors = ["#FF0000", "#00FF00", "#0000FF", "#F0F000", "#00F0F0"];
  var userColors = [
      "#ac63a5", // purple
      "#face57", // yellow
      "#e98039", // orange
      "#6ab1b6", // light blue
      "#ff0000", // full red
      "#00ff00", // full green
      "#ffff00", // full yellow
      "#0000ff", // full blue
      "#ff00ff", // magenta
      "#00ffff", // teal
      "#7f7f7f", // gray
      "#cccccc" // darker gray
  ];

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
