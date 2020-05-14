exports.up = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.integer('platform_fee_perc').notNullable().defaultTo(5000);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('platform_fee_perc');
    });
};