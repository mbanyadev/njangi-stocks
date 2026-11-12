// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUsdc} from "../src/MockUsdc.sol";
import {NjangiStocksFactory} from "../src/NjangiStocksFactory.sol";

/// @notice Deploys Mock USDC and the Njangi Stocks factory.
///         Intended for Base Sepolia. Never commit a private key.
///         PRIVATE_KEY must be set in the environment, not in this repo.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        MockUsdc usdc = new MockUsdc();
        NjangiStocksFactory factory = new NjangiStocksFactory(address(usdc));
        vm.stopBroadcast();
        console.log("MockUsdc", address(usdc));
        console.log("NjangiStocksFactory", address(factory));
    }
}
