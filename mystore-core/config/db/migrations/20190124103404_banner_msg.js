exports.up = function (knex, Promise) {
    return knex.schema.createTable('banner_msg', (table) => {
        table.increments('id').unsigned().primary();
        table.date('expires');
        table.string('message').notNullable();
        table.string('type').notNullable();
        table.timestamps(false, true);
    })
};

exports.down = function (knex, Promise) {
    return Promise.all([
        knex.schema.dropTableIfExists('users'),

        knex.table('sounds', function (table) {
            table.dropForeign('soundEditor'),
                table.dropForeign('category')
        }),
        knex.schema.dropTableIfExists('sounds'),

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
        knex.schema.dropTableIfExists('purchase_sound'),

        knex.table('validationTokens', function (table) {
            table.dropForeign('userID')
        }),
        knex.schema.dropTableIfExists('validationTokens'),

        knex.table('passwordTokens', function (table) {
            table.dropForeign('userID')
        }),
        knex.schema.dropTableIfExists('passwordTokens'),

        knex.schema.dropTableIfExists('banner_msg'),
    ]);
};