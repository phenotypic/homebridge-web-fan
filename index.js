let Service, Characteristic
const packageJson = require('./package.json')
const request = require('request')
const ip = require('ip')
const http = require('http')

module.exports = function (homebridge) {
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  homebridge.registerAccessory('homebridge-web-fan', 'WebFan', WebFan)
}

function WebFan (log, config) {
  this.log = log

  this.name = config.name
  this.apiroute = config.apiroute
  this.pollInterval = config.pollInterval || 300

  this.listener = config.listener || false
  this.port = config.port || 2000
  this.requestArray = ['state', 'rotationSpeed', 'rotationDirection']

  this.rotationSpeed = config.rotationSpeed || false
  this.rotationDirection = config.rotationDirection || false

  this.manufacturer = config.manufacturer || packageJson.author
  this.serial = config.serial || this.apiroute
  this.model = config.model || packageJson.name
  this.firmware = config.firmware || packageJson.version

  this.username = config.username || null
  this.password = config.password || null
  this.timeout = config.timeout || 3000
  this.http_method = config.http_method || 'GET'

  if (this.username != null && this.password != null) {
    this.auth = {
      user: this.username,
      pass: this.password
    }
  }

  if (this.listener) {
    this.server = http.createServer(function (request, response) {
      const baseURL = 'http://' + request.headers.host + '/'
      const url = new URL(request.url, baseURL)
      if (this.requestArray.includes(url.pathname.substr(1))) {
        try {
          this.log.debug('Handling request')
          response.end('Handling request')
          this._httpHandler(url.pathname.substr(1), url.searchParams.get('value'))
        } catch (e) {
          this.log.warn('Error parsing request: %s', e.message)
        }
      } else {
        this.log.warn('Invalid request: %s', request.url)
        response.end('Invalid request')
      }
    }.bind(this))

    this.server.listen(this.port, function () {
      this.log('Listen server: http://%s:%s', ip.address(), this.port)
    }.bind(this))
  }

  this.service = new Service.Fan(this.name)
}

WebFan.prototype = {

  identify: function (callback) {
    this.log('Identify requested!')
    callback()
  },

  _httpRequest: function (url, body, method, callback) {
    request({
      url: url,
      body: body,
      method: this.http_method,
      timeout: this.timeout,
      rejectUnauthorized: false,
      auth: this.auth
    },
    function (error, response, body) {
      callback(error, response, body)
    })
  },

  _getStatus: function (callback) {
    const url = this.apiroute + '/status'
    this.log.debug('Getting status: %s', url)

    this._httpRequest(url, '', 'GET', function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error getting status: %s', error.message)
        this.service.getCharacteristic(Characteristic.On).updateValue(new Error('Polling failed'))
        callback(error)
      } else {
        this.log.debug('Device response: %s', responseBody)
        try {
          const json = JSON.parse(responseBody)
          this.service.getCharacteristic(Characteristic.On).updateValue(json.currentState)
          this.log.debug('Updated state to: %s', json.currentState)
          if (this.rotationSpeed) {
            this.service.getCharacteristic(Characteristic.RotationSpeed).updateValue(json.rotationSpeed)
            this.log.debug('Updated rotationSpeed to: %s', json.rotationSpeed)
          }
          if (this.rotationDirection) {
            this.service.getCharacteristic(Characteristic.RotationDirection).updateValue(json.rotationDirection)
            this.log.debug('Updated rotationDirection to: %s', json.rotationDirection)
          }
          callback()
        } catch (e) {
          this.log.warn('Error parsing status: %s', e.message)
        }
      }
    }.bind(this))
  },

  _httpHandler: function (characteristic, value) {
    switch (characteristic) {
      case 'state': {
        this.service.getCharacteristic(Characteristic.On).updateValue(value)
        this.log('Updated %s to: %s', characteristic, value)
        break
      }
      case 'rotationSpeed': {
        this.service.getCharacteristic(Characteristic.RotationSpeed).updateValue(value)
        this.log('Updated %s to: %s', characteristic, value)
        break
      }
      case 'rotationDirection': {
        this.service.getCharacteristic(Characteristic.RotationDirection).updateValue(value)
        this.log('Updated %s to: %s', characteristic, value)
        break
      }
      default: {
        this.log.warn('Unknown characteristic "%s" with value "%s"', characteristic, value)
      }
    }
  },

  setOn: function (value, callback) {
    value = value ? 1 : 0
    const url = this.apiroute + '/setState?value=' + value
    this.log.debug('Setting state: %s', url)

    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error setting state: %s', error.message)
        callback(error)
      } else {
        this.log('Set state to %s', value)
        callback()
      }
    }.bind(this))
  },

  setRotationSpeed: function (value, callback) {
    const url = this.apiroute + '/setRotationSpeed?value=' + value
    this.log.debug('Setting rotationSpeed: %s', url)

    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error setting rotationSpeed: %s', error.message)
        callback(error)
      } else {
        this.log('Set rotationSpeed to %s', value)
        callback()
      }
    }.bind(this))
  },

  setRotationDirection: function (value, callback) {
    const url = this.apiroute + '/setRotationDirection?value=' + value
    this.log.debug('Setting rotationDirection: %s', url)

    this._httpRequest(url, '', this.http_method, function (error, response, responseBody) {
      if (error) {
        this.log.warn('Error setting rotationDirection: %s', error.message)
        callback(error)
      } else {
        this.log('Set rotationDirection to %s', value)
        callback()
      }
    }.bind(this))
  },

  getServices: function () {
    this.informationService = new Service.AccessoryInformation()
    this.informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.model)
      .setCharacteristic(Characteristic.SerialNumber, this.serial)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmware)

    this.service
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOn.bind(this))

    if (this.rotationSpeed) {
      this.service
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('set', this.setRotationSpeed.bind(this))
    }

    if (this.rotationDirection) {
      this.service
        .getCharacteristic(Characteristic.RotationDirection)
        .on('set', this.setRotationDirection.bind(this))
    }

    this._getStatus(function () {})

    setInterval(function () {
      this._getStatus(function () {})
    }.bind(this), this.pollInterval * 1000)

    return [this.informationService, this.service]
  }

}
