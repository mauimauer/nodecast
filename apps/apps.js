var App = require('./app.js');

function Apps() {
    this.registered = {};
};

Apps.prototype.init = function(fs, app) {
    var me = this;
};

Apps.prototype.registerApp = function(express, addr, name, url, protocols) {
    var app = new App(addr, name, url, protocols);
    this.registered[name] = app;
    app.registerApi(express);
    console.log("Registered App: "+ name);
}

var apps = new Apps();
module.exports = apps;