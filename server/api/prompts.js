var accessAllowed = require("./apiPermissions").accessAllowed;
var fs = require("fs");

var taskPrediction = new Array(8);  //Group offtask (!ontask)
var showingOntask = new Array(8);
var markerOntask = new Array(8);


var taskPrediction2 = new Array(8); //Silent on task (ontasknoint)
var showingNoint = new Array(8);
var markerNoint = new Array(8);


var groupsStoreid = new Array(8);
var startTimer = false;
var timeElapsed = 1;
var groupStoreindex = 0;
var sessionId = 0;


//Reset prompts file 
var prompts = fs.readFileSync('./server/empty_list.json');
prompts = JSON.parse(prompts);
fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));

//Initialize all array values
for (var i = 0; i < taskPrediction.length; i++) {
    taskPrediction[i] = [];
    showingOntask[i] = 0;
    markerOntask[i] = 0;

    taskPrediction2[i] = [];
    showingNoint[i] = 0;
    markerNoint[i] = 0;
    
    groupsStoreid[i] = 9999999999;
}

//function that refreshes predictions every certain seconds
function refreshPredictions () {
    //should be 15 for 5 min gap
    if (startTimer && timeElapsed > 15){
        //Read predictions
        var predictions = fs.readFileSync('././prediction_server/ml_predictions.json');
        predictions = JSON.parse(predictions);

        //Compare the saved storeid of each group to see if there is a match. 
        //if there is a match and then compare the value to see if it matches the rule or not
        for (var j = 0; j < groupsStoreid.length; j++){
            for (var i = 0; i < predictions.length; i++) {
                if (predictions[i].source_log_file == groupsStoreid[j]){

                    //Prompt: Group off task    Rule to check: Not on task
                    if (predictions[i].pred_code_ontask < 0.85) {
                        taskPrediction[j].unshift(1);
                        if (taskPrediction[j].length > 3){
                            taskPrediction[j].pop();
                        }
                    }
                    else{
                        taskPrediction[j].unshift(0);
                        if (taskPrediction[j].length > 3){
                            taskPrediction[j].pop();
                        }
                    }

                    //Prompt: Silent on task    Rule to check: ontasknoint
                    if (predictions[i].pred_code_ontasknoint > 0.40) {
                        taskPrediction2[j].unshift(1);
                        if (taskPrediction2[j].length > 3){
                            taskPrediction2[j].pop();
                        }
                    }
                    else{
                        taskPrediction2[j].unshift(0);
                        if (taskPrediction2[j].length > 3){
                            taskPrediction2[j].pop();
                        }
                    }
                }
            }
        }

        //following for loop checks to see if a particular prompt should be made visible
        for (var i = 0; i < taskPrediction.length; i++) {
            if (taskPrediction[i].length == 3 && showingNoint[i] == 0){
                if (taskPrediction[i][0] == 1 && taskPrediction[i][1] == 1 && taskPrediction[i][2] == 1 && markerOntask[i] == 0){
                    if (showingOntask[i] == 0){
                        var date = new Date();
                        var timestamp = date.getTime();
                        var groupId = i+1;
                        var data_text = '{ "time": ' + timestamp + ', "prompt": Group Off Task,'+' "Group": '+ groupId + ', "action": shown, "user": server' + '}';
                        fs.appendFile('././ta_logs/session_'+sessionId+'.log', data_text, function (err) {
                          if (err) throw err;
                        });
                    }
                    showingOntask[i] = 1;
                    prompts = fs.readFileSync('./server/prompts_list.json');
                    prompts = JSON.parse(prompts);
                    for (var j = 0; j < prompts.length; j++) {
                      if (prompts[j].id == i && prompts[j].prompt != -1) {
                        prompts[j].prompt = 1;
                        prompts[j].prompt_id = 1;
                        prompts[j].prompt_title = "Group Off Task";
                        prompts[j].prompt_desc = "Off-task talk or off task actions (e.g., texting or off topic discussions)";
                        
                        break;
                      }
                    }
                    fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
                }
                else if (taskPrediction[i][0] == 0 && taskPrediction[i][1] == 0){
                    if (showingOntask[i] == 1){
                        var date = new Date();
                        var timestamp = date.getTime();
                        var groupId = i+1;
                        var data_text = '{ "time": ' + timestamp + ', "prompt": Group Off Task,'+' "Group": '+ groupId + ', "action": removed, "user": server' + '}';
                        fs.appendFile('././ta_logs/session_'+sessionId+'.log', data_text, function (err) {
                          if (err) throw err;
                        });
                    }
                    markerOntask[i] = 0;
                    showingOntask[i] = 0;
                    prompts = fs.readFileSync('./server/prompts_list.json');
                    prompts = JSON.parse(prompts);
                    for (var j = 0; j < prompts.length; j++) {
                      if (prompts[j].id == i) {
                        prompts[j].prompt = 0;
                        prompts[j].prompt_id = 0;
                          
                        break;
                      }
                    }
                    fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
                }
            }

            if (taskPrediction2[i].length == 3 && showingOntask[i] == 0){
                if (taskPrediction2[i][0] == 1 && taskPrediction2[i][1] == 1 && taskPrediction2[i][2] == 1 && markerNoint[i] == 0){
                    if (showingNoint[i] == 0){
                        var date = new Date();
                        var timestamp = date.getTime();
                        var groupId = i+1;
                        var data_text = '{ "time": ' + timestamp + ', "prompt": Silent On Task,'+' "Group": '+ groupId + ', "action": shown, "user": server' + '}';
                        fs.appendFile('././ta_logs/session_'+sessionId+'.log', data_text, function (err) {
                          if (err) throw err;
                        });
                    }
                    showingNoint[i] = 1;
                    prompts = fs.readFileSync('./server/prompts_list.json');
                    prompts = JSON.parse(prompts);
                    for (var j = 0; j < prompts.length; j++) {
                      if (prompts[j].id == i && prompts[j].prompt != -1) {
                        prompts[j].prompt = 1;
                        prompts[j].prompt_id = 2;
                        prompts[j].prompt_title = "Silent On Task";
                        prompts[j].prompt_desc = "The entire group is on task, but not discussing amongst themselves";
                          
                        
                        break;
                      }
                    }
                    fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
                }
                else if (taskPrediction2[i][0] == 0 && taskPrediction2[i][1] == 0){
                    if (showingNoint[i] == 1){
                        var date = new Date();
                        var timestamp = date.getTime();
                        var groupId = i+1;
                        var data_text = '{ "time": ' + timestamp + ', "prompt": Silent On Task,'+' "Group": '+ groupId + ', "action": removed, "user": server' + '}';
                        fs.appendFile('././ta_logs/session_'+sessionId+'.log', data_text, function (err) {
                          if (err) throw err;
                        });
                    }
                    markerNoint[i] = 0;
                    showingNoint[i] = 0;
                    prompts = fs.readFileSync('./server/prompts_list.json');
                    prompts = JSON.parse(prompts);
                    for (var j = 0; j < prompts.length; j++) {
                      if (prompts[j].id == i) {
                        prompts[j].prompt = 0;
                        prompts[j].prompt_id = 0;
                        break;
                      }
                    }
                    fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
                }
            }
        }
    }
    else {
        if (startTimer){
            timeElapsed++;
        }
    }


}
var preTimer = setInterval(refreshPredictions, 20000);


exports.createRoutes = function(app, db) {
    
    //Returns all the prompts from prompts_list file
    app.route("/api/v1/prompts/")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            
            var groupId = req.params.groupId;
            startTimer = true;
            prompts = fs.readFileSync('./server/prompts_list.json');
            prompts = JSON.parse(prompts);
            res.json({data: prompts});
        });
    
    //Saves storeid for each group in the groupsStoreid array to compare when fetching predictions
//    app.route("/api/v1/prompts/groups/:storeid")
//        .get(function(req, res) {
//            if(!accessAllowed(req, "prompts")) {
//                res.status(403).json({data:{status:403}});
//                return;
//            }
//            var isStored = false;
//            var storeid = req.params.storeid;
//            for (var i =0; i< groupsStoreid.length;i++){
//                if (groupsStoreid[i] == storeid){
//                    isStored = true;
//                }
//            }
//        
//            if (!isStored){
//                groupsStoreid[groupStoreindex] = storeid;
//                groupStoreindex++;
//            }
//            groups = JSON.stringify(groupsStoreid);
//            res.json({data: groups});
//        });
    
        app.route("/api/v1/prompts/groups/:storeid/:index")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var isStored = false;
            var storeid = req.params.storeid;
            var index = req.params.index;

            groupsStoreid[index] = storeid;
            groups = JSON.stringify(groupsStoreid);
            res.json({data: groups});
        });
    
    //helper api call to view the contents of the groupsStoreid array
    app.route("/api/v1/prompts/view")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            marker = JSON.stringify(groupsStoreid);
            res.json({data: marker});
        });
    
    //helper api call to view the contents of the taskPrediction2 array
    app.route("/api/v1/prompts/view2")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            marker = JSON.stringify(taskPrediction2);
            res.json({data: marker});
        });
    
    //helper api call to view the contents of the taskPrediction array
    app.route("/api/v1/prompts/view3")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            marker = JSON.stringify(taskPrediction);
            res.json({data: marker});
        });
    
    //helper api call to view the contents of the taskPrediction array
    app.route("/api/v1/prompts/view4")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            
            marker = JSON.stringify(markerNoint);
            marker += JSON.stringify(markerOntask);
            marker += JSON.stringify(showingNoint);
            marker += JSON.stringify(showingOntask);
            res.json({data: marker});
        });
    
        //helper api call to view the contents of the taskPrediction array
    app.route("/api/v1/prompts/log/:data")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            var log_data = req.params.data;
        
            fs.appendFile('././ta_logs/session_'+sessionId+'.log', log_data, function (err) {
              if (err) throw err;
            });
            log_data = JSON.stringify(log_data);
            res.json({data: log_data});
        });
    
    //When a TA clicks on a prompt, following api call is made to mark the prompt -1, so it doesn't appear on other tablets
    app.route("/api/v1/prompts/:groupId/remove")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            
            var groupId = req.params.groupId;
            prompts = fs.readFileSync('./server/prompts_list.json');
            prompts = JSON.parse(prompts);
            for (var i = 0; i < prompts.length; i++) {
              if (prompts[i].id == groupId) {
                prompts[i].prompt = -1;
                break;
              }
            }
            var selGroup = prompts.filter((group) => group.id == groupId);
            fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
            res.json({data: selGroup});
        });
    
    //When a TA presses confirm after a prompt is shown, the predictions values are reset
    app.route("/api/v1/prompts/:groupId/confirmontask")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            var groupId = req.params.groupId;
            
        
            
            prompts = fs.readFileSync('./server/prompts_list.json');
            prompts = JSON.parse(prompts);
            for (var i = 0; i < prompts.length; i++) {
              if (prompts[i].id == groupId) {
                prompts[i].prompt = 0;
                taskPrediction[groupId] = [0,0,0];
                showingOntask[i] = 0;
                taskPrediction2[groupId] = [0,0,0];
                showingNoint[i] = 0;
                break;
              }
            }
            clearInterval(preTimer);
            preTimer = setInterval(refreshPredictions, 10000);
            fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
            marker = JSON.stringify(taskPrediction);
            res.json({data: marker});
        });
    
    //When a TA presses deny after a prompt is shown, a marker is set on a particular task so it only appears again after it goes away from the predictions and comes back again
    app.route("/api/v1/prompts/:groupId/denyontask")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
            
            var groupId = req.params.groupId;
            prompts = fs.readFileSync('./server/prompts_list.json');
            prompts = JSON.parse(prompts);
            for (var i = 0; i < prompts.length; i++) {
              if (prompts[i].id == groupId) {
                prompts[i].prompt = 0;
                if (prompts[i].prompt_id == 1){
                    markerOntask[groupId] = 1;
                    showingOntask[groupId] = 0;
                }
                else if (prompts[i].prompt_id == 2){
                    markerNoint[groupId] = 1;
                    showingNoint[groupId] = 0;
                }
                break;
              }
            }
            fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
            marker = JSON.stringify(markerOntask);
            res.json({data: marker});
        });

    
    
    //API call to reset values when a new session is created
    app.route("/api/v1/prompts/newsession/:sessionId")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            sessionId = req.params.sessionId;
            startTimer = false;
            timeElapsed = 1;
            groupStoreindex = 0;
            //Reset prompts file 
            var prompts = fs.readFileSync('./server/empty_list.json');
            prompts = JSON.parse(prompts);
            fs.writeFileSync('./server/prompts_list.json',JSON.stringify(prompts));
            
            //Initialize all array values
            for (var i = 0; i < taskPrediction.length; i++) {
                taskPrediction[i] = [];
                showingOntask[i] = 0;
                markerOntask[i] = 0;

                taskPrediction2[i] = [];
                showingNoint[i] = 0;
                markerNoint[i] = 0;

                groupsStoreid[i] = 9999999999;
                
            }

            res.json({data: prompts});
    });
    
    app.route("/api/v1/prompts/session/:sessionId")
        .get(function(req, res) {
            if(!accessAllowed(req, "prompts")) {
                res.status(403).json({data:{status:403}});
                return;
            }
        
            sessionId = parseInt(req.params.sessionId, 10);
            sessionId = JSON.stringify(sessionId);
            res.json({data: sessionId});
    });
};