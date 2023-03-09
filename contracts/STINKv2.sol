// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "./interfaces/IUniswap.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract STINKv2 is ERC20, Ownable {
    mapping(address => bool) public taxExempt;
    mapping(address => bool) public pair;

    address public marketing;
    address public vault;
    address public liquidityVault;

    uint public liquidityFee;
    uint public marketingFee;

    uint public sellThreshold;

    uint public totalLiquidity;
    uint public totalStaking;
    uint public totalMarketing;

    // Taxes are: Marketing, Liquidity, Staking
    uint8[3] public buyTaxes = [1, 1, 1];
    uint8[3] public sellTaxes = [2, 1, 3];

    IUniswapV2Router02 public router;
    IUniswapV2Pair public mainPair;

    bool public swapping = false;

    event SwapAndLiquify(
        uint tokensSwapped,
        uint ethReceived,
        uint tokensIntoLiqudity
    );

    modifier lockTheSwap() {
        swapping = true;
        _;
        swapping = false;
    }

    constructor(
        address _marketing,
        address _vault,
        address _liquidityVault
    ) ERC20("STINKv2", "STINKv2") {
        _mint(msg.sender, 1_000_000_000 ether);
        sellThreshold = 100 ether;
        // SET DEFAULT INIT PAIR
        router = IUniswapV2Router02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
        IUniswapV2Factory pancakeFactory = IUniswapV2Factory(router.factory());
        address bnbPair = pancakeFactory.createPair(
            address(this),
            router.WETH()
        );
        mainPair = IUniswapV2Pair(bnbPair);
        pair[bnbPair] = true;

        taxExempt[msg.sender] = true;
        marketing = _marketing;
        vault = _vault;
        liquidityVault = _liquidityVault;
    }

    /// @notice Allowed to receive ETH
    receive() external payable {}

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        uint balance = balanceOf(address(this));
        if (balance > sellThreshold && !swapping) {
            distributeFees(balance);
        }

        if (swapping || taxExempt[sender] || taxExempt[recipient]) {
            super._transfer(sender, recipient, amount);
        } else {
            uint fees = getFees(sender, recipient, amount);
            amount -= fees;
            super._transfer(sender, recipient, amount);
        }
    }

    function distributeFees(uint amount) private lockTheSwap {
        uint totalFees = marketingFee + liquidityFee;

        uint mkt = marketingFee;
        uint liq = liquidityFee;

        if (totalFees != amount) {
            mkt = (marketingFee * amount) / totalFees;
            liq = amount - mkt;
        }
        if (liq > 0) {
            _swapAndLiquify(liq);
            liq = 0; // reset just in case
            liquidityFee = 0;
        }
        if (mkt > 0) {
            _swapForEth(mkt);
            liq = address(this).balance;
            totalMarketing += address(this).balance;
            marketingFee = 0;
        }
        // Send ETH to marketing wallet
        if (liq > 0) {
            (bool succ, ) = payable(marketing).call{
                value: address(this).balance
            }("");
            require(succ, "Marketing transfer failed");
        }
    }

    /// @notice Swap half tokens for ETH and create liquidity internally
    /// @param tokens Amount of tokens to swap
    function _swapAndLiquify(uint tokens) private {
        uint half = tokens / 2;
        uint otherHalf = tokens - half;

        uint initialBalance = address(this).balance;

        _swapForEth(half);

        uint newBalance = address(this).balance - initialBalance;

        _approve(address(this), address(router), otherHalf);
        (, , uint liquidity) = router.addLiquidityETH{value: newBalance}(
            address(this),
            otherHalf,
            0,
            0,
            liquidityVault,
            block.timestamp
        );

        totalLiquidity += liquidity;

        emit SwapAndLiquify(half, newBalance, liquidity);
    }

    /// @notice Swap tokens for ETH
    function _swapForEth(uint tokens) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        _approve(address(this), address(router), tokens);

        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokens,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function getFees(
        address sender,
        address recipient,
        uint256 amount
    ) internal returns (uint totalFee) {
        uint mktFee;
        uint liqFee;
        uint stakingFee;
        // BUY transaction
        if (pair[sender]) {
            mktFee += (amount * buyTaxes[0]) / 100;
            liqFee += (amount * buyTaxes[1]) / 100;
            stakingFee += (amount * buyTaxes[2]) / 100;
            totalFee = mktFee + liqFee + stakingFee;
            marketingFee += mktFee;
            liquidityFee += liqFee;
            totalStaking += stakingFee;
            super._transfer(sender, vault, stakingFee);
            super._transfer(sender, address(this), mktFee + liqFee);
        }
        // SELL transaction
        else if (pair[recipient]) {
            mktFee += (amount * sellTaxes[0]) / 100;
            liqFee += (amount * sellTaxes[1]) / 100;
            stakingFee += (amount * sellTaxes[2]) / 100;
            totalFee = mktFee + liqFee + stakingFee;
            marketingFee += mktFee;
            liquidityFee += liqFee;
            super._transfer(sender, address(this), mktFee + liqFee);
            super._transfer(sender, vault, stakingFee);
        }
        // DO NOTHING IF NONE
        else return 0;
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        require(
            amount <= allowance(account, msg.sender),
            "STINKv2: Not enough allowance"
        );
        uint256 decreasedAllowance = allowance(account, msg.sender) - amount;
        _approve(account, msg.sender, decreasedAllowance);
        _burn(account, amount);
    }

    function setTaxExempt(address account, bool exempt) external onlyOwner {
        require(account != address(0), "STINKv2: zero address");
        taxExempt[account] = exempt;
    }

    function setMarketingWallet(address account) external onlyOwner {
        require(account != address(0), "STINKv2: zero address");
        marketing = account;
    }

    function setVaultAddress(address account) external onlyOwner {
        require(account != address(0), "STINKv2: zero address");
        vault = account;
    }

    function setLiquidityVaultAddress(address account) external onlyOwner {
        require(account != address(0), "STINKv2: zero address");
        liquidityVault = account;
    }

    ///@notice get tokens sent "mistakenly" to the contract
    ///@param _token Address of the token to be recovered
    function recoverToken(address _token) external {
        require(_token != address(this), "Cannot withdraw SELF");
        uint256 balance = IERC20(_token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(IERC20(_token).transfer(marketing, balance), "Transfer failed");
    }

    /// @notice recover ETH sent to the contract
    function recoverETH() external {
        (bool succ, ) = payable(marketing).call{value: address(this).balance}(
            ""
        );
        require(succ, "ETH transfer failed");
    }
}
