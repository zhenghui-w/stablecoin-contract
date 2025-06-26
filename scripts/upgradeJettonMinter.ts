import {compile, NetworkProvider} from '@ton/blueprint';
import {Address, Cell} from "@ton/core";
import {
    addressToString,
    jettonWalletCodeFromLibrary,
    promptBool,
    promptUserFriendlyAddress
} from "../wrappers/ui-utils";
import {checkJettonMinter} from "./JettonMinterChecker";
import {
    JettonMinter,
    jettonMinterConfigFullToCell,
    JettonMinterConfigFull
} from "../wrappers/JettonMinter";

export async function run(provider: NetworkProvider) {
    const isTestnet = provider.network() !== 'mainnet';

    const ui = provider.ui();

    const jettonMinterCode = await compile('JettonMinter');
    const jettonWalletCodeRaw = await compile('JettonWallet');
    const jettonWalletCode = jettonWalletCodeFromLibrary(jettonWalletCodeRaw);
    const jettonWalletV2CodeRaw = await compile('JettonWalletV2');
    const jettonWalletV2Code = jettonWalletCodeFromLibrary(jettonWalletV2CodeRaw);

    const jettonMinterAddress = await promptUserFriendlyAddress("Enter the address of the jetton minter", ui, isTestnet);

    try {
        const {
            jettonMinterContract,
            adminAddress
        } = await checkJettonMinter(jettonMinterAddress, jettonMinterCode, jettonWalletCode, provider, ui, isTestnet, true);
        console.log("HERE");

        if (!provider.sender().address!.equals(adminAddress)) {
            ui.write('You are not admin of this jetton minter');
            return;
        }

        // Fetch current on-chain data to preserve supply/content/next admin, but swap wallet code
        const getData = await jettonMinterContract.getJettonData();
        const nextAdmin = await jettonMinterContract.getNextAdminAddress();

        const newDataCell: Cell = jettonMinterConfigFullToCell({
            supply: getData.totalSupply,
            admin: adminAddress,
            transfer_admin: nextAdmin,
            wallet_code: jettonWalletV2Code,
            jetton_content: getData.content
        } as JettonMinterConfigFull);

        const newCode = await compile('JettonMinter'); // Latest minter code

        ui.write('Sending upgrade transaction…');
        const result = await jettonMinterContract.sendUpgrade(provider.sender(), newCode, newDataCell);

        ui.write('Transaction sent');

    } catch (e: any) {
        ui.write(e.message);
        return;
    }
}
