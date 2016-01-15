define('login', ['exports', 'mithril', 'underscore'], function(exports, m, _) { 
  
  // configuration options:
  // - student [true]: log in student, as opposed to just classroom
  exports.display = function(el, config, callback) {
    if (!config.store)
      throw new Error("set store on config parameter");
    _.defaults(config, {
      'student': true
    });
    
    m.mount(el, m.component(selector, _.extend(config, {'callback': callback})));
  };
  
  var selector = {
    'controller': function(args) {
      return {
        'classroom': m.prop(null)
      };
    },
    'view': function(ctrl, args) {
      return m('.container',
        m('.row#classroom', [
          m('br'),
          m('.col-xs-10.col-xs-offset-1.col-sm-6-col-sm-offset-3.col-md-4.col-md-offset-4', [
            m('.alert.alert-info', "Log in to get started:"),
            m('h4', 'Select a classroom'),
            m('.list-group',
              Object.keys(args.store.classrooms).map(function(classroomId) {
                return m('a.list-group-item', {
                  'onclick': function(e) {
                    var others = e.target.parentNode.children;
                    for (var i = 0; i < others.length; i++)
                      others[i].classList.remove('active');
                    e.target.classList.add('active');
                    document.getElementById('classroom').classList.add('dim');
                    if (args.student)
                      ctrl.classroom(classroomId);
                    else
                      args.callback(classroomId);
                  }
                }, args.store.classrooms[classroomId].name)
              })
            )
          ])
        ]),
        m('.row', {
          'style': ctrl.classroom() === null ? 'visibility: hidden;' : ''
        },
          m('br'),
          m('.col-xs-10.col-xs-offset-1.col-sm-6-col-sm-offset-3.col-md-4.col-md-offset-4', [
            m('h4', 'What\'s your name?'),
            m('.list-group',
              Object.keys(ctrl.classroom() ? args.store.classrooms[ctrl.classroom()].users : {}).map(function(userId) {
                return m('a.list-group-item', {
                  'onclick': function() {
                    args.callback(ctrl.classroom(), userId);
                  }
                }, args.store.classrooms[ctrl.classroom()].users[userId].name)
              })
            )
          ])
        )
      );
    }
  }
});