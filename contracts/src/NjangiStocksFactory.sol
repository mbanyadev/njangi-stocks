// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./IERC20.sol";
import {MockStockToken} from "./MockStockToken.sol";

/// @title Njangi Stocks
/// @notice A rotating savings circle on Base. Members pay a fixed USDC amount each
///         round. When everyone has paid, the pot goes to the member whose turn it
///         is, either as USDC or as mock fractional stock tokens (a testnet stand-in
///         for a tokenized stock, minted at a fixed demo price).
/// @dev Demo / Base Sepolia only. This is not an offer of securities and is not
///      available to US persons. Production would need legal review and a real
///      tokenized-stock venue, plus a proper US-person block that this contract
///      cannot enforce on its own.
contract NjangiStocksFactory {
    enum PayoutKind {
        Usdc,
        Stock
    }

    struct Circle {
        string name;
        address[] members;
        uint256 contribution;
        uint256 period;
        uint256 startTime;
        uint256 currentRound;
        PayoutKind payoutKind;
        address stockToken;
        uint256 stockPrice; // USDC units (same decimals as usdc) per 1e18 stock
        bool started;
        bool closed;
    }

    IERC20 public immutable usdc;
    address public immutable owner;

    Circle[] public circles;
    // circleId => member => last paid round (0 = never, rounds are 1-indexed)
    mapping(uint256 => mapping(address => uint256)) public paidRound;
    // circleId => round => amount of USDC collected
    mapping(uint256 => mapping(uint256 => uint256)) public collected;
    mapping(address => int256) public reputation;

    int256 public constant ON_TIME = 10;
    int256 public constant LATE = -15;
    int256 public constant COMPLETED = 20;
    uint256 public constant LATE_GRACE = 1; // periods after due before a payment is late

    event CircleCreated(uint256 indexed id, string name, address indexed creator, PayoutKind payoutKind);
    event Joined(uint256 indexed id, address indexed member);
    event Started(uint256 indexed id, uint256 startTime);
    event Paid(uint256 indexed id, address indexed member, uint256 round, bool late);
    event PaidOut(uint256 indexed id, uint256 round, address indexed recipient, PayoutKind kind, uint256 amount);
    event ReputationChanged(address indexed member, int256 delta, int256 total);

    error BadArgs();
    error NotMember();
    error AlreadyMember();
    error AlreadyPaid();
    error NotStarted();
    error AlreadyStarted();
    error Closed();
    error RoundNotReady();
    error TransferFailed();

    constructor(address usdc_) {
        if (usdc_ == address(0)) revert BadArgs();
        usdc = IERC20(usdc_);
        owner = msg.sender;
    }

    function circleCount() external view returns (uint256) {
        return circles.length;
    }

    function membersOf(uint256 id) external view returns (address[] memory) {
        return circles[id].members;
    }

    function getCircle(uint256 id)
        external
        view
        returns (
            string memory name,
            uint256 memberCount,
            uint256 contribution,
            uint256 period,
            uint256 startTime,
            uint256 currentRound,
            PayoutKind payoutKind,
            address stockToken,
            uint256 stockPrice,
            bool started,
            bool closed
        )
    {
        Circle storage c = circles[id];
        return (
            c.name,
            c.members.length,
            c.contribution,
            c.period,
            c.startTime,
            c.currentRound,
            c.payoutKind,
            c.stockToken,
            c.stockPrice,
            c.started,
            c.closed
        );
    }

    /// @param stockPrice_ USDC (token units) required to mint 1e18 of the mock stock.
    ///                    Ignored when payoutKind is Usdc; pass 0.
    function createCircle(
        string calldata name_,
        address[] calldata members_,
        uint256 contribution_,
        uint256 period_,
        PayoutKind payoutKind_,
        uint256 stockPrice_
    ) external returns (uint256 id) {
        if (bytes(name_).length == 0 || members_.length < 2 || contribution_ == 0 || period_ == 0) {
            revert BadArgs();
        }
        if (payoutKind_ == PayoutKind.Stock && stockPrice_ == 0) revert BadArgs();
        _unique(members_);

        id = circles.length;
        address stock;
        if (payoutKind_ == PayoutKind.Stock) {
            MockStockToken token = new MockStockToken(
                string.concat(name_, " Share"),
                "nSTOCK",
                address(this)
            );
            stock = address(token);
        }

        Circle storage c = circles.push();
        c.name = name_;
        c.contribution = contribution_;
        c.period = period_;
        c.payoutKind = payoutKind_;
        c.stockToken = stock;
        c.stockPrice = stockPrice_;
        for (uint256 i; i < members_.length; i++) {
            c.members.push(members_[i]);
        }

        emit CircleCreated(id, name_, msg.sender, payoutKind_);
    }

    function join(uint256 id) external {
        Circle storage c = circles[id];
        if (c.started || c.closed) revert AlreadyStarted();
        if (_indexOf(c.members, msg.sender) >= 0) revert AlreadyMember();
        c.members.push(msg.sender);
        emit Joined(id, msg.sender);
    }

    function start(uint256 id) external {
        Circle storage c = circles[id];
        if (c.started) revert AlreadyStarted();
        if (c.members.length < 2) revert BadArgs();
        if (_indexOf(c.members, msg.sender) < 0) revert NotMember();
        c.started = true;
        c.startTime = block.timestamp;
        c.currentRound = 1;
        emit Started(id, c.startTime);
    }

    function pay(uint256 id) external {
        Circle storage c = circles[id];
        if (!c.started) revert NotStarted();
        if (c.closed) revert Closed();
        if (_indexOf(c.members, msg.sender) < 0) revert NotMember();

        uint256 round = c.currentRound;
        if (paidRound[id][msg.sender] >= round) revert AlreadyPaid();

        if (!usdc.transferFrom(msg.sender, address(this), c.contribution)) revert TransferFailed();
        paidRound[id][msg.sender] = round;
        collected[id][round] += c.contribution;

        bool late = block.timestamp > c.startTime + (round * c.period) + (c.period * LATE_GRACE);
        int256 delta = late ? LATE : ON_TIME;
        reputation[msg.sender] += delta;
        emit ReputationChanged(msg.sender, delta, reputation[msg.sender]);
        emit Paid(id, msg.sender, round, late);

        if (collected[id][round] == c.contribution * c.members.length) {
            _payout(id, c);
        }
    }

    function currentRecipient(uint256 id) public view returns (address) {
        Circle storage c = circles[id];
        if (c.currentRound == 0 || c.members.length == 0) return address(0);
        uint256 idx = (c.currentRound - 1) % c.members.length;
        return c.members[idx];
    }

    function _payout(uint256 id, Circle storage c) internal {
        address recipient = currentRecipient(id);
        uint256 pot = collected[id][c.currentRound];

        if (c.payoutKind == PayoutKind.Usdc) {
            if (!usdc.transfer(recipient, pot)) revert TransferFailed();
            emit PaidOut(id, c.currentRound, recipient, PayoutKind.Usdc, pot);
        } else {
            // Demo "purchase": lock USDC in this contract and mint stock at the fixed price.
            uint256 shares = (pot * 1e18) / c.stockPrice;
            MockStockToken(c.stockToken).mint(recipient, shares);
            emit PaidOut(id, c.currentRound, recipient, PayoutKind.Stock, shares);
        }

        reputation[recipient] += COMPLETED;
        emit ReputationChanged(recipient, COMPLETED, reputation[recipient]);

        if (c.currentRound >= c.members.length) {
            c.closed = true;
        } else {
            c.currentRound += 1;
        }
    }

    function _indexOf(address[] storage members, address who) internal view returns (int256) {
        for (uint256 i; i < members.length; i++) {
            if (members[i] == who) return int256(i);
        }
        return -1;
    }

    function _unique(address[] calldata members_) internal pure {
        for (uint256 i; i < members_.length; i++) {
            if (members_[i] == address(0)) revert BadArgs();
            for (uint256 j = i + 1; j < members_.length; j++) {
                if (members_[i] == members_[j]) revert BadArgs();
            }
        }
    }
}
