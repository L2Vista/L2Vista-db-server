require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {
      forking: {
        url: "https://api.wemix.com",
      }
    },
    wemix: {
      url: "https://api.wemix.com",
    },
    wemixtestnet: {
      url: "https://api.test.wemix.com",
    },
  }
};
