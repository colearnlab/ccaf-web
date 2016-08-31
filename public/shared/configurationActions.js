define('configurationActions', ['exports', 'underscore'], function(exports, _) {
  exports.load = function(stm) {
    /* init: Ensure all classrooms have the correct properties so modules can find
     * objects where they expect. Probably not needed, but a principle of checkerboard
     * is to create your state expecting anything in the store, because you can't
     * rely on other modules to keep data intact. This function is based off of
     * ccaf-server/schema.json.
     */
    stm.action('init')
      .onReceive(function() {
        this.teachers = this.teachers || {};

        // moved
        this.classrooms = null;

        for (var teacher in this.teachers) {
          teacher = this.teachers[teacher];

          teacher.currentActivity = typeof teacher.currentActivity === 'undefined' ? null : teacher.currentActivity;

          teacher.activities = teacher.activities || {};
          for (var activity in teacher.activities) {
            activity = teacher.activities[activity];
          }

          teacher.classrooms = teacher.classrooms || {};
          for (var classroom in teacher.classrooms) {
            classroom = teacher.classrooms[classroom];

            classroom.users = classroom.users || {};
            classroom.groups = classroom.groups || {};
            classroom.studentGroupMapping = classroom.studentGroupMapping || {};
          }
        }

      });

    stm.action('add-teacher')
      .onReceive(function(name, email) {
        var key = findNextKey(this.teachers);
        this.teachers[key] = {
          'id': key,
          'name': name,
          'email': email,
          'classrooms': {}
        };
      });

    stm.action('add-classroom-to-teacher')
      .onReceive(function(name, initialStudents) {
        var key = findNextKey(this.classrooms);
        this.classrooms[key] = {
          'id': key,
          'name': name,
          'students': initialStudents,
          'groups': {},
          'studentGroupMapping': {}
        };
      });

    stm.action('delete-classroom-from-teacher')
      .onReceive(function(id) {
        delete this.classrooms[id];
      });

    stm.action('create-group-in-classroom')
      .onReceive(function(app) {
        var key = findNextKey(this.groups);
        var name = "Group " + (key + 1);
        this.groups[key] = {
          'id': key,
          'name': name
        };
      });

    stm.action('set-group-name')
      .onReceive(function(name) {
        this.name = name;
      });

    /* delete-app-instance: delete an instance of an app on the state it is called on.
     */
    stm.action('delete-group-from-classroom')
      .onReceive(function(group) {

        // First, find all users associated to that instance and clear that association.
        for (var user in this.studentGroupMapping)
          if (this.studentGroupMapping[user] == group)
            delete this.studentGroupMapping[user];

        // Remove the instance from the instance object.
        delete this.groups[group];
      });

    /* associate-user-to-instance: associates a user to an instance on the state it
     * is called on.
     */
    // NOTE: Will need to account for multiple users logged into the same device.
    stm.action('associate-student-to-group')
      .onReceive(function(student, group) {
          if (group === null)
            delete this.studentGroupMapping[student];
          else
            this.studentGroupMapping[student] = group;
      });

    /* toggle-projection: operates on the classroom level. Adds a projection of a
     * LIVE instance to the list of projections.
     */
    stm.action('toggle-projection')
      .onReceive(function(instance) {
        var projections = this.projections;

        // First, look to see if a projection of this instance already exists.
        // If so, delete it and return.
        for (var projection in projections)
          if (projections[projection].instanceId == instance) {
            delete projections[projection];
            return true;
          }

        // Otherwise, create a new projection of that instance.
        projections[findNextKey(projections)] = new Projection(instance);

      });

    /* update-projection: update the coordinates, etc. of the projection action
     * is called on.
     */
    stm.action('update-projection')
      .onReceive(function(x, y, a, s, z) {
        this.x = ifExistsElse(x, this.x);
        this.y = ifExistsElse(y, this.y);
        this.a = ifExistsElse(a, this.a);
        this.s = ifExistsElse(s, this.s);
        this.z = ifExistsElse(z, this.z);
      });
  };

  /* --- support functions --- */

  /* Prototype for the Projection object.
   */
  function Projection(instanceId) {
    this.x = 0;
    this.y = 0;
    this.a = 0;
    this.s = 0.5;
    this.z = 0;
    this.instanceId = instanceId;
  };

  /* Returns an unused index that is one greater than the greatest existing index in
   * an object.
   */
  function findNextKey(obj) {
    var id = 0;
    if (_.keys(obj).length > 0)
      id = Math.max.apply(null, _.keys(obj).map(function(val) { return val.toString(); })) + 1;

    return id;
  }

  /* if tryFirst is defined, return that. Otherwise, return the default value.
   * Used for conditional setting for parameters.
   */
  function ifExistsElse(tryFirst, fallback) {
    if (typeof tryFirst !== 'undefined')
      return tryFirst;

    return fallback;
  }
});
