
exports.up = function(knex, Promise) {
  return knex.schema.createTable('keywords', (table) =>
  {
    table.increments('id').unsigned().primary();
    table.string('keyword').unique().notNullable();
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
    knex.schema.dropTableIfExists('keywords')
  ]);
};
