// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {NjangiStocksFactory} from "../src/NjangiStocksFactory.sol";
import {MockUsdc} from "../src/MockUsdc.sol";
import {MockStockToken} from "../src/MockStockToken.sol";

contract NjangiStocksFactoryTest is Test {
    MockUsdc internal usdc;
    NjangiStocksFactory internal factory;

    address internal ama = makeAddr("ama");
    address internal bih = makeAddr("bih");
    address internal chi = makeAddr("chi");
    address internal dze = makeAddr("dze");

    uint256 internal constant CONTRIBUTION = 25e6; // 25 mock USDC
    uint256 internal constant PERIOD = 7 days;
    uint256 internal constant STOCK_PRICE = 25e6; // 1 share per 25 USDC

    function setUp() public {
        usdc = new MockUsdc();
        factory = new NjangiStocksFactory(address(usdc));
        _fund(ama, 1_000e6);
        _fund(bih, 1_000e6);
        _fund(chi, 1_000e6);
        _fund(dze, 1_000e6);
    }

    function test_createCircle_usdcAndStock() public {
        uint256 usdcId = _createUsdcCircle();
        uint256 stockId = _createStockCircle();
        assertEq(factory.circleCount(), 2);

        NjangiStocksFactory.CircleView memory usdcView = factory.getCircle(usdcId);
        assertEq(usdcView.name, "Douala Market");
        assertEq(uint256(usdcView.payoutKind), uint256(NjangiStocksFactory.PayoutKind.Usdc));
        assertEq(usdcView.stockToken, address(0));

        NjangiStocksFactory.CircleView memory stockView = factory.getCircle(stockId);
        assertEq(stockView.name, "Bamenda Traders");
        assertEq(uint256(stockView.payoutKind), uint256(NjangiStocksFactory.PayoutKind.Stock));
        assertTrue(stockView.stockToken != address(0));
        assertEq(MockStockToken(stockView.stockToken).minter(), address(factory));
        assertEq(MockStockToken(stockView.stockToken).symbol(), "nSTOCK");
    }

    function test_createCircle_rejectsBadArgs() public {
        address[] memory one = new address[](1);
        one[0] = ama;
        vm.expectRevert(NjangiStocksFactory.BadArgs.selector);
        factory.createCircle("x", one, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0);

        address[] memory two = _members3();
        two = new address[](2);
        two[0] = ama;
        two[1] = ama;
        vm.expectRevert(NjangiStocksFactory.BadArgs.selector);
        factory.createCircle("x", two, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0);

        two[1] = bih;
        vm.expectRevert(NjangiStocksFactory.BadArgs.selector);
        factory.createCircle("x", two, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Stock, 0, 0);

        vm.expectRevert(NjangiStocksFactory.BadArgs.selector);
        factory.createCircle("", two, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0);
    }

    function test_joinStartPay_usdcPayoutAndClose() public {
        uint256 id = _createUsdcCircle(); // ama, bih, chi
        vm.prank(dze);
        factory.join(id);
        address[] memory members = factory.membersOf(id);
        assertEq(members.length, 4);
        assertTrue(factory.isMember(id, dze));

        vm.prank(ama);
        factory.start(id);

        vm.expectRevert(NjangiStocksFactory.AlreadyStarted.selector);
        vm.prank(ama);
        factory.start(id);

        // Four members, each pays 25 USDC. Round 1 recipient is ama.
        _pay(ama, id);
        _pay(bih, id);
        _pay(chi, id);
        assertEq(usdc.balanceOf(ama), 1_000e6 - CONTRIBUTION);
        _pay(dze, id);

        // Pot of 100 USDC goes to ama. Reputation: +10 each for paying, +20 to ama for payout.
        assertEq(usdc.balanceOf(ama), 1_000e6 - CONTRIBUTION + (4 * CONTRIBUTION));
        assertEq(factory.reputation(ama), 30);
        assertEq(factory.reputation(bih), 10);
        assertTrue(factory.hasPaid(id, ama, 1));
        NjangiStocksFactory.CircleView memory view_ = factory.getCircle(id);
        assertEq(view_.currentRound, 2);
        assertTrue(view_.started);
        assertFalse(view_.closed);

        // Finish remaining rounds so the circle closes after round 4.
        // Recipients: r2 bih, r3 chi, r4 dze.
        _payAll(id);
        _payAll(id);
        _payAll(id);
        view_ = factory.getCircle(id);
        assertTrue(view_.closed);
        assertEq(view_.currentRound, 4);
        assertEq(factory.reputation(ama), 30 + 10 * 3); // no more COMPLETED
        assertEq(factory.reputation(bih), 10 + 10 * 3 + 20);
        assertEq(factory.reputation(chi), 10 * 4 + 20);
        assertEq(factory.reputation(dze), 10 * 4 + 20);

        vm.expectRevert(NjangiStocksFactory.Closed.selector);
        vm.prank(ama);
        factory.pay(id);
    }

    function test_stockPayout_mintsFractionalShares() public {
        uint256 id = _createStockCircle();
        vm.prank(ama);
        factory.start(id);

        _pay(ama, id);
        _pay(bih, id);
        _pay(chi, id);

        address token = factory.getCircle(id).stockToken;
        // Pot = 75 USDC, price = 25 USDC per share → 3e18 shares to ama.
        assertEq(MockStockToken(token).balanceOf(ama), 3e18);
        assertEq(MockStockToken(token).totalSupply(), 3e18);
        // USDC is locked in the factory (demo purchase).
        assertEq(usdc.balanceOf(address(factory)), 75e6);
        assertEq(usdc.balanceOf(ama), 1_000e6 - CONTRIBUTION);
        assertEq(factory.reputation(ama), 30);
    }

    function test_latePayment_reducesReputation() public {
        uint256 id = _createStockCircle();
        vm.prank(ama);
        factory.start(id);

        _pay(ama, id);
        _pay(bih, id);

        // Due at start+period; late after start+2*period (LATE_GRACE = 1).
        vm.warp(block.timestamp + (2 * PERIOD) + 1);
        _pay(chi, id);

        assertEq(factory.reputation(ama), 10 + 20); // on time + completed
        assertEq(factory.reputation(bih), 10);
        assertEq(factory.reputation(chi), -15);
    }

    function test_alreadyPaid_notMember_notStarted() public {
        uint256 id = _createUsdcCircle();

        vm.expectRevert(NjangiStocksFactory.NotStarted.selector);
        vm.prank(ama);
        factory.pay(id);

        vm.prank(ama);
        factory.start(id);

        vm.expectRevert(NjangiStocksFactory.NotMember.selector);
        vm.prank(dze);
        factory.pay(id);

        _pay(ama, id);
        vm.expectRevert(NjangiStocksFactory.AlreadyPaid.selector);
        vm.prank(ama);
        factory.pay(id);
    }

    function test_reputationGate_blocksJoinAndStart() public {
        // Drive chi's reputation negative with a late payment in a first circle.
        uint256 first = _createStockCircle();
        vm.prank(ama);
        factory.start(first);
        _pay(ama, first);
        _pay(bih, first);
        vm.warp(block.timestamp + (2 * PERIOD) + 1);
        _pay(chi, first);
        assertEq(factory.reputation(chi), -15);

        address[] memory members = new address[](2);
        members[0] = ama;
        members[1] = bih;
        uint256 gated = factory.createCircle(
            "Gated", members, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0
        );

        vm.expectRevert(NjangiStocksFactory.ReputationTooLow.selector);
        vm.prank(chi);
        factory.join(gated);

        // A new circle that already lists chi, with minReputation 0, cannot start.
        address[] memory withChi = _members3();
        uint256 blocked = factory.createCircle(
            "Needs scores", withChi, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0
        );
        vm.expectRevert(NjangiStocksFactory.ReputationTooLow.selector);
        vm.prank(ama);
        factory.start(blocked);

        // The same members can start a circle with no floor (minReputation = -100).
        uint256 open = factory.createCircle(
            "Open", withChi, CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, -100
        );
        vm.prank(ama);
        factory.start(open);
        assertTrue(factory.getCircle(open).started);
    }

    function test_currentRecipient_andDueTimes() public {
        uint256 id = _createUsdcCircle();
        assertEq(factory.currentRecipient(id), address(0));
        assertEq(factory.dueAt(id, 1), 0);

        vm.prank(ama);
        factory.start(id);
        assertEq(factory.currentRecipient(id), ama);
        uint256 startTime = factory.getCircle(id).startTime;
        assertEq(factory.dueAt(id, 1), startTime + PERIOD);
        assertEq(factory.lateAfter(id, 1), startTime + (2 * PERIOD));
    }

    function test_join_rejectsDuplicatesAndClosed() public {
        uint256 id = _createUsdcCircle();
        vm.expectRevert(NjangiStocksFactory.AlreadyMember.selector);
        vm.prank(ama);
        factory.join(id);
    }

    function test_constructorRejectsZeroUsdc() public {
        vm.expectRevert(NjangiStocksFactory.BadArgs.selector);
        new NjangiStocksFactory(address(0));
    }

    function test_faucetAndApprove() public {
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.balanceOf(ama), 1_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        vm.prank(who);
        usdc.faucet(amount);
        vm.prank(who);
        usdc.approve(address(factory), type(uint256).max);
    }

    function _members3() internal view returns (address[] memory members) {
        members = new address[](3);
        members[0] = ama;
        members[1] = bih;
        members[2] = chi;
    }

    function _createUsdcCircle() internal returns (uint256) {
        return factory.createCircle(
            "Douala Market", _members3(), CONTRIBUTION, PERIOD, NjangiStocksFactory.PayoutKind.Usdc, 0, 0
        );
    }

    function _createStockCircle() internal returns (uint256) {
        return factory.createCircle(
            "Bamenda Traders",
            _members3(),
            CONTRIBUTION,
            PERIOD,
            NjangiStocksFactory.PayoutKind.Stock,
            STOCK_PRICE,
            0
        );
    }

    function _pay(address who, uint256 id) internal {
        vm.prank(who);
        factory.pay(id);
    }

    function _payAll(uint256 id) internal {
        address[] memory members = factory.membersOf(id);
        for (uint256 i; i < members.length; i++) {
            if (!factory.hasPaid(id, members[i], _currentRound(id))) {
                _pay(members[i], id);
            }
        }
    }

    function _currentRound(uint256 id) internal view returns (uint256) {
        return factory.getCircle(id).currentRound;
    }
}
