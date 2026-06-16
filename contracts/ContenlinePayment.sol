// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ContenlinePayment
 * @notice Pagos únicos en USDC para cursos / servicios / API onchain.
 *         category: 0=course(10%), 1=service(3%), 2=onchain(3%).
 *         Previene replay vinculando cada sessionId de Supabase.
 */
contract ContenlinePayment is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public feeRecipient;

    uint256 public constant BPS_DENOMINATOR = 10000;
    // fees por categoría en bps
    uint16[3] public feeBps = [1000, 300, 300]; // course 10%, service 3%, onchain 3%

    mapping(string => bool) public processed; // sessionId => procesado

    event PaymentCompleted(
        address indexed from,
        address indexed to,
        string sessionId,
        uint256 amount,
        uint256 fee,
        uint8 category
    );
    event FeeUpdated(uint8 category, uint16 newFeeBps);

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        require(_usdc != address(0) && _feeRecipient != address(0), "zero address");
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Paga a `creator` por una sesión. Requiere allowance previo de USDC.
     * @param creator   wallet del creador
     * @param sessionId id de la payment session en Supabase (único)
     * @param category  0=course, 1=service, 2=onchain
     * @param amount    monto en USDC (6 decimales)
     */
    function pay(
        address creator,
        string calldata sessionId,
        uint8 category,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        require(creator != address(0), "invalid creator");
        require(amount > 0, "amount=0");
        require(category < 3, "invalid category");
        require(bytes(sessionId).length > 0, "empty session");
        require(!processed[sessionId], "session already processed");

        processed[sessionId] = true;

        uint256 fee = (amount * feeBps[category]) / BPS_DENOMINATOR;
        uint256 net = amount - fee;

        usdc.safeTransferFrom(msg.sender, creator, net);
        if (fee > 0) {
            usdc.safeTransferFrom(msg.sender, feeRecipient, fee);
        }

        emit PaymentCompleted(msg.sender, creator, sessionId, amount, fee, category);
    }

    function setFeeBps(uint8 category, uint16 _feeBps) external onlyOwner {
        require(category < 3, "invalid category");
        require(_feeBps <= 1500, "fee too high"); // máx 15%
        feeBps[category] = _feeBps;
        emit FeeUpdated(category, _feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "zero address");
        feeRecipient = _recipient;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
