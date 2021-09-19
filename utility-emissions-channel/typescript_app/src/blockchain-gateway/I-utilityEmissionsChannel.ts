// I-utilityEmissionsChannel.ts : defines interface of request and response to/from
// utilityEmissionsChannel chaincode

import { 
    FabricSigningCredentialType,
    VaultTransitKey,
    WebSocketKey
} from '@brioux/cactus-plugin-ledger-connector-fabric'

export interface IEmissionRecord {
    uuid: string; //
    utilityId: string; //
    partyId: string; //
    fromDate: string; //
    thruDate: string; //
    emissionsAmount: number; //
    renewableEnergyUseAmount: number; //
    nonrenewableEnergyUseAmount: number; //
    energyUseUom: string; //
    factorSource: string; //
    url: string; //
    md5: string; //
    tokenId: string;
}

export interface IRecordEmissionsInput {
    utilityId: string;
    partyId: string;
    fromDate: string;
    thruDate: string;
    energyUseAmount: number;
    energyUseUom: string;
    url: string;
    md5: string;
}

export interface IRecordEmissionsOutput {
    info: string;
    utilityId: string;
    partyId: string;
    fromDate: string;
    thruDate: string;
    energyUseUom: string;
    emissionsAmount?: string;
    energyUseAmount?: string;
    uuid?: string;
    renewableEnergyUseAmount?: string;
    nonrenewableEnergyUseAmount?: string;
    factorSource?: string;
    url?: string;
    md5?: string;
}

export interface IUpdateEmissionsMintedTokenRequest {
    tokenId: string;
    partyId: string;
    uuids: string[];
}

// v2
export interface ICaller {
    type: FabricSigningCredentialType;
    token: string;
    username: string;
    vaultKey?: VaultTransitKey;
    webSocketKey?: WebSocketKey;
}
