"use strict"

let uuid = require("uuid");

class Passenger {
    
    constructor(gender) {
        this.id = uuid.v4();

        this.gender = gender; // G / F
    }
}

module.exports = Passenger;