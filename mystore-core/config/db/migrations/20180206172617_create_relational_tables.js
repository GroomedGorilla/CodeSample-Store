
exports.up = function(knex, Promise) {
  return Promise.all([
    knex.schema.createTable('user_sound', (table) =>
    {
      table.increments('id').unsigned().primary();
      table.integer('userID').unsigned().references('users.id').notNullable();
      table.integer('soundID').unsigned().references('sounds.id').notNullable();
    }),

    knex.schema.createTable('sound_keyword', (table) =>
    {
      table.increments('id').unsigned().primary();
      table.integer('soundID').unsigned().references('sounds.id').notNullable();
      table.integer('keywordID').unsigned().references('keywords.id').notNullable();
    }),

    knex.schema.createTable('purchase_sound', (table) =>
    {
      table.increments('id').unsigned().primary();
      table.integer('soundID').unsigned().references('sounds.id').notNullable();
      table.integer('purchaseID').unsigned().references('purchases.id').notNullable();
    })

  ]);
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

    knex.table('user_sound', function (table) {
      table.dropForeign('userID')
      table.dropForeign('soundID')
    }),
    knex.schema.dropTableIfExists('user_sound'),

    knex.table('sound_keyword', function (table) {
      table.dropForeign('soundID')
      table.dropForeign('keywordID')
    }),
    knex.schema.dropTableIfExists('sound_keyword'),

    knex.table('purchase_sound', function (table) {
      table.dropForeign('purchaseID')
      table.dropForeign('soundID')
    }),
    knex.schema.dropTableIfExists('purchase_sound')
  ]);
};
