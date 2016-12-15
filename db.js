"use strict"

let config = require("./config");
let mongoose = require("mongoose");

mongoose.connect(config.db.connectionString);

let userSchema = mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: false },
    token: { type: String, required: true},
    gender: { type: String, required: true}, //  G F
    picture: { type: String, required: false},
    createdAt: { type: Date, required: true, default: Date.now },
    banned: { type: Boolean, required: true, default: false },
});

userSchema.plugin(require('mongoose-bcrypt'));

let Users = mongoose.model('user', userSchema);

let driverSchema = mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    token: { type: String, required: false },
    picture: { type: String, required: false },
    createdAt: { type: Date, required: true, default: Date.now },
    banned: { type: Boolean, required: true, default: false }
});

driverSchema.plugin(require("mongoose-bcrypt"));


let Drivers = mongoose.model('driver', driverSchema);

 module.exports = { Users: Users, Drivers: Drivers };