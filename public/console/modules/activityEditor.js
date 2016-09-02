  /* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('activityEditor', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  var phaseToRemove;

  exports.ActivityEditor = {
    'view': function(ctrl, args) {
      return m('div',
        m.component(AddPhaseModal, args),
        m.component(RemovePhaseModal, args),
        m('.phases',
          _.values(args.activity.phases) // we are getting an array of phases and sorting them by their specified order.
            .sort(function(a, b) { return a.order - b.order})
            .map(function(phase) {
              return m.component(Phase, _.extend(args, {'phase': phase}));
            }),
          m('.phase.add-phase-button', {
              'onclick': function(e) {
                $('#add-phase-modal').modal('show');
              }
            },
            m('span.phase-arrow.glyphicon.glyphicon-circle-arrow-right'),
            m('span.glyphicon.glyphicon-plus.add-phase-symbol')
          )
        )
      );
    }
  };

  var Phase = {
    'view': function(ctrl, args) {
      return m('div.phase',
        m('span.phase-arrow.glyphicon.glyphicon-circle-arrow-right'),
        m('iframe.activity-view', {
          'height': '200',
          'width:': '310',
          'src': '/client'
        }),
        m('.phase-app-icon-holder',
          m('img.phase-app-icon', {
            'height': '45px',
            'src': 'apps/' + args.phase.app + '/'+ args.apps[args.phase.app].icon
          })
        ),
        m('span.glyphicon.glyphicon-remove.remove-phase', {
          'onclick': function(e) {
            console.log('hi');
            phaseToRemove = args.phase.id;
            $('#remove-phase-modal').modal('show');
          }
        })
      );
    }
  };

  var AddPhaseModal = {
    'controller': function(args) {
      return {
        'app': null
      }
    },
    'view': function(ctrl, args) {
      return m('.modal.fade#add-phase-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Add phase")
          ),
          m('.modal-body',
            m('div.form-horizontal',
              m('.form-group',
                m('label', "App"),
                m('p', "Which app will students use in this phase?"),
                m('.list-group',
                  _.pairs(args.apps).map(function(pair) {
                    return m('.list-group-item' + (ctrl.app === pair[0] ? '.active' : ''), {
                      'onclick': function() {
                        ctrl.app = pair[0];
                      }
                    },
                      m('img.app-selection-icon', {
                        'height': '30px',
                        'src': 'apps/' + pair[0] + '/'+ pair[1].icon
                      }),
                      pair[1].title
                    );
                  })
                )
              )
            )
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Close"),
            m('button.btn.btn-primary#submit-new-class', {
              'data-dismiss': 'modal',
              'disabled': ctrl.app === null,
              'onclick': function(e) {
                args.activity.sendAction('add-phase-to-activity', ctrl.app);
              }
            }, "Add")
          )
        )
      );
    }
  };

  var RemovePhaseModal = {
    'view': function(ctrl, args) {
      return m('.modal.fade#remove-phase-modal',
        m('.modal-content.col-md-6.col-md-offset-3',
          m('.modal-header',
            m('h4.modal-title', "Delete class?")
          ),
          m('.modal-body',
            "Are you sure you want to delete this phase? This cannot be undone."
          ),
          m('.modal-footer',
            m('button.btn.btn-default', {
              'data-dismiss': 'modal'
            }, "Take me back"),
            m('button.btn.btn-danger', {
              'data-dismiss': 'modal',
              'onclick': function() {
                args.activity.sendAction('remove-phase-from-activity', phaseToRemove);
                classToDelete = void 0;
              }
            }, "Delete!")
          )
        )
      );
    }
  };

});
