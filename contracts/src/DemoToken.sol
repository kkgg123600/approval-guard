// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DemoToken
/// @notice ERC-20 used to create realistic approval state on a local or test network.
/// @dev Open minting is intentional: this token exists only for demos and tests.
contract DemoToken is ERC20 {
    constructor() ERC20("Demo USD", "dUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
