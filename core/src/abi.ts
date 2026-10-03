import { parseAbi } from "viem";

// Only the functions the scanner needs. ERC-20 and ERC-721 share the `approve`
// name with different meanings, so each standard gets its own ABI.
export const erc20Abi = parseAbi([
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export const erc721Abi = parseAbi([
  "function getApproved(uint256 tokenId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function symbol() view returns (string)",
]);

// `approve(address,uint256)` has the same selector in ERC-20 and ERC-721
// (spender+amount vs to+tokenId), so one ABI covers every revoke transaction.
export const revokeAbi = parseAbi([
  "function approve(address spenderOrTo, uint256 amountOrTokenId)",
  "function setApprovalForAll(address operator, bool approved)",
]);
