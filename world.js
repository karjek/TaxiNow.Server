"use strict"

// research loop, likely to be executed in an other thread
// @Todo("refactor loop function")

let geolib = require("geolib");
let messages = require("./messages");

class World {

    constructor() {

        this.riders = [];
        this.drivers = [];
        this.spamList = {};
        
        this.timer = null;
        this.startLoop = () => {

            this.timer = setInterval(() => {

                if (this.riders.length == 0 || this.drivers.length == 0)
                    return;
                
                let worseCaseDrivers = [];
                
                for (let i = 0; i < this.riders.length; i++) {
                    
                    let currentRider = this.riders[i];

                    // not searching
                    if (currentRider.state !== 1)
                        continue;

                    worseCaseDrivers.length = 0;

                    if (currentRider.userChoice == true)
                        currentRider.userChoiceList.length = 0;
                    
                    let riderSpams = this.spamList[currentRider.riderInfo.id];

                    let driverFound = false;

                    for (let j = 0; j < this.drivers.length; j++) {
                        
                        let currentDriver = this.drivers[j];

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
                                continue;
                        }

                        if (currentDriver.isFull() || currentDriver.location.lat == null)
                            continue;
                     
                        if (currentRider.numRiders + currentDriver.count() > 3)
                            continue;
                        
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

                                if (currentDriver.passengers[i].gender == "M")
                                    maleCount++;
                                if (currentDriver.passengers[i].gender == "F")
                                    femaleCount++;
                            }
                            
                            if (maleCount !== 0 /*&& maleCount !== femaleCount*/)
                                continue;
                        }

                        if (currentDriver.destinationPath.length == 0 && currentDriver.count() > 1)
                            continue;

                        let distance = geolib.getDistance(
                                { latitude: currentDriver.location.lat, longitude: currentDriver.location.lon },
                                { latitude: currentRider.location.lat , longitude: currentRider.location.long }
                        );

                        if (distance > 1500)
                            continue;
                        
                        if (currentDriver.destinationPath.length === 0 && distance <= 250) {

                            worseCaseDrivers.push(currentDriver);

                            continue;
                        }

                        // check where the driver is in his path

                        let closest = 1000000;
                        let index = 0;

                        for (let k = 0; k < currentDriver.destinationPath.length; k++) {
                            
                            let currentPoint = currentDriver.destinationPath[k];

                            let distance = geolib.getDistance(
                                { latitude: currentDriver.location.lat, longitude: currentDriver.location.lon },
                                { latitude: currentPoint.lat , longitude: currentPoint.lon }
                            );

                            if (distance < closest) {
                                closest = distance;
                                index = k;
                            }
                        }
                        
                        for (let iter = index; iter < currentDriver.destinationPath.length; iter++) {
                            
                            let currentPoint = currentDriver.destinationPath[iter];

                            let distance = geolib.getDistance(
                                { latitude: currentRider.location.lat, longitude: currentRider.location.long },
                                { latitude: currentPoint.lat , longitude: currentPoint.lon }
                            );
                            
                            if (distance > 250)
                                continue;

                            for (let iter2 = iter; iter2 < currentDriver.destinationPath.length; iter2++) {
                                
                                let currentPoint2 = currentDriver.destinationPath[iter2];

                                let distance2 = geolib.getDistance(
                                    { latitude: currentRider.destination.lat, longitude: currentRider.destination.long },
                                    { latitude: currentPoint2.lat , longitude: currentPoint2.lon }
                                );
                                
                                if (distance2 > 250)
                                    continue;

                                console.log("sent it");
                                
                                driverFound = true;

                                if (currentRider.userChoice == true) {
                                    
                                    currentRider.userChoiceList.push(currentDriver);
                                }
                                else {
                                    
                                    if (this.spamList[currentRider.riderInfo.id] == null) {
                                        this.spamList[currentRider.riderInfo.id] = [];
                                    }

                                    let time = new Date();
                                    time.setMinutes(time.getMinutes() + 10);
                                    this.spamList[currentRider.riderInfo.id].push({ driver: currentDriver.driverInfo.id, time: time });

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
                                }

                                break;
                            }

                            break;
                        }
                    }

                    if (driverFound == true)
                    {
                        if (currentRider.userChoiceList.length !== 0) {
                            
                            let data = [];

                            for (let w = 0; w < currentRider.userChoiceList.length; w++) {
                                
                                let currentDriver = currentRider.userChoiceList[w];

                                let passengersGender = [];

                                currentDriver.passengers.forEach((p) => {
                                    passengersGender.push(p.gender);
                                });

                                currentDriver.riders.forEach((r) => {
                                    passengersGender.push(r.gender);
                                });
                                
                                currentDriver.waitingRiders.forEach((wr) => {
                                    passengersGender.push(wr.gender);
                                });

                                data.push({ 
                                        lat: currentDriver.location.lat, 
                                        lon: currentDriver.location.lon, 
                                        passengers: passengersGender, 
                                        driverId: currentDriver.driverInfo.id 
                                });
                            }

                            if (data.length != 0) {
                                currentRider.getSocket().send(JSON.stringify({
                                    messageId: messages.refreshTaxiChoiceListMessageId, 
                                    taxiInfos: data 
                                }));
                            }
                        }

                        continue;
                    }
                    
                    if (currentRider.userChoice == false) {

                        for (let w = 0; w < worseCaseDrivers.length; w++) {

                            let currentDriver = worseCaseDrivers[w];

                            if (this.spamList[currentRider.riderInfo.id] == null) {
                                    this.spamList[currentRider.riderInfo.id] = [];
                            }

                            let time = new Date();
                            time.setMinutes(time.getMinutes() + 10);
                            this.spamList[currentRider.riderInfo.id].push({ driver: currentDriver.driverInfo.id, time: time });

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
                        }
                    }
                    else {

                        let data = [];

                        for (let w = 0; w < worseCaseDrivers.length; w++) {
                            
                            let currentDriver = worseCaseDrivers[w];

                            let passengersGender = [];

                            currentDriver.passengers.forEach((p) => {
                                passengersGender.push(p.gender);
                            });

                            currentDriver.riders.forEach((r) => {
                                passengersGender.push(r.gender);
                            });
                            
                            currentDriver.waitingRiders.forEach((wr) => {
                                passengersGender.push(wr.gender);
                            });

                            data.push({ 
                                    lat: currentDriver.location.lat, 
                                    lon: currentDriver.location.lon, 
                                    passengers: passengersGender, 
                                    driverId: currentDriver.driverInfo.id 
                            });
                        }

                        if (data.length != 0) {
                            currentRider.getSocket().send(JSON.stringify({
                                    messageId: messages.refreshTaxiChoiceListMessageId, 
                                    taxiInfos: data 
                            }));
                        }
                    }
                }

            }, 5000);
        };

        this.stopLoop = () => {
            clearInterval(this.timer);
        }
    }
}

module.exports = World;