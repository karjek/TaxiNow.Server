"use strict"

let auth = require("./auth.service")
let WorkingDriver = require("./workingDriver");
let Rider = require("./rider");
let Passenger = require("./passenger");
let config = require("./config");
let messages = require("./messages");
let geolib = require("geolib");

let messageHandlers = [];

messageHandlers[messages.driverAuthenticationMessageId] = (ws, world, message) => {

    return auth.ConnectDriverWS(message, (err, driver) => {

        if (err) {
            console.log(err);
            return ws.send(JSON.stringify({ messageId: messages.authenticationErrorMessageId, error: err}));
        }

        ws.currentConnectionState = 2;
        ws.user = new WorkingDriver(driver, ws);
        world.drivers.push(ws.user);
        ws.send(JSON.stringify({ messageId : messages.authenticatedMessageId}));
    });
};

messageHandlers[messages.newPassengerMessageId] = (ws, world, message) => {

    if (ws.user.isFull()) {
        return ws.send(JSON.stringify({messageId: messages.errorMessageId, error: "Il est intérdit d'avoir plus de 3 passagers"}));
    }

    if (message.gender == null || ( message.gender !== 'M' && message.gender !== 'F')) {
        return ws.send(JSON.stringify({ messageId: messages.errorMessageId, error: config.unknownErrorMessage}));
    }
    
    let newPassenger = new Passenger(message.gender);
    ws.user.passengers.push(newPassenger);

    ws.send(JSON.stringify({ messageId: messages.newPassengerAcceptedMessageId, gender: newPassenger.gender, type: 0, id: newPassenger.id}))
};

messageHandlers[messages.deletePassengerMessageId] = (ws, world, message) => {

    for (let i = 0; i < ws.user.passengers.length; i++) {

        if (ws.user.passengers[i].id != message.passengerId)
            continue;

        ws.user.passengers.splice(i, 1);

        return ws.send(JSON.stringify({ messageId: messages.passengerDeletedMessageId, id: message.passengerId, type:0 }));
    }

    ws.send(JSON.stringify({ messageId: messages.errorMessageId, error: config.unknownErrorMessage }));
};

messageHandlers[messages.deleteRiderMessageId] = (ws, world, message) => {

    for (let i = 0; i < ws.user.riders.length; i++) {

        let currentRider = ws.user.riders[i];
        
        if (currentRider.riderInfo.id != message.riderId)
            continue;

       if (world.spamList[currentRider.riderInfo.id] == null) {
            world.spamList[currentRider.riderInfo.id] = [];
        }

        let time = new Date();
        time.setMinutes(time.getMinutes() + 7);
        world.spamList[currentRider.riderInfo.id].push({ driver: ws.user.driverInfo.id, time: time });

        ws.user.riders.splice(i, 1);
        
        return ws.send(JSON.stringify({ messageId: messages.riderDeletedMessageId, riderId: message.riderId }));
    }

    for (let i = 0; i < ws.user.waitingRiders.length; i++) {

        let waitingRider = ws.user.waitingRiders[i];

        if (waitingRider.riderInfo.id != message.riderId)
            continue;

            if (world.spamList[waitingRider.riderInfo.id] == null) {
                world.spamList[waitingRider.riderInfo.id] = [];
        }

        let time = new Date();
        time.setMinutes(time.getMinutes() + 7);
        world.spamList[waitingRider.riderInfo.id].push({ driver: ws.user.driverInfo.id, time: time });

        let riderSocket = waitingRider.getSocket();

        ws.user.waitingRiders.splice(i, 1);
        waitingRider.setSearchingState();

        riderSocket.send(JSON.stringify({ messageId: messages.waitingDriverDisconnectedMessageId }));

        return ws.send(JSON.stringify({ messageId: messages.riderDeletedMessageId, riderId: message.riderId }));
    }

    ws.send(JSON.stringify({ messageId: messages.errorMessageId, error: config.unknownErrorMessage }));
};

messageHandlers[messages.newLocationMessageId] = (ws, world, message) => {
    
    ws.user.location.lat = message.lat;
    ws.user.location.lon = message.lon;

    for (let i = 0; i < ws.user.waitingRiders.length; i++) {

        let waitingRider = ws.user.waitingRiders[i];

        let distanceInMeters = geolib.getDistance(
                        {latitude: waitingRider.location.lat, longitude: waitingRider.location.long},
                        {latitude: ws.user.location.lat, longitude: ws.user.location.lon}
                    );

        if (distanceInMeters < 100) {

            if (waitingRider.sentDriverCloseMessage === false) {

                waitingRider.sentDriverCloseMessage = true;
                
                waitingRider.getSocket().send(JSON.stringify({ messageId: messages.driverCloseMessageId }));
            }
        }

        waitingRider.getSocket().send(JSON.stringify({ messageId: messages.driverLocationUpdateMessageId, lat: message.lat, lon: message.lon }));
    }
};

messageHandlers[messages.riderAcceptedMessageId] = (ws, world, message) => {

    if (message.riderId == null || message.riderId.length === 0)
        return;

    for (let i = 0; i < world.riders.length; i++) {

        if (world.riders[i].riderInfo.id != message.riderId)
            continue;

        let currentRider = world.riders[i];

        if (world.spamList[currentRider.riderInfo.id] != null) {

            let index = world.spamList[currentRider.riderInfo.id].indexOf(ws.user.driverInfo.id);

            if (index !== 1) {
                world.spamList[currentRider.riderInfo.id].splice(index, 1);
            }
        }
        
        let index = currentRider.waitingForDrivers.indexOf(ws.user);
        
        if (currentRider.driver == ws.user) {
            return;
        }

        if (index === -1) {
            return ws.send(JSON.stringify({ messageId: messages.riderAlreadyFoundDriverMessageId, riderId: message.riderId }));
        }

        currentRider.setWaitingState(ws.user);
        ws.user.waitingRiders.push(currentRider);

        currentRider.getSocket().send(JSON.stringify({
            messageId: messages.driverFoundAndAcceptedMessageId, 
            lat: ws.user.location.lat,
            lon: ws.user.location.lon
        }));

        ws.send(JSON.stringify({ messageId: messages.newPassengerRiderMessageId, riderId: message.riderId }));

        return;
    }

    return ws.send(JSON.stringify({ messageId: messages.riderCanceledRequestMessageId, riderId: message.riderId }));
};

messageHandlers[messages.riderRefusedMessageId] = (ws, world, message) => {

    if (message.riderId == null || message.riderId.length === 0)
        return;

    for (let i = 0; i < world.riders.length; i++) {
        
        if (world.riders[i].riderInfo.id != message.riderId) 
            continue;

        let currentRider = world.riders[i];

        let index = currentRider.waitingForDrivers.indexOf(ws.user);

        if (index === -1) break;

        currentRider.waitingForDrivers.splice(index, 1);
    }
};

messageHandlers[messages.driverChoseDestinationMessageId] = (ws, world, message) => {

    if (message.path == null || message.path.length == 0)
        return;

    let lastPoint = message.path[0];

    ws.user.destinationPath.length = 0;

    ws.user.destinationPath.push(lastPoint);
        
    for (let i = 1; i < message.path.length; i++) {

        let currentPoint = message.path[i];
        
        let distanceInMeters = geolib.getDistance(
            { latitude: lastPoint.lat, longitude: lastPoint.lon },
            { latitude: currentPoint.lat, longitude: currentPoint.lon }
        );

        if (distanceInMeters < 250)
            continue;

        if (distanceInMeters > 350) {
            generateAndAddCloserPoint(lastPoint, currentPoint, 250, ws.user.destinationPath);
            lastPoint = ws.user.destinationPath[ws.user.destinationPath.length-1];
        }
        else {
            ws.user.destinationPath.push(currentPoint);
            lastPoint = currentPoint;
        }
    }

//    ws.send(JSON.stringify({messageId: 1500, path : ws.user.destinationPath}));
};

function generateAndAddCloserPoint(head, tail, max, array) {

    let center = geolib.getCenter([
            { latitude: head.lat, longitude: head.lon },
            { latitude: tail.lat, longitude: tail.lon }
    ]);

    center.lat = center.latitude;
    center.lon = center.longitude;

    let distance = geolib.getDistance(
        { latitude: head.lat, longitude: head.lon },
        { latitude: center.lat, longitude: center.lon }
    );

    if (distance < max) {

        array.push(center);
        array.push(tail);

        return;        
    }

    generateAndAddCloserPoint(head, center, max, array);
    generateAndAddCloserPoint(center, tail, max, array);
}

messageHandlers[messages.driverRemovedDestinationMessageId] = (ws, world, message) => {

    ws.user.destinationPath.length = 0;
};

// Rider

messageHandlers[messages.riderAuthenticationMessageId] = (ws, world, message) => {


    return auth.ConnectRiderWS(message, (err, rider) => {

        if (err || message.dest == null || message.curr == null) {
            console.log(err);
            return ws.send(JSON.stringify({ messageId: messages.authenticationErrorMessageId, error: err}));
        }

        if (message.locAddress == null) {
            return ws.send(JSON.stringify({ messageId: messages.authenticationErrorMessageId, error: "Votre adresse actuelle est introuvable, veuillez réessayer" }));
        }

        if (message.destAddress == null) {
            return ws.send(JSON.stringify({ messageId: messages.authenticationErrorMessageId, error: "Adresse de destination introuvable, veuillez réessayer" }));
        }

        ws.currentConnectionState = 2;
        ws.user = new Rider(rider, ws);
        ws.user.address = message.address;
        ws.user.location = JSON.parse(message.curr);
        ws.user.destination = JSON.parse(message.dest);
        ws.user.destAddress = message.destAddress;
        ws.user.locAddress = message.locAddress;

        if (message.numRiders)
            ws.user.numRiders = message.numRiders;

        if (message.detour)
            ws.user.detour = message.detour;

        if (message.userChoice)
            ws.user.userChoice = message.userChoice;

        if (message.femaleOnly)
            ws.user.femaleOnly = message.femaleOnly;

        world.riders.push(ws.user);
        ws.send(JSON.stringify({ messageId : messages.authenticatedMessageId }));
    });
};

messageHandlers[messages.updateRiderLocationMessageId] = (ws, world, message) => {

    ws.user.location.long = message.long;
    ws.user.location.lat = message.lat;
    ws.user.location.acc = message.acc;

    console.log(ws.user.state);
    

    if (ws.user.state == 2 && message.acc < 40 ) { // waiting
        console.log("sending rider location");
        return ws.user.driver.getSocket().send(JSON.stringify({ messageId: messages.waitingRiderLocationUpdateMessageId, riderId: ws.user.riderInfo.id, lat: message.lat, lon: message.long }));
    } 
};

messageHandlers[messages.sendTaxiRequestMessageId] = (ws, world, message) => {

    if (message.driverId == null)
        return;

    let currentRider = ws.user;

    if (currentRider.state !== 1)
        return;

    if (currentRider.userChoice !== true)
        return;

    let currentDriver = null;

    for (let i = 0; i < world.drivers.length; i++) {
        
        if (world.drivers[i].driverInfo.id != message.driverId)
            continue;
        
        currentDriver = world.drivers[i];
    }

    if (currentDriver == null)
        return;

    let riderSpams = world.spamList[currentRider.riderInfo.id];

    if (riderSpams != null) {

        let isSpam = false;
        
        for (let ii = 0; ii < riderSpams.length; ii++) {
            
            if (riderSpams[ii].driver !== currentDriver.driverInfo.id)
                continue;
            
            let time = riderSpams[ii].time;
            
            if ((time - new Date()) > 0) {
                isSpam = true;
            }
            else {
                riderSpams.splice(ii, 1);
            }

            break;
        }

        if (isSpam)
            return;
    }

    if (currentDriver.isFull() || currentDriver.location.lat == null)
        return;
                     
    if (currentRider.numRiders + currentDriver.count() > 3)
        return;

    if (currentRider.femaleOnly == true) {

        let femaleCount = 0;
        let maleCount = 0;

        for (let i = 0; i < currentDriver.riders.length; i++) {

            if (currentDriver.riders[i].gender == "G")
                maleCount++;
            if (currentDriver.riders[i].gender == "F")
                femaleCount++;
        }

        for (let i = 0; i < currentDriver.waitingRiders.length; i++) {

            if (currentDriver.waitingRiders[i].gender == "G")
                maleCount++;
            if (currentDriver.waitingRiders[i].gender == "F")
                femaleCount++;
        }

        for (let i = 0; i < currentDriver.passengers.length; i++) {

            if (currentDriver.passengers[i].gender == "G")
                maleCount++;
            if (currentDriver.passengers[i].gender == "F")
                femaleCount++;
        }

        if (maleCount !== 0 && maleCount !== femaleCount)
            return;
    }

    if (world.spamList[currentRider.riderInfo.id] == null) {
        world.spamList[currentRider.riderInfo.id] = [];
    }

    let time = new Date();
    time.setMinutes(time.getMinutes() + 10);
    world.spamList[currentRider.riderInfo.id].push({ driver: currentDriver.driverInfo.id, time: time });

    if (currentRider.waitingForDrivers.indexOf(currentDriver) === -1)
        currentRider.waitingForDrivers.push(currentDriver);
    
    currentDriver.getSocket().send(JSON.stringify({ 
        messageId: messages.riderFoundMessageId,
        id: currentRider.riderInfo.id,
        firstName: currentRider.riderInfo.firstName,
        lastName: currentRider.riderInfo.lastName,
        locAddress: currentRider.locAddress,
        locationLat: currentRider.location.lat,
        locationLong: currentRider.location.long,
        destAddress: currentRider.destAddress,
        destinationLat: currentRider.destination.lat,
        destinationLong: currentRider.destination.long,
        numberRider: currentRider.numRiders,
        detour: currentRider.detour,
        gender: currentRider.riderInfo.gender
    }));
};

module.exports = messageHandlers;