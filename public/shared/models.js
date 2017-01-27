define(["exports", "mithril", "jquery"], function(exports, m, $) {
  var apiPrefix = "/api/v1/";

  // User methods.
  var User = function User(name, email, type) {
    this.name = name || "";
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
        else if (type instanceof Array)
          return users.data.filter(function(user) { return type.indexOf(user.type) >= 0; });
        else
          return users.data.filter(function(user) { return user.type === type; });
      }
    ).then(function(users) {
      return users.map(function(user) {
        return Object.assign(new User(), user);
      });
    });
  };

  User.me = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "users/me"
    }).then(function(user) {
      return user.data;
    });
  };

  User.prototype.save = function(settings) {
    settings = settings || {};
    settings.type = (typeof this._id !== "undefined" ? "PUT" : "POST");
    settings.url = apiPrefix + "users";
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  };

  User.prototype.delete = function(settings) {
    settings = settings || {};
    settings.type = "DELETE";
    settings.url = apiPrefix + "users";
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  };

  var Classroom = function(title, owner) {
    this.title = title || "";
    this.users = [];
  };

  Classroom.list = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "classrooms"
    }).then(function(classrooms) {
      return classrooms.data.map(function(classroom) { return Object.assign(new Classroom(), classroom); });
    });
  };

  Classroom.prototype.save = function(settings) {
    settings = settings || {};
    settings.type = (typeof this._id !== "undefined" ? "PUT" : "POST");
    settings.url = apiPrefix + "classrooms";
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  };

  exports.User = User;
  exports.Classroom = Classroom;
});
