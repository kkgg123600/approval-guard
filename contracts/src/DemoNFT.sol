// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title DemoNFT
/// @notice ERC-721 used to create per-token and operator approvals for the scanner.
/// @dev Open minting is intentional: this collection exists only for demos and tests.
contract DemoNFT is ERC721 {
    uint256 public nextTokenId = 1;

    constructor() ERC721("Demo NFT", "DNFT") {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
    }
}
