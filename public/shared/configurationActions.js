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
        this.classrooms = this.classrooms || {};

        for (var classroom in this.classrooms) {
          classroom = this.classrooms[classroom];

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

    /* create-app-instance: create an instance of an app on the state it is called on.
     * This can be the live state, or a state being preconfigured in the editor.
     */
    stm.action('create-app-instance')
      .onReceive(function(app) {
        var instances = this.instances;
        instances[findNextKey(instances)] = new Instance(app);
      });

    stm.action('set-instance-app')
      .onReceive(function(app) {
        this.app = app;
      });

    /* delete-app-instance: delete an instance of an app on the state it is called on.
     */
    stm.action('delete-app-instance')
      .onReceive(function(instance) {
        // First, find all users associated to that instance and clear that association.
        for (var user in this.userInstanceMapping)
          if (this.userInstanceMapping[user] == instance)
            delete this.userInstanceMapping[user];

        // Remove the instance from the instance object.
        delete this.instances[instance];
      });

    /* associate-user-to-instance: associates a user to an instance on the state it
     * is called on.
     */
    // NOTE: Will need to account for multiple users logged into the same device.
    stm.action('associate-user-to-instance')
      .onReceive(function(user, instance) {
          if (instance === null)
            delete this.userInstanceMapping[user];
          else
            this.userInstanceMapping[user] = instance;
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
  }

  /* Prototype for the Instance object.
   */
  function Instance(app, title, config) {
    this.app = app;
    this.title = title;
    this.root = {};
    this.config = config || {};
  }

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
