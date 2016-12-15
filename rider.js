"use strict"

class Rider {

    constructor(rider, ws) {

        this.riderState = {
            Searching: 1,
            WaitingDriver: 2,
            Riding: 3,
            Done: 4
        }

        this.riderInfo = rider;
        this.location = null;
        this.destination = null;
        this.state = this.riderState.Searching;
        this.driver = null;
        this.locAddress = null;
        this.destAddress = null;
        this.waitingForDrivers = []; // drivers to accept
        this.sentDriverCloseMessage = false;
        this.numRiders = 1;
        this.detour = true;
        this.userChoice = false;
        this.femaleOnly = false;
        this.userChoiceList = [];

        this.getSocket = () => {
            return ws;
        };

        this.setWaitingState = (driver) => {
            this.driver = driver;
            this.state = 2;
            this.sentDriverCloseMessage = false;
            this.waitingForDrivers.length = 0;
        };

        this.setSearchingState = () => {
            this.driver = null;
            this.state = this.riderState.Searching;
            this.waitingForDrivers.length = 0;
        }
    }
}

module.exports = Rider;
