'use strict';

var {
  bookshelf
} = require('../../bookshelf');

var BannerMsg = bookshelf.model('BannerMsg', {
  tableName: 'banner_msg'
});

module.exports = {
  BannerMsg
};