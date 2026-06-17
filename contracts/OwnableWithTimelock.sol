// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OwnableWithTimelock
 * @notice Ownable + timelock de 48h para acciones administrativas sensibles
 *         (cambios de fee y de receptor de fee). El owner suele ser un multisig
 *         (Gnosis Safe); el timelock añade una segunda capa: aunque el multisig
 *         se vea comprometido, cualquier cambio de fee queda anunciado onchain con
 *         48h de antelación, dando margen a los usuarios para reaccionar/salir.
 *
 *         Patrón propuesta→ejecución vinculado al VALOR: el actionId incluye los
 *         parámetros exactos (keccak256(abi.encode(...))), así que el owner solo
 *         puede ejecutar el cambio que propuso, no uno distinto. Ejecutar consume
 *         la propuesta (no es reutilizable).
 */
abstract contract OwnableWithTimelock is Ownable {
    /// @notice Demora mínima entre proponer y ejecutar un cambio administrativo.
    uint256 public constant TIMELOCK_DELAY = 48 hours;

    // actionId => timestamp a partir del cual la propuesta puede ejecutarse.
    // 0 significa "sin propuesta vigente".
    mapping(bytes32 => uint256) public pendingActions;

    event FeeUpdateProposed(bytes32 indexed actionId, uint256 executeAfter);
    event FeeUpdateExecuted(bytes32 indexed actionId);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @dev Registra (o reemplaza) una propuesta y arranca su ventana de 48h.
    function _proposeAction(bytes32 actionId) internal {
        uint256 eta = block.timestamp + TIMELOCK_DELAY;
        pendingActions[actionId] = eta;
        emit FeeUpdateProposed(actionId, eta);
    }

    /// @dev Valida que la propuesta exista y su delay haya transcurrido; la consume.
    function _consumeAction(bytes32 actionId) internal {
        uint256 eta = pendingActions[actionId];
        require(eta != 0, "no proposal");
        require(block.timestamp >= eta, "timelock not elapsed");
        delete pendingActions[actionId];
        emit FeeUpdateExecuted(actionId);
    }
}
