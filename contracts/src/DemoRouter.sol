// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title DemoRouter
/// @notice Models a spender whose admin can move any asset users have approved to it.
/// @dev This is the risk Approval Guard surfaces: an approval outlives the trade it was
///      made for, so a compromised or malicious spender can still pull funds later.
contract DemoRouter is Ownable {
    using SafeERC20 for IERC20;

    constructor(address admin) Ownable(admin) {}

    function sweep(IERC20 token, address from, address to, uint256 amount) external onlyOwner {
        token.safeTransferFrom(from, to, amount);
    }

    function sweepNFT(IERC721 nft, address from, address to, uint256 tokenId) external onlyOwner {
        nft.transferFrom(from, to, tokenId);
    }
}
