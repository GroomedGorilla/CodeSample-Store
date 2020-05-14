'use strict';

var {
  bookshelf
} = require('../../bookshelf');
var Sound = require('./sound')

var User = bookshelf.model('User', {
  tableName: 'users',
  uploads: function () {
    return this.hasMany('Sound', 'soundEditor', 'id');
  },
  sounds: function () {
    return this.belongsToMany('Sound', 'user_sound', 'userID', 'soundID');
  }
});

module.exports = User;