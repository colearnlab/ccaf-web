define(["exports", "mithril", "jquery"], function(exports, m, $) {
  var apiPrefix = "/api/v1/";

  // User methods.
  var User = function User(name, email, type) {
    this.name = name;
    this.email = email;
    this.type = type;
  };

  // Return a list of all users of a certain type.
  User.list = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "users"
    }).then(function(users) {
      return users.data.map(function(user) {
        return Object.assign(new User(), user);
      });
    });
  };

  User.get = function(id) {
    return m.request({
      method: "GET",
      url: apiPrefix + "users/" + id
    }).then(function(user) {
      return Object.assign(new User(), user.data);
    });
  };

  User.me = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "users/me"
    }).then(function(user) {
      return Object.assign(new User(), user.data);
    });
  };

  User.types = {
    "administrator": 0,
    "teacher": 1,
    "student": 2
  };

  User.prettyPrintTypes = {
    0: "Administrator",
    1: "Teacher",
    2: "Student"
  };

  User.prototype.classrooms = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "users/" + this.id + "/classrooms"
    }).then(function(classrooms) {
      return classrooms.data.map(function(classroom) {
        return Object.assign(new Classroom(), classroom);
      });
    });
  };

  User.prototype.addClassroom = function(classroom) {
    var classroomId = (classroom instanceof Classroom ? classroom.id : classroom);
    return m.request({
      method: "PUT",
      url: apiPrefix + "users/" + this.id + "/classrooms/" + classroomId,
      deserialize: function(){}
    });
  };

  User.prototype.removeClassroom = function(classroom) {
    var classroomId = (classroom instanceof Classroom ? classroom.id : classroom);
    return m.request({
      method: "DELETE",
      url: apiPrefix + "users/" + this.id + "/classrooms/" + classroomId,
      deserialize: function(){}
    });
  };

  User.prototype.save = function(settings) {
    return basicSave.call(this, "users", settings);
  };

  User.prototype.delete = function(settings) {
    return basicDelete.call(this, "users", settings);
  };

  var Classroom = function(title, owner) {
    this.title = title;
    this.owner = owner;
  };

  Classroom.list = function() {
    return m.request({
      method: "GET",
      url: apiPrefix + "classrooms"
    }).then(function(classrooms) {
      return classrooms.data.map(function(classroom) {
        return Object.assign(new Classroom(), classroom);
      });
    });
  };

  Classroom.prototype.users = function() {
    if (typeof this.id === "undefined")
      return m.prop([]);

    return m.request({
      method: "GET",
      url: apiPrefix + "classrooms/" + this.id + "/users"
    }).then(function(users) {
      return users.data.map(function(user) {
        return Object.assign(new User(), user);
      });
    });
  };

  Classroom.prototype.save = function(settings) {
    return basicSave.call(this, "classrooms", settings);
  };

  Classroom.prototype.delete = function(settings) {
    return basicDelete.call(this, "classrooms", settings);
  };

  function basicSave(url) {
    return m.request({
      method: (typeof this.id !== "undefined" ? "PUT" : "POST"),
      url: apiPrefix + url + (typeof this.id !== "undefined" ? "/" + this.id : ""),
      data: JSON.parse(JSON.stringify(this)),
      serialize: function(data) { return m.route.buildQueryString(data); },
      deserialize: function() {},
      config: function(xhr) {
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
      }
    });
  }

  function basicDelete(url, settings) {
    return m.request({
      method: "DELETE",
      url: apiPrefix + url + (typeof this.id !== "undefined" ? "/" + this.id : ""),
      data: JSON.parse(JSON.stringify(this)),
      serialize: function(data) { return m.route.buildQueryString(data); },
      deserialize: function() {},
      config: function(xhr) {
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
      }
    });
  }

  exports.User = User;
  exports.Classroom = Classroom;
});
