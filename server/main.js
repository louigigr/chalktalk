var bodyParser = require("body-parser");
var express = require("express");
var formidable = require("formidable");
var fs = require("fs");
var http = require("http");
var path = require("path");


var ttDgram = require('dgram');
var ttServer = ttDgram.createSocket('udp4');
ttServer.on('listening', function () { });
ttServer.on('message', function (message, remote) { ttData.push(message); });
ttServer.bind(9090, '127.0.0.1');
ttData = [];


var app = express();
var port = process.argv[2] || 11235;

// serve static files from main directory
app.use(express.static("./"));

// handle uploaded files
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.route("/upload").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.uploadDir = "./sketches";
   form.keepExtensions = true;

   form.parse(req, function(err, fields, files) {
      res.writeHead(200, {"content-type": "text/plain"});
      res.write('received upload:\n\n');

      var filename = fields.sketchName;
      var suffix = ".js";
      if (filename.indexOf(suffix, filename.length - suffix.length) == -1)
         filename += suffix;

      fs.writeFile(form.uploadDir + "/" + filename, fields.sketchContent, function(err) {
         if (err) {
            console.log(err);
         } else {
            console.log("file written");
         }
      });

      res.end();
   });
});

app.route("/play").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      var exec = require('child_process').exec;
      exec('/Applications/VLC.app/Contents/MacOS/VLC --fullscreen --video-on-top --no-video-title-show ' + fields.cmd, function (error, stdout, stderr) {
      });
   });
});

var values = {};

app.route("/setValue").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      values[fields.key] = fields.value;
   });
});

app.route("/getValue").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      returnString(res, values[fields.key]);
   });
});

app.route("/getTT").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      if (ttData.length > 0) {
         returnString(res, ttData[0]);
         ttData = [];
      }
   });
});

app.route("/set").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      res.writeHead(200, {"content-type": "text/plain"});
      res.write('received upload:\n\n');

      var key = fields.key;

      var suffix = ".json";
      if (key.indexOf(suffix, key.length - suffix.length) == -1)
         key += suffix;

      fs.writeFile(key, fields.value, function(err) {
         if (err) {
            console.log(err);
         } else {
            console.log("file written");
         }
      });

      res.end();
   });
});

app.route("/writeFile").post(function(req, res, next) {
   var form = formidable.IncomingForm();
   form.parse(req, function(err, fields, files) {
      fs.writeFile(fields.fileName, JSON.parse(fields.contents),
         function(err) { if (err) console.log(err); }
      );
      res.end();
   });
});

app.route("/talk").get(function(req, res) {
   res.sendfile("index.html");
});

app.route("/listen").get(function(req, res) {
   res.sendfile("index.html");
});

var time = 0;

// handle request for the current time
app.route("/getTime").get(function(req, res) {
   time = (new Date()).getTime();
   returnString(res, '' + time);
});

// handle request for list of available sketches
app.route("/ls_sketches").get(function(req, res) {
   readDir(res, "sketches");
});

// handle request for list of available images
app.route("/ls_images").get(function(req, res) {
   readDir(res, "images");
});

// handle request for list of state files
app.route("/ls_state").get(function(req, res) {
   readDir(res, "state");
});

function returnString(res, str) {
   res.writeHead(200, { "Content-Type": "text/plain" });
   res.write(str + "\n");
   res.end();
};

function readDir(res, dirName) {
   fs.readdir("./" + dirName + "/", function(err, files) {
      if (err) {
         res.writeHead(500, { "Content-Type": "text/plain" });
         res.write(err);
         console.log("error listing the " + dirName + " directory" + err);
         res.end();
         return;
      }

      res.writeHead(200, { "Content-Type": "text/plain" });
      for (var i = 0; i < files.length; i++) {
         res.write(files[i] + "\n");
      }
      res.end();
   });
}

// handle request for appcache file -- needs a special Content-Type
app.route("/appcache").get(function(req, res) {
   recursive_ls("./", function(err, files) {
      if (err) {
         res.writeHead(500, { "ContentType": "text/plain" });
         res.write(err);
         res.end();
         console.log("error while building appcache manifest");
         return;
      }

      res.writeHead(200, { "ContentType": "text/cache-manifest" });
      res.write("CACHE MANIFEST\n");
      files.sort();
      files.forEach(function(file) {
         if ((file.endsWith("html") || file.endsWith("js") || file.endsWith("json"))
               && !file.contains("server") && !file.contains(".git") && !file.contains("swp")) {
            res.write(file + "\n");
         }
      });
      res.end();
   });
});

var recursive_ls = function(dir, callback) {
   var cwd = process.cwd() + "/";
   var results = [];
   fs.readdir(dir, function(err, list) {
      if (err) return callback(err);
      var pending = list.length;
      if (!pending) return callback(null, results);
      list.forEach(function(file) {
         file = path.resolve(dir, file);
         fs.stat(file, function(err, stat) {
            if (stat && stat.isDirectory()) {
               recursive_ls(file, function(err, res) {
                  results = results.concat(res);
                  if (!--pending) callback(null, results);
               });
            } else {
               results.push(file.replace(cwd, ""));
               if (!--pending) callback(null, results);
            }
         });
      });
   });
};

function isDef(v) { return ! (v === undefined); }

String.prototype.endsWith = function(suffix) {
   return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

String.prototype.contains = function(substr) {
   return this.indexOf(substr) > -1;
};

// PROTOBUF SETUP -- FOR SENDING HEAD TRACKING DATA
try {
   var ProtoBuf = require("protobufjs")
       protoBuilder = ProtoBuf.loadProtoFile("server/update_protocol.proto"),
       updateProtoBuilders = protoBuilder.build("com.mrl.update_protocol");
} catch (err) {
   console.log("Something went wrong during protobuf setup:\n" + err
         + "\nIf you have not done so, please run 'npm install' from the server directory");
}

// CREATE THE HTTP SERVER
var httpserver = http.Server(app);

// WEBSOCKET ENDPOINT SETUP
try {
   var WebSocketServer = require("ws").Server;
   var wss = new WebSocketServer({ port: 22346 });
   var websockets = [];

   wss.on("connection", function(ws) {

      for (ws.index = 0 ; websockets[ws.index] ; ws.index++)
	 ;
      websockets[ws.index] = ws;

      var startTimeMillis = (new Date()).getTime();

      var cameraUpdateInterval = null;
      function toggleHMDTracking() {
         if (cameraUpdateInterval == null) {
            // SAVE THIS WEBSOCKET IN THE MAP
            websockets[ws.index] = ws;

              cameraUpdateInterval = setInterval(function() {
                 var time = ((new Date()).getTime() - startTimeMillis) / 1000;
		 var t = time / 5;
		 var px = Math.cos((t)) / 10,
                     py = Math.sin(2 * (t)) / 10,
                     pz = Math.sin((t) / 2) / 10;
		 var qx = Math.cos((t)) / 2,
		     qy = Math.sin(2 * (t)) / 2,
                     qz = 0,//Math.sin((t) / 2) / 2,
		     qw = Math.sqrt(1 - qx * qx - qy * qy - qz * qz);
                 var trackedBody = new updateProtoBuilders.TrackedBody({
                    "id": 123,
                    "label": "ViveHMD",
                    "trackingValid": true,
                    "position": { "x": px, "y": py, "z": pz },
                    "rotation": { "x": qx, "y": qy, "z": qz, "w": qw }
                 });
  
                 var update = new updateProtoBuilders.Update({
                    "id": "abc",
                    "mod_version": 123,
                    "time": 123,
                    "mocap": {
                       "duringRecording": false,
                       "trackedModelsChanged": false,
                       "timecode": "abc",
                       "tracked_bodies": [
                          trackedBody
                       ]
                    }
                 });
                 ws.send(update.toBuffer());
              }, 1000 / 60);
         } else {
            // REMOVE THIS WEBSOCKET FROM THE MAP
            delete websockets[ws.index];

            clearInterval(cameraUpdateInterval);
            cameraUpdateInterval = null;
         }
      }

      ws.on("message", function(msg) {
         for (var index = 0 ; index < websockets.length ; index++)
            if (index != ws.index)
               websockets[index].send(msg);
      });

      ws.on("close", function() {
         // REMOVE THIS WEBSOCKET
         websockets.splice(ws.index, 1);

         clearInterval(cameraUpdateInterval);
         cameraUpdateInterval = null;
      });
   });
} catch (err) {
   console.log("\x1b[31mCouldn't load websocket library. Disabling event broadcasting."
         + " Please run 'npm install' from Chalktalk's server directory\x1b[0m");
}

/*
try {
   var dgram = require('dgram');

   var socket = dgram.createSocket({type: 'udp4', 'reuseAddr': true});
   var logged = false;
   socket.on("message", function (message, remote) {
      if (!logged) {
         console.log("Successfully received at least one UDP packet");
         logged = true;
      }

      for (var index = 0 ; index < websockets.length ; index++)
         websockets[index].send(message);
   });

   socket.on("listening", function() {
      socket.addMembership("224.1.1.1");
   });

   socket.bind(1611);
   console.log("UDP socket is bound.");
} catch (err) {
   console.log("Something went wrong during socket binding:\n" + err);
}
*/

// DIFFSYNC ENDPOINT SETUP
try {
   var io = require("socket.io")(httpserver);
   var diffsync = require("diffsync");
   var dataAdapter = new diffsync.InMemoryDataAdapter();
   var diffsyncServer = new diffsync.Server(dataAdapter, io);
} catch (err) {
   console.log("Something went wrong during diffsync setup:\n" + err
         + "\nIf you have not done so, please run 'npm install' from the server directory");
}

// START THE HTTP SERVER
httpserver.listen(parseInt(port, 10), function() {
   console.log("HTTP server listening on port %d", httpserver.address().port);
});


