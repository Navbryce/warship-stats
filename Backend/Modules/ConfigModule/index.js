var fs = require('fs');
var config = null;

var configContents = fs.readFileSync('/app/config.json').toString();
config = JSON.parse(configContents);

function getConfig () {
  return config;
}

module.exports = {
  getConfig: getConfig
};