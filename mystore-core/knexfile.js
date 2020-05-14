// Update with your config settings.

module.exports = {

  development: {
    client: 'mysql',
    connection: {
      database: 'jz_database',
      user: 'root',
      password: '',
      // host: '127.0.0.1',
      // port: '4404',
      host: 'mysql',
      port: '3306',
    },
    migrations: {
      directory: __dirname + '/config/db/migrations'
    }
  },

  // staging: {
  //   client: 'postgresql',
  //   connection: {
  //     database: 'my_db',
  //     user:     'username',
  //     password: 'password'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // },
  //
  // production: {
  //   client: 'postgresql',
  //   connection: {
  //     database: 'my_db',
  //     user:     'username',
  //     password: 'password'
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations'
  //   }
  // }

};
