'use strict';

var {
  bookshelf
} = require('../../bookshelf');
var User = require('./user')

var Token = bookshelf.model('Token', {
  tableName: 'validationTokens',
  users: function () {
    return this.belongsTo('User');
  }
});

var PassToken = bookshelf.model('PassToken', {
  tableName: 'passwordTokens',
  users: function () {
    return this.belongsTo('User');
  }
});

module.exports = {
  Token,
  PassToken
};