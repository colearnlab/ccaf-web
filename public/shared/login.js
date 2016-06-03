define('login', ['exports', 'mithril', 'underscore', 'clientUtil'], function(exports, m, _, clientUtil) {
  exports.display = function(el, config, callback) {
    _.defaults(config, {
      'type': 'student'
    });

    if (config.type == 'student' || config.type == 'classroom')
      m.mount(el, m.component(selector, _.extend(config, {'callback': callback})));
    else if (config.type == 'google') {
      var doLoginUrl = function() {
        var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {var r = Math.random()*16|0,v=c=='x'?r:r&0x3|0x8;return v.toString(16);});
        config.ws.send(JSON.stringify({'channel': 'request-google-auth', 'message': {'id': id, 'redirect_uri': location.protocol + '//' + location.host + location.pathname}}));

        var eventListener;
        config.ws.addEventListener('message', eventListener = function(event) {
          var envelope = JSON.parse(event.data);
          if (envelope.channel == 'google-auth-url' && envelope.message.id == id) {
            m.mount(el, m.component(GoogleLogin, _.extend(config, {'callback': callback, 'url': envelope.message.url})));
            config.ws.removeEventListener('message', eventListener);
          }
        });
      };

      var gup = clientUtil.gup;
      if (gup('code') === null) {
        doLoginUrl();
      } else {
        config.ws.send(JSON.stringify({'channel': 'verify-google-auth', 'message': {'code': gup('code')}}));

        var eventListener;
        config.ws.addEventListener('message', eventListener = function(event) {
          var envelope = JSON.parse(event.data);
          if (envelope.channel == 'verify-google-auth-failed' && envelope.message.code == gup('code')) {
            doLoginUrl();
          } else if (envelope.channel == 'verify-google-auth-success' && envelope.message.code == gup('code')) {
            callback();
          }
        });
      }
    }
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
                    if (args.type == 'student')
                      ctrl.classroom(classroomId);
                    else if (args.type == 'classroom')
                      args.callback(classroomId);
                  }
                }, args.store.classrooms[classroomId].name);
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
                }, args.store.classrooms[ctrl.classroom()].users[userId].name);
              })
            )
          ])
        )
      );
    }
  };

  var GoogleLogin = {
    'controller': function(args) {

    },
    'view': function(ctrl, args) {
      return m('a', {
        'href': args.url
      }, "Log in via Google");
    }
  };
});
