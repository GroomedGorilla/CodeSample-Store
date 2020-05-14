
exports.up = function(knex, Promise) {
  return knex.schema.createTable('purchases', (table) =>
  {
    table.increments('id').unsigned().primary();
    table.integer('userID').unsigned().references('users.id').notNullable();
    table.integer('totalGBP').notNullable(); //Stored in cents
    table.integer('itemCount').notNullable();
    table.string('chargeID').notNullable();
    table.string('error');
    table.timestamps(false, true);
  })
};

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.table('sounds', function (table) {
      table.dropForeign('soundEditor'),
      table.dropForeign('category')
    }),
    knex.schema.dropTableIfExists('sounds'),

    knex.schema.dropTableIfExists('users'),
    knex.schema.dropTableIfExists('soundCategories'),

    knex.table('activities', function (table) {
      table.dropForeign('userID')
    }),
    knex.schema.dropTableIfExists('activities'),
    knex.schema.dropTableIfExists('keywords'),

    knex.table('purchases', function (table) {
      table.dropForeign('userID')
    }),
    knex.schema.dropTableIfExists('purchases'),
  ]);
};
