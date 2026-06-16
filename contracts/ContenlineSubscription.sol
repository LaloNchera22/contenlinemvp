// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ContenlineSubscription
 * @notice Suscripciones en USDC. Cobra fee (default 10%) y transfiere el neto al creador.
 *         El estado onchain es la fuente de verdad que Supabase espejea.
 */
contract ContenlineSubscription is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public feeRecipient;

    uint256 public feeBps = 1000; // 10%
    uint256 public constant MAX_FEE_BPS = 1500; // límite 15%
    uint256 public constant BPS_DENOMINATOR = 10000;

    // subscriber => creator => expiración (timestamp)
    mapping(address => mapping(address => uint256)) public expiresAt;

    event Subscribed(
        address indexed subscriber,
        address indexed creator,
        uint256 planId,
        uint256 amount,
        uint256 fee,
        uint256 expiresAt
    );
    event FeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        require(_usdc != address(0) && _feeRecipient != address(0), "zero address");
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Suscribe a `creator` por `durationDays`. Requiere allowance previo de USDC.
     * @param creator      wallet del creador
     * @param planId       id del plan (vincula con Supabase)
     * @param durationDays duración en días
     * @param amount       monto total en USDC (6 decimales)
     */
    function subscribe(
        address creator,
        uint256 planId,
        uint256 durationDays,
        uint256 amount
    ) external nonReentrant {
        require(creator != address(0), "invalid creator");
        require(amount > 0, "amount=0");
        require(durationDays > 0, "duration=0");

        uint256 fee = (amount * feeBps) / BPS_DENOMINATOR;
        uint256 net = amount - fee;

        // Pull de fondos del suscriptor; reparto creador/fee.
        usdc.safeTransferFrom(msg.sender, creator, net);
        if (fee > 0) {
            usdc.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        // Extiende desde el mayor entre ahora y la expiración actual.
        uint256 current = expiresAt[msg.sender][creator];
        uint256 base = current > block.timestamp ? current : block.timestamp;
        uint256 newExpiry = base + (durationDays * 1 days);
        expiresAt[msg.sender][creator] = newExpiry;

        emit Subscribed(msg.sender, creator, planId, amount, fee, newExpiry);
    }

    /// @notice Fuente de verdad de suscripción para validación onchain.
    function isSubscribed(address subscriber, address creator)
        external
        view
        returns (bool active, uint256 expiry)
    {
        expiry = expiresAt[subscriber][creator];
        active = expiry > block.timestamp;
    }

    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "fee too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "zero address");
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }
}
