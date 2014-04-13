/** @jsx React.DOM */


var Lights = React.createClass({
   getInitialState: function() {
      return {lights: []};
   },
   componentWillUnmount: function(){
      this.props.socket.on("all-lights", function(){});
      this.props.socket.on("light", function(a){});
   },
   componentDidMount: function(){
      this.props.socket.on("all-lights", this.setAllLightState);
      this.props.socket.on("light", this.setLightState);
      this.props.socket.emit("get-switches");
   },
   setLightState: function(data) {
      var ls = this.state.lights;
      if (this.isMounted()) {
         for (var l = 0; i < ls.length; i++) {
            if (ls[l].id == data.id) {
               ls[l] = data;
               break;
            }
         }
         this.setState({lights: ls});
      }
   },
   setAllLightState: function(data) {
      if (this.isMounted())
         this.setState({lights: data});
   },
   render: function() {
      var that = this;
      var mapState = function(state) {
        return (state === '1' ? "teal" : (state === '0' ? "black" : "red"));
      }
      var handleClick = function(index) {
         return function(e) {
            that.props.socket.emit("toggle", {"index": index});
         }
      }
      var lightNodes = this.state.lights.map(function(l) {
         var cstr = "ui small labeled icon button " + mapState(l.value);
         var iconCls = l.value === '1' ? 'checked checkbox icon' : 'empty checkbox icon';
         var lchange = moment(parseInt(l.last_toggle) * 1000.0).calendar();
         return (<div key={l.id} className="column">
                    <div>
                     <h4 className="ui header">{l.name}</h4>
                     <a onClick={handleClick(l.id)} className={cstr}><i className={iconCls} />{l.value == '1' ? "Turn Off" : "Turn On"}</a>
                     <div className="last-toggle">
                     <small>Last toggled {lchange}</small>
                     </div>
                    </div>
                 </div>);
      });
      return (<div className="ui four column center aligned stackable divided grid">{lightNodes}</div>);
   }
}); 


var Sensors = React.createClass({
   getInitialState: function() {
      return {sensors: []};
   },
   componentWillUnmount: function(){
      this.props.socket.on("all-temps", function(){});
      this.props.socket.on("temp", function(a){});
   },
   componentDidMount: function(){
      this.props.socket.on("all-temps", this.setAllSensorState);
      this.props.socket.on("temp", this.setSensorState);
      this.props.socket.emit("get-sensors");
   },
   setSensorState: function(data) {
      var ls = this.state.sensors;
      if (this.isMounted()) {
         for (var l = 0; i < ls.length; i++) {
            if (ls[l].id == data.id) {
               ls[l] = data;
               break;
            }
         }
         this.setState({sensors: ls});
      }
   },
   setAllSensorState: function(data) {
      if (this.isMounted())
         this.setState({sensors:data});
   },
   render: function() {
      var sensorNodes = this.state.sensors.map(function(s){
         return (<div className="ui vertical segment" key={s.name}>{s.name} at <strong><span className={"numbers"}>{parseFloat(s.value).toFixed(2)}</span><span>˚C</span></strong></div>);
      });
      return (<div className="column">
                <h3 className="ui header">Sensors</h3>
                <div>{sensorNodes}</div>
              </div>);
   }
});


var Weather = React.createClass({
   getInitialState: function() {
      return {weather: {working: false, status: "not connected"}};
   },
   componentWillUnmount: function(){
      this.props.socket.on("weather", function(){});
   },
   componentDidMount: function(){
      this.props.socket.on("weather", this.setWeatherState);
      this.props.socket.emit("get-weather");
   },
   setWeatherState: function(data) {
      if (this.isMounted())
         this.setState({weather:data});
   },
   render: function() {
      if (this.state.weather.working)
         return (<div className="column">
                    <h3 className="ui header">Weather</h3>
                    {this.state.weather.desc}; <strong><span className={"numbers"}>{this.state.weather.temp.toFixed(1)}</span><span>˚C</span></strong>
                    <p>Wind <strong><span className={"numbers"}>{this.state.weather.wind.speed.toFixed(1)}</span><span>m/s</span></strong> from <strong>{this.state.weather.wind.deg.toFixed(0)}˚</strong></p>
                 </div>);
      else
         return (<div className="column">
                     <h3 className="ui header">Weather</h3>
                     <h5 className="ui header">error: {this.state.weather.status}</h5>
                 </div>);
   }
});

var FlockEntry = React.createClass({
   render: function () {
      return <div>flock</div>;
   }
});

var FeedEntry = React.createClass({
   render: function () {
      return <div>feed</div>;
   }
});

var EventsEntry = React.createClass({
   getInitialState: function () {
      return {date: Date.create().format("{Month} {d}, {yyyy}"), text: ""};
   },
   handleDateChange: function(e){
      if (this.isMounted())
         this.setState({date: e.target.value});      
   },
   handleTextChange: function (e) {
      if (this.isMounted())
         this.setState({text: e.target.value})
   },
   handlePostText: function (e) {
      e.preventDefault();
      var procDate = Date.past(this.state.date);
      var logEntry = { timestamp: procDate.valueOf() / 1000.0 + 2 // +2 so it sorts separately
                     , ptype: this.props.ptype
                     , text: this.state.text
                     , entrystamp: (new Date()).valueOf() / 1000.0
                     };
      this.props.onLog(logEntry);
      this.setState({date: procDate.addDays(1).format("{Month} {d}, {yyyy}"), text: ''});
      this.refs.date.getDOMNode().focus(); // focus back
      return false;
   },
   render: function () {
      var procDate = Date.past(this.state.date);
      var disabled = !procDate.isValid() || this.state.text.length === 0;
      var clsStr = "ui blue submit button" + (disabled ? " disabled" : "");
      return (<form onSubmit={this.handlePostText} className="ui form segment">
                 <div className="field">
                    <label>Date <small>{procDate.format('{dow} {mon} {ord}, {yyyy}')}</small></label>
                    <input type="date" required ref="date" value={this.state.date} onChange={this.handleDateChange}  />
                  </div>
                  <div className="field">
                     <label>Event <small>required</small></label>
                     <textarea placeholder="Describe the event" ref="texte" value={this.state.text}  onChange={this.handleTextChange} />
                  </div>
                   <input type="submit" className={clsStr} disabled={disabled} value="Log" />
               </form>
             );
   }
});

var EggEntry = React.createClass({
   getInitialState: function () {
      return {date: Date.create().format("{Month} {d}, {yyyy}"), eggs: 0};
   },
   handleEggChange: function(e){
      var num = parseInt(e.target.value);
      if (num) this.setState({eggs: Math.abs(num)});
      else     this.setState({eggs: 0});
   },
   handleDateChange: function(e){
      if (this.isMounted())
         this.setState({date: e.target.value});      
   },
   
   handlePostLog: function (e) {
      e.preventDefault();
      var procDate = Date.past(this.state.date);
      var logEntry = { timestamp: procDate.valueOf() / 1000.0 + 1 // + 1 so it sorts separately
                     , ptype: this.props.ptype
                     , eggs: this.state.eggs
                     , entrystamp: (new Date()).valueOf() / 1000.0
                     };
      this.props.onLog(logEntry);
      this.setState({date: procDate.addDays(1).format("{Month} {d}, {yyyy}"), eggs: 0});
      this.refs.date.getDOMNode().focus();
      return false;
   },
   render: function() {
      var procDate = Date.past(this.state.date);
      var disabled = !procDate.isValid() || this.state.eggs <= 0;
      var clsStr = "ui blue submit button" + (disabled ? " disabled" : "");
      return (<form onSubmit={this.handlePostLog} className="ui form segment">
                   <div className="field">
                     <label>Date — {procDate.format('{dow} {mon} {ord}, {yyyy}')}</label>
                     <input type="date" required ref="date" value={this.state.date} onChange={this.handleDateChange} />
                   </div>
                   <div className="field">
                     <label>Eggs</label>
                     <input type="number" required ref="eggs" value={this.state.eggs} onChange={this.handleEggChange} />
                   </div>
                   <input type="submit" className={clsStr} disabled={disabled} value="Log" />
             </form>);
      
   }
   
});

var LogEntry = React.createClass({

   componentDidMount: function() {
      $(this.refs.accord.getDOMNode()).accordion();
   },
   render: function() {
      return (<div className="column">
                     <div className="ui fluid accordion" ref="accord">
                        <div className="active title"><i className="dropdown icon" /><span>Eggs</span></div>
                        <div className="active content">
                         <div className="ui green ribbon label">{this.props.dozens} Dozen Eggs</div>
                        <EggEntry onLog={this.props.onLog} ptype={"eggs"} />
                        </div>
                        <div className="title"><i className="dropdown icon"/><span>Events and Notes</span></div>
                        <div className="content">
                        <EventsEntry onLog={this.props.onLog} ptype={"events"} />
                        </div>
                     </div>
              </div>
             );
   }
});

var LogNode = React.createClass({
   render: function () {
      var s = "s";
      switch (this.props.entry.ptype) {
      case "eggs":
         if (this.props.entry.eggs == 1) s = "";
         return (<li className={this.props.entry.ptype + " log"}>
                    {this.props.entry.eggs} egg{s}
                         <span className="date"> &mdash; {Date.past(this.props.entry.date).format('{Weekday} {Month} {ord}, {yyyy}')}</span>
                 </li>);
         break;
      case "events":
         return (<li className={this.props.entry.ptype + " log"}>
                  {this.props.entry.text}
                  <span className="date"> &mdash; {Date.past(this.props.entry.date).format('{Weekday} {Month} {ord}, {yyyy}')}</span>
                 </li>);
         break;
      }
      return (<li>{this.props.entry.ptype}</li>);
   }
});


var LogDisplay = React.createClass({
   render: function() {
      var entries = this.props.log.map(function (ll) {
         return (<LogNode key={ll.ptype + Date.past(ll.date).valueOf()} entry={ll} />)
      });
      return (<ul>
               {entries}
              </ul>);
   }
});

var SvgLogDayDisplay = React.createClass({
   componentDidMount: function() {
      if (this.props.log.ptype === "events")
         $(this.refs.ebox.getDOMNode()).popup({
             position : 'top center',
             title    : this.props.log.date,
             content  : this.props.log.text
         });
   },
   render: function() {
      var date  = Date.past(this.props.log.date);
      var adate = Date.past(this.props.log.date);
      adate.addDays(1);
      var clsStr = "day " + this.props.log.ptype;
      var z = this.props.z;
      var x = date.getDay() * z;
      var y = ((adate.getISOWeek() - this.props.firstWeek)) * z;
      if (this.props.log.ptype === "eggs") {
         return (<g>
                     <text x={x + z - 3} y={y + z - 5} style={{"text-anchor": "end"}} className="eggCount">{this.props.log.eggs}</text>
                 </g>);
      }
      else {
         return (<g>
                      <circle ref="ebox" cx={x+27} cy={y+10} className={clsStr} r="6" style={{  "fill": "rgb(200,240,200)",
  "stroke": "green"}}>
                      <title>{this.props.log.text}</title>
                      </circle>
                 </g>);
      }
   }
});

var SvgLogMonthDisplay = React.createClass({
   render: function() {
      var z = 37;
      var month = this.props.month;
      var  year = this.props.year;
      var fdate = Date.past(year, month);
      var  date = Date.past(year, month);
      var firstWeek = 0;
      var firstDay  = fdate.getDay();
      var day, week = 0;
      var dategrid = [];
      do {
            day = date.getDay();
            dategrid.add(<rect key={"db" + date.valueOf()} x={day * z} y={week * z} width={z} height={z} style={{stroke: "#ccc", fill: date.isPast() ? "transparent" : "rgb(242,242,242)"}} />);
            dategrid.add(<text key={"dt" + date.valueOf()} x={day * z + 2} y={week * z + 10} style={{"text-anchor": "start"}} className="daydate">{date.format("{d}")}</text>);
            if (day === 6) week++;
            date.setDate(date.getDate() + 1);
      } while (date.getMonth() === month);

      var lastDay = day;
      var lastWeek = day === 6 ? week - 1 : week;
      
      var ndate = Date.past(fdate);
      ndate.addDays(1);
      var dayOutlines = this.props.log.map(function (l) {
         return (<SvgLogDayDisplay key={"y" + year + "m" + month  + "d" + Date.past(l.date).format("{dd}") + l.ptype} z={z} firstWeek={ndate.getISOWeek()} log={l} />);
      });
      var monthStr = "M" + firstDay * z + "," + (firstWeek + 1) * z
                   + "V" + firstWeek * z
                   + "H" + 7 * z
                   + "V" + lastWeek * z
                   + "H" + (lastDay + 1) * z
                   + "V" + (lastWeek + 1) * z
                   + "H" + 0
                   + "V" + (firstWeek + 1) * z
                   + "Z";
      var monthOutline = (<path className="month" d={monthStr} strokeWidth="0.8"  />);
      return (<div className="column">
                 <h5 className="ui header">{fdate.format('{Month}, {yyyy}')}</h5>
                 <svg x="0px" y="0px" style={{"width":"100%","height":"100%"}} viewBox="0 0 280 224" overflow="inherit">
                    <g transform="translate(2,2)">
                    {dategrid}
                    {dayOutlines}
                    {monthOutline}
                    </g>
                 </svg>
              </div>);
   }
});

var SvgLogYearDisplay = React.createClass({
   render: function() {
      var months = [];
      var year = this.props.year;
      var groups = this.props.log.groupBy(function(d) { return Date.past(d.date).getMonth() + ""; })
      Object.each(groups, function(mm, l) {
         months.add(<SvgLogMonthDisplay key={"y" + year + "m" + mm} month={parseInt(mm)} year={year} log={l} />);
      });
            
      return (<div>
               <h4 className="ui black block header">{year}</h4>
               <div className="four column stackable ui grid">
                  {months}
               </div>
               </div>);
      
   }
   
});

var SvgLogDisplay = React.createClass({

   render: function() {
      var years = [];
      var f = function(d) { return Date.past(d.date).getFullYear() + ""; }
      var e = function (y, l) {
         var sl = (<SvgLogYearDisplay key={"y" + y} year={parseInt(y)} log={l} />);
         years.add(sl);
      }
      Object.each(this.props.log.groupBy(f), e);
      
      return (<div>
                  <div className="ui section divider"></div>
                  {years.reverse()}
              </div>);
   }
});


// Keep a record of events, and display that record
var Log = React.createClass({

   getInitialState: function() {
      return {log:[]}
   },

   handleNewLog: function (l) {
      this.props.socket.emit("logit", l);
   },
   
   handleLogs: function (ls) {
      if (this.isMounted())
         this.setState({log: ls});
   },

   componentDidMount: function() {
      this.props.socket.on("log", this.handleLogs);
      this.props.socket.emit("get-log");
   },

   componentWillUnmount: function(){
      this.props.socket.on("log", function(){});
   },
   
   render: function() {
      var sum = this.state.log.filter(function (e) {
         return e.ptype === "eggs";
      }).reduce(function (a,b) {
         return a + b.eggs;
      }, 0);
      return (<div>
                <div className="sixteen wide column">
                  <div className="ui three column aligned stackable divided grid">
                     <LogEntry onLog={this.handleNewLog} dozens={(sum / 12).toFixed(0)} />
                     <Sensors socket={this.props.socket} />
                     <Weather socket={this.props.socket} />
                  </div>
                  </div>
                  <SvgLogDisplay log={this.state.log} />
              </div>);
   }

});



var Graph = React.createClass({
   render: function(){
      return (<img src={"/images/" + this.props.graph.name + ".svg?ts=" + this.props.graph.timestamp} width="100%" />);
   }
});

// Main Coop
var Coop = React.createClass({
   getInitialState: function() {
      return {socket: null, connection: 'Disconnected', graphs: []};
   },
   componentWillUnmount: function(){
      var Socket = this.state.socket;
      if (Socket) {
         Socket.on('connect', function(){});
         Socket.on('connecting', function(){});
         Socket.on('disconnect', function(){});
         Socket.on('reconnecting', function(){});
         Socket.on('graphs', function(g){});
         this.setState({socket:null});
      }
   },
   componentDidMount: function(){
      var Socket = io.connect(this.props.socketUrl); 
      var that = this;
      Socket.on('connect', function() {that.setState({connection: "Connected"});});
      Socket.on('connecting', function() {that.setState({connection: "Connecting..."});});
      Socket.on('disconnect', function() {that.setState({connection: "Disconnected"});});
      Socket.on('reconnecting', function() {that.setState({connection: "Reconnecting..."});});
      Socket.on('graphs', function(g) {that.setState({graphs: g});});
      this.setState({socket: Socket});
   },
   render: function() {
      if (this.state.connection !== 'Connected') {
         return (<div data-alert="data-alert" className="alert-box warning">
                   {this.state.connection}
                 </div>);
      }

      var graphs = this.state.graphs.map(function (g) {
         return (<Graph key={g.name} graph={g} />);
      });
      return (<div className="sixteen wide column">
               <div className="ui divider">
               </div>
               <div>
                  <Lights socket={this.state.socket} />
               </div>
               <div className="ui horizontal icon divider">
                 <i className="circular star icon"></i>
               </div>
               <div>
                  <Log socket={this.state.socket} />
               </div>
               <div className="ui horizontal icon divider">
                 <i className="circular star icon"></i>
               </div>
               <div className="ui two column aligned stackable divided grid">
                  {graphs}
               </div>
               </div>);
   }
});
