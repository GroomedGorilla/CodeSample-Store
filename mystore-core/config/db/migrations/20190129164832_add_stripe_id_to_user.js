//Add column to store Stripe Authentication ID Token for Sellers

exports.up = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.string('stripeID');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('stripeID');
    });
};