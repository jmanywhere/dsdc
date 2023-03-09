import { expect } from "chai";
import  hre, { ethers } from 'hardhat';
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers/lib/utils";

describe("STINKv2", function () {
  const initBalance = parseUnits("1000000000", "ether");

  async function setup() {
    const [owner, user1, user2, user3, marketing, vault, liquidity] = await ethers.getSigners();
    const testTokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await testTokenFactory.deploy();
    await testToken.deployed();
    const stinkFactory = await ethers.getContractFactory("STINKv2");
    const STINK = await stinkFactory.deploy(marketing.address, vault.address, liquidity.address);
    await STINK.deployed();
    const router = await ethers.getContractAt("IUniswapV2Router02", await STINK.router());
    return { owner, user1, user2, user3, marketing, liquidity, vault, STINK, testToken, router };
  }

  describe("ERC Basic tests", function (){
    it("Should return the name", async function () {
      const { STINK } = await loadFixture(setup);
      expect(await STINK.name()).to.equal("STINKv2");
    });
    it("Should return the symbol", async function () {
      const { STINK } = await loadFixture(setup);
      expect(await STINK.symbol()).to.equal("STINKv2");
    });
    it("Should return the decimals", async function () {
      const { STINK } = await loadFixture(setup);
      expect(await STINK.decimals()).to.equal(18);
    });
    it("Should return the total supply", async function () {
      const { STINK } = await loadFixture(setup);
      expect(await STINK.totalSupply()).to.equal(initBalance);
    });
    it("Should return the balance of the owner", async function () {
      const { STINK, owner } = await loadFixture(setup);
      expect(await STINK.balanceOf(owner.address)).to.equal(initBalance);
    });
    it("Should approve allowance", async function () {
      const { STINK, owner, user1 } = await loadFixture(setup);
      await STINK.connect(owner).approve(user1.address, initBalance);
      expect(await STINK.connect(owner).allowance(owner.address, user1.address)).to.equal(initBalance);
    });
    it("Should increase allowance", async function () {
      const { STINK, owner, user1 } = await loadFixture(setup);
      await STINK.connect(owner).increaseAllowance(user1.address, 100);
      expect(await STINK.allowance(owner.address, user1.address)).to.equal(100);
    });
    it("Should decrease allowance", async function () {
      const { STINK, owner, user1 } = await loadFixture(setup);
      await STINK.connect(owner).approve(user1.address, 200);
      await STINK.connect(owner).decreaseAllowance(user1.address, 100);
      expect(await STINK.allowance(owner.address, user1.address)).to.equal(100);
    });
    it("Should burn tokens", async function () {
      const { STINK, owner } = await loadFixture(setup);
      await STINK.connect(owner).burn(100);
      expect(await STINK.balanceOf(owner.address)).to.equal(initBalance.sub(100));
    });
  });

  describe("Owner functions", function (){
    it("Should set tax exempt status if owner", async function () {
      const { STINK, owner, user1 } = await loadFixture(setup);
      // Base case
      expect( await STINK.taxExempt(user1.address)).to.equal(false);
      // expect reversion
      await expect(STINK.connect(user1).setTaxExempt(user1.address, true)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(STINK.connect(owner).setTaxExempt(ethers.constants.AddressZero, true)).to.be.revertedWith("STINKv2: zero address");
      // set status
      await STINK.connect(owner).setTaxExempt(user1.address, true);
      expect( await STINK.taxExempt(user1.address)).to.equal(true);
      // remove the status
      expect( await STINK.taxExempt(owner.address)).to.equal(true);
      await STINK.connect(owner).setTaxExempt(owner.address, false);
      expect( await STINK.taxExempt(owner.address)).to.equal(false);
    })
    it("Should set marketing wallet if owner", async function () {
      const { STINK, owner, user1, marketing } = await loadFixture(setup);
      // Base case
      expect( await STINK.marketing()).to.equal(marketing.address);
      // expect reversion
      await expect(STINK.connect(user1).setMarketingWallet(user1.address)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(STINK.connect(owner).setMarketingWallet(ethers.constants.AddressZero)).to.be.revertedWith("STINKv2: zero address");
      // set the wallet
      await STINK.connect(owner).setMarketingWallet(user1.address);
      expect( await STINK.marketing()).to.equal(await user1.getAddress());
    })
    it("Should set vault address if owner", async function () {
      const { STINK, owner, user1, vault } = await loadFixture(setup);
      // Base case
      expect( await STINK.vault()).to.equal(vault.address);
      // expect reversion
      await expect(STINK.connect(user1).setVaultAddress(user1.address)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(STINK.connect(owner).setVaultAddress(ethers.constants.AddressZero)).to.be.revertedWith("STINKv2: zero address");
      // set the wallet
      await STINK.connect(owner).setVaultAddress(user1.address);
      expect( await STINK.vault()).to.equal(await user1.getAddress());
    })
    it("Should set liquidityVault address if owner", async function () {
      const { STINK, owner, user1, liquidity } = await loadFixture(setup);
      // Base case
      expect( await STINK.liquidityVault()).to.equal(liquidity.address);
      // expect reversion
      await expect(STINK.connect(user1).setLiquidityVaultAddress(user1.address)).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(STINK.connect(owner).setLiquidityVaultAddress(ethers.constants.AddressZero)).to.be.revertedWith("STINKv2: zero address");
      // set the wallet
      await STINK.connect(owner).setLiquidityVaultAddress(user1.address);
      expect( await STINK.liquidityVault()).to.equal(await user1.getAddress());
    })
  })

  describe("Recovery functions", () => {
    it("Should recover any tokens sent to the contract", async ()=> {
      const { STINK, owner, user1, testToken, marketing } = await loadFixture(setup);
      // Reversions
      await expect(STINK.connect(user1).recoverToken(testToken.address)).to.be.revertedWith("No tokens to withdraw");
      await expect(STINK.connect(user1).recoverToken(STINK.address)).to.be.revertedWith("Cannot withdraw SELF");
      // Transfer tokens to the contract
      await testToken.connect(owner).transfer(STINK.address, 100);
      expect(await testToken.balanceOf(STINK.address)).to.equal(100);
      // Recover tokens
      await STINK.connect(user1).recoverToken(testToken.address);
      expect(await testToken.balanceOf(STINK.address)).to.equal(0);
      expect(await testToken.balanceOf(marketing.address)).to.equal(100);
    })
    it("Should recover ETH sent to the contract", async ()=> {
      const { STINK, user1, marketing } = await loadFixture(setup);
      // Transfer ETH to the contract
      await user1.sendTransaction({to: STINK.address, value: 100});
      expect(await ethers.provider.getBalance(STINK.address)).to.equal(100);

      const marketingBalance = await ethers.provider.getBalance(marketing.address);
      // Recover ETH
      await STINK.connect(user1).recoverETH();
      expect(await ethers.provider.getBalance(STINK.address)).to.equal(0);
      expect(await ethers.provider.getBalance(marketing.address)).to.equal(marketingBalance.add(100));
    })
  })

  describe("Liquidity functions", () => {
    it("Should add liquidity to the pool", async ()=> {
      const { STINK, owner, router } = await loadFixture(setup);
      const tokenAmount = parseUnits("100000", "ether");
      const ethAmount = parseUnits("100", "ether");
      // Reversions
      await expect(router.connect(owner).addLiquidityETH(STINK.address, tokenAmount, tokenAmount, ethAmount, owner.address,(await time.latest())+3600, { value: ethAmount } ))
        .to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
      // Approve the router
      await STINK.connect(owner).approve(router.address, tokenAmount);
      // Add liquidity
      await router.connect(owner).addLiquidityETH(STINK.address, tokenAmount, tokenAmount, ethAmount, owner.address,(await time.latest())+3600, { value: ethAmount } );

      const pair = await ethers.getContractAt("IUniswapV2Pair", await STINK.mainPair());
      // Check balances
      expect(await STINK.balanceOf(pair.address)).to.equal(tokenAmount);
      // reserve1 is WETH
      expect((await pair.getReserves()).reserve1).to.equal(ethAmount);
      expect( await pair.totalSupply()).to.be.greaterThan(0);
    })
    it("Should remove liquidity from the pool", async ()=> {
      const { STINK, owner, router } = await loadFixture(setup);
      const tokenAmount = parseUnits("100", "ether");
      const ethAmount = parseUnits("1", "ether");
      // Approve the router
      await STINK.connect(owner).approve(router.address, tokenAmount);
      // Add liquidity
      await router.connect(owner).addLiquidityETH(STINK.address, tokenAmount, tokenAmount, ethAmount, owner.address,(await time.latest())+3600, { value: ethAmount } );

      const pair = await ethers.getContractAt("IUniswapV2Pair", await STINK.mainPair());
      const liquidityOwned = await pair.balanceOf(owner.address);
      await pair.connect(owner).approve(router.address, liquidityOwned)
      // Remove liquidity
      await router.connect(owner).removeLiquidityETHSupportingFeeOnTransferTokens(STINK.address, liquidityOwned, 0, 0, owner.address,(await time.latest())+3600);
      // Check balances
      expect(await pair.totalSupply()).to.be.lessThan(10000);
    })
  })

  async function liquiditySetup () {
    const [owner, user1, user2, user3, marketing, vault, liquidity] = await ethers.getSigners();
    const testTokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await testTokenFactory.deploy();
    await testToken.deployed();
    const stinkFactory = await ethers.getContractFactory("STINKv2");
    const STINK = await stinkFactory.deploy(marketing.address, vault.address, liquidity.address);
    await STINK.deployed();
    const router = await ethers.getContractAt("IUniswapV2Router02", await STINK.router());
    const tokenAmount = parseUnits("100000", "ether");
    const ethAmount = parseUnits("100", "ether");
    await STINK.connect(owner).approve(router.address, tokenAmount);
    await router.connect(owner).addLiquidityETH(STINK.address, tokenAmount, tokenAmount, ethAmount, owner.address,(await time.latest())+3600, { value: ethAmount } );

    return { owner, user1, user2, user3, marketing, liquidity, vault, STINK, testToken, router };
  }

  describe("Buy Taxes", () => {
    it("Should have the right taxes", async ()=> {
      const { STINK } = await loadFixture(liquiditySetup);
      expect(await STINK.buyTaxes(0)).to.equal(1);
      expect(await STINK.buyTaxes(1)).to.equal(1);
      expect(await STINK.buyTaxes(2)).to.equal(1);
    })
    it("Should not charge tax if buyer is tax exempt", async ()=> {
      const { STINK, owner, router } = await loadFixture(liquiditySetup);
      const ethAmount = parseUnits("0.1", "ether");

      const amounts = (await router.getAmountsOut(ethAmount, [await router.WETH(), STINK.address]))[1];
      const ownerTokens = await STINK.balanceOf(owner.address);
      await router.connect(owner).swapExactETHForTokens(0, [await router.WETH(), STINK.address], owner.address, (await time.latest())+3600, { value: ethAmount });
      expect(await STINK.balanceOf(owner.address)).to.equal(ownerTokens.add(amounts));

    })
    it("Should charge the correct tax amount from transaction", async ()=> {
      const {STINK, user1, router} = await loadFixture(liquiditySetup);
      const ethAmount = parseUnits("0.1", "ether");
      const amounts = (await router.getAmountsOut(ethAmount, [await router.WETH(), STINK.address]))[1];
      const taxedAmount = amounts.mul(97).div(100);
      await router.connect(user1).swapExactETHForTokens(0, [await router.WETH(), STINK.address], user1.address, (await time.latest())+3600, { value: ethAmount });
      // A difference of 1e-15 is acceptable
      expect((await STINK.balanceOf(user1.address)).sub(taxedAmount)).to.be.lessThan(1000);
      expect(await STINK.marketingFee()).to.equal(amounts.mul(1).div(100));
      expect(await STINK.liquidityFee()).to.equal(amounts.mul(1).div(100));
    })
    it("Should distribute staking tax directly to vault", async ()=> {
      const {STINK, user1, router} = await loadFixture(liquiditySetup);
      const ethAmount = parseUnits("0.1", "ether");
      const amounts = (await router.getAmountsOut(ethAmount, [await router.WETH(), STINK.address]))[1];
      await router.connect(user1).swapExactETHForTokens(0, [await router.WETH(), STINK.address], user1.address, (await time.latest())+3600, { value: ethAmount });

      const stakedAmount = amounts.mul(1).div(100)
      const vaultTokens = await STINK.balanceOf(await STINK.vault());
      if(stakedAmount.gt(vaultTokens))
        expect(stakedAmount.sub(vaultTokens)).to.be.lessThan(1000);
      else
        expect(vaultTokens.sub(stakedAmount)).to.be.lessThan(1000);
      //  Marketing and LP fees
      expect(await STINK.balanceOf(STINK.address)).to.be.equal(stakedAmount.mul(2))
    })
  })
  describe("Sell Taxes", () => {
    it("Should have the right taxes", async ()=> {})
    it("Should not charge tax if seller is tax exempt", async ()=> {})
    it("Should charge the correct tax amount from transaction", async ()=> {})
    it("Should distribute staking tax directly to vault", async ()=> {})
  })
  describe("Tax distribution", () => {
    it("Should distribute ETH to the marketing wallet", async() => {})
    it("Should distribute liquidity to the liquidityVault wallet", async() => {})
  })

});