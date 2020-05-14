'use strict';

var {
    bookshelf
} = require('../../bookshelf');
var User = require('./user')
var Sound = require('./sound')
var {
    PurchaseSound
} = require('./relations')

var Purchase = bookshelf.model('Purchase', {
    tableName: 'purchases',
    user: function () {
        return this.belongsTo('User', 'userID', 'id');
    },
    sounds: function () {
        return this.belongsToMany('Sound', 'purchase_sound', 'purchaseID', 'soundID');
    },
});

module.exports = {
    Purchase
};