#!/usr/bin/env node

var        _ = require('underscore');
var  express = require('express');
var     http = require('http');
var   bunyan = require('bunyan');
var     path = require('path');
var    redis = require('redis');
var      tmp = require('tmp');
var  Promise = require('bluebird');
var      app = express();
var      net = require("net");
var    sugar = require("sugar");
var     repl = require("repl");

Promise.longStackTraces();

var  request = Promise.promisify(require("request"));
var      log = bunyan.createLogger({ name: "tucktuck"
                                   , streams: [{ path: '/var/log/tucktuck.log'
                                               }]});
app.set('port', process.env.PORT || 80);
server = http.createServer(app);

var   io = require('socket.io').listen(server);
var   fs = require('fs');
var snmp = require('snmp-native');


// Make sure we're in the right dir (yea, yuck)
process.chdir("/home/clord/tucktuck");


// Just a very explicit `not` function. I hate javascript sometimes.
var flip = function flip(value) {
   if (value === 0) return 1;
   return 0;
}


// Set up redis database connection
var client = redis.createClient("/var/redis/sock");


// For using promises api
var clientp = Promise.promisifyAll(client);
var fsp = Promise.promisifyAll(fs);
var cp = Promise.promisifyAll(require("child_process"));

client.on("error", function (err) {
   log.error(err);
});


// all environments
app.use(log);
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));


// development only
app.configure('development', function(){
  log.info("development config for express");
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

// production only
app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// socket io production environment
io.configure('production', function(){
        io.enable('browser client minification');  // send minified client
        io.enable('browser client etag');          // apply etag caching logic based on version number
        io.set('log level', 1);                    // reduce logging
        io.set('transports', [ 'websocket'
                             , 'flashsocket'
                             , 'htmlfile'
                             , 'xhr-polling'
                             , 'jsonp-polling'
                             ]);
      });


// Just make a tab-seprated line. 
function csvLine() {
   return Array.prototype.slice.apply(arguments).join("\t") + "\n";
}

// Occasionally need to convert from snmp raw array OIDs to string-based, as we use string-based keys in the
// hashes below.
function arrOidToStr(arr) {
   return _.reduce(arr, function(acc, v) { return acc + "." + v; }, "");
}


// My little board uses SNMPv1
var session = new snmp.Session({ host: process.env.CONTROL_BOARD_HOST, port: 161, community: process.env.CONTROL_BOARD_COMMUNITY || "public" });


// Fetch switch state from the board, and update the database. Recursive in this style to avoid overloading
// the board, which drops packets if we go to fast. TODO: Investigate using promises to rate-limit
exports.updateAllSwitchState = function updateAllSwitchState(list, value, next) {
   if (list.length === 0) {
      next();
      return;
   }
   session.set({oid: _.head(list), value: value, type: 2}, function(error, vb) {
      if (error) { log.error(error); }
      else {
         var soid = arrOidToStr(vb[0].oid);
         client.hset(soid, "last_toggle", ((new Date()).valueOf() / 1000.0).toFixed(0));
         client.hset(soid, "value", vb[0].value);
         updateAllSwitchState(_.rest(list), value, next);
      }
   });
}


// update switch state in app and on any connected clients from actual board
exports.retrieveSwitchState = function retrieveSwitchState(list, next) {
   if (list.length === 0) {
      next();
      return;
   }
   session.get({oid: _.head(list)}, function(error, vb) {
      if (error) { log.error(error); }
      else {
         client.hset(arrOidToStr(vb[0].oid), "value", vb[0].value);
         retrieveSwitchState(_.rest(list), next);
      }
   });
}


// update switch state in app and on any connected clients from actual board
exports.retrieveAllSensorState = function retrieveAllSensorState(list, next) {
   if (list.length === 0) {
      next();
      return;
   }
   session.get({oid: _.head(list)}, function(error, vb) {
      if (error) { log.error(error); }
      else {
         var soid = arrOidToStr(vb[0].oid);
         // Algebra comes from the manual on the board. Just basic linear transformation of the raw voltage.
         var decoded = (1.2 * (vb[0].value / 1024.0) * 8.0/4.7 * 100.0);
         client.hget(soid, "value", function(err, oldval) {
            if (err) {log.error(err);}
            var result = decoded;
            if (oldval) {
               // a smoothing factor, meaning 'only use x% of sensor reading, take reset from history'
               // this slows down the rate of change but gets rid of the spikey data coming from the sensor.
               var smooth = 0.03;
               result = smooth * decoded + (1.0 - smooth) * parseFloat(oldval);
            }
            client.hset(soid, "value", result, function() {
               retrieveAllSensorState(_.rest(list), next);
            });

         });
      }
   });
}



// Tell everyone of a light's current state. 
var broadcastSwitch = function(oid) {
   client.hgetall(oid, function(err, reply){
      if (err) {log.error(err);}
      io.sockets.emit("light", reply);
   });
}

// Tell everyone of a certain sensor's value
var broadcastSensor = function(oid) {
   client.hgetall(oid, function(err, reply){
      if (err) {log.error(err);}
      io.sockets.emit("temp", reply);
   });
}


// Tell everyone about all the switches
var broadcastSwitches = function(e) {
   client.lrange("switches", 0, -1, function(err, switches) {
      client.multi(switches.map(function(s) {return ["hgetall",  s]; })).exec(function(err, replies) {
         if (err) {log.error(err);}
         if (e === undefined)
            io.sockets.emit("all-lights", replies);
         else
            e.emit("all-lights", replies);
      });
   });
}


// Tell everyone about all the sensor values
var broadcastSensors = function(e) {
   client.lrange("sensors", 0, -1, function(err, sensors) {
      client.multi(sensors.map(function(s) {return ["hgetall",  s]; })).exec(function(err, replies) {
         if (err) {log.error(err);}
         if (e === undefined)
            io.sockets.emit("all-temps", replies);
         else
            e.emit("all-temps", replies);
      });
   });
}

var rtrue = function() {return true;};

// This timer type just does a very basic thing: Turns a switch on and off based on a schedule.
function Timer(trigger_time, id, switcher) {
   this.triggerSwitch = switcher;
   this.flip_at = trigger_time; // seconds after 7am local time
   this.id = id;
}

Timer.prototype.normalize = function(at) {
   // relativize to mdt timezone (chickens don't care about daylight savings).
   var tweaked = new Date(at).addHours(-6); 
   var start   = tweaked.clone().beginningOfDay();
   var seconds = (tweaked - start) / 1000.0;
   return seconds;
}

// Get the current daily time in seconds.
Timer.prototype.current = function() {
   var seconds = this.normalize(Date.create());
   return seconds;
}; 

// Allow outside to change the flip time (useful for adjusting for e.g., sunrise/sunset)
Timer.prototype.setFlipTime = function(value) {
   this.flip_at = value;
};

// Indicate that the timer has been triggered today (suppresses further clicks)
Timer.prototype.setSeenToday = function(time) { 
   return clientp.setAsync("seen-event-today-" + this.id, time);
}; 

// Check when/whether we've seen this timer fire today
Timer.prototype.lastSeenToday = function() {
   return clientp.getAsync("seen-event-today-" + this.id)
                 .then(function(val) { 
                    if (val === null) return 0.0; 
                    return parseFloat(val); 
                 }, function(e) { log.error(e); return 0.0; });
}; 

// Wow, we've gotten through a whole day without crashing or starting a fire. reset for next day :)
Timer.prototype.itIsANewDay = function() {
   log.info(this, "it's a new day");
   return clientp.delAsync("seen-event-today-" + this.id);
};

// Core of the timer, which checks whether to call the trigger
Timer.prototype.isEventTriggered = function() {
   var that = this;
   return that.lastSeenToday().then(function(last) {
      var cur = that.current();
      if (last > cur) {
         that.itIsANewDay();
      }
      else if (cur > that.flip_at && last < that.flip_at) {
         return that.setSeenToday(that.flip_at).then(rtrue);
      }  
      return false;
   });
}; 

// Click the timer, and fire any switches that should be triggered.
Timer.prototype.tick = function() {
   var that = this;
   this.isEventTriggered().then(function(b) { if (b) return that.triggerSwitch(that); }).catch(function(e) {
      log.error(e);
   });
}; 

// Lights on. This is specific to our control board. 
var lightsOn = function(timer) {
   log.info(timer, "lights on");
   exports.updateAllSwitchState([".1.3.6.1.4.1.19865.1.2.2.1.0"], 1, function() {broadcastSwitches();});
};

var lightsOff = function(timer) {
   log.info(timer, "lights off");
   exports.updateAllSwitchState([".1.3.6.1.4.1.19865.1.2.2.1.0"], 0, function() {broadcastSwitches();});
};


// Put the timers in order from early to late (so that if we restart the system, they come back in teh right
// state) and also note that times are relative to midnight MDT, which is the start of a standard chicken-day.
var timers = [new Timer( 6*3600, "virtual_dawn",  lightsOn),
              new Timer( 7*3600, "after_sunrise", lightsOff),
              new Timer(20*3600, "before_sunset", lightsOn),
              new Timer(22*3600, "virtual_dusk",  lightsOff)];


// Every second, consider whether this second should trigger a 'go-to-state' action. If so,
// trigger the desired state and notify connected clients. 
var timerLoop = function() {
   setTimeout(timerLoop, 2000); // every n*1000 seconds...
   loadDbWeather(function(weather) {
      var suppress = false;
      if (weather && weather.sunrise && weather.sunset) {
         suppress = (weather.sunset - weather.sunrise) > 51000; // only do this for days that are shorter than ~14 hours

         if (!suppress) {
            // Tweak the two middle timers for sunrise/sunset to save some power on longer days
            // 2800 is about 3/4 of an hour, which gives those chucks time to mozy. 
            timers[1].setFlipTime(timers[1].normalize(1000 * (weather.sunrise + 2800)));
            timers[2].setFlipTime(timers[2].normalize(1000 * (weather.sunset - 2000)));
         }
      }
      // if we care, tick all the timers.
      if (!suppress) timers.each(function(timer){timer.tick();});
   });
};




function LogWriter() {}
LogWriter.prototype.allLogs = function () {
   return clientp.zrangeAsync('log', 0, -1).map(JSON.parse);
};
LogWriter.prototype.writeEggLog = function() {
   return LogWriter.prototype.allLogs()
        .filter(function(i) { return i.ptype === "eggs"; })
        .reduce(function(r, e) {
           return r + csvLine(e.timestamp, e.eggs);
        }, "")
        .then(function(e) {
           return fsp.writeFileAsync("./templog/egg.log", e);
        })
        .then(function(e) {
           return generateGraph('eggs-over-time');
        });
};

// Just loops calling the body routine
LogWriter.prototype.periodicEggLog = function () {
   setTimeout(LogWriter.prototype.periodicEggLog, 3600 * 6 * 1000);
   return LogWriter.prototype.writeEggLog().catch(function(e) {log.error(e, "Egg log error");});
};



var broadcastGraphs = function(e) {
   var ss = (e === undefined) ? io.sockets : e;
   return clientp.hgetallAsync("graphs").then(function(gs) {
      ss.emit("graphs", Object.values(Object.map(gs, function(k,v) { var res = JSON.parse(v); res.name = k; return res; }))
                              .sortBy(function(n) {return n.sort;}));
   });
};

// run our little script that updates the svg files
// and then signal the web-app to reload the svg files
var generateGraph = function(name) {
   return cp.execFileAsync("./generate_graphs.sh", [name], {})
      .then(function() {
         return clientp.hgetAsync("graphs", name)
               .then(JSON.parse)
               .then(function(gs) {
                        if (!gs) {
                           gs = {sort:0, timestamp:0};
                        }
                        gs.timestamp = new Date().valueOf();
                        return clientp.hsetAsync("graphs", name, JSON.stringify(gs));
                     })
               .then(function() {return broadcastGraphs(); })
      }, function(a, b) {
         log.error("Failed to run generate_graphs.sh: " + b);         
      });
};

var fetchLocalWeather = function() {
   return clientp.getAsync("weather")
                         .then(JSON.parse, function() { return {dt: 0, working: false, message: "Failed to fetch from DB"} })
                         .catch(function(e) {
                            log.error("failed to fetch local weather", e);
                            return {dt: 0, working:false, message: e};
                         });
}


var fetchOpenWeather = function(){
   return request("http://api.openweathermap.org/data/2.5/weather?lat=54.267881&lon=-110.563016&units=metric")
                         .then(function(a) { return a[1]; }, function() { log.error("Failed to fetch weather"); return {dt: 0}; })
                         .then(JSON.parse)
                         .catch(function(e) {
                            log.error("failed to fetch internet weather", e);
                            return {dt: 0};
                         });
}


var weatherPromise = function() {
   return Promise.all([fetchLocalWeather(), fetchOpenWeather()])
           .then(function(a) {
               var cached = a[0];
               var web = a[1];
               var weather = cached;
               // If weather from internet is newer than our cached weather, update our
               // cached weather first
               if (parseFloat(web.dt) > parseFloat(cached.dt)) {
                  weather = { sunrise: web.sys.sunrise
                            ,  sunset: web.sys.sunset
                            ,   humid: web.main.humidity
                            ,   press: web.main.pressure
                            ,    desc: web.weather[0].description
                            ,    icon: web.weather[0].icon
                            ,      dt: web.dt
                            ,    temp: web.main.temp
                            ,    wind: web.wind
                            , working: true
                            };
                  client.set("weather", JSON.stringify(weather));
               }
               io.sockets.emit("weather", weather);
               return weather;
          });
}

// get weather from internet and store in database, write to log, and send to connected clients
var weatherLoop = function() {
   setTimeout(weatherLoop, 1000*2000); // every so often
   weatherPromise()
      .then(function(weather) {
                  fs.appendFile("./templog/weather.log", csvLine( weather.dt
                                                                , weather.temp
                                                                , weather.sunset - weather.sunrise
                                                                , weather.icon
                                                                , weather.wind.speed
                                                                , weather.wind.deg));
            })
      .then(function() {
         return generateGraph('temp-over-time').then(function() {
         return generateGraph('temps-last-two-days');
         });
      })
      .catch(function(e) {
         io.sockets.emit("weather", {dt: 0, working:false, message: e});
         log.error(e);
         return {dt: 0, working:false, message: e};
      });
}

// Load the weather from DB and emit to all clients
var broadcastWeather = function(e) {
   loadDbWeather(function(weather) {
      if (e === undefined)
         io.sockets.emit("weather", weather);
      else
      e.emit("weather", weather);
   });
}

var broadcastLog = function (ee) {
   client.zrevrange(["log", 0, -1], function(err, r) {
      if (err) log.error(err);
      else {
         var res = r.map(function (e) {
            var res = JSON.parse(e);
            res.date = Date.create(res.timestamp * 1000).format("{Weekday} {Month} {day}, {yyyy}");
            return res;
         });
         if (ee === undefined)
            io.sockets.emit("log", res);
         else
            ee.emit("log", res);
      }
   });
}

exports.broadcastSwitches = broadcastSwitches;
exports.broadcastSensors = broadcastSensors;
exports.broadcastWeather = broadcastWeather;
exports.broadcastLog = broadcastLog;

var defaultWeather = {dt: 0, working:false, status: "Not initialized yet"};
var loadDbWeather = function(cb) {
   client.get("weather", function(err, weatherS) {
      if (err) {
         log.error(err);
         return;
      }
      var weather;
      try {
         weather = JSON.parse(weatherS);
      }
      catch (e) {
         weather = defaultWeather;
         weather.error = e;
      }
      cb(weather);
   });
}



var switchLoop = function() {
   // Schedule another update
   setTimeout(switchLoop, 12901);
   client.lrange("switches", 0, -1, function(err, reply) {
   if (err) {log.error(err);return;}
      exports.retrieveSwitchState(reply, broadcastSwitches); 
   });
}

var sensorLoop = function() {
   setTimeout(sensorLoop, 13907);
   client.lrange("sensors", 0, -1, function(err, tkeys) {
      if (err) {log.error(err);return;}
      exports.retrieveAllSensorState(tkeys, function() {
         // Update connected clients
         broadcastSensors();

         // Update the log
         _.each(tkeys, function(k) {
            // We need a canonicalized version that is granular in the precision of the log
            client.hgetall(k, function(err, m) {
               var valtowrite = parseFloat(m.value).toFixed(2);
               client.get("last-temp:" + k, function(err, reply) {
                   if (!reply || reply !== valtowrite)
                      fs.appendFile( "./templog/coop-" + m.name + ".log"
                                   , csvLine(((new Date()).valueOf() / 1000.0).toFixed(0), valtowrite),
                         function(err) {
                            if (err) log.error(err);
                            else     client.set("last-temp:" + k, valtowrite);
                         });                   
               });
            });
         });
      });
   });

}


var lw = new LogWriter();

// On connection, update the new client, and register a handler for toggling switches (by index)
io.sockets.on('connection', function(socket) { 
   socket.on("get-log", function() {broadcastLog(socket); broadcastGraphs().done();});
   socket.on("get-weather", function() {broadcastWeather(socket)});
   socket.on("get-sensors", function() {broadcastSensors(socket)});
   socket.on("get-switches", function() {broadcastSwitches(socket)});
   socket.on("logit", function(l) {
      client.zremrangebyscore("log", l.timestamp, l.timestamp, function (e, r) {
         if (e) log.error(e);
         client.zadd("log", l.timestamp, JSON.stringify(l), function(e, r) {
            if (e) log.error(e);
            else {
               broadcastLog();
               if (l.ptype === "eggs")
                  lw.writeEggLog().catch(function(e) {log.error(e, "On logit message");});
            }
         });
      });
   });
   socket.on("toggle", function(data) {
      if (data && data.index !== null) {
         var soid = data.index;
         session.get({oid: soid}, function(error, varbinds) {
            if (error) {
               log.error(error);
            } else {
               var oldstate = varbinds[0].value;
               var newstate = flip(oldstate);
               session.set({oid: soid, value: newstate, type: 2}, function(err, nvb) {
                  client.hset(soid, "last_toggle", ((new Date()).valueOf() / 1000.0).toFixed(0), function(err) {
                     client.hset(soid, "value", newstate, function(err) {
                        //TODO: broadcastSwitch(soid);
                        broadcastSwitches();
                     });
                  });
               });
            }
         });
      }
   });
});


var start = function startApp() {
   try {

      // Start updating temps and switches
      sensorLoop();
      switchLoop();
      weatherLoop();
      timerLoop();
      lw.periodicEggLog();
      
      // serve up static files (TODO: serve with nginx?)
      server.listen(app.get('port'), function(){
      log.info('Express server listening on port ' + app.get('port'));
      });
      
      
      // publish a repl, connect with `nc -U sock`
      var replpath = "/var/run/tucktuck.sock";
      if (fs.existsSync(replpath))
         fs.unlinkSync(replpath);
      net.createServer(function (socket) {
         var lrepl = repl.start({
         prompt: "tucktuck> ",
         terminal: true,
         input: socket,
         output: socket,
         useGlobal: true
         });
         lrepl.context.m = exports;
         lrepl.on('exit', function() {
         log.info("repl connect");
         socket.end();
         });
      }).listen(replpath);

   }
   catch (err) {
      log.error(err);
   }
} 

start();

process.on("uncaughtException", function(err) {
    log.error(err);
});


// clean up any temp files if the proc dies
tmp.setGracefulCleanup();
