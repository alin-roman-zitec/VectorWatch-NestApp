var vectorWatch = require('stream-dev-tools');
var Promise = require('bluebird');
var mysql = require('mysql');

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'NestApp'
});
connection.connect();


var getMapping = function(labels) {
    var future = Promise.defer();

    connection.query('INSERT IGNORE INTO Mapping (string) VALUES ?', [labels.map(function(string) { return [string]; })], function(err) {
        if (err) return future.reject(err);

        connection.query('SELECT id, string FROM Mapping WHERE string IN (?)', [labels], function(err, records) {
            if (err) return future.reject(err);

            var mapping = {};
            (records || []).forEach(function(record) {
                mapping[record.string] = record.id;
            });

            future.resolve(mapping);
        });
    });

    return future.promise;
};

var getLabelById = function(id) {
    var future = Promise.defer();

    connection.query('SELECT string FROM Mapping WHERE id = ?', [id], function(err, records) {
        if (err) return future.reject(err);

        return future.resolve(((records || [])[0] || {}).string);
    });

    return future.promise;
};


var vectorStream = vectorWatch.createStreamNode({
    streamUID: process.env.STREAM_UID,
    token: process.env.VECTOR_TOKEN,

    auth: {
        protocol: 'OAuth',
        version: '2.0',

        clientId: process.env.NEST_KEY,
        clientSecret: process.env.NEST_SECRET,

        callbackUrl: 'http://vectorwatch-srv.cloudapp.net:3050/callback',
        accessTokenUrl: 'https://api.home.nest.com/oauth2/access_token?grant_type=authorization_code',

        authorizeUrl: 'https://home.nest.com/login/oauth2'
    },

    database: {
        connection: connection
    }
});
vectorStream.debugMode = true;

var NestApi = require('./NestApi.js');
var nestApi = new NestApi();

vectorStream.requestConfig = function(resolve, reject, authTokens) {
    resolve({
        renderOptions: { },
        settings: { },
        defaults: { }
    });
};

vectorStream.callMethod = function(resolve, reject, methodName, args, authTokens) {
    callMethod(methodName, args, authTokens).then(resolve).catch(reject);
};

var callMethod = function(methodName, args, authTokens) {
    if (!RemoteMethods[methodName]) {
        return Promise.reject(new Error('Invalid method name.'));
    }

    return RemoteMethods[methodName].call(null, authTokens.access_token, args);
};

var RemoteMethods = {
    loadStructures: function(accessToken) {
        return nestApi.getStructures(accessToken).then(function(structures) {
            return getMapping(structures.map(function(structure) { return structure.id; })).then(function(mapping) {
                var results = [];
                structures.forEach(function(structure) {
                    if (mapping[structure.id]) {
                        results.push({
                            type: 'text',
                            id: mapping[structure.id],
                            label: structure.name
                        });
                    }
                });
                return results;
            });
        }).then(function(items) {
            return {
                type: 'list',
                items: items
            };
        });
    },
    loadThermostats: function(accessToken, options) {
        var thermostatsPromise;

        if (options.id && options.id > 0) {
            thermostatsPromise = getLabelById(options.id).then(function(structureId) {
                return nestApi.getThermostatsForStructure(structureId, accessToken);
            });
        } else {
            thermostatsPromise = nestApi.getAllThermostats(accessToken);
        }

        return thermostatsPromise.then(function(thermostats) {
            return getMapping(thermostats.map(function(thermostat) { return thermostat.id; })).then(function(mapping) {
                var results = [];
                thermostats.forEach(function(thermostat) {
                    if (mapping[thermostat.id]) {
                        results.push({
                            type: 'text',
                            id: mapping[thermostat.id],
                            label: thermostat.name
                        });
                    }
                });
                return results;
            });
        }).then(function(items) {
            return {
                type: 'list',
                items: items
            }
        });
    },
    getCurrentTemp: function(accessToken, options) {
        return getLabelById(options.id).then(function(thermostatId) {
            return nestApi.getTemperatureScale(thermostatId, accessToken).then(function(scale) {
                return nestApi.getCurrentTemperature(thermostatId, scale, accessToken);
            });
        }).then(function(temp) {
            return {
                type: 'number',
                value: temp
            };
        });
    },
    getTargetTemp: function(accessToken, options) {
        return getLabelById(options.id).then(function(thermostatId) {
            return nestApi.getTemperatureScale(thermostatId, accessToken).then(function(scale) {
                return nestApi.getTargetTemperature(thermostatId, scale, accessToken);
            });
        }).then(function(temp) {
            return {
                type: 'number',
                value: temp
            };
        });
    },
    getTemp: function(accessToken, options) {
        return getLabelById(options.id).then(function(thermostatId) {
            return nestApi.getTemperatureScale(thermostatId, accessToken).then(function(scale) {
                return nestApi.getTemperature(thermostatId, scale, accessToken);
            });
        }).then(function(temps) {
            return {
                type: 'gauge_element',
                selectedValue: temps.target,
                actualValue: temps.current
            };
        });
    },
    setTargetTemp: function(accessToken, options) {
        return getLabelById(options.id).then(function(thermostatId) {
            return nestApi.getTemperatureScale(thermostatId, accessToken).then(function(scale) {
                return nestApi.setTargetTemperature(thermostatId, scale, options.value, accessToken).then(function() {
                    return nestApi.getTemperature(thermostatId, scale, accessToken);
                });
            });
        }).then(function(temps) {
            return {
                type: 'gauge_element',
                selectedValue: temps.target,
                actualValue: temps.current
            };
        });
    }
};


vectorStream.startStreamServer(3050, function() {
    console.log('Nest App server started.');
});
