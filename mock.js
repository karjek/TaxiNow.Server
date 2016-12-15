"use strict"

let db = require("./db");

let driver = new db.Drivers({ email: "testing2@devpost.com", firstName: "test", lastName: "test", password: "test" });

driver.save((err) => {
    console.log(err || "driver added");
});
