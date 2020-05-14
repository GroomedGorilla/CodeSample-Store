const knexConnection = require('knex')({
  client: 'mysql',
  connection: {
    host: 'mysql',
    // host   : '127.0.0.1', port : 4404,
    user: 'jzdev',
    password: 'pass123', //TODO Hide in environment variables
    database: 'jz_database',
    charset: 'utf8',
  }
});

var bookshelf = require('bookshelf')(knexConnection);

bookshelf.plugin('registry');
bookshelf.plugin('pagination');

module.exports = {
  bookshelf,
  knexConnection
};