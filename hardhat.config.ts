import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const privateKeys = process.env.PRIVATE_KEY?.split(" ") ;

const config: HardhatUserConfig = {
  solidity: "0.8.19",
  networks: {
    hardhat: {
      chainId: 1337, // We set 1337 to make interacting with MetaMask simpler
      forking: {
        url: "https://eth.public-rpc.com",
        blockNumber: 15380054,
      }
    },
    testnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: privateKeys,
    }
  }
};

export default config;
