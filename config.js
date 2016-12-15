module.exports = {
    unknownErrorMessage: "Une erreur s'est produite",
    db: {
        connectionString: "mongodb://localhost/TaxiNowDb"
    },
    jwt: {
        expiresRider: "120d",
        expiresDriver: "7d",
        secret: "482763H0ZE?VSGJD",
        driverSecret: "52045H0PN*BSWJD"
    },
    http: {
        port: 8080,
    },
    google: {
         clientId: "",
         secret: "",
         redirectUrl: "http://localhost:8080"
    },
    facebook: {
        graphUrl: "https://graph.facebook.com/me?fields=gender,name,email,picture&access_token="
    }
};
