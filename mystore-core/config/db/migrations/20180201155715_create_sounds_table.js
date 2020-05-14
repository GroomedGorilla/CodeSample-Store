
exports.up = function(knex, Promise) {
  return knex.schema.createTable('sounds', (table) =>
  {
    table.increments('id').unsigned().primary();
    table.integer('soundEditor').unsigned().references('users.id').notNullable();
    table.string('name').notNullable();
    table.string('originalName').notNullable();
    table.integer('price').notNullable();
    table.string('uuid').notNullable();
    table.string('mimetype').notNullable();
    table.string('fileExtension');
    table.string('imageLocation');
    table.string('previewLocation').notNullable().defaultTo('S3 Bucket'); //TODO Remove defaultTo
    table.boolean('synthesized').notNullable().defaultTo(false);
    table.integer('soundModelID').unsigned(); //TODO relationship
    table.timestamps(false, true);
    table.boolean('available').notNullable().defaultTo(false);
    table.integer('category').unsigned().references('id').inTable('soundCategories').notNullable();
    // TODO: add soundminer tags
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
  ]);
};
