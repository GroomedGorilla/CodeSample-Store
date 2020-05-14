
exports.up = function(knex, Promise) {
    return knex.schema.table('sounds', (table) => {
        table.boolean('lossless');
        table.integer('bitrate');
        table.integer('bitsPerSample');
        table.integer('sampleRate');
        table.integer('numberOfChannels');
        table.float('duration');
        table.string('copyright');
        table.string('artist');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.table('sounds', (table) => {
        table.dropColumn('lossless');
        table.dropColumn('bitrate');
        table.dropColumn('bitsPerSample');
        table.dropColumn('sampleRate');
        table.dropColumn('numberOfChannels');
        table.dropColumn('duration');
        table.dropColumn('copyright');
        table.dropColumn('artist');
    });
};