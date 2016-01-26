var Promise = require('bluebird');
var request = require('request');

var NestApi = function NestApi() {
    this.caching = {};
};

NestApi.prototype.put = function(endpoint, data, accessToken) {
    var future = Promise.defer();

    request.put('https://developer-api.nest.com/' + endpoint, {
        headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        followAllRedirects: true,
        json: true,
        body: data
    }, function(err, res, body) {
        if (err) return future.reject(err);
        if (res.statusCode != 200) {
            try {
                err = JSON.parse(body);
            } catch (e) {
                err = new Error('Could not PUT.');
            }
            return future.reject(err);
        }

        try {
            future.resolve((JSON).parse(body));
        } catch (err) {
            future.reject(err);
        }
    });

    return future.promise;
};

NestApi.prototype.get = function(endpoint, accessToken) {
    var future = Promise.defer();

    request.get('https://developer-api.nest.com/' + endpoint, {
        headers: {
            Authorization: 'Bearer ' + accessToken,
            Accept: 'application/json'
        }
    }, function(err, res, body) {
        if (err) return future.reject(err);
        if (res.statusCode != 200) {
            try {
                err = JSON.parse(body);
            } catch (e) {
                err = new Error('Could not GET.');
            }
            return future.reject(err);
        }

        try {
            future.resolve((JSON).parse(body));
        } catch (err) {
            future.reject(err);
        }
    });

    return future.promise;
};

NestApi.prototype.getCached = function(endpoint, accessToken, ttl) {
    var now = Date.now(),
        key = endpoint + accessToken,
        _this = this;

    for (var k in this.caching) {
        if (this.caching[k].expire < now) {
            delete this.caching[k];
        }
    }

    if (this.caching[key]) {
        var cached = this.caching[key];
        if (cached.promise) {
            return cached.promise;
        }
        return Promise.resolve(cached.value);
    }

    this.caching[key] = {
        promise: this.get(endpoint, accessToken).then(function(data) {
            delete _this.caching[key].promise;
            _this.caching[key].value = data;
            _this.caching[key].expire = Date.now() + ttl;
            return data;
        }).catch(function(err) {
            delete _this.caching[key];
            return Promise.reject(err);
        }),
        expire: Infinity
    };

    return this.caching[key].promise;
};

NestApi.prototype.getAll = function(accessToken) {
    return this.getCached('', accessToken, 60 * 1000);
};

NestApi.prototype.getStructures = function(accessToken) {
    return this.getAll(accessToken).then(function(all) {
        return Object.keys(all.structures).map(function(structureId) {
            return {
                id: structureId,
                name: all.structures[structureId].name
            };
        });
    });
};

NestApi.prototype.getThermostatsForStructure = function(structureId, accessToken) {
    return this.getAll(accessToken).then(function(all) {
        var structures = all.structures;
        var thermostats = all.devices.thermostats;

        if (!structures[structureId]) return Promise.reject(new Error('Invalid structureId.'));

        return structures[structureId].thermostats.map(function(thermostatId) {
            return {
                id: thermostatId,
                name: thermostats[thermostatId].name
            };
        });
    });
};

NestApi.prototype.getAllThermostats = function(accessToken) {
    return this.getAll(accessToken).then(function(all) {
        var thermostats = all.devices.thermostats;

        return Object.keys(thermostats).map(function(thermostatId) {
            return {
                id: thermostatId,
                name: thermostats[thermostatId].name
            };
        });
    });
};

NestApi.prototype.getThermostat = function(thermostatId, accessToken) {
    return this.getAll(accessToken).then(function(all) {
        return all.devices.thermostats[thermostatId];
    });
};

NestApi.prototype.getTemperatureScale = function(thermostatId, accessToken) {
    return this.getThermostat(thermostatId, accessToken).then(function(thermostat) {
        return (thermostat && thermostat.temperature_scale || 'c').toLowerCase();
    });
};

NestApi.prototype.getCurrentTemperature = function(thermostatId, scale, accessToken) {
    return this.get('devices/thermostats/' + thermostatId + '/ambient_temperature_' + scale, accessToken);
};

NestApi.prototype.getTargetTemperature = function(thermostatId, scale, accessToken) {
    return this.get('devices/thermostats/' + thermostatId + '/target_temperature_' + scale, accessToken);
};

NestApi.prototype.setTargetTemperature = function(thermostatId, scale, temperature, accessToken) {
    return this.put('devices/thermostats/' + thermostatId + '/target_temperature_' + scale, Number(temperature), accessToken);
};

NestApi.prototype.getTemperature = function(thermostatId, scale, accessToken) {
    return this.get('devices/thermostats/' + thermostatId, accessToken).then(function(data) {
        return {
            current: data['ambient_temperature_' + scale],
            target: data['target_temperature_' + scale]
        };
    });
};


module.exports = NestApi;