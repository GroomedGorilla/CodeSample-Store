exports.up = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.string('stripe_status');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('stripe_status');
    });
};