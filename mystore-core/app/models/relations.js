'use strict';
var {
    Sound,
    Keyword
} = require('./sound')
var {
    Purchase
} = require('./purchase')
var {
    bookshelf
} = require('../../bookshelf');

var SoundKeyword = bookshelf.model('SoundKeyword', {
    tableName: 'sound_keyword',
    sound: function () {
        return this.belongsTo('Sound', 'soundID');
    },
    keyword: function () {
        return this.belongsTo('Keyword', 'keywordID');
    }
});

var PurchaseSound = bookshelf.model('PurchaseSound', {
    tableName: 'purchase_sound',
    // sound: function () {
    //     return this.belongsTo(Sound, 'soundID');
    // },
    // purchase: function () {
    //     return this.belongsTo(Purchase, 'purchaseID');
    // }
});

var UserSound = bookshelf.model('UserSound', {
    tableName: 'user_sound',
});

module.exports = {
    SoundKeyword,
    PurchaseSound,
    UserSound
};