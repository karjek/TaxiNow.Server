"use strict"

let db = require("./db");
let config = require("./config");
let validator = require("validator");
let jwt = require("jsonwebtoken");
let request = require("request");
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var plus = google.plus('v1');

class Auth {

    Connect(userForm, callback) {

         if (userForm.email == null || userForm.password == null)
            return callback("Veuillez remplir tous les champs");

        if (!validator.isEmail(userForm.email))
            return callback("Addresse email invalide");

        if (userForm.password.length < 4)
            return callback("Le mot de passe est trop petit");

        return db.Users.findOne({"email": userForm.email}, (err, user) => {

            if (user == null) {
                callback("Email ou mot de passe incorrecte");
            }
            else {
                user.verifyPassword(userForm.password, (err, valid) => {

                    if (valid) {

                        this.VerifyWebToken(user.token,() => callback(null, user), () =>  {

                            var token = this.GenerateToken(user);
                            user.token = token;
                            
                            user.save((err) => {
                                if (err)
                                    console.log(err);

                                callback(null, user);
                            });
                        });

                    }
                    else callback("Email ou mot de passe incorrecte");
                });
            }
        });
    }

    RegisterUser(userForm, callback) {

        if (userForm.email == null || userForm.password == null || 
            userForm.firstName == null || userForm.lastName == null)
            return callback("Veuillez remplir tous les champs");

        if (!validator.isEmail(userForm.email))
            return callback("Addresse email invalide");

        if (userForm.password.length < 4)
            return callback("Le mot de passe est trop petit");

        if (userForm.lastName.length < 3)
           return callback("Veuillez entrer votre nom");

        if (userForm.firstName.length < 3)
           return callback("Veuillez entrer votre prénom");
        
        return db.Users.findOne({"email": userForm.email}, (err, user) => {
            if (user != null) {
                
                return callback("Un compte est déjà associé à cette addresse email");
            }
            else {

                return this.AddUser(userForm, callback);
            }
        });
    }

    RegisterGoogle(obj, callback) {

        let token = obj.token;
        let gender = obj.gender;

        var oauth2Client = new OAuth2(config.google.clientId, config.google.secret, config.google.redirectUrl);

        oauth2Client.getToken(token, (err, tokens) => {
        // Now tokens contains an access_token and an optional refresh_token. Save them.
            if(!err) {
                
                oauth2Client.setCredentials(tokens);
                
                plus.people.get({ userId: 'me', auth: oauth2Client }, (err, response) => {
                    console.log(response);
                    if (err) {
                        console.log("he :" + err);
                        return callback("Invalid access token");
                    }
                    
                    db.Users.findOne({"email": response.emails[0].value}, (err, user) => {
                        if (user != null) {
                            // user exists
                            this.VerifyWebToken(user.token, () =>  callback(null, user), () => {
                                var token = this.GenerateToken(user);
                                user.token = token;
                                user.save((err) => {
                                    if (err) {
                                        console.log(err);
                                        callback(config.unknownErrorMessage);
                                    }
                                    else 
                                        callback(null, user)
                                });
                            });
                        }
                        else {
                            // new user
                            var userData = {
                                email: response.emails[0].value,
                                firstName: response.name.givenName,
                                lastName: response.name.familyName,
                                gender: response.gender == null ? gender : response.gender,
                                picture: response.image.url
                            }
                            return this.AddUser(userData, callback);
                        }
                    });
                });
            }
            else
                return callback("Invalid access token");
        });
    }

    RegisterFacebook(token, callback) {

        let url = config.facebook.graphUrl+token;

        request(url, (err, res, body) => {
            if (!err && res.statusCode == 200) {
                let info = JSON.parse(body);
                db.Users.findOne({"email": info.email}, (err, user) => {
                    if (user != null) {
                        // user exists
                        this.VerifyWebToken(user.token, () =>  callback(null, user), () => {
                            var token = this.GenerateToken(user);
                            user.token = token;
                            user.save((err) => {
                                if (err) {
                                    console.log(err);
                                    callback(config.unknownErrorMessage);
                                }
                                else 
                                    callback(null, user)
                            });
                        });
                    }
                    else {
                        var nameArray = info.name.split(" ");
                        // new user
                        var userData = {
                            email: info.email,
                            firstName: nameArray[0],
                            lastName: nameArray[nameArray.length-1],
                            gender: info.gender,
                            picture: info.picture.data.url
                        }
                        console.log(info.name.split(" ").length);
                        return this.AddUser(userData, callback);
                    }
                });
            }
            else {
                return callback("Invalid access token");
            }
        });
    }

    ConnectDriver(driverForm, callback) {
        
        if (driverForm.email == null || driverForm.password == null)
            return callback("Veuillez remplir tous les champs");

        if (!validator.isEmail(driverForm.email))
            return callback("Addresse email invalide");

        if (driverForm.password.length < 4)
            return callback("Le mot de passe est trop petit");
            
        return db.Drivers.findOne({"email": driverForm.email}, (err, driver) => {

            if (driver == null) {
                callback("Email ou mot de passe incorrecte");
            }
            else {
                driver.verifyPassword(driverForm.password, (err, valid) => {
                    if (valid) {
                        
                        this.VerifyDriverWebToken(driver.token, () => callback(null, driver), () =>  {

                            var token = this.GenerateDriverToken(driver);
                            driver.token = token;

                            driver.save((err) => {
                                if (err)
                                    console.log(err);

                                callback(null, driver);
                            });
                        });

                    }
                    else callback("Email ou mot de passe incorrecte");
                });
            }
        });
    }

    ConnectDriverWS(driverForm, callback) {

        if (driverForm.email == null)
            return callback(config.unknownErrorMessage);

        if (!validator.isEmail(driverForm.email))
            return callback(config.unknownErrorMessage);

        return db.Drivers.findOne({"email": driverForm.email}, (err, driver) => {
                
                if (driver == null || driverForm.token != driver.token) {
                    callback(config.unknownErrorMessage);
                }
                else {
                    this.VerifyDriverWebToken(driver.token, () => callback(null, driver), () =>  {
                            callback(config.unknownErrorMessage);
                        });
                }
        });
    }

     ConnectRiderWS(riderForm, callback) {

        if (riderForm.email == null)
            return callback(config.unknownErrorMessage);

        if (!validator.isEmail(riderForm.email))
            return callback(config.unknownErrorMessage);

        return db.Users.findOne({"email": riderForm.email}, (err, rider) => {
                
                if (rider == null || rider.token != riderForm.token) {
                    callback(config.unknownErrorMessage);
                }
                else {
                    this.VerifyWebToken(rider.token, () => callback(null, rider), () =>  {
                            callback(config.unknownErrorMessage);
                        });
                }
            });
    }

    AddUser(userForm, callback) {

         var user = new db.Users({ email: userForm.email, firstName: userForm.firstName, 
                                lastName: userForm.lastName, password: userForm.password,
                                gender: userForm.gender});
        
        var token = this.GenerateToken(user);
        user.token = token;
        user.save((err) => {
            if (err)    { console.log(err); return callback(config.unknownErrorMessage);}
            else        return callback(null, user);
        });
    }

    GenerateToken(user) {
        return jwt.sign(user, config.jwt.secret, {expiresIn: config.jwt.expiresRider});
    }

    GenerateDriverToken(driver) {
        return jwt.sign(driver, config.jwt.driverSecret, {expiresIn: config.jwt.expiresDriver});
    }

    VerifyWebToken(webToken, success, expired) {

        jwt.verify(webToken, config.jwt.secret, (err, decoded) => {
            if (err && err.name == "TokenExpiredError")
                expired();
            else if (!err)
                success();
        });
    }

    VerifyDriverWebToken(webToken, success, expired) {

        if (webToken == null) {
            return expired();
        }

        jwt.verify(webToken, config.jwt.driverSecret, (err, decoded) => {
            if (err && err.name == "TokenExpiredError") {
                expired();
            }
            else if (!err)
                success();
        });
    }
}

module.exports = new Auth();