define([/*"./fabric.require","sha1",*/ "underscore"], function(/*fabric, Sha1,*/ _) {
	
	var mechanicsObjects = {};

    // ======================================================================================
    // ======================================================================================
    // ======================================================================================
    // ======================================================================================
    // New object types.
    // These are all classes that create and return the object, but don't add it to the canvas.

	mechanicsObjects.Arrow = fabric.util.createClass(fabric.Object, {
		type: 'Arrow',
		initialize: function(options) {
			options = options || {};
			this.callSuper("initialize", options);
			this.set('arrowheadOffsetRatio', options.arrowheadOffsetRatio || 0.03);
			this.set('arrowheadWidthRatio', options.arrowheadWidthRatio || 0.01);
			this.set('strokeWidth', options.strokeWidth || 2);
			this.set('stroke', options.stroke || 'black');
			this.set('height', options.height || 3*this.strokeWidth);
			this.setControlVisible('bl',false);
			this.setControlVisible('tl',false);
			this.setControlVisible('br',false);
			this.setControlVisible('tr',false);
			this.setControlVisible('mt',false);
			this.setControlVisible('mb',false);   
			this.setControlVisible('ml',false);
			this.setControlVisible('mr',false); 

            //this.set('originX', 'left');
            //this.setControlVisible('mtr',false);

		},
		toObject: function() {
			return fabric.util.object.extend(this.callSuper('toObject'), {
                /* should write here the properties that were added in initialize
                   and that should appear on the server */
                name: this.get('name')
			});
		},
		_render: function(ctx) {
			var lengthPx = this.width;                      //Length of the arrow line.
			var lenPx = lengthPx*this.arrowheadOffsetRatio; //Length of the arrowhead.
			var dyPx = lengthPx*this.arrowheadWidthRatio;  
			// draw the line
			ctx.beginPath();                
			ctx.moveTo(-lengthPx/2, 0);
			ctx.lineTo(lengthPx/2, 0);
			// draw the arrow head
			ctx.moveTo(lengthPx/2-lenPx/2, 0);
			ctx.lineTo(lengthPx/2-lenPx, dyPx);
			ctx.lineTo(lengthPx/2, 0);
			ctx.lineTo(lengthPx/2-lenPx, -dyPx);
			ctx.closePath();               
			this._renderFill(ctx);
			this._renderStroke(ctx);
		},
	});   
 
    // ======================================================================================
    
    mechanicsObjects.Arc = fabric.util.createClass(fabric.Object, {
		type: 'Arc',
        getDefaultOptions: function() {
            return { 
                type: "Arc",
                left: 0, 
                top: 0,    
                originX: 'center', 
                originY: 'center',                
                width: 120, 
                height: 120, 
                radius: 60, 
                startAngle: -110, 
                endAngle: 110,    
                strokeWidth: 2,  
                fill: 'magenta', 
                stroke: 'magenta',
                clockwise: false,
                angle: -20
            };
        },
		initialize: function(options) {
			options = options || {};
			this.callSuper("initialize", options);
			this.set('arrowheadOffsetRatio', options.arrowheadOffsetRatio || 0.2);
			this.set('arrowheadWidthRatio', options.arrowheadWidthRatio || 0.2);
            this.set('clockwise', options.clockwise || false);
			this.set('strokeWidth', options.strokeWidth || 2);
			this.set('stroke', options.stroke || 'black');
			this.set('height', options.height || 3*this.strokeWidth);
			this.setControlVisible('bl',false);
			this.setControlVisible('tl',false);
			this.setControlVisible('br',false);
			this.setControlVisible('tr',false);
			this.setControlVisible('mt',false);
			this.setControlVisible('mb',false);   
			this.setControlVisible('ml',false);
			this.setControlVisible('mr',false); 
			this.setControlVisible('mtr',false);
		},
		toObject: function() {
			return fabric.util.object.extend(this.callSuper('toObject', Object.keys(this.getDefaultOptions())), {
                name: this.get('name')
				//arrowheadOffsetRatio: this.get('arrowheadOffsetRatio'),
				//arrowheadWidthRatio: this.get('arrowheadWidthRatio'),
                //clockwise: this.get('clockwise')
			});
		},
		_render: function(ctx) {
			var lengthPx = this.radius; //Length of the arrow line.
			var lenPx = lengthPx*this.arrowheadOffsetRatio; //Length of the arrowhead.
			var dyPx = lengthPx*this.arrowheadWidthRatio;  
            ctx.beginPath(); 
            if (this.clockwise) {
                var angle1 = this.startAngle*Math.PI/180;
                var angle2 = this.endAngle*Math.PI/180;
            }
            else {
                var angle2 = this.startAngle*Math.PI/180;
                var angle1 = this.endAngle*Math.PI/180;             
            }
            var xhead = this.radius*Math.cos(angle2);
            var yhead = this.radius*Math.sin(angle2);
            var xtail = this.radius*Math.cos(angle1);
            var ytail = this.radius*Math.sin(angle1);
            ctx.moveTo(xhead, yhead); 
			ctx.lineTo(xhead+lenPx, yhead+dyPx);
			ctx.lineTo(xhead-dyPx, yhead);
			ctx.lineTo(xhead+lenPx, yhead-dyPx);
			ctx.lineTo(xhead, yhead);    
            this._renderFill(ctx);            
            if (this.clockwise) ctx.moveTo(xtail, ytail);
            ctx.arc(0, 0, this.radius, this.startAngle*Math.PI/180 , this.endAngle*Math.PI/180);            
            this._renderStroke(ctx);
            //ctx.setLineDash([0.1,0.05]);            
            ctx.moveTo(0, 0); 
            ctx.arc(-this.radius/9, 0, this.radius/9, 0, 2 * Math.PI);
            //ctx.lineTo(this.radius,0);
            this._renderStroke(ctx);
		},
	}); 	

    // ======================================================================================

    mechanicsObjects.Rod = fabric.util.createClass(fabric.Object, {
		type: 'rod',
		initialize: function(options) {
			options = options || {};
			this.callSuper("initialize", options);
		},
		_render: function(ctx) {
			// in the _render function, the canvas has already been translated to the center of the object which is being drawn. So anything we draw at the point 0, 0 will be drawn in the center of the object. 
			var lengthPx = this.width/2;
			var rPx = this.height/2;  
			var pointRadiusPx = rPx/5; 
			ctx.beginPath();
			ctx.moveTo(-lengthPx, rPx);
			ctx.arcTo(lengthPx + rPx, rPx, lengthPx + rPx, -rPx, rPx);                
			ctx.arcTo(lengthPx + rPx, -rPx, -lengthPx, -rPx, rPx);
			ctx.arcTo(-lengthPx-rPx, -rPx, -lengthPx-rPx, rPx, rPx);
			ctx.arcTo(-lengthPx-rPx, rPx, -lengthPx, rPx, rPx);  
			ctx.moveTo(-lengthPx+pointRadiusPx, 0);                       
			ctx.arc(-lengthPx, 0, pointRadiusPx, 0, 2 * Math.PI);
			ctx.moveTo(lengthPx+pointRadiusPx, 0);                       
			ctx.arc(lengthPx, 0, pointRadiusPx, 0, 2 * Math.PI);                    
			this._renderFill(ctx);
			this._renderStroke(ctx);
		},
	});    

    // ============================================================
    // Add latex labels
    // ============================================================    
    /*
    mechanicsObjects.addLatexToCanvas = function(canvas, latex, leftPos, topPos) {
            var latexURL = 'text/' + Sha1.hash(latex.slice(4)) + '_hi.png'
            fabric.Image.fromURL(latexURL, function(im) {
                canvas.add(im);
            }, {
                left: leftPos,
                top: topPos,
                minScaleLimit: 0.0001,
                scaleX: 0.25,
                scaleY: 0.25,
                originX: 'center',
                originY: 'center',
                selectable:false,
            });
    };
*/

    /********************************************************************************/
    /********************************************************************************/
    /********************************************************************************/
    // Helper functions for maintaining submittedAnswer
    
    mechanicsObjects.idCounter = 0;
    mechanicsObjects.newID = function() {
        this.idCounter++;
        return this.idCounter;
    };

    mechanicsObjects.addOrReplaceSubmittedAnswerObject = function(submittedAnswer, answerName, subObj) {
        if (!submittedAnswer.has(answerName)) submittedAnswer.set(answerName, []);
        var objects = submittedAnswer.get(answerName);
        var origSubObj = _(objects).findWhere({id: subObj.id});
        if (origSubObj) {
            _.extend(origSubObj, subObj);
        } else {
            objects.push(subObj);
        }
        submittedAnswer.set(answerName, []); // hack to trigger change events
        submittedAnswer.set(answerName, objects);
    };

    mechanicsObjects.removeSubmittedAnswerObject = function(submittedAnswer, answerName, subObj) {
        var objects = submittedAnswer.get(answerName);
        objects = _(objects).reject(function(obj) {return obj.id == subObj.id;});
        submittedAnswer.set(answerName, objects);
    };

    mechanicsObjects.byType = {};
    mechanicsObjects.restoreSubmittedAnswer = function(canvas, submittedAnswer, answerName) {
        if (!submittedAnswer.has(answerName)) return;
        var objects = submittedAnswer.get(answerName);
        var that = this;
        _(objects).each(function(obj) {
            that.idCounter = Math.max(that.idCounter, obj.id);
            var newObj = JSON.parse(JSON.stringify(obj));
            delete newObj.type;
            var fcn = that.byType[obj.type];
            if (!fcn) return;
            fcn.call(that, canvas, newObj, submittedAnswer, answerName);
        });
    };
    
    // ======================================================================================
    // ======================================================================================
    // ======================================================================================
    // Background drawing function
    
    mechanicsObjects.addCanvasBackground = function(canvas, gridsize) {
        canvas.backgroundColor =  '#FFFFF0';
        
        var options = {
            stroke: "#D3D3D3",
            strokeWidth: 1,
            selectable: false,
        };
        for (var i = 1; i < (canvas.width/gridsize); i++){
            canvas.add(new fabric.Line([gridsize*i, 0, gridsize*i, canvas.height], options));
        }
        for (var i = 1; i < (canvas.height/gridsize); i++){
            canvas.add(new fabric.Line([0, gridsize*i, canvas.width, gridsize*i], options));
        }
    }
	
    // ======================================================================================
    // ======================================================================================
    // ======================================================================================
    // Functions to add objects to the canvas, including maintaining submittedAnswer.
    // These functions do not create actual new object types, but just use existing obejcts.
    //
    // These can all be called in two forms:
    // 1. addDistUnifLoad(canvas, options) will simply draw the object directly on the canvas.
    // 2. addDistUnifLoad(canvas, options, submittedAnswer, answerName) will draw the object
    //    on the canvas and also add callbacks to update the object in submittedAnswer.
    
    // ======================================================================================
    // line
    //
    // options:
    //     x1: first x coordinate
    //     y1: first y coordinate
    //     x2: second x coordinate
    //     y2: second y coordinate
    //     options: drawing options

    mechanicsObjects.addLine = function(canvas, options, submittedAnswer, answerName) {
        var obj = this.makeLine(options);
        canvas.add(obj);
        if (!submittedAnswer) return obj;

        var subObj = _.clone(options);
        if (!subObj.id) subObj.id = this.newID();
        subObj.type = 'line';
        this.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);

        var that = this;
        obj.on('modified', function() {
            subObj.left = obj.left,
            subObj.top = obj.top,
            subObj.angle = obj.angle;
            that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        obj.on('removed', function() {
            that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });

        return obj;
    };

    mechanicsObjects.byType['line'] = mechanicsObjects.addLine;

	mechanicsObjects.makeLine = function(options) {
        var line = new fabric.Line([options.x1, options.y1, options.x2, options.y2], options);
		line.setControlVisible('bl', false);
		line.setControlVisible('tl', false);
		line.setControlVisible('br', false);
		line.setControlVisible('tr', false);
		line.setControlVisible('mt', false);
		line.setControlVisible('mb', false);
		line.setControlVisible('ml', false);
		line.setControlVisible('mr', false);
        return line;
	};

    // ======================================================================================
    // arrow
    //
    // options:
    //     left: left coordinate
    //     right: right coordinate
    //     ...: other drawing options

    mechanicsObjects.addArrow = function(canvas, options, submittedAnswer, answerName) {
        var obj = new this.Arrow(options);
        canvas.add(obj);
        if (!submittedAnswer) return obj;

        var subObj = _.clone(options);
        if (!subObj.id) subObj.id = this.newID();
        subObj.type = 'arrow';
        this.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);

        var that = this;
        obj.on('modified', function() {
            subObj.left = obj.left,
            subObj.top = obj.top,
            subObj.angle = obj.angle,
            that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        obj.on('removed', function() {
            that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });

        return obj;
    };

    mechanicsObjects.byType['arrow'] = mechanicsObjects.addArrow;

    // ======================================================================================
    // arc
    //
    // options:
    //     left: left coordinate
    //     right: right coordinate
    //     ...: other drawing options

    mechanicsObjects.addArc = function(canvas, options, submittedAnswer, answerName) {
        var obj = new this.Arc(options);
        canvas.add(obj);
        if (!submittedAnswer) return obj;

        var subObj = _.clone(options);
        if (!subObj.id) subObj.id = this.newID();
        subObj.type = 'arc';
        this.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);

        var that = this;
        obj.on('modified', function() {
            subObj.left = obj.left,
            subObj.top = obj.top,
            subObj.angle = obj.angle,
            that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        obj.on('removed', function() {
            that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });

        return obj;
    };

    mechanicsObjects.byType['arc'] = mechanicsObjects.addArc;

    // ======================================================================================
    // distUnifLoad
    //
    // options:
    //     left: left coordinate of the object
    //     top: top coordinate of the object
    //     angle: rotation angle (90 or -90)
    //     range: horizontal width of the load
    //     spacing: horizontal spacing of the arrows
    //     thickness: vertical thickness of the load
    
    mechanicsObjects.DistUnifLoad = fabric.util.createClass(fabric.Group, {
		type: 'DistUnifLoad',
	    getDefaultOptions: function() {
            return {
                name: "arrow",
                left: 0,  
                top: 0, 
                arrowWidth: 120,
                arrowAngle: 0,
                //stroke: 'green',
                strokeWidth: 2.5, 
                originX: 'left', 
                originY: 'top', 
                range: 100,
                spacing: 15,
                thickness: 60 
            };
        },
		initialize: function(options) {
			options = options || {};
            var optionsWithDefaults = Object.assign({}, this.getDefaultOptions(), options);
            
            var originalLeft = optionsWithDefaults.left,
                originalTop = optionsWithDefaults.top;

            // construct fabric.Group base
            this.callSuper("initialize", [], optionsWithDefaults);

            // Make arrows
            var arrowTop = this.top,
                arrowLeft = this.left,
                arrowSpacing = this.spacing;
            var nSpaces = this.range / this.spacing;
            for(var i = 0; i <= nSpaces; i++) {
                var eachArrow = new mechanicsObjects.Arrow({
                    left: arrowLeft + i * arrowSpacing,
                    top: arrowTop,
                    width: this.thickness,
                    angle: this.arrowAngle
                });
                //this.callSuper('addWithUpdate', eachArrow);
                this.addWithUpdate(eachArrow);
            }

            // Find difference between building position and final position
            this.diffLeft = this.left - originalLeft;
            this.diffTop = this.top - originalTop;

            // Hide controls
            this.setControlVisible('bl', false);
			this.setControlVisible('tl', false);
			this.setControlVisible('br', false);
			this.setControlVisible('tr', false);
			this.setControlVisible('mt', false);
			this.setControlVisible('mb', false);   
			this.setControlVisible('ml', false);
			this.setControlVisible('mr', false); 
			this.setControlVisible('mtr', false);
		},
		toObject: function(extra) {
            // Call parent toObject but discard information about the arrows
            var keys = Object.keys(this.getDefaultOptions());
			var wholeObject = this.callSuper('toObject', keys.concat(extra || []));
            delete wholeObject.objects;
            
            wholeObject.left = this.left - this.diffLeft;
            wholeObject.top = this.top - this.diffTop;

            return wholeObject;
		}
    });
    
    // ======================================================================================
    // distTrianLoad
    //
    // options:
    //     left: left coordinate of the object
    //     top: top coordinate of the object
    //     angle: rotation angle (90 or -90)
    //     range: horizontal width of the load
    //     spacing: horizontal spacing of the arrows
    //     minThickness: minimum vertical thickness of the load
    //     maxThickness: maximum vertical thickness of the load
    
    mechanicsObjects.DistTrianLoad = fabric.util.createClass(fabric.Group, {
		type: 'DistTrianLoad',
	    getDefaultOptions: function() {
            return {
                name: "arrow",
                left: 0,  
                top: 0, 
                arrowWidth: 120,
                arrowAngle: 0, 
                //stroke: 'green',
                strokeWidth: 2.5, 
                originX: 'center', 
                originY: 'center', 
                range: 100,
                spacing: 15,
                thickness: 60,
                flipped: false,
                minThickness: 5,
                maxThickness: 50
            };
        },
        initialize: function(options) {
			options = options || {};
            var optionsWithDefaults = Object.assign({}, this.getDefaultOptions(), options);
            
            var originalLeft = optionsWithDefaults.left,
                originalTop = optionsWithDefaults.top;
            
            // construct fabric.Group base
            this.callSuper("initialize", [], optionsWithDefaults);

            // Make arrows
            var arrowTop = this.top,
                arrowLeft = this.left,
                arrowSpacing = this.spacing;
            var nSpaces = this.range / this.spacing;
            for(var i = 0; i <= nSpaces; i++) {
                var eachArrow = new mechanicsObjects.Arrow({
                    left: arrowLeft + i * arrowSpacing,
                    top: arrowTop,
                    width: this.minThickness + (i / nSpaces) * (this.maxThickness - this.minThickness),
                    angle: this.arrowAngle
                });
                //this.callSuper('addWithUpdate', eachArrow);
                this.addWithUpdate(eachArrow);
                //this.add(eachArrow);
            }
            this.set('flipX', this.flipped);
            
            // Find difference between building position and final position
            this.diffLeft = this.left - originalLeft;
            this.diffTop = this.top - originalTop;

            // Hide controls
            this.setControlVisible('bl', false);
			this.setControlVisible('tl', false);
			this.setControlVisible('br', false);
			this.setControlVisible('tr', false);
			this.setControlVisible('mt', false);
			this.setControlVisible('mb', false);   
			this.setControlVisible('ml', false);
			this.setControlVisible('mr', false); 
			this.setControlVisible('mtr', false);
		
        },
		toObject: function(extra) {
            // Call parent toObject but discard information about the arrows
            var keys = Object.keys(this.getDefaultOptions());
			var wholeObject = this.callSuper('toObject', keys.concat(extra || []));
            delete wholeObject.objects;
            
            wholeObject.left = this.left - this.diffLeft;
            wholeObject.top = this.top - this.diffTop;
            
            return wholeObject;
		},
        /*
		_render: function(ctx) {
            
        }*/
    });

    
    // ======================================================================================
    // controlledLine
    //
    // options:
    //     x1: left coordinate of first end
    //     y1: top coordinate of first end
    //     x2: left coordinate of second end
    //     y2: top coordinate of second end
    //     handleRadius: radius of the control circles on each end
    //     strokeWidth: stroke width of the line
   
    /*
    mechanicsObjects.Line = fabric.util.createClass(fabric.Group, {
        type: "Line",
        getDefaultOptions: function() {
            return {
                strokeWidth: 4,
                stroke: 'red',
                handleRadius: 4,
                handleFill: 'white',
                handleStroke: '#666',
                selectable: true
            };
        },
        initialize: function(options) {
			options = options || {};
            
            var optionsWithDefaults = Object.assign({}, options, this.getDefaultOptions());
            var members = [];
            members.push(new fabric.Line([
                optionsWithDefaults.x1, 
                optionsWithDefaults.y1, 
                optionsWithDefaults.x2, 
                optionsWithDefaults.y2
              ], {
                stroke: optionsWithDefaults.stroke,
                strokeWidth: optionsWithDefaults.strokeWidth,
                selectable: false,
                name: "controlledLine",
                originX: 'center',
                originY: 'center'
            }));
            members.push(new fabric.Circle({
                left: optionsWithDefaults.x1,
                top: optionsWithDefaults.y1,
                strokeWidth: optionsWithDefaults.strokeWidth,
                radius: optionsWithDefaults.handleRadius,
                fill: optionsWithDefaults.handleFill,
                stroke: optionsWithDefaults.handleStroke,
                originX: 'center',
                originY: 'center',
                excludeFromExport: true,
                name: "controlHandle",
                hasControls: false,
                selectable: true
            }));
            members.push(new fabric.Circle({
                left: optionsWithDefaults.x2,
                top: optionsWithDefaults.y2,
                strokeWidth: optionsWithDefaults.strokeWidth,
                radius: optionsWithDefaults.handleRadius,
                fill: optionsWithDefaults.handleFill,
                stroke: optionsWithDefaults.handleStroke,
                originX: 'center',
                originY: 'center',
                excludeFromExport: true,
                name: "controlHandle",
                hasControls: false
            }));


            members[1].on('modified', (function() {
                members[0].set(this.x1 = members[1].left);
                members[0].set(this.y1 = members[1].top);
            }).bind(this));
        
            members[2].on('modified', (function() {
                members[0].set(this.x2 = members[2].left);
                members[0].set(this.y2 = members[2].top);
            }).bind(this));

            members[1].on('moving', (function() {
                members[0].set({ 
                    x1: this.x1 = members[1].left,
                    y1: this.y1 = members[1].top 
                });
            }).bind(this));
        
            members[2].on('moving', (function() {
                members[0].set({ 
                    x1: this.x1 = members[2].left,
                    y1: this.y1 = members[2].top 
                });
            }).bind(this));
        
            members[0].on('removed', this.remove)
            members[1].on('removed', this.remove)
            members[2].on('removed', this.remove)
            
            this.callSuper('initialize', members, optionsWithDefaults);
            

            // Hide controls
            this.setControlVisible('bl', false);
			this.setControlVisible('tl', false);
			this.setControlVisible('br', false);
			this.setControlVisible('tr', false);
			this.setControlVisible('mt', false);
			this.setControlVisible('mb', false);   
			this.setControlVisible('ml', false);
			this.setControlVisible('mr', false); 
			this.setControlVisible('mtr', false);
            this.hasControls = false;
		},
		toObject: function(extra) {
            var keys = Object.keys(this.getDefaultOptions());
			var wholeObject = this.callSuper('toObject', keys.concat(extra || []));
            return wholeObject;
        } 
    });
    */

    mechanicsObjects.addControlledLine = function(canvas, options, submittedAnswer, answerName) {
        var line = mechanicsObjects.makeControlStraightLine(options.x1, options.y1, options.x2, options.y2, options.strokeWidth);
        line.left = options.left;
        line.top = options.top;
        var c1 = mechanicsObjects.makeControlHandle(options.x1, options.y1, options.handleRadius, options.strokeWidth/2);
        c1.left = options.left;
        c1.top = options.top;
        var c2 = mechanicsObjects.makeControlHandle(options.x2, options.y2, options.handleRadius, options.strokeWidth/2);
        c2.left = options.left;
        c2.top = options.top;
        //canvas.add(line, c1, c2);
        //if (!submittedAnswer) return [line, c1, c2];

        var subObj = _.clone(options);
        if (!subObj.id) subObj.id = this.newID();
        subObj.type = 'controlledLine';
        //this.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);

        line.on('modified', function() {
            c1.left = line.x1;
            c1.top = line.y1;
            c2.left = line.x2;
            c2.top = line.y2;
        });

        //var that = this;
        c1.on('modified', function() {
            subObj.x1 = c1.left;
            subObj.y1 = c1.top;
            //that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c2.on('modified', function() {
            subObj.x2 = c2.left;
            subObj.y2 = c2.top;
            //that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c1.on('moving',function() {
            line.set({ 'x1': c1.left, 'y1': c1.top });
        });
        c2.on('moving',function() {
            line.set({ 'x2': c2.left, 'y2': c2.top });
        });
        c1.on('removed', function() {
            c2.remove();
            line.remove();
            //that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c2.on('removed', function() {
            c1.remove();
            line.remove();
            //that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });

        // TODO make group?

        return [line, c1, c2];
    };

    mechanicsObjects.byType['controlledLine'] = mechanicsObjects.addControlledLine;
	
    mechanicsObjects.makeControlHandle = function(left, top, handleRadius, strokeWidth, num) {
        var c = new fabric.Circle({
            left: left,
            top: top,
            strokeWidth: strokeWidth,
            radius: handleRadius,
            fill: 'white',
            stroke: '#666',
            originX: 'center',
            originY: 'center',
            excludeFromExport: true,
            name: "controlHandle",
        });
        c.hasControls = false;
        return c;
    };

    mechanicsObjects.makeControlStraightLine = function(x1, y1, x2, y2, strokeWidth) {
        var line =  new fabric.Line([x1, y1, x2, y2], {
            stroke: 'red',
            strokeWidth: strokeWidth,
            selectable: false,
            name: "controlledLine",
            originX: 'left',
            originY: 'top',
        });
        return line;
    };
	
    // ======================================================================================
    // controlledCurvedLine
    //
    // options:
    //     x1: left coordinate of first point
    //     y1: top coordinate of first point
    //     x2: left coordinate of second point
    //     y2: top coordinate of second point
    //     x3: left coordinate of third point
    //     y3: top coordinate of third point
    //     handleRadius: radius of the control circles on each end
    //     strokeWidth: stroke width of the line

    mechanicsObjects.addControlledCurvedLine = function(canvas, options, submittedAnswer, answerName) {
        var line = mechanicsObjects.makeControlCurvedLine(options.x1, options.y1, options.x2, options.y2, options.x3, options.y3, options.strokeWidth);
        var c1 = mechanicsObjects.makeControlHandle(options.x1, options.y1, options.handleRadius, options.strokeWidth/2);
        var c2 = mechanicsObjects.makeControlHandle(options.x2, options.y2, options.handleRadius, options.strokeWidth/2);
        var c3 = mechanicsObjects.makeControlHandle(options.x3, options.y3, options.handleRadius, options.strokeWidth/2);
        //canvas.add(line, c1, c2, c3);
        //if (!submittedAnswer) return [line, c1, c2, c3];

        var subObj = _.clone(options);
        if (!subObj.id) subObj.id = this.newID();
        subObj.type = 'controlledCurvedLine';
        //this.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);

        //var that = this;
        c1.on('modified', function() {
            subObj.x1 = c1.left;
            subObj.y1 = c1.top;
            //that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c2.on('modified', function() {
            subObj.x2 = c2.left;
            subObj.y2 = c2.top;
            //that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c3.on('modified', function() {
            subObj.x3 = c3.left;
            subObj.y3 = c3.top;
            //that.addOrReplaceSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c1.on('moving',function() {
            line.path[0][1] = c1.left;
            line.path[0][2] = c1.top;
        });
        c2.on('moving',function() {
            line.path[1][1] = c2.left;
            line.path[1][2] = c2.top;
        });
        c3.on('moving',function() {
            line.path[1][3] = c3.left;
            line.path[1][4] = c3.top;
        });
        c1.on('removed', function() {
            c2.remove();
            c3.remove();
            line.remove();
            //that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c2.on('removed', function() {
            c1.remove();
            c3.remove();
            line.remove();
            //that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });
        c3.on('removed', function() {
            c1.remove();
            c2.remove();
            line.remove();
            //that.removeSubmittedAnswerObject(submittedAnswer, answerName, subObj);
        });

        return [line, c1, c2, c3];
    };

    mechanicsObjects.byType['controlledCurvedLine'] = mechanicsObjects.addControlledCurvedLine;
	
	mechanicsObjects.makeControlCurvedLine = function(x1, y1, x2, y2, x3, y3, strokeWidth) {
        var options = {
            //fill: '',
            stroke: 'red',
            strokeWidth: strokeWidth,
            selectable: false,
			name: "controlCurvedLine",
            originX: 'center',
            originY: 'center',
        };
        var line = new fabric.Path('M 0 0 Q 1 1 3 0', options);
        line.path[0][1] = x1;
        line.path[0][2] = y1;
        line.path[1][1] = x2;
        line.path[1][2] = y2;
        line.path[1][3] = x3;
        line.path[1][4] = y3;
        return line;
	};

    return mechanicsObjects;
});
