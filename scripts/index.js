const modeCcipSync = require("./mode_ccip");
const modeHyperlaneSync = require("./mode_hyperlane");
const zoraCcipSync = require("./zora_ccip");
const zoraHyperlaneSync = require("./zora_hyperlane");

async function start() {
    modeCcipSync();
    modeHyperlaneSync();
    zoraCcipSync();
    zoraHyperlaneSync();
}

start();