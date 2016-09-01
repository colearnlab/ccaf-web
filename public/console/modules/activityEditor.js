/* jshint ignore:start */
{{> rjsConfig}}
/* jshint ignore:end */

module = null;

define('activityEditor', ['exports', 'mithril', 'underscore', 'interact'], function(exports, m, _, interact) {
  exports.ActivityEditor = {
    'view': function(ctrl, args) {
      return m('div',
        m('.phases',
          _.values(args.activity.phases) // we are getting an array of phases and sorting them by their specified order.
            .sort(function(a, b) { return a.order - b.order})
            .map(function(phase) {
              return m.component(Phase, {'phase': phase});
            }),
          m('.phase.add-phase-button', {
              'onclick': function(e) {
                args.activity.sendAction('add-phase-to-activity', 'whiteboard');
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
      "phase ", args.phase.id);
    }
  }

});
