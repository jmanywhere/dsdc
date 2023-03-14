import { expect } from "chai";
import  hre, { ethers } from 'hardhat';
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers/lib/utils";

describe("STINKY", function () {

  const initBalance = parseUnits("1000000000", "ether");

  async function setup() {
    const [owner, user1, user2, user3, minter, dev] = await ethers.getSigners();
    const testTokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await testTokenFactory.deploy();
    await testToken.deployed();
    const stinkyFactory = await ethers.getContractFactory("STINKY");
    const STINKY = await stinkyFactory.deploy(minter.address, dev.address, testToken.address);
    await STINKY.deployed();
    return { owner, user1, user2, user3, minter, dev, STINKY, testToken };
  }

  describe("ERC Basic tests", function (){
    it("Should return the name", async function () {
      const { STINKY } = await loadFixture(setup);
      expect(await STINKY.name()).to.equal("STINKY");
    });
    it("Should return the symbol", async function () {
      const { STINKY } = await loadFixture(setup);
      expect(await STINKY.symbol()).to.equal("STINKY");
    });
    it("Should return the decimals", async function () {
      const { STINKY } = await loadFixture(setup);
      expect(await STINKY.decimals()).to.equal(18);
    });
    it("Should return the total supply", async function () {
      const { STINKY } = await loadFixture(setup);
      expect(await STINKY.totalSupply()).to.equal(initBalance);
    });
    it("Should return the balance of the owner", async function () {
      const { STINKY, owner } = await loadFixture(setup);
      expect(await STINKY.balanceOf(owner.address)).to.equal(initBalance);
    });
    it("Should approve allowance", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await STINKY.connect(owner).approve(user1.address, initBalance);
      expect(await STINKY.connect(owner).allowance(owner.address, user1.address)).to.equal(initBalance);
    });
    it("Should increase allowance", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await STINKY.connect(owner).increaseAllowance(user1.address, 100);
      expect(await STINKY.allowance(owner.address, user1.address)).to.equal(100);
    });
    it("Should decrease allowance", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await STINKY.connect(owner).approve(user1.address, 200);
      await STINKY.connect(owner).decreaseAllowance(user1.address, 100);
      expect(await STINKY.allowance(owner.address, user1.address)).to.equal(100);
    });
    it("Should burn tokens", async function () {
      const { STINKY, owner } = await loadFixture(setup);
      await STINKY.connect(owner).burn(100);
      expect(await STINKY.balanceOf(owner.address)).to.equal(initBalance.sub(100));
    })
    it("Should burn tokens from", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await expect(STINKY.connect(user1).burnFrom(owner.address, 100)).to.be.revertedWith("STINKY: Not enough allowance");
      await STINKY.connect(owner).approve(user1.address, 100);
      await STINKY.connect(user1).burnFrom(owner.address, 100);
      expect(await STINKY.balanceOf(owner.address)).to.equal(initBalance.sub(100));
    });
  });

  describe("Owner functions", function () {
    it("Should transfer ownership", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await STINKY.connect(owner).transferOwnership(user1.address);
      expect(await STINKY.owner()).to.equal(user1.address);
    });
    it("Should renounce ownership", async function () {
      const { STINKY, owner } = await loadFixture(setup);
      await STINKY.connect(owner).renounceOwnership();
      expect(await STINKY.owner()).to.be.equal(ethers.constants.AddressZero);
    })

    it("Should set minter", async function () {
      const { STINKY, owner, user1, minter } = await loadFixture(setup);
      expect(await STINKY.minter()).to.equal(minter.address);
      await STINKY.connect(owner).setMinter(user1.address);
      expect(await STINKY.minter()).to.equal(user1.address);
    });

    it("Should set dev", async function () {
      const { STINKY, owner, user1, dev } = await loadFixture(setup);
      expect(await STINKY.dev()).to.equal(dev.address);
      await STINKY.connect(owner).setDev(user1.address);
      expect(await STINKY.dev()).to.equal(user1.address);
    });

    it("Should exclude from fee", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);

      expect(await STINKY.taxExcluded(user1.address)).to.be.false;
      await STINKY.connect(owner).excludeFromTax(user1.address);
      expect(await STINKY.taxExcluded(user1.address)).to.be.true;
    });

    it("Should include in fee", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);

      await STINKY.connect(owner).excludeFromTax(user1.address);
      expect(await STINKY.taxExcluded(user1.address)).to.be.true;
      await STINKY.connect(owner).includeInTax(user1.address);
      expect(await STINKY.taxExcluded(user1.address)).to.be.false;
    });
    it("Should only allow minter to mint", async function () {
      const { STINKY, owner, minter } = await loadFixture(setup);
      await expect(STINKY.connect(owner).mint(100)).to.be.revertedWith("STINKY: not minter");
      await STINKY.connect(minter).mint(100);
      expect(await STINKY.balanceOf(minter.address)).to.equal(100);
    });
  })

  describe("Recovery functions", function () {
    it("Should recover ERC20", async function () {
      const { STINKY, owner, user1, dev, testToken } = await loadFixture(setup);
      await testToken.connect(owner).transfer(STINKY.address, 100);
      // anyone can call, but the tokens are sent to the dev address
      await STINKY.connect(user1).recoverToken(testToken.address);
      expect(await testToken.balanceOf(dev.address)).to.equal(100);
    });
  })

  describe("Transfers", function (){
    it("Should transfer tokens normally", async function () {
      const { STINKY, owner, user1 } = await loadFixture(setup);
      await STINKY.connect(owner).transfer(user1.address, 100);
      expect(await STINKY.balanceOf(user1.address)).to.equal(100);
    });
    it("Should charge a 20% tax on transfer after receiving tokens", async function () {
      const { STINKY, owner, user1, user2 } = await loadFixture(setup);
      await STINKY.connect(owner).transfer(user1.address, 100);
      await STINKY.connect(user1).transfer(user2.address, 100);
      expect(await STINKY.balanceOf(user1.address)).to.equal(0);
      expect(await STINKY.balanceOf(user2.address)).to.equal(80);
    });
    it("Should not charge a 20% tax after 72h have passed since receiving tokens", async () => {
      const { STINKY, owner, user1, user2,user3 } = await loadFixture(setup);
      await STINKY.connect(owner).transfer(user1.address, 200);
      await STINKY.connect(user1).transfer(user2.address, 100);
      expect(await STINKY.balanceOf(user2.address)).to.equal(80);
      // More than 72h have passed since receiving tokens 86400 blocks of 3 seconds each
      await hre.network.provider.send("hardhat_mine", ["0x15180", "0x3"])
      await STINKY.connect(user1).transfer(user3.address, 100);
      expect(await STINKY.balanceOf(user3.address)).to.equal(100);
    });
  })
});
