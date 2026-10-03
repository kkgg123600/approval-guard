// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {DemoNFT} from "../src/DemoNFT.sol";
import {DemoRouter} from "../src/DemoRouter.sol";

/// @notice Deploys the demo contracts and leaves the broadcaster with a mix of live,
///         limited and already-revoked approvals for Approval Guard to find.
/// @dev Usage (anvil): forge script script/Seed.s.sol --rpc-url $RPC_URL --broadcast --private-key $PK
contract Seed is Script {
    // Arbitrary EOAs acting as spenders. No code is deployed at these addresses.
    address constant EOA_SPENDER = address(0xBEEF);
    address constant OLD_DEX = address(0xDE0);

    function run() external {
        vm.startBroadcast();
        address user = msg.sender;

        DemoToken token = new DemoToken();
        DemoNFT nft = new DemoNFT();
        DemoRouter router = new DemoRouter(user);
        DemoRouter oldRouter = new DemoRouter(user);

        token.mint(user, 10_000e18);
        uint256 id1 = nft.mint(user);
        nft.mint(user);
        nft.mint(user);

        // Live approvals the scanner must report.
        token.approve(address(router), type(uint256).max); // unlimited, contract spender
        token.approve(EOA_SPENDER, 250e18); // limited, EOA spender
        nft.approve(EOA_SPENDER, id1); // single-token approval
        nft.setApprovalForAll(address(router), true); // operator over the whole collection

        // Approvals that were revoked; the scanner must ignore them.
        token.approve(OLD_DEX, type(uint256).max);
        token.approve(OLD_DEX, 0);
        nft.setApprovalForAll(address(oldRouter), true);
        nft.setApprovalForAll(address(oldRouter), false);

        vm.stopBroadcast();

        console.log("user      ", user);
        console.log("DemoToken ", address(token));
        console.log("DemoNFT   ", address(nft));
        console.log("DemoRouter", address(router));
    }
}
