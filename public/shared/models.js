define(["exports", "mithril", "jquery"], function(exports, m, $) {
  var apiPrefix = "/api/v1/";

  function basicSave(url, settings) {
    settings = settings || {};
    settings.type = (typeof this._id !== "undefined" ? "PUT" : "POST");
    settings.url = apiPrefix + url;
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  }

  function basicDelete(url, settings) {
    settings = settings || {};
    settings.type = "DELETE";
    settings.url = apiPrefix + url;
    settings.data = JSON.parse(JSON.stringify(this));
    $.ajax(settings);
  }

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
    return basicSave.call(this, "users", settings);
  };

  User.prototype.delete = function(settings) {
    return basicDelete.call(this, "users", settings);
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

  Classroom.get = function(classroomId) {
    return m.request({
      method: "GET",
      url: apiPrefix + "classrooms/" + classroomId
    }).then(function(classroom) {
      classroom = classroom.data;

      classroom.groups = classroom.groups || [];
      classroom.groups = classroom.groups.map(function(group) {
        return Object.assign(new Group(), group);
      });
      
      return Object.assign(new Classroom(), classroom);
    });
  };

  Classroom.prototype.save = function(settings) {
    return basicSave.call(this, "classrooms", settings);
  };

  Classroom.prototype.delete = function(settings) {
    return basicDelete.call(this, "classrooms", settings);

  };

  var Group = function(title) {
    this.title = title;
    this.users = [];
  };

  exports.User = User;
  exports.Classroom = Classroom;
  exports.Group = Group;
});
