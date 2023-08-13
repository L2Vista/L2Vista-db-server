const storeDB = require("./storeDB");
const storeDBMockup = require("./storeDBMockup");
const storeDBTheGraph = require("./storeDBTheGraph");

async function start() {
    storeDB();
    storeDBMockup();
    storeDBTheGraph();
}

start();