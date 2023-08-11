const modeCcipSync = require("./mode_ccip");
const modeHyperlaneSync = require("./mode_hyperlane");
const zoraCcipSync = require("./zora_ccip");
const zoraHyperlaneSync = require("./zora_hyperlane");
const opCcipSync = require("./op_ccip");
const opHyperlaneSync = require("./op_hyperlane");
const baseCcipSync = require("./base_ccip");
const baseHyperlaneSync = require("./base_hyperlane");

async function start() {
    //mode
    modeCcipSync();
    modeHyperlaneSync();
    //zora
    zoraCcipSync();
    zoraHyperlaneSync();
    //op
    opCcipSync();
    opHyperlaneSync();
    //base
    baseCcipSync();
    baseHyperlaneSync();
}

start();