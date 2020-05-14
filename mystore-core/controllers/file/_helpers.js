const fs = require('fs');

var listAudioFiles = () => {
    var dir = '/../../audio/processing';
    console.log(__dirname);
    var content = '';
    fs.readdirSync(__dirname + dir).forEach(file => {
        content += file + ' \n'
    });
    return content;
}

module.exports = {
    listAudioFiles
}