define(["exports", "pdfjs-dist/build/pdf.combined", "mithril", "models", "interact"], function(exports, pdfjs, m, models, interact) {
    /* TODO
     *
     * Draw the big per-group-relative-activity plot
     *  -   background
     *  -   axes
     *  -   points, lines, labels
     *  -   legend
     *  -   mouse events
     *
     *  Draw the per-group progress views
     *  -   background
     *  -   pdf page thumbnails
     *  -   box edges
     *  -   completion tokens
     *  -   per-student relative activity bars
     */

    exports.dataVis = {
        controller: function(args) {
            //console.log("in controller");
            // TODO call API for data vis results here
            return {
                sessionId: m.route.param("sessionId"),
                // make single request for all groups!

            };
        },
        
        view: function(ctrl, args) {
            //console.log("in view");
            // Page structure:
            // activity graph (canvas?)
            // grid with groups
            //  need: pdf thumbs

            return m("div", "Hello session " + ctrl.sessionId);
        }
    };

    
});
