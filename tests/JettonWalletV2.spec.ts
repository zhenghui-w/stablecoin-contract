import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { JettonWalletV2 } from '../wrappers/JettonWalletV2';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('JettonWalletV2', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('JettonWalletV2');
    });

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let jettonWalletV2: SandboxContract<JettonWalletV2>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        jettonWalletV2 = blockchain.openContract(JettonWalletV2.createFromConfig({}, code));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await jettonWalletV2.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonWalletV2.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and jettonWalletV2 are ready to use
    });
});
