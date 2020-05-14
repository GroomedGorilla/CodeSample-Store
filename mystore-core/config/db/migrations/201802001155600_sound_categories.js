var soundCats = ["Airport", "Amphibians", "Animals", "Applause", "Aviation", "Bars Restaurants", "Basketball", "Bells", "Birds", "Boats,Marine", "Buildings", "Buses", "Cars Specific", "Cars Various", "Cartoons", "Casino", "Communications", "Construction", "Crowds", "Dogs", "Doors", "Farm Machines", "Feet Footsteps", "Fight", "Fires", "Foley", "Guns", "Hockey", "Horns", "Horses", "Hospitals", "Household", "Humans", "Industry", "Insects", "Kids", "Machines", "Magic", "Metal", "Military", "Motorcycles", "Nature", "Office", "Police Fire", "Rain Thunder", "Rocks", "Science Fiction", "Snow", "Sports", "Sound Design", "Toys", "Traffic Various", "Trains", "Trucks Specific", "Trucks Various", "Vehicles", "Voices", "Water", "Whoosh", "Winds", "Wood", "Glass", "Boom Tracks Low Frequency", "Plastic"];
var musicCats = ["Action Sports", "Adult Contemporary", "Bed Tracks", "Bells", "Children", "Circus", "Classical", "Comedy Cartoons", "Corporate Business", "Country", "Dance", "Dramatic", "Electronica", "Groups", "Historical", "Holidays", "Horns", "Horror", "Jazz", "Military Marches", "Music Boxes", "New Age Atmospheric", "Percussion", "Rock", "Science Fiction", "Strings", "Tonal", "Urban", "Voices Vocals", "World Music", "Latin", "DrumNBass Underscores", "Acid Jazz", "Funk", "Reggae", "Pop Tracks", "Downtempo", "Blues", "Folk", "Theater Music"];
var insertSoundCats = soundCats.map(x => {
    var b = {
        name: x,
        type: 'sound'
    };
    return b;
});
var insertMusicCats = musicCats.map(x => {
    var b = {
        name: x,
        type: 'music'
    };
    return b;
});


exports.up = function (knex, Promise) {
    return Promise.all([
        knex.schema.createTable("soundCategories", (table) => {
            table.increments('id').unsigned().primary();
            table.string('name').notNullable();
            table.enu('type', ['sound', 'music']).notNullable();
        }).then(() => {
            return knex("soundCategories").insert([...insertSoundCats, ...insertMusicCats]);
        }),
    ]);
};

exports.down = function (knex, Promise) {
    return Promise.all([
        knex.schema.dropTableIfExists('users'),

        knex.schema.dropTableIfExists('soundCategories'),
    ]);
};