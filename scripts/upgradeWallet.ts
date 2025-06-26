import {NetworkProvider} from '@ton/blueprint';
import {toNano} from '@ton/core';
import {promptUserFriendlyAddress} from "../wrappers/ui-utils";
import {JettonWallet} from "../wrappers/JettonWallet";

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const isTestnet = provider.network() !== 'mainnet';

    // Ask for Jetton Wallet V1 address
    const walletUF = await promptUserFriendlyAddress("Enter Jetton Wallet V1 address", ui, isTestnet);
    const walletAddress = walletUF.address;

    // Ask for Jetton Minter address (master)
    const minterUF = await promptUserFriendlyAddress("Enter Jetton Minter address", ui, isTestnet);
    const minterAddress = minterUF.address;

    // Open wallet contract wrapper (code not needed, we only read)
    const walletContract = provider.open(JettonWallet.createFromAddress(walletAddress));

    // Fetch wallet data
    const walletData = await walletContract.getWalletData();
    const balance = walletData.balance;
    const status = await walletContract.getWalletStatus();

    ui.write('Sending upgrade_wallet message …');

    await walletContract.sendUpgradeWallet(provider.sender(), status, balance, walletData.owner, minterAddress, toNano('0.2'));

    ui.write('Message sent');
} 