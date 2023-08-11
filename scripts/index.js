const modeCcipSync = require("./mode_ccip");
const modeHyperlaneSync = require("./mode_hyperlane");

async function start() {
    modeCcipSync();
    modeHyperlaneSync();
}

start();