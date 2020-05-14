'use strict';

var {
  bookshelf
} = require('../../bookshelf');

var Category = bookshelf.model('Category', {
  tableName: 'soundCategories',
  sounds: function () {
    return this.hasMany('Sound', 'category', 'id');
  }
});

module.exports = {
  Category
};