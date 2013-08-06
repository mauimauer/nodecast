var fs = require('fs');
var querystring = require('querystring');

function App(addr, name, url, protocols) {
	this.addr = addr;
    this.config = {
    	name: name,
    	state: "stopped",
    	link: "",
    	connectionSvcURL: "",
    	protocols: ["ramp"],
    	app_url: "",
    	url: url
    }

	if(Array.isArray(protocols) ) {
		for(var i = 0; i < protocols.length; i++) {
			this.config.protocols.push(protocols[i]);
		}
	}

    this.receivers = [];
    this.remotes = [];
    this.messageQueue = [];
}

App.prototype.getName = function() {
	return this.config.name;
}

App.prototype.registerSession = function(connection) {
	var me = this;
	connection.on('message', function(message) {
		//if(message.utf8Data.indexOf('ping') != -1) {
		//	connection.send(message.utf8Data.replace('ping', 'pong'));
		//} else {
			if(me.receivers.length == 0) {
				console.log("buffering msg for receiver");
				me.messageQueue.push(message.utf8Data);
			} else {
				console.log("relaying msg to receiver");
				me.receivers[0].send(message.utf8Data);
			}

		if(message.utf8Data.indexOf('ping') == -1 && message.utf8Data.indexOf('pong') == -1) {
			console.log("-->to receiver: "+ message.utf8Data);
		}
		//}
	});

	connection.on('close', function(closeReason, description) {
		var i = me.remotes.indexOf(connection);	
		me.remotes.splice(i,1);
		console.log("Closed SessionChannel");
	});

	console.log("Opened SessionChannel");
	this.remotes.push(connection);
}

App.prototype.registerReceiver = function(connection) {

	var me = this;
	connection.on('message', function(message) {
		//if(message.utf8Data.indexOf('ping') != -1) {
		//	connection.send(message.utf8Data.replace('ping', 'pong'));
		//} else {
			if(me.remotes.length > 0)
				me.remotes[0].send(message.utf8Data);
		//}

		if(message.utf8Data.indexOf('ping') == -1 && message.utf8Data.indexOf('pong') == -1) {
			console.log("-->to remote: "+ message.utf8Data);
		}
	});

	connection.on('close', function(closeReason, description) {
		var i = me.receivers.indexOf(connection);	
		me.receivers.splice(i,1);
		console.log("Closed ReceiverChannel");
	});

	console.log("Opened ReceiverChannel");
	this.receivers.push(connection);

	while(me.messageQueue.length > 0) {
		connection.send(me.messageQueue.shift());
	}
}

App.prototype.getProtocols = function() {
	var p = "";

	if(this.config.state == "running") {
		for(var i = 0; i < this.config.protocols.length; i++) {
			p += "<protocol>"+this.config.protocols[i]+"</protocol>";
		}
	}

	return p;
}

App.prototype.registerApi = function(app) {
	var me = this;
	app.get("/apps/"+me.config.name, function(req, res) {
		fs.readFile('./app.xml', 'utf8', function (err,data) {
			data = data.replace("#name#", me.config.name)
				.replace("#connectionSvcURL#",me.config.connectionSvcURL)
				.replace('#protocols#',me.getProtocols())
				.replace('#state#', me.config.state)
				.replace('#link#', me.config.link);
			res.type('xml');
			res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
			res.setHeader("Access-Control-Expose-Headers", "Location");
			res.setHeader("Cache-control", "no-cache, must-revalidate, no-store");
			res.send(data);
		});
	});

	app.delete("/apps/"+me.config.name+"/web-1", function(req, res) {
		me.config.state = "stopped";
		me.config.link = "";
		me.config.connectionSvcURL = "";

		fs.readFile('./app.xml', 'utf8', function (err,data) {

			if(global.stageConnection)
				global.stageConnection.send(JSON.stringify({
					cmd: "close",
					app: me.config.name
				}))

			data = data.replace("#name#", me.config.name)
				.replace("#connectionSvcURL#",me.config.connectionSvcURL)
				.replace('#protocols#',me.getProtocols())
				.replace('#state#', me.config.state)
				.replace('#link#', me.config.link);
			res.type('xml');
			res.setHeader("Access-Control-Allow-Method", "GET, POST, DELETE, OPTIONS");
			res.setHeader("Access-Control-Expose-Headers", "Location");
			res.setHeader("Cache-control", "no-cache, must-revalidate, no-store");
			res.send(data);
		});
	});

	app.post("/apps/"+me.config.name, function(req, res) {
		me.config.state = "running";
		me.config.link = "<link rel='run' href='web-1'/>";
		me.config.connectionSvcURL = "http://"+me.addr+":8008/connection/"+me.config.name

		if(global.stageConnection)
			global.stageConnection.send(JSON.stringify({
				cmd: "show",
				app: me.config.name,
				url:  me.config.url.replace('$query',req.rawBody)
			}))

		res.setHeader("Location", "http://"+me.addr+":8008/apps/"+me.config.name+"/web-1");
		res.send(201,"");
	});
}

module.exports = App;