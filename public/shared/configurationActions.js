define('configurationActions', ['exports', 'underscore'], function(exports, _) {
  exports.load = function(stm) {
    stm.action('init')
      .onReceive(function() {
        this.classrooms = this.classrooms || {};

        var classroom;
        for (var c in this.classrooms) {
          classroom = this.classrooms[c];

          if (typeof classroom.id === 'undefined')
            delete this.classrooms[c];

          classroom.users = classroom.users || {};
          classroom.userStatus = classroom.userStatus || {};
          classroom.currentActivity = classroom.currentActivity || null;
          classroom.currentState = classroom.currentState || {instances:{}, userInstanceMapping:{}};
          classroom.activities = classroom.activities || {};
          classroom.projections = classroom.projections || {};
        }
      });

    stm.action('create-app-instance')
      .onReceive(function(app) {
        var instances = this.instances;
        var id = 0;
        if (_.keys(instances).length > 0)
          id = Math.max.apply(null, _.keys(instances).map(function(val) { return val.toString(); })) + 1;

        instances[id] = new Instance(app);
      });

    stm.action('delete-app-instance')
      .onReceive(function(instance) {
        for (var user in this.userInstanceMapping)
          if (this.userInstanceMapping[user] == instance)
            delete this.userInstanceMapping[user];
        delete this.instances[instance];
      });

    stm.action('associate-user-to-instance')
      .onReceive(function(user, instance) {
          this.userInstanceMapping[user] = instance;
      });

    stm.action('toggle-projection')
      .onReceive(function(instance) {
        var projections = this.projections;
        for (var projection in projections)
          if (projections[projection].instanceId == instance) {
            delete projections[projection];
            return true;
          }

        var id = 0;
          if (_.keys(projections).length > 0)
            id = Math.max.apply(null, _.keys(projections).map(function(val) { return val.toString(); })) + 1;

        projections[id] = {x:0, y:0, a:0, s:1, z:0, instanceId: instance};

      });

    stm.action('update-projection')
      .onReceive(function(x, y, a, s, z) {
        this.x = x || this.x;
        this.y = y || this.y;
        this.a = a || this.a;
        this.s = s || this.s;
        this.z = z || this.z;
      });
  };



  function Instance(app, title, config) {
    this.app = app;
    this.title = title;
    this.root = {};
    this.config = config || {};
  }
});
