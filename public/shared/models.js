/*
 * models.js: Client-side definitions of various classes including User, 
 *  Classroom, Group, ClassroomSession, and Activity. Wraps API calls.
 */

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

    User.typeNames = {
        0: "administrator",
        1: "teacher",
        2: "student"
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

    User.prototype.ownclassrooms = function() {
        return m.request({
            method: "GET",
            url: apiPrefix + "users/" + this.id + "/ownclassrooms"
        }).then(function(classrooms) {
            return classrooms.data.map(function(classroom) {
                return Object.assign(new Classroom(), classroom);
            });
        });
    };

    User.prototype.activities = function() {
        return Activity.list(this.id);
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


    User.prototype.groups = function() {
        return m.request({
            method: "GET",
            url: apiPrefix + "users/" + this.id + "/groups"
        }).then(function(groups) {
            return groups.data.map(function(group) {
                return Object.assign(new Group(), group);
            });
        });
    };

    User.prototype.addGroup = function(group) {
        var groupId = (group instanceof Group ? group.id : group);
        return m.request({
            method: "PUT",
            url: apiPrefix + "users/" + this.id + "/groups/" + groupId
        });
    };

    User.prototype.removeGroup = function(group) {
        var groupId = (group instanceof Group ? group.id : group);
        return m.request({
            method: "DELETE",
            url: apiPrefix + "users/" + this.id + "/groups/" + groupId
        }).then(function(data) {
            return data;
        }, function(data) {
            return data
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

    Classroom.get = function(id) {
        return m.request({
            method: "GET",
            url: apiPrefix + "classrooms/" + id
        }).then(function(classroom) {
            return Object.assign(new Classroom(), classroom.data);
        });
    };

    Classroom.prototype.groups = function() {
        if (typeof this.id === "undefined")
            return m.prop([]);

        return m.request({
            method: "GET",
            url: apiPrefix + "classrooms/" + this.id + "/groups"
        }).then(function(groups) {
            return groups.data.map(function(group) {
                return Object.assign(new Group(), group);
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

    Classroom.prototype.sessions = function() {
        if (typeof this.id === "undefined")
            return m.prop([]);

        return m.request({
            method: "GET",
            url: apiPrefix + "classrooms/" + this.id + "/sessions"
        }).then(function(sessions) {
            return sessions.data.map(function(session) {
                return Object.assign(new ClassroomSession(), session);
            });
        });
    };

    Classroom.prototype.save = function() {
        return basicSave.call(this, "classrooms");
    };

    Classroom.prototype.delete = function() {
        return basicDelete.call(this, "classrooms");
    };

    var Group = function(title, classroom) {
        this.title = title;
        this.classroom = classroom;
    };

    Group.prototype.users = function() {
        if (typeof this.id === "undefined")
            return m.prop([]);

        return m.request({
            method: "GET",
            url: apiPrefix + "groups/" + this.id + "/users"
        }).then(function(users) {
            return users.data.map(function(user) {
                return Object.assign(new User(), user);
            });
        });
    };

    Group.prototype.save = function() {
        return basicSave.call(this, "groups");
    };

    Group.prototype.delete = function() {
        return basicDelete.call(this, "groups");
    };

    function basicSave(url) {
        var that = this;
        return m.request({
            method: (typeof this.id !== "undefined" ? "PUT" : "POST"),
            url: apiPrefix + url + (typeof this.id !== "undefined" ? "/" + this.id : ""),
            data: JSON.parse(JSON.stringify(this)),
            serialize: function(data) { return m.route.buildQueryString(data); },
            config: function(xhr) {
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
            }
        }).then(function(returnedData) {
            if (typeof that.id === "undefined")
                that.id = returnedData.data.id;

            return returnedData;
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

    function File() {}

    File.upload = function(file, metadata) {
        var data = new FormData();
        data.append("metadata", metadata);
        data.append("upload", file);
        return m.request({
            method: "POST",
            url: "/api/v1/media",
            data: data,
            serialize: function(a) { return a; }
        }).then(function(resobj) {
            var res = resobj.data;
            var newPage = new ActivityPage();
            newPage.id = res.activityPageId;
            newPage.filename = res.filename;
            newPage.originalFilename = res.originalname;
            newPage.owner = res.owner;
            newPage.timeUploaded = res.timeUploaded;
            newPage.metadata = res.metadata;
            return newPage;
        });
    };

    function ClassroomSession() {}

    ClassroomSession.get = function(id) {
        return m.request({
            method: "GET",
            url: "/api/v1/classroom_sessions/" + id
        }).then(function(classroomSession) {
            return Object.assign(new ClassroomSession(), classroomSession.data);
        });
    };

    ClassroomSession.list = function() {
        return m.request({
            method: "GET",
            url: "/api/v1/classroom_sessions"
        }).then(function(classroomSessions) {
            return classroomSessions.data.map(function(classroomSession) {
                return Object.assign(new ClassroomSession(), classroomSession);
            });
        });
    };

    ClassroomSession.prototype.getStoreId = function(group, user) {
        return m.request({
            method: "GET",
            url: "/api/v1/getStoreId/session/" + this.id + "/group/" + group + "/user/" + user
        }).then(function(storeId) {
            return storeId.data;
        });
    };

    ClassroomSession.prototype.save = function() {
        return basicSave.call(this, "classroom_sessions");
    };

    function Activity(title, owner) {
        this.title = title;
        this.owner = owner;
        this.pages = [];
    }

    // Get an activity by its id (should get info about all pages!)
    Activity.get = function(id) {
        return m.request({
            method: "GET",
            url: "/api/v1/activity/" + id
        }).then(function(activity) {
            var newActivity = Object.assign(new Activity(), activity.data);
            if(newActivity.pages) {
                newActivity.pages = newActivity.pages.map(function(page) {
                    return Object.assign(new ActivityPage(), page);
                });
            }
            console.log(newActivity);
            return newActivity;
        });
    };

    Activity.list = function(ownerId) {
        if((typeof ownerId) == "undefined")
            ownerId = "";
        return m.request({
            method: "GET",
            url: "/api/v1/activities/" + ownerId
        }).then(function(activities) {
            return activities.data.map(function(activity) {
                var ret = new Activity(activity.title, activity.owner);
                ret.course_info = {
                    course: activity.course,
                    course_name: activity.course_name,
                    course_owner: activity.course_owner,
                }
                ret.id = activity.id;
                return ret;
            });
        });
    };

    Activity.prototype.save = function() {
        console.log(this.pages);
        var oldPages = this.pages;
        this.pages = JSON.stringify(this.pages);
        return basicSave.call(this, "activity").then(function() {
            this.pages = oldPages;
        });
    };

    Activity.prototype.delete = function(settings) {
        return basicDelete.call(this, "activity", settings);
    };

    function ActivityPage() {}

    ActivityPage.getByOwner = function(ownerId) {
        return m.request({
            method: "GET",
            url: "/api/v1/documents/" + ownerId
        }).then(function(pages) {
            //console.log(pages);
            return pages.data.map(function(page) {
                return Object.assign(new ActivityPage(), page);
            });
        });
    };



    exports.User = User;
    exports.Classroom = Classroom;
    exports.Group = Group;
    exports.File = File;
    exports.ClassroomSession = ClassroomSession;
    exports.Activity = Activity;
    exports.ActivityPage = ActivityPage;
});
