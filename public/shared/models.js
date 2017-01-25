define(["exports", "mithril", "jquery"], function(exports, m, $) {
  var apiPrefix = "/api/v1/";

  // User methods.
  var User = function User(name, email, type) {
    this.name = name || "New user";
    this.email = email || "";
    this.type = type || "";
  };

  // Return a list of all users of a certain type.
  User.list = function(type) {
    return m.request({
      method: "GET",
      url: apiPrefix + "users"
    }).then(function(users) {
        if (typeof type === "undefined")
          return users.data;
        else
          return users.data.filter(function(user) { return user.type === type; });
      }
    ).then(function(users) {
      return users.map(function(user) {
        return Object.assign(new User(), user);
      });
    });
  };

  User.prototype.save = function(settings) {
    settings = settings || {};
    settings.url = apiPrefix + "users";
    settings.data = JSON.parse(JSON.stringify(this));
    $.post(settings);
  };

  User.prototype.delete = function(settings) {
    settings = settings || {};
    settings.type = "DELETE";
    settings.url = apiPrefix + "users";
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  };

  var Classroom = function(title, owner) {
    this.title = title;
    this.owner = owner;
  };

  Classroom.listAll = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "classrooms"
    });
  };

  Classroom.listByOwner = function(owner) {

  };

  Classroom.listBySharedWith = function(sharedWith) {

  };

  exports.User = User;
});
