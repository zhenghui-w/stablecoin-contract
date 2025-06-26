import {
    addressToString,
    assert,
    base64toCell,
    equalsMsgAddresses,
    formatAddressAndUrl,
    parseContentCell,
    sendToIndex
} from "../wrappers/ui-utils";
import {Address, Cell, fromNano, OpenedContract} from "@ton/core";
import {JettonMinter, parseJettonMinterData} from "../wrappers/JettonMinter";
import {NetworkProvider, UIProvider} from "@ton/blueprint";
import {fromUnits} from "./units";

export const checkJettonMinter = async (
    jettonMinterAddress: {
        isBounceable: boolean,
        isTestOnly: boolean,
        address: Address
    },
    jettonMinterCode: Cell,
    jettonWalletCode: Cell,
    provider: NetworkProvider,
    ui: UIProvider,
    isTestnet: boolean,
    silent: boolean
) => {

    const write = (message: string) => {
        if (!silent) {
            ui.write(message);
        }
    }

    // Account State and Data

    const result = await sendToIndex('account', {address: addressToString(jettonMinterAddress)}, provider);
    write('Contract status: ' + result.status);

    assert(result.status === 'active', "Contract not active", ui);
    if (base64toCell(result.code).equals(jettonMinterCode)) {
        write('The contract code matches the jetton-minter code from this repository');
    } else {
        write('The contract code DOES NOT match the jetton-minter code from this repository');
    }
    write('Toncoin balance on jetton-minter: ' + fromNano(result.balance) + ' TON');

    const data = base64toCell(result.data);
    const parsedData = parseJettonMinterData(data);
    if (parsedData.wallet_code.equals(jettonWalletCode)) {
        write('The jetton-wallet code matches the jetton-wallet code from this repository');
    } else {
        write('The jetton-wallet DOES NOT match the jetton-wallet code from this repository');
    }

    let metadataUrl: string = "";
    try {
        metadataUrl = (parsedData.jetton_content as Cell).beginParse().loadStringTail();
    } catch (e) {
        // jetton_content might be an on-chain metadata dict, we will read URL later
        metadataUrl = "<embedded>";
    }

    // Get-methods

    const jettonMinterContract: OpenedContract<JettonMinter> = provider.open(JettonMinter.createFromAddress(jettonMinterAddress.address));
    const getData = await jettonMinterContract.getJettonData();
    assert(getData.totalSupply === parsedData.supply, "Total supply doesn't match", ui);
    assert(getData.adminAddress.equals(parsedData.admin), "Admin address doesn't match", ui);

    let decimals: number | null = null;
    try {
        const parsedContent = await parseContentCell(getData.content);
        if (typeof parsedContent === 'string' || parsedContent instanceof String) {
            metadataUrl = metadataUrl === "<embedded>" ? (parsedContent as string) : metadataUrl;
        } else {
            const contentMap: any = parsedContent;
            if (metadataUrl !== "<embedded>") {
                console.assert(contentMap['uri'], metadataUrl, "Metadata URL doesn't match");
            } else if (contentMap['uri']) {
                metadataUrl = contentMap['uri'];
            }
            const decStr = contentMap['decimals'];
            const parsedDec = parseInt(decStr);
            if (!isNaN(parsedDec)) {
                decimals = parsedDec;
            }
        }
    } catch (e: any) {
        write('Warning: failed to parse on-chain content: ' + e.message);
    }

    try {
        assert(getData.walletCode.equals(parsedData.wallet_code), "Jetton-wallet code doesn't match", ui);
        const getNextAdminAddress = await jettonMinterContract.getNextAdminAddress();
        console.assert(equalsMsgAddresses(getNextAdminAddress, parsedData.transfer_admin), "Next admin address doesn't match");
    } catch {}

    // StateInit

    const jettonMinterContract2 = JettonMinter.createFromConfig({
        admin: parsedData.admin,
        wallet_code: jettonWalletCode,
        jetton_content: {
            uri: metadataUrl
        }
    }, jettonMinterCode)

    if (jettonMinterContract2.address.equals(jettonMinterAddress.address)) {
        write('StateInit matches');
    }

    // Print

    const dec = decimals ?? 0;
    write('Decimals: ' + dec);
    write('Total Supply: ' + fromUnits(parsedData.supply, dec));
    write('Mintable: ' + getData.mintable);
    write(`Metadata URL: "${metadataUrl}"`);
    write('Current admin address: ' + (await formatAddressAndUrl(parsedData.admin, provider, isTestnet)));
    const nextAdminAddress = parsedData.transfer_admin;
    if (!nextAdminAddress) {
        write('Next admin address: null');
    } else {
        write('Next admin address: ' + (await formatAddressAndUrl(nextAdminAddress, provider, isTestnet)));
    }

    return {
        jettonMinterContract,
        adminAddress: parsedData.admin,
        nextAdminAddress: parsedData.transfer_admin,
        decimals
    }
}