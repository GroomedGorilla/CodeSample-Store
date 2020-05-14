exports.up = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.boolean('registeredSeller').notNullable().defaultTo(false);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('registeredSeller');
    });
};