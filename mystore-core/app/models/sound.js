'use strict';

var {
  bookshelf
} = require('../../bookshelf');
var User = require('./user')
var Purchase = require('./purchase')
var Category = require('./category')
var {
  SoundKeyword,
  PurchaseSound
} = require('./relations')

var Sound = bookshelf.model('Sound',{
  tableName: 'sounds',
  soundEditor: function () {
    return this.belongsTo('User', 'soundEditor');
  },
  keywords: function () {
    return this.belongsToMany('Keyword', 'sound_keyword', 'soundID', 'keywordID');
  },
  purchases: function () {
    return this.belongsToMany('Purchase', 'purchase_sound', 'soundID', 'purchaseID');
  },
  category: function() {
    return this.belongsTo('Category', 'category');
  },
  users: function () {
    return this.belongsToMany('User', 'user_sound', 'soundID', 'userID');
  },
});

var Keyword = bookshelf.model('Keyword',{
  tableName: 'keywords',
  sounds: function () {
    return this.belongsToMany('Sound', 'sound_keyword', 'keywordID', 'soundID');
  }
});

module.exports = {
  Sound,
  Keyword
};