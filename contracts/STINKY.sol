// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract STINKY is ERC20, Ownable {
    mapping(address => uint256) public lastReceived;
    mapping(address => bool) public taxExcluded;

    address public minter;
    address public dev;
    uint8 public earlyTax = 20;

    modifier isMinter() {
        require(msg.sender == minter, "STINKY: not minter");
        _;
    }

    constructor(address _minter, address _dev) ERC20("STINKY", "STINKY") {
        // 1 billion tokens initial supply
        _mint(msg.sender, 1_000_000_000 ether);
        minter = _minter;
        dev = _dev;
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        if (!taxExcluded[sender]) {
            if (lastReceived[sender] > block.timestamp) {
                uint256 tax = (amount * earlyTax) / 100;
                amount -= tax;
                super._transfer(sender, dev, tax);
            }
        }
        super._transfer(sender, recipient, amount);
        lastReceived[recipient] = block.timestamp + 72 hours;
    }

    function mint(uint256 amount) external isMinter {
        _mint(msg.sender, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        uint allowance = allowance(account, msg.sender);
        require(allowance >= amount, "STINKY: burn amount exceeds allowance");
        _burn(account, amount);
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    function setDev(address _dev) external onlyOwner {
        dev = _dev;
    }
}
