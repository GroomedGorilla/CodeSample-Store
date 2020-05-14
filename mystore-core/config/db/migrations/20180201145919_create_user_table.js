
exports.up = function(knex, Promise) {
  return knex.schema.createTable('users', (table) =>
  {
    table.increments('id').unsigned().primary();
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.string('name').notNullable();
    table.string('surname').notNullable();
    table.boolean('admin').notNullable().defaultTo(false);
    table.boolean('soundEditor').notNullable().defaultTo(false);
    table.boolean('validated').notNullable().defaultTo(false);
    table.date('dob');
    table.string('profession');
    table.timestamps(false, true);
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTableIfExists('users');
};
