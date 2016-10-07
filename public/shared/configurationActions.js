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

        for (var teacher in this.teachers) {
          teacher = this.teachers[teacher];

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
          'classrooms': {},
          'activities': {},
          'recordings': {}
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
          'studentGroupMapping': {},
          'currentActivity': null,
          'currentRecording': null
        };
      });

    stm.action('delete-classroom-from-teacher')
      .onReceive(function(id) {
        delete this.classrooms[id];
      });

    stm.action('create-group-in-classroom')
      .onReceive(function(classroomId, app) {
        var classroom = this.classrooms[classroomId];
        var initialStates;
        if (classroom.currentActivity !== null) {
          initialStates = {};
          _.values(this.activities[classroom.currentActivity].phases).forEach(function(phase) {
            initialStates[phase.id] = phase.initialState;
          });
        }
        var key = findNextKey(classroom.groups);
        var name = "Group " + (key + 1);
        classroom.groups[key] = {
          'id': key,
          'name': name,
          'states': initialStates
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

    stm.action('add-student-to-classroom')
      .onReceive(function(email) {
        var key = findNextKey(this.students);
        this.students[key] = {
          'id': key,
          'email': email,
          'currentPhase': 0
        };
      });

    stm.action('update-student')
      .onReceive(function(newProps) {
        for (var p in newProps)
          this[p] = newProps[p];
      });

    stm.action('toggle-project-on-student')
      .onReceive(function() {
        this.projected = !this.projected;
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

  stm.action('add-activity-to-teacher')
    .onReceive(function(name) {
      var key = findNextKey(this.activities);
      this.activities[key] = {
        'id': key,
        'name': name,
        'phases': {}
      };
    });

  stm.action('delete-activity-from-teacher')
    .onReceive(function(id) {
      delete this.activities[id];
    });

  stm.action('add-phase-to-activity')
    .onReceive(function(app) {
      var key = findNextKey(this.phases);
      this.phases[key] = {
        'id': key,
        'order': _.keys(this.phases).length + 1,
        'app': app,
        'initialState': {}
      };
    });

  stm.action('remove-phase-from-activity')
    .onReceive(function(id) {
      delete this.phases[id];
    });

  stm.action('launch-activity-in-classroom')
    .onReceive(function(classroomId, activityId) {
      // stores initial states indexed by phase id
      var initialStates = {};

      // iterate through phases and retrieve initial state of phase
      _.values(this.activities[activityId].phases).forEach(function(phase) {
        initialStates[phase.id] = phase.initialState;
      });

      // iterate through groups and copy initial states
      _.values(this.classrooms[classroomId].groups).forEach(function(group) {
        group.states = JSON.parse(JSON.stringify(initialStates));
      });

      // initialize students' current phase to 0
      _.values(this.classrooms[classroomId].students).forEach(function(student) {
        student.currentPhase = 0;
      })

      // mark that there is a live activity
      this.classrooms[classroomId].currentActivity = activityId;

      this.classrooms[classroomId].currentRecording = findNextKey(this.recordings);
      this.recordings[this.classrooms[classroomId].currentRecording] = {
        'startTime': Date.now()
      };
    });

  stm.action('end-activity-in-classroom')
    .onReceive(function(classroomId) {
      var recording = this.recordings[this.classrooms[classroomId].currentRecording];
      recording.image = JSON.parse(JSON.stringify(this.classrooms[classroomId]));
      recording.endTime = Date.now();

      this.classrooms[classroomId].currentActivity = null;
      this.classrooms[classroomId].currentRecording = null;

      _.values(this.classrooms[classroomId].students).forEach(function(student) {
        student.currentPhase = -1;
        student.projected = false;
      });

    });
  };
  /* --- support functions --- */

  /* Returns an unused index that is one greater than the greatest existing index in
   * an object.
   */
  function findNextKey(obj) {
    var id = 0;
    if (_.keys(obj).length > 0)
      id = Math.max.apply(null, _.keys(obj).map(function(val) { return val.toString(); })) + 1;

    return id;
  }
});
