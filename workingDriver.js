"use strict"

class WorkingDriver {

    constructor(driverInfo, ws) {

        this.driverInfo = driverInfo;
        this.riders = [];
        this.passengers = []; // passenger : anonymous rider
        this.waitingRiders = [];
        this.location = {};
        this.destinationPath = [];

        this.isFull = () => {
            return this.count() >= 3;
        }

        this.getSocket = () => {
            return ws;
        };

        this.count = () => {
            
            let c = 0;

            for (let i = 0; i < this.waitingRiders.length; i++) {
                c += this.waitingRiders[i].numRiders;
            }

            return this.riders.length + c + this.passengers.length;
        }
    }
}

module.exports = WorkingDriver;
