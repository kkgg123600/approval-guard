// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20Errors, IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {DemoToken} from "../src/DemoToken.sol";
import {DemoNFT} from "../src/DemoNFT.sol";
import {DemoRouter} from "../src/DemoRouter.sol";

/// @notice Shows why stale approvals matter and that revoking them closes the exposure.
contract ApprovalRiskTest is Test {
    DemoToken token;
    DemoNFT nft;
    DemoRouter router;

    address user = makeAddr("user");
    address routerAdmin = makeAddr("routerAdmin");
    address attacker = makeAddr("attacker");

    function setUp() public {
        token = new DemoToken();
        nft = new DemoNFT();
        router = new DemoRouter(routerAdmin);
        token.mint(user, 1_000e18);
    }

    function test_unlimitedApproval_exposesFutureBalance() public {
        vm.prank(user);
        token.approve(address(router), type(uint256).max);

        // Funds received after the approval are exposed too.
        token.mint(user, 5_000e18);

        vm.prank(routerAdmin);
        router.sweep(token, user, attacker, 6_000e18);

        assertEq(token.balanceOf(user), 0);
        assertEq(token.balanceOf(attacker), 6_000e18);
    }

    function test_limitedApproval_capsExposure() public {
        vm.prank(user);
        token.approve(address(router), 100e18);

        vm.prank(routerAdmin);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), 100e18, 101e18)
        );
        router.sweep(token, user, attacker, 101e18);

        vm.prank(routerAdmin);
        router.sweep(token, user, attacker, 100e18);
        assertEq(token.balanceOf(attacker), 100e18);
    }

    function test_revokedApproval_blocksSweep() public {
        vm.startPrank(user);
        token.approve(address(router), type(uint256).max);
        token.approve(address(router), 0);
        vm.stopPrank();

        vm.prank(routerAdmin);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(router), 0, 1));
        router.sweep(token, user, attacker, 1);
    }

    function test_approvalForAll_exposesNftsMintedLater() public {
        vm.prank(user);
        nft.setApprovalForAll(address(router), true);

        uint256 laterId = nft.mint(user);

        vm.prank(routerAdmin);
        router.sweepNFT(nft, user, attacker, laterId);
        assertEq(nft.ownerOf(laterId), attacker);
    }

    function test_revokedApprovalForAll_blocksSweep() public {
        uint256 id = nft.mint(user);
        vm.startPrank(user);
        nft.setApprovalForAll(address(router), true);
        nft.setApprovalForAll(address(router), false);
        vm.stopPrank();

        vm.prank(routerAdmin);
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(router), id));
        router.sweepNFT(nft, user, attacker, id);
    }

    function test_onlyAdminCanSweep() public {
        vm.prank(user);
        token.approve(address(router), type(uint256).max);

        vm.prank(attacker);
        vm.expectRevert();
        router.sweep(token, user, attacker, 1);
    }
}
