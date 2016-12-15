"use strict"

let config = require("./config");
let auth = require("./auth.service")
let app = require("express")();
let bodyParser = require('body-parser');
 app.use(bodyParser.json());
 // CONFIGURE EXPRESS HERE
let http = require("http").Server(app);
let messageHandlers = require("./messageHandlers");
let ws = new (require('uws').Server)({ server: http });
let WorkingDriver = require("./workingDriver");
let Rider = require("./rider");
let World = require("./world");
let messages = require("./messages");

let connectionState = {
    notConnected: 1,
    connected: 2
}

let world = new World();

world.startLoop();

ws.on('connection', ws => {
    
    ws.currentConnectionState = connectionState.notConnected;

    ws.on('message',  (message) => {
        
        let jsonMessage = JSON.parse(message);

//        console.log(jsonMessage);

        if (jsonMessage.messageId == null)
            return ws.close();

        if (ws.currentConnectionState === connectionState.notConnected && 
            jsonMessage.messageId !== 1001 && 
            jsonMessage.messageId !== 100)
                return ws.close();

        if (jsonMessage.messageId > 1000 && (ws.user != null && !ws.user instanceof WorkingDriver)) {
            return ws.close();
        }

        if (jsonMessage.messageId < 1000 && (ws.user != null && !ws.user instanceof Rider)) {
            return ws.close();
        }

        return messageHandlers[jsonMessage.messageId](ws, world, jsonMessage);
    });

    ws.on("close", () => {

        ws.currentConnectionState = connectionState.notConnected;

        if (ws.user != null) {

            if (ws.user instanceof WorkingDriver) {
                
                world.drivers.splice(world.drivers.indexOf(ws.user));
                
                for(let i  = 0; i < ws.user.waitingRiders.length; i++) {
                    
                    let waitingRider = ws.user.waitingRiders[i];

                    waitingRider.setSearchingState();
                    waitingRider.getSocket().send(JSON.stringify({ messageId: messages.waitingDriverDisconnectedMessageId }));
                }

                ws.user.waitingRiders.length = null;
            }
            else {
                
                world.riders.splice(world.riders.indexOf(ws.user));
                let driver = ws.user.driver;
                
                if (driver != null) {
                    
                    let index = driver.waitingRiders.indexOf(ws.user);

                    if (index !== -1) {

                        driver.waitingRiders.splice(index, 1);
                        console.log(driver.waitingRiders.length);
                        driver.getSocket().send(JSON.stringify({ messageId: messages.waitingRiderDisconnectedMessageId, riderId: ws.user.riderInfo.id }))
                    }
                }
            }
        }

        ws.user = null;

        console.log("closed");
    });
});

// RIDER API

app.post("/auth/login", function(req, res) {
   
    auth.Connect(req.body, function(err, user) {
        
        if (err)
            return res.status(500).send({error: err});

        res.send({ email: user.email, token:user.token, firstName: user.firstName, lastName: user.lastName, gender: user.gender});
    });
});

app.post("/auth/register", function(req, res) {

    auth.RegisterUser(req.body, function(err, user) {

        if (err)
            return res.status(500).send({error: err});

        return res.send({email: user.email, firstName: user.firstName, lastName: user.lastName, token: user.token, gender: user.gender });
    });
});

app.post("/auth/facebook", function(req, res){

    var token = req.body.token;

    if (token == null || token.length == 0)
        return res.status(500).send({error: "Invalid access token"});

    auth.RegisterFacebook(token, function(err, user) {
        
        if (err)
            return res.status(500).send({error: err});

        user.password = null;

        return res.send({email: user.email, firstName: user.firstName, lastName: user.lastName, token: user.token, gender: user.gender});
    });
});

app.post("/auth/google/:gender?", function(req, res) {

    var token = req.body.token;

    if (token == null || token.length == 0)
        return res.status(500).send({error: "Invalid access token"});

    auth.RegisterGoogle({token: token, gender: req.params.gender}, function(err, user) {
        
        if (err)
            return res.status(500).send({error: err});
            
        user.password = null;

        return res.send({email: user.email, firstName: user.firstName, lastName: user.lastName, token: user.token, gender: user.gender});
    });
});

// DRIVER API

app.post("/auth/driver/connect", function(req, res) { 

    auth.ConnectDriver(req.body, function(err, driver) {
        console.log("driver connected");
        if (err) res.status(500).send({error: err});
        else res.send({email: driver.email, firstName: driver.firstName, lastName: driver.lastName, token: driver.token});
    });
});

http.listen(config.http.port, function() {
    console.log("server started at "+ config.http.port);
});
